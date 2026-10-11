import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, ScrollView, TouchableOpacity,
  Animated, Easing, StyleSheet, StatusBar, Linking,
} from 'react-native';
import Slider from '@react-native-community/slider';

// >>> PUT YOUR COMPUTER'S IPv4 ADDRESS HERE (from `ipconfig`), keep http:// and :8000 <<<
const API = 'http:/192.168.1.10:8000';
const BUILD = 'build 3';   // if you do not see "build 3" on screen, you are running a different App.js

const CATS = ['Physical', 'Metals', 'Chemicals', 'Pathogens'];
const CAT_TITLE = {
  Physical: '🧪 Physical / General',
  Metals: '🔩 Metals',
  Chemicals: '☣️ Hazardous Chemicals',
  Pathogens: '🦠 Pathogens',
};

// ---------- helpers ----------
async function api(path, options = {}) {
  const { headers, ...rest } = options;          // keep Content-Type even when extra headers are sent
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(API + path, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(res.status + ' ' + (t || ''));
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Poll the backend so every screen shows live state
function useLiveState() {
  const [state, setState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [s, a] = await Promise.all([api('/state'), api('/alerts')]);
        if (alive) { setState(s); setAlerts(a); setError(null); }
      } catch (e) {
        if (alive) setError('Cannot reach server at ' + API + ' (' + String(e.message) + ')');
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { state, setState, alerts, error };
}

// ---------- animated pipe (simple flowing blue dashes) ----------
function Pipe({ label, flowing }) {
  const x = useRef(new Animated.Value(0)).current;
  const loop = useRef(null);
  useEffect(() => {
    if (flowing) {
      x.setValue(0);
      loop.current = Animated.loop(
        Animated.timing(x, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      );
      loop.current.start();
    } else if (loop.current) {
      loop.current.stop();
    }
    return () => loop.current && loop.current.stop();
  }, [flowing]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={styles.pipeLabel}>{label}</Text>
      <View style={[styles.pipe, { backgroundColor: flowing ? '#1e78dc' : '#33383f' }]}>
        {flowing && (
          <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }], marginLeft: -28 }}>
            {Array.from({ length: 30 }).map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function PipelineCard({ state }) {
  const open = state.city_open;
  return (
    <View style={styles.card}>
      <Text style={[styles.banner, { color: open ? '#28a745' : '#ff4b4b' }]}>
        {open ? '✅ Water is safe: city valve OPEN'
              : '🚨 UNSAFE: ' + state.params.filter(p => p.violated).map(p => p.label).join(', ') + '. City valve CLOSED'}
      </Text>
      <Pipe label="🏭 Plant → 🏙️ City" flowing={open} />
      <Pipe label="🏭 Plant → 🧪 Tester (never stops)" flowing={true} />
    </View>
  );
}

// ---------- ADMIN ----------
function AdminScreen({ state, setState }) {
  const [adminKey, setAdminKey] = useState('mypassword');
  const [local, setLocal] = useState({});     // slider values while dragging
  const [status, setStatus] = useState('');   // result of the last action, shown on screen

  const headers = { 'X-Admin-Key': adminKey.trim() };

  const send = async (key, value) => {
    try {
      const s = await api('/admin/levels', { method: 'POST', headers, body: JSON.stringify({ values: { [key]: value } }) });
      setState(s);
      setStatus('✅ Updated ' + key + ' = ' + value);
    } catch (e) {
      setStatus('❌ Update failed: ' + String(e.message));
    }
    // drop the local value so the slider snaps to what the SERVER has
    setLocal(l => { const n = { ...l }; delete n[key]; return n; });
  };
  const setMode = async (mode) => {
    try { setState(await api('/admin/mode', { method: 'POST', headers, body: JSON.stringify({ mode }) })); setStatus('✅ Mode changed'); }
    catch (e) { setStatus('❌ Mode change failed: ' + String(e.message)); }
  };
  const reset = async () => {
    try { setLocal({}); setState(await api('/admin/reset', { method: 'POST', headers })); setStatus('✅ Reset to safe values'); }
    catch (e) { setStatus('❌ Reset failed: ' + String(e.message)); }
  };
  const testAlert = async () => {
    try {
      const r = await api('/admin/test-alert', { method: 'POST', headers });
      setStatus(r.subscribers > 0
        ? '✅ Test alert sent to ' + r.subscribers + ' Telegram subscriber(s)'
        : '⚠️ Nobody is subscribed yet. Open the bot from the User tab and press Start.');
    } catch (e) { setStatus('❌ Test alert failed: ' + String(e.message)); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <PipelineCard state={state} />

      <View style={styles.card}>
        <Text style={styles.h2}>Admin settings</Text>
        <TextInput style={styles.input} value={adminKey} onChangeText={setAdminKey}
          placeholder="Admin key" placeholderTextColor="#666"
          autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.small}>Key being sent: "{adminKey.trim()}" ({adminKey.trim().length} characters)</Text>
        <Text style={{ color: status.startsWith('❌') ? '#ff4b4b' : status.startsWith('⚠️') ? '#f5a623' : '#28a745', fontSize: 12, marginTop: 6 }}>{status}</Text>
        <Text style={styles.small}>Telegram subscribers: {state.subscribers}</Text>
        <View style={styles.rowBtns}>
          <Chip text="Acceptable limit" active={state.mode === 'acc'} onPress={() => setMode('acc')} />
          <Chip text="Permissible limit" active={state.mode === 'perm'} onPress={() => setMode('perm')} />
        </View>
        <TouchableOpacity style={styles.btn} onPress={reset}><Text style={styles.btnText}>♻️ Reset all to safe values</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#2a7f62' }]} onPress={testAlert}>
          <Text style={styles.btnText}>🧪 Send test alert to Telegram</Text>
        </TouchableOpacity>
      </View>

      {CATS.map(cat => (
        <View key={cat} style={styles.card}>
          <Text style={styles.h2}>{CAT_TITLE[cat]}</Text>
          {state.params.filter(p => p.cat === cat).map(p => {
            const v = local[p.key] !== undefined ? local[p.key] : p.value;
            const bad = p.violated;
            return (
              <View key={p.key} style={[styles.paramRow, bad && { backgroundColor: 'rgba(255,75,75,0.10)' }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.text}>{p.label}</Text>
                  <Text style={{ color: bad ? '#ff4b4b' : '#28a745', fontFamily: 'Courier' }}>
                    {Number(v).toFixed(p.dec)} {p.unit}
                  </Text>
                </View>
                <Slider
                  minimumValue={p.vmin} maximumValue={p.vmax} step={p.step} value={v}
                  minimumTrackTintColor="#00c0f2" maximumTrackTintColor="#444" thumbTintColor="#00c0f2"
                  onValueChange={(val) => setLocal(l => ({ ...l, [p.key]: val }))}
                  onSlidingComplete={(val) => { send(p.key, val); }}
                />
                <View style={styles.rowBetween}>
                  <Text style={styles.small}>Limit: {p.limit}</Text>
                  <Text style={{ color: bad ? '#ff4b4b' : '#28a745', fontSize: 11 }}>{bad ? '🚨 UNSAFE' : '✅ OK'}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// ---------- USER ----------
function UserScreen({ state, alerts }) {
  const openBot = () => Linking.openURL('https://t.me/' + state.telegram_bot + '?start=subscribe');

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <PipelineCard state={state} />

      <View style={styles.card}>
        <Text style={styles.h2}>✈️ Get alerts on Telegram</Text>
        {state.telegram_bot ? (
          <>
            <Text style={styles.small}>
              Tap the button, then press Start in Telegram. You will get an alert automatically the moment the water
              becomes unsafe, with what to do, symptoms to watch for, and when to get medical help. Send /stop to unsubscribe.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={openBot}>
              <Text style={styles.btnText}>Open @{state.telegram_bot} in Telegram</Text>
            </TouchableOpacity>
            <Text style={styles.small}>Telegram subscribers: {state.subscribers}</Text>
          </>
        ) : (
          <Text style={styles.small}>
            Telegram bot not connected. Add TELEGRAM_BOT_TOKEN to the backend .env file and restart the backend.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Recent alerts</Text>
        {alerts.length === 0 && <Text style={styles.small}>No alerts yet.</Text>}
        {alerts.map((a, i) => (
          <View key={i} style={styles.alertBox}>
            <Text style={{ color: a.key === 'clear' ? '#28a745' : '#ff4b4b', fontWeight: 'bold' }}>{a.time} · {a.label}</Text>
            <Text style={styles.small}>{a.text}</Text>
            {a.what ? (<><Text style={styles.sub}>What to do</Text><Text style={styles.small}>{a.what}</Text></>) : null}
            {a.watch ? (<><Text style={styles.sub}>Watch for</Text><Text style={styles.small}>{a.watch}</Text></>) : null}
            {a.urgent ? (<><Text style={styles.sub}>Get medical help immediately if</Text><Text style={styles.small}>{a.urgent}</Text></>) : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Live readings</Text>
        {state.params.map(p => (
          <View key={p.key} style={styles.rowBetween}>
            <Text style={styles.text}>{p.label}</Text>
            <Text style={{ color: p.violated ? '#ff4b4b' : '#28a745' }}>
              {Number(p.value).toFixed(p.dec)} {p.unit} {p.violated ? '🚨' : '✅'}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Chip({ text, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && { backgroundColor: '#00c0f2' }]}>
      <Text style={{ color: active ? '#000' : '#ccc', fontWeight: '600' }}>{text}</Text>
    </TouchableOpacity>
  );
}

// ---------- APP ----------
export default function App() {
  const [tab, setTab] = useState('user');
  const { state, setState, alerts, error } = useLiveState();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>💧 Water Quality Monitor</Text>
      <Text style={[styles.small, { textAlign: 'center' }]}>{BUILD} · server: {API}</Text>
      <View style={styles.tabs}>
        <Chip text="👤 User" active={tab === 'user'} onPress={() => setTab('user')} />
        <Chip text="🛠️ Admin" active={tab === 'admin'} onPress={() => setTab('admin')} />
      </View>
      {error && <Text style={{ color: '#ff4b4b', textAlign: 'center', paddingHorizontal: 12 }}>{error}</Text>}
      {!state ? <Text style={[styles.small, { textAlign: 'center' }]}>Connecting…</Text>
        : tab === 'admin' ? <AdminScreen state={state} setState={setState} />
        : <UserScreen state={state} alerts={alerts} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111', paddingTop: 30 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 8 },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 6 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#333', padding: 12, marginBottom: 12 },
  h2: { color: '#00c0f2', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  text: { color: '#ddd', fontSize: 13 },
  small: { color: '#888', fontSize: 11, marginTop: 4 },
  sub: { color: '#ccc', fontSize: 11, fontWeight: 'bold', marginTop: 6 },
  banner: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  input: { backgroundColor: '#111', color: '#eee', borderWidth: 1, borderColor: '#444', borderRadius: 8, padding: 10, marginBottom: 8 },
  btn: { backgroundColor: '#1e78dc', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  rowBtns: { flexDirection: 'row', gap: 10, marginVertical: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#444', backgroundColor: '#1a1a1a' },
  paramRow: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6 },
  alertBox: { marginVertical: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  pipe: { height: 14, borderRadius: 7, overflow: 'hidden', justifyContent: 'center' },
  pipeLabel: { color: '#aaa', fontSize: 11, marginBottom: 3 },
  dash: { width: 14, height: 3, backgroundColor: 'rgba(190,230,255,0.9)', marginRight: 14, borderRadius: 2 },
});
