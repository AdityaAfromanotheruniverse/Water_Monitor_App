// StatusScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, radii, spacing, type } from './theme';
import { API_BASE, POLL_MS } from './config';

const TABS = ['Status', 'Parameters', 'Alerts', 'Telegram', 'Admin'];

/* ------------------------------------------------------------------ data */

function useWaterState(enabled) {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/state`);
        const json = await res.json();
        if (alive) {
          setState(json);
          setOnline(true);
        }
      } catch (e) {
        if (alive) setOnline(false);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled]);

  return { state, online };
}

// Group /state params by category -> [{ name, total, unsafe }]
function summarizeCategories(params) {
  const order = [];
  const map = {};
  params.forEach((p) => {
    if (!map[p.cat]) {
      map[p.cat] = { name: p.cat, total: 0, unsafe: 0 };
      order.push(p.cat);
    }
    map[p.cat].total += 1;
    if (p.violated) map[p.cat].unsafe += 1;
  });
  return order.map((c) => map[c]);
}

/* ------------------------------------------------------------ components */

function Header({ safe, alertCount, online }) {
  const tone = safe ? colors.green : colors.red;
  return (
    <View style={styles.header}>
      <View>
        <Text style={type.title}>Water Status</Text>
        <Text style={type.subtitle}>
          {online ? 'Live · updated just now' : 'Offline · retrying'}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          { backgroundColor: safe ? colors.greenDim : colors.redDim, borderColor: tone },
        ]}
      >
        <Text style={[styles.badgeText, { color: tone }]}>
          {safe ? 'ALL SAFE' : `${alertCount} ALERTS`}
        </Text>
      </View>
    </View>
  );
}

function Hero({ safe, paramCount, unsafeLabels }) {
  const tone = safe ? colors.green : colors.red;
  return (
    <View style={[styles.hero, { backgroundColor: safe ? colors.greenDim : colors.redDim }]}>
      <View style={[styles.heroRing, { borderColor: tone }]} />
      <Text style={[styles.heroTitle, { color: tone }]}>
        {safe ? 'WATER IS SAFE' : 'WATER IS UNSAFE'}
      </Text>
      <Text style={styles.heroSub}>
        {safe
          ? `All ${paramCount} parameters within IS 10500 limits`
          : `${unsafeLabels.join(', ')} above limit`}
      </Text>
    </View>
  );
}

function SupplyCard({ label, value, note, tone }) {
  return (
    <View style={[styles.supplyCard, { borderColor: tone }]}>
      <Text style={type.cardLabel}>{label}</Text>
      <Text style={[type.cardValue, { color: tone }]}>{value}</Text>
      <Text style={type.cardNote}>{note}</Text>
    </View>
  );
}

// Water-flow strip. Droplets slide along a pipe; `period` is the droplet spacing
// and `speed` (px/s) is how fast they move, so the two lines visibly differ.
function FlowStrip({ label, active, labelColor, dotColor, period, speed }) {
  const [width, setWidth] = useState(335);
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shift.setValue(0);
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.timing(shift, {
        toValue: period,
        duration: (period / speed) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [active, period, speed, shift]);

  const count = Math.ceil(width / period) + 2;
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  return (
    <View style={styles.strip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.pipe} />
      <Text style={[styles.stripLabel, { color: labelColor }]}>{label}</Text>
      {active && (
        <Animated.View
          style={[
            styles.dotLayer,
            { width: count * period, transform: [{ translateX: shift }] },
          ]}
        >
          {dots.map((i) => (
            <View
              key={i}
              style={[styles.dot, { left: i * period - period, backgroundColor: dotColor }]}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function CategoryRow({ name, total, unsafe }) {
  const tone = unsafe === 0 ? colors.green : colors.red;
  return (
    <View style={styles.catRow}>
      <Text style={type.body}>{name}</Text>
      <View style={styles.catRight}>
        <View style={[styles.catDot, { backgroundColor: tone }]} />
        <Text style={[styles.catText, { color: tone }]}>
          {unsafe} of {total} unsafe
        </Text>
      </View>
    </View>
  );
}

export function TabBar({ active, onTabPress }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const on = t === active;
        return (
          <TouchableOpacity key={t} style={styles.tab} onPress={() => onTabPress && onTabPress(t)}>
            <View style={[styles.tabDot, { backgroundColor: on ? colors.blue : colors.muted }]} />
            <Text
              style={[
                styles.tabText,
                { color: on ? colors.text : colors.muted, fontFamily: on ? fonts.semiBold : fonts.medium },
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------- screen */

export default function StatusScreen({ state: stateProp, onTabPress }) {
  const live = useWaterState(stateProp === undefined);
  const state = stateProp !== undefined ? stateProp : live.state;
  const online = stateProp !== undefined ? true : live.online;

  if (!state) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.blue} />
        <Text style={[type.subtitle, { marginTop: 12 }]}>
          {online ? 'Connecting to water monitor…' : `Can't reach ${API_BASE}. Retrying…`}
        </Text>
      </SafeAreaView>
    );
  }

  const unsafeParams = state.params.filter((p) => p.violated);
  const safe = state.violations.length === 0;
  const cityOpen = state.city_open;
  const testerFlowing = state.tester_flowing;
  const categories = summarizeCategories(state.params);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <Header safe={safe} alertCount={state.violations.length} online={online} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Hero
          safe={safe}
          paramCount={state.params.length}
          unsafeLabels={unsafeParams.map((p) => p.label)}
        />

        <Text style={[type.sectionLabel, styles.sectionLabel]}>SUPPLY LINES</Text>
        <View style={styles.supplyRow}>
          <SupplyCard
            label="CITY VALVE"
            value={cityOpen ? 'OPEN' : 'CLOSED'}
            note={cityOpen ? 'Supplying the city' : 'Paused automatically'}
            tone={cityOpen ? colors.green : colors.red}
          />
          <SupplyCard
            label="TESTER LINE"
            value={testerFlowing ? 'FLOWING' : 'STOPPED'}
            note="Always on"
            tone={testerFlowing ? colors.green : colors.red}
          />
        </View>

        <View style={styles.stripWrap}>
          <FlowStrip
            label={cityOpen ? 'City line · supply open' : 'City line · closed'}
            active={cityOpen}
            labelColor={cityOpen ? colors.textBlue : colors.red}
            dotColor={colors.textBlue}
            period={60}
            speed={83}
          />
        </View>
        <View style={styles.stripWrap}>
          <FlowStrip
            label="Tester line · always flowing"
            active={testerFlowing}
            labelColor={colors.green}
            dotColor={colors.green}
            period={80}
            speed={111}
          />
        </View>

        <Text style={[type.sectionLabel, styles.sectionLabel, { paddingTop: 20 }]}>
          PARAMETERS BY CATEGORY
        </Text>
        <View style={styles.catList}>
          {categories.map((c) => (
            <CategoryRow key={c.name} {...c} />
          ))}
        </View>
      </ScrollView>

      <TabBar active="Status" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: 8,
    paddingBottom: 16,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radii.chip,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },

  hero: { alignItems: 'center', padding: 20, gap: 8 },
  heroRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 6 },
  heroTitle: { fontFamily: fonts.extraBold, fontSize: 18, letterSpacing: 1 },
  heroSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, textAlign: 'center' },

  sectionLabel: { paddingHorizontal: spacing.page, paddingTop: 16, paddingBottom: 8 },

  supplyRow: { flexDirection: 'row', gap: spacing.gapLg, paddingHorizontal: spacing.page },
  supplyCard: {
    flex: 1,
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },

  stripWrap: { paddingHorizontal: spacing.page, paddingTop: 8 },
  strip: {
    height: 40,
    overflow: 'hidden',
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.navy,
  },
  pipe: { position: 'absolute', left: 0, right: 0, top: 21, height: 10, backgroundColor: colors.card },
  stripLabel: { position: 'absolute', left: 11, top: 2, fontFamily: fonts.medium, fontSize: 10 },
  dotLayer: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  dot: { position: 'absolute', top: 22, width: 14, height: 8, borderRadius: 4, opacity: 0.9 },

  catList: { gap: spacing.gap, paddingHorizontal: spacing.page },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.row,
    backgroundColor: colors.card,
  },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catText: { fontFamily: fonts.medium, fontSize: 12 },

  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tab: { alignItems: 'center', gap: 4 },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabText: { fontSize: 11 },
});
