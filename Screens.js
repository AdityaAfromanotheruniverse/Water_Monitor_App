import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput, TouchableOpacity,
  Linking, StatusBar, Platform, StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, fonts, radii, spacing, type } from './theme';
import { TabBar } from './StatusScreen';

const CATS = ['Physical', 'Metals', 'Chemicals', 'Pathogens'];

function Shell({ title, subtitle, active, onTabPress, children }) {
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={s.header}>
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={type.subtitle}>{subtitle}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <TabBar active={active} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

const Loading = () => <Text style={[type.subtitle, s.pad]}>Connecting to water monitor…</Text>;

/* ---------------- PARAMETERS (live readings) ---------------- */
export function ParametersScreen({ state, onTabPress }) {
  return (
    <Shell title="Parameters" subtitle="Live readings" active="Parameters" onTabPress={onTabPress}>
      {!state ? <Loading /> : CATS.map((cat) => {
        const rows = state.params.filter((p) => p.cat === cat);
        if (!rows.length) return null;
        return (
          <View key={cat}>
            <Text style={[type.sectionLabel, s.section]}>{cat.toUpperCase()}</Text>
            <View style={s.list}>
              {rows.map((p) => {
                const tone = p.violated ? colors.red : colors.green;
                return (
                  <View key={p.key} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.body}>{p.label}</Text>
                      <Text style={type.cardNote}>Limit: {p.limit}</Text>
                    </View>
                    <Text style={[s.value, { color: tone }]}>
                      {Number(p.value).toFixed(p.dec)} {p.unit}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </Shell>
  );
}

/* ---------------- ALERTS ---------------- */
export function AlertsScreen({ alerts, onTabPress }) {
  return (
    <Shell title="Alerts" subtitle="Recent alerts" active="Alerts" onTabPress={onTabPress}>
      <View style={s.list}>
        {(!alerts || alerts.length === 0) && <Text style={type.subtitle}>No alerts yet.</Text>}
        {(alerts || []).map((a, i) => (
          <View key={i} style={s.alertBox}>
            <Text style={{ color: a.key === 'clear' ? colors.green : colors.red, fontFamily: fonts.bold, fontSize: 13 }}>
              {a.time} · {a.label}
            </Text>
            <Text style={type.cardNote}>{a.text}</Text>
            {a.what ? <><Text style={s.sub}>What to do</Text><Text style={type.cardNote}>{a.what}</Text></> : null}
            {a.watch ? <><Text style={s.sub}>Watch for</Text><Text style={type.cardNote}>{a.watch}</Text></> : null}
            {a.urgent ? <><Text style={s.sub}>Get medical help immediately if</Text><Text style={type.cardNote}>{a.urgent}</Text></> : null}
          </View>
        ))}
      </View>
    </Shell>
  );
}

/* ---------------- TELEGRAM ---------------- */
export function TelegramScreen({ state, onTabPress }) {
  const openBot = () => Linking.openURL('https://t.me/' + state.telegram_bot + '?start=subscribe');
  return (
    <Shell title="Telegram" subtitle="Get alerts on your phone" active="Telegram" onTabPress={onTabPress}>
      {!state ? <Loading /> : (
        <View style={s.list}>
          {state.telegram_bot ? (
            <View style={s.card}>
              <Text style={type.cardNote}>
                Tap the button, then press Start in Telegram. You will get an alert the moment the water becomes
                unsafe, with what to do, symptoms to watch for, and when to get medical help. Send /stop to unsubscribe.
              </Text>
              <TouchableOpacity style={s.btn} onPress={openBot}>
                <Text style={s.btnText}>Open @{state.telegram_bot} in Telegram</Text>
              </TouchableOpacity>
              <Text style={type.cardNote}>Subscribers: {state.subscribers}</Text>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={type.cardNote}>
                Telegram bot not connected. Add TELEGRAM_BOT_TOKEN to the backend .env file and restart the backend.
              </Text>
            </View>
          )}
        </View>
      )}
    </Shell>
  );
}

/* ---------------- ADMIN ---------------- */
export function AdminScreen({ state, setState, api, onTabPress }) {
  const [adminKey, setAdminKey] = useState('');
  const [local, setLocal] = useState({});
  const [status, setStatus] = useState('');
  const headers = { 'X-Admin-Key': adminKey.trim() };

  const send = async (key, value) => {
    try {
      const st = await api('/admin/levels', { method: 'POST', headers, body: JSON.stringify({ values: { [key]: value } }) });
      setState(st);
      setStatus('✅ Updated ' + key + ' = ' + value);
    } catch (e) { setStatus('❌ Update failed: ' + String(e.message)); }
    setLocal((l) => { const n = { ...l }; delete n[key]; return n; });
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
      setStatus(r.subscribers > 0 ? '✅ Test alert sent to ' + r.subscribers + ' subscriber(s)'
        : '⚠️ Nobody is subscribed yet. Open the bot from the Telegram tab and press Start.');
    } catch (e) { setStatus('❌ Test alert failed: ' + String(e.message)); }
  };

  const statusColor = status.startsWith('❌') ? colors.red : status.startsWith('⚠️') ? '#f5a623' : colors.green;

  return (
    <Shell title="Admin" subtitle="Simulate water levels" active="Admin" onTabPress={onTabPress}>
      {!state ? <Loading /> : (
        <View style={s.list}>
          <View style={s.card}>
            <TextInput
              style={s.input} value={adminKey} onChangeText={setAdminKey}
              placeholder="Admin key" placeholderTextColor={colors.muted}
              autoCapitalize="none" autoCorrect={false} secureTextEntry
            />
            {status ? <Text style={{ color: statusColor, fontSize: 12 }}>{status}</Text> : null}
            <Text style={type.cardNote}>Telegram subscribers: {state.subscribers}</Text>
            <View style={s.chipRow}>
              <Chip text="Acceptable limit" active={state.mode === 'acc'} onPress={() => setMode('acc')} />
              <Chip text="Permissible limit" active={state.mode === 'perm'} onPress={() => setMode('perm')} />
            </View>
            <TouchableOpacity style={s.btn} onPress={reset}><Text style={s.btnText}>Reset all to safe values</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#2a7f62' }]} onPress={testAlert}>
              <Text style={s.btnText}>Send test alert to Telegram</Text>
            </TouchableOpacity>
          </View>

          {CATS.map((cat) => (
            <View key={cat} style={s.card}>
              <Text style={[type.sectionLabel, { marginBottom: 8 }]}>{cat.toUpperCase()}</Text>
              {state.params.filter((p) => p.cat === cat).map((p) => {
                const v = local[p.key] !== undefined ? local[p.key] : p.value;
                const tone = p.violated ? colors.red : colors.green;
                return (
                  <View key={p.key} style={{ paddingVertical: 6 }}>
                    <View style={s.between}>
                      <Text style={type.body}>{p.label}</Text>
                      <Text style={[s.value, { color: tone }]}>{Number(v).toFixed(p.dec)} {p.unit}</Text>
                    </View>
                    <Slider
                      minimumValue={p.vmin} maximumValue={p.vmax} step={p.step} value={v}
                      minimumTrackTintColor={colors.blue} maximumTrackTintColor={colors.line} thumbTintColor={colors.blue}
                      onValueChange={(val) => setLocal((l) => ({ ...l, [p.key]: val }))}
                      onSlidingComplete={(val) => send(p.key, val)}
                    />
                    <View style={s.between}>
                      <Text style={type.cardNote}>Limit: {p.limit}</Text>
                      <Text style={{ color: tone, fontSize: 11 }}>{p.violated ? 'UNSAFE' : 'OK'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </Shell>
  );
}

function Chip({ text, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
      <Text style={{ color: active ? '#000' : colors.text, fontWeight: '600', fontSize: 12 }}>{text}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 },
  header: { paddingHorizontal: spacing.page, paddingTop: 8, paddingBottom: 16 },
  scroll: { paddingBottom: 16 },
  pad: { padding: spacing.page },
  section: { paddingHorizontal: spacing.page, paddingTop: 16, paddingBottom: 8 },
  list: { gap: spacing.gap, paddingHorizontal: spacing.page },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.row, backgroundColor: colors.card },
  value: { fontFamily: fonts.semiBold, fontSize: 13 },
  card: { gap: 8, padding: 14, borderRadius: radii.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  alertBox: { gap: 4, padding: 14, borderRadius: radii.card, backgroundColor: colors.card },
  sub: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 11, marginTop: 6 },
  input: { backgroundColor: colors.bg, color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10 },
  btn: { backgroundColor: colors.blue, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
