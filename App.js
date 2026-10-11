import React, { useState, useEffect } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import * as StatusMod from './StatusScreen';
import * as ScreensMod from './Screens';

const StatusScreen = StatusMod.default || StatusMod.StatusScreen;
const { ParametersScreen, AlertsScreen, TelegramScreen, AdminScreen } = ScreensMod;

const API = 'http://192.168.1.10:8000';

async function api(path, options = {}) {
  const { headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(API + path, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(res.status + ' ' + (await res.text()));
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function useLiveState() {
  const [state, setState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [s, a] = await Promise.all([api('/state'), api('/alerts')]);
        if (alive) { setState(s); setAlerts(a); }
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { state, setState, alerts };
}

export default function App() {
  const { state, setState, alerts } = useLiveState();
  const [tab, setTab] = useState('Status');

  const missing = [];
  if (!StatusScreen) missing.push('StatusScreen (from ./StatusScreen) → exports found: ' + Object.keys(StatusMod).join(', '));
  if (!StatusMod.TabBar) missing.push('TabBar (needs "export function TabBar" in StatusScreen.js)');
  if (!ParametersScreen) missing.push('ParametersScreen');
  if (!AlertsScreen) missing.push('AlertsScreen');
  if (!TelegramScreen) missing.push('TelegramScreen');
  if (!AdminScreen) missing.push('AdminScreen');
  if (missing.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#111', padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: '#ff4b4b', fontSize: 18, marginBottom: 12 }}>Missing exports:</Text>
        {missing.map((m) => <Text key={m} style={{ color: '#fff', marginBottom: 8 }}>• {m}</Text>)}
        <Text style={{ color: '#888', marginTop: 12 }}>Screens.js exports found: {Object.keys(ScreensMod).join(', ') || 'none'}</Text>
      </SafeAreaView>
    );
  }

  if (tab === 'Parameters') return <ParametersScreen state={state} onTabPress={setTab} />;
  if (tab === 'Alerts') return <AlertsScreen alerts={alerts} onTabPress={setTab} />;
  if (tab === 'Telegram') return <TelegramScreen state={state} onTabPress={setTab} />;
  if (tab === 'Admin') return <AdminScreen state={state} setState={setState} api={api} onTabPress={setTab} />;
  return <StatusScreen state={state} onTabPress={setTab} />;
}
