"""
Water monitoring backend (Telegram edition)

 - Holds the current water levels (admin app moves them; real sensors would call the same function)
 - Evaluates every parameter against IS 10500 on EVERY update
 - Closes the city valve if anything is unsafe (tester line never stops)
 - Sends a full alert (what to do / symptoms / when to get help) to every Telegram subscriber
   the moment a parameter crosses its limit
 - Subscribers are saved to telegram_chats.json so they survive restarts

Run (from this folder, ONE copy only):
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os
import time
import json
import html
import threading
from typing import Dict, List

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from params import PARAMS, PARAM_BY_KEY, ADVICE, FOOTER

load_dotenv()
ADMIN_KEY = os.getenv("ADMIN_KEY", "admin123")
COOLDOWN = int(os.getenv("ALERT_COOLDOWN_SECONDS", "60"))          # min seconds between repeat alerts per parameter
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "").strip().lstrip("@")   # auto-detected if empty
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram_chats.json")

app = FastAPI(title="Water Monitor")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
lock = threading.Lock()
values: Dict[str, float] = {p["key"]: p["default"] for p in PARAMS}
mode = "acc"                              # "acc" = acceptable limit, "perm" = permissible limit
telegram_chats: Dict[str, str] = {}       # telegram chat_id -> first name (saved to disk)
active_alerts: set = set()                # parameter keys currently unsafe
last_sent: Dict[str, float] = {}          # parameter key -> time of last alert
alert_pending_clear = False               # True once an alert went out, so we can send "all clear"
alert_log: List[dict] = []                # recent alerts, shown in the app


def load_chats():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            telegram_chats.update(json.load(f))
        print(f"Loaded {len(telegram_chats)} saved Telegram subscriber(s)")
    except FileNotFoundError:
        pass
    except Exception as e:
        print("Could not read", DATA_FILE, e)


def save_chats():
    """Call while holding `lock` or right after changing telegram_chats."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(telegram_chats, f)
    except Exception as e:
        print("Could not save", DATA_FILE, e)


# ---------------------------------------------------------------------------
# Safety evaluation
# ---------------------------------------------------------------------------
def limit_of(p):
    return p["acc"] if mode == "acc" else p["perm"]


def is_violated(p, v) -> bool:
    if p["is_range"]:
        return v < 6.5 or v > 8.5
    return v > limit_of(p)


def limit_text(p) -> str:
    if p["is_range"]:
        return "6.5 - 8.5"
    if p["cat"] == "Pathogens":
        return "Absent (0)"
    return f"<= {limit_of(p):g} {p['unit']}"


def ratio_of(p, v) -> float:
    if p["is_range"]:
        return abs(v - 7.5) / 1.0
    lim = limit_of(p)
    if lim == 0:
        return 1.0 if v > 0 else 0.0
    return v / lim


def snapshot() -> dict:
    rows, bad = [], []
    for p in PARAMS:
        v = values[p["key"]]
        viol = is_violated(p, v)
        if viol:
            bad.append(p["key"])
        rows.append(dict(key=p["key"], label=p["label"], unit=p["unit"], cat=p["cat"],
                         value=v, limit=limit_text(p), violated=viol, ratio=round(ratio_of(p, v), 3),
                         dec=p["dec"], vmin=p["vmin"], vmax=p["vmax"], step=p["step"]))
    return dict(params=rows, violations=bad, city_open=(len(bad) == 0),
                tester_flowing=True, mode=mode,
                telegram_bot=TELEGRAM_BOT_USERNAME, subscribers=len(telegram_chats))


# ---------------------------------------------------------------------------
# Telegram messaging
# ---------------------------------------------------------------------------
def send_telegram(chat_id: str, text: str, use_html: bool = False):
    tag = f"[TELEGRAM -> {chat_id}]"
    if not TELEGRAM_TOKEN:
        print(f"\n{tag} (no token, not sent)\n{text}\n")
        return
    payload = {"chat_id": chat_id, "text": text}
    if use_html:
        payload["parse_mode"] = "HTML"
    try:
        r = requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage", json=payload, timeout=15)
        if r.status_code >= 300:
            raise RuntimeError(f"{r.status_code} {r.text}")
        print(f"{tag} sent")
    except Exception as e:
        print(f"{tag} FAILED: {e}")


def build_alert(key: str, test: bool = False) -> str:
    p, a, v = PARAM_BY_KEY[key], ADVICE[key], values[key]
    e = html.escape
    reading = f"{v:.{p['dec']}f} {p['unit']}".strip()
    title = "🧪 TEST ALERT (not a real emergency)" if test else "🚨 WATER ALERT"
    return (f"<b>{title}: {e(p['label'])}</b>\n"
            f"Reading: <b>{e(reading)}</b> (safe limit: {e(limit_text(p))})\n"
            f"City supply has been paused automatically.\n\n"
            f"<b>What to do</b>\n{e(a['what'])}\n\n"
            f"<b>Watch for</b>\n{e(a['watch'])}\n\n"
            f"<b>Get medical help immediately if</b>\n{e(a['urgent'])}\n\n"
            f"<i>{e(FOOTER)}</i>")


def build_all_clear() -> str:
    return ("✅ <b>Water update</b>\nAll parameters are back within safe limits and city supply has resumed.\n\n"
            f"<i>{html.escape(FOOTER)}</i>")


def notify(keys: List[str] = None, all_clear: bool = False, test: bool = False):
    """Runs in a background task so the admin's slider request returns instantly."""
    with lock:
        chats = list(telegram_chats)
    what = "all-clear" if all_clear else str(keys)
    print(f"Sending {what} to {len(chats)} Telegram subscriber(s)")
    if not chats:
        print("  -> nobody subscribed yet: open the bot in Telegram and press Start")
    for chat in chats:
        if all_clear:
            send_telegram(chat, build_all_clear(), use_html=True)
        else:
            for k in keys:
                send_telegram(chat, build_alert(k, test), use_html=True)


def status_text() -> str:
    with lock:
        s = snapshot()
    if s["city_open"]:
        return "✅ Water is currently safe. City supply is open."
    names = [r["label"] for r in s["params"] if r["violated"]]
    return "🚨 Water is UNSAFE: " + ", ".join(names) + ". City supply is paused."


# ---------------------------------------------------------------------------
# Telegram bot: anyone who presses Start on the bot is subscribed automatically
# ---------------------------------------------------------------------------
def telegram_poll():
    offset = None
    print("Telegram bot polling started")
    while True:
        try:
            r = requests.get(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates",
                             params={"timeout": 25, "offset": offset}, timeout=35).json()
            for u in r.get("result", []):
                offset = u["update_id"] + 1
                m = u.get("message") or {}
                chat = str(m.get("chat", {}).get("id", ""))
                text = (m.get("text") or "").strip().lower()
                name = m.get("from", {}).get("first_name", "")
                if not chat:
                    continue
                if text.startswith("/start"):
                    with lock:
                        telegram_chats[chat] = name
                        save_chats()
                    print(f"Subscribed Telegram chat {chat} ({name})")
                    send_telegram(chat, "✅ Subscribed to water quality alerts.\n\n"
                                        "You will get a message immediately if the water becomes unsafe, with what to do "
                                        "and symptoms to watch for.\n\n/status - current water status\n/stop - unsubscribe")
                elif text.startswith("/stop"):
                    with lock:
                        telegram_chats.pop(chat, None)
                        save_chats()
                    send_telegram(chat, "Unsubscribed. Send /start to subscribe again.")
                elif text.startswith("/status"):
                    send_telegram(chat, status_text())
        except Exception as e:
            print("Telegram poll error:", e)
            time.sleep(5)


@app.on_event("startup")
def start_telegram():
    global TELEGRAM_BOT_USERNAME
    load_chats()
    if not TELEGRAM_TOKEN:
        print("Telegram disabled: no TELEGRAM_BOT_TOKEN in .env (alerts will only print here)")
        return
    try:   # find the bot's username automatically so the app can link to it
        me = requests.get(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getMe", timeout=15).json()
        if me.get("ok") and not TELEGRAM_BOT_USERNAME:
            TELEGRAM_BOT_USERNAME = me["result"]["username"]
        print("Telegram bot:", TELEGRAM_BOT_USERNAME or me)
    except Exception as e:
        print("Could not reach Telegram:", e)
    threading.Thread(target=telegram_poll, daemon=True).start()


# ---------------------------------------------------------------------------
# Core: apply new levels, decide valve + alerts (called by admin sliders or real sensors)
# ---------------------------------------------------------------------------
def apply_levels(new_vals: Dict[str, float], bg: BackgroundTasks):
    global active_alerts, alert_pending_clear
    with lock:
        for k, v in new_vals.items():
            p = PARAM_BY_KEY.get(k)
            if p is None:
                continue
            values[k] = round(max(p["vmin"], min(p["vmax"], float(v))), p["dec"])

        now_bad = {p["key"] for p in PARAMS if is_violated(p, values[p["key"]])}
        newly = now_bad - active_alerts
        to_alert = [k for k in newly if time.time() - last_sent.get(k, 0) >= COOLDOWN]
        became_safe = bool(active_alerts) and not now_bad and alert_pending_clear
        active_alerts = now_bad

        for k in to_alert:
            a = ADVICE[k]
            last_sent[k] = time.time()
            alert_log.insert(0, dict(time=time.strftime("%H:%M:%S"), key=k, label=PARAM_BY_KEY[k]["label"],
                                     text=a["short"], what=a["what"], watch=a["watch"], urgent=a["urgent"]))
        del alert_log[30:]
        if to_alert:
            alert_pending_clear = True
        if became_safe:
            alert_pending_clear = False
            alert_log.insert(0, dict(time=time.strftime("%H:%M:%S"), key="clear", label="All clear",
                                     text="All parameters back within safe limits.", what="", watch="", urgent=""))

    if to_alert:
        print("ALERT TRIGGERED:", to_alert)
        bg.add_task(notify, keys=to_alert)
    if became_safe:
        print("ALL CLEAR")
        bg.add_task(notify, all_clear=True)


def require_admin(key: str):
    if key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Bad admin key")


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
class LevelsUpdate(BaseModel):
    values: Dict[str, float]


class ModeUpdate(BaseModel):
    mode: str


@app.get("/state")
def get_state():
    with lock:
        return snapshot()


@app.get("/alerts")
def get_alerts():
    with lock:
        return alert_log


@app.post("/admin/levels")
def admin_levels(body: LevelsUpdate, bg: BackgroundTasks, x_admin_key: str = Header(default="")):
    require_admin(x_admin_key)
    apply_levels(body.values, bg)
    with lock:
        return snapshot()


@app.post("/admin/mode")
def admin_mode(body: ModeUpdate, bg: BackgroundTasks, x_admin_key: str = Header(default="")):
    global mode
    require_admin(x_admin_key)
    if body.mode not in ("acc", "perm"):
        raise HTTPException(400, "mode must be 'acc' or 'perm'")
    mode = body.mode
    apply_levels({}, bg)            # re-evaluate with the new limits
    with lock:
        return snapshot()


@app.post("/admin/reset")
def admin_reset(bg: BackgroundTasks, x_admin_key: str = Header(default="")):
    require_admin(x_admin_key)
    apply_levels({p["key"]: p["default"] for p in PARAMS}, bg)
    with lock:
        return snapshot()


@app.post("/admin/test-alert")
def admin_test_alert(bg: BackgroundTasks, x_admin_key: str = Header(default="")):
    """Sends a sample fluoride alert to every Telegram subscriber without changing any water levels."""
    require_admin(x_admin_key)
    with lock:
        n = len(telegram_chats)
    bg.add_task(notify, keys=["f"], test=True)
    return {"ok": True, "subscribers": n}
