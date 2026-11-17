import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, ScrollViewInstance, Share, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { blank, Data, dkey, hhmm, Item, itemByKey, load, LogEntry, persist, sample, settingsOf } from './src/lib';
import { Loader } from './src/Loader';
import {
  ACT_SKIP, ACT_SNOOZE, ACT_TAKE, cancelAll, getPermState, PermState, ReminderData, reminderDay, requestExact, requestPermission,
  reschedule, ScheduleResult, sendTest, snooze, SNOOZE_MIN,
} from './src/notify';
import { Actions, Log, More, MoreActions, Plan, Today } from './src/screens';
import { EntrySheet, Form, newForm, PhysioForm, PhysioSheet, ReminderSheet, RestoreSheet, WipeSheet } from './src/sheets';
import { C } from './src/theme';
import { Grid, T } from './src/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

type View_ = 'today' | 'plan' | 'log' | 'settings';
type Toast = { msg: string; undo?: { day: string; key: string } } | null;

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const [data, setData] = useState<Data | null>(null);
  const dataRef = useRef<Data | null>(null);
  dataRef.current = data;
  const [loader, setLoader] = useState(true);
  const [view, setView] = useState<View_>('today');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [physio, setPhysio] = useState<PhysioForm | null>(null);
  const [sheet, setSheet] = useState<'restore' | 'wipe' | null>(null);
  const [toast, setToastState] = useState<Toast>(null);
  const [now, setNow] = useState(new Date());
  const [perm, setPerm] = useState<PermState | null>(null);
  const [sched, setSched] = useState<ScheduleResult | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  /* ---------- load ---------- */
  useEffect(() => {
    load().then((d) => {
      const first = d || sample();
      if (!d) persist(first);
      setData(first);
    });
  }, []);
  const ready = fontsLoaded && !!data;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  /* ---------- clock ---------- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ---------- toast ---------- */
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((t: Toast) => {
    setToastState(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 3600);
  }, []);

  /* ---------- data updates ---------- */
  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);
  const setLog = useCallback(
    (day: string, key: string, val: LogEntry | null) =>
      update((d) => {
        const logs = { ...d.logs, [day]: { ...(d.logs[day] || {}) } };
        if (val) logs[day][key] = val;
        else delete logs[day][key];
        return { ...d, logs };
      }),
    [update],
  );

  /* ---------- reminders ---------- */
  const refreshPerm = useCallback(() => getPermState().then(setPerm).catch(() => {}), []);
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      reschedule(data).then(setSched).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [data]);
  useEffect(() => {
    refreshPerm();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setNow(new Date());
      refreshPerm();
      if (dataRef.current) reschedule(dataRef.current).then(setSched).catch(() => {});
    });
    return () => sub.remove();
  }, [refreshPerm]);

  // Explain reminders before the system prompt: once per launch when there is a real plan
  // and the person hasn't decided yet, and again right after they add their first entry.
  const [askOpen, setAskOpen] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    if (!ready || loader || asked.current || !perm || perm.granted || !perm.canAsk) return;
    if (!dataRef.current || dataRef.current.sample || !dataRef.current.items.length) return;
    asked.current = true;
    setAskOpen(true);
  }, [ready, loader, perm, data]);

  /* ---------- notification taps and buttons ---------- */
  const handled = useRef(new Set<string>());
  const pending = useRef<Notifications.NotificationResponse[]>([]);
  const handleResponse = useCallback(
    (r: Notifications.NotificationResponse) => {
      const d = dataRef.current;
      if (!d) {
        pending.current.push(r);
        return;
      }
      const id = r.notification.request.identifier + '|' + r.actionIdentifier + '|' + r.notification.date;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
      Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});

      const raw = r.notification.request.content.data as Partial<ReminderData> | undefined;
      setView('today');
      const day = reminderDay(r.notification);
      if (!raw?.keys?.length || !day) return;
      const rd = { ...raw, day } as ReminderData; // a weekly reminder logs against the day it arrived
      const keys = rd.keys.filter((k) => !(d.logs[rd.day] || {})[k] && itemByKey(d, k));
      const nowT = hhmm(new Date());
      if (r.actionIdentifier === ACT_TAKE) {
        keys.forEach((k) => {
          const it = itemByKey(d, k)!;
          setLog(rd.day, k, it.type === 'physio' ? { s: 'done', at: nowT, sets: it.sets } : { s: 'taken', at: nowT });
        });
        if (keys.length) showToast({ msg: keys.length === 1 ? itemByKey(d, keys[0])!.name + ' logged' : keys.length + ' doses logged', undo: keys.length === 1 ? { day: rd.day, key: keys[0] } : undefined });
      } else if (r.actionIdentifier === ACT_SKIP) {
        keys.forEach((k) => setLog(rd.day, k, { s: 'skipped', at: nowT }));
        if (keys.length) showToast({ msg: 'Marked as skipped', undo: keys.length === 1 ? { day: rd.day, key: keys[0] } : undefined });
      } else if (r.actionIdentifier === ACT_SNOOZE) {
        if (keys.length) snooze(d, { ...rd, keys }).then(() => showToast({ msg: `Reminding you again in ${SNOOZE_MIN} min` }));
      } else if (keys.length === 1 && rd.day === dkey(new Date())) {
        const it = itemByKey(d, keys[0])!;
        if (it.type === 'physio') setPhysio({ key: keys[0], sets: it.sets, pain: 2, note: '' });
      }
    },
    [setLog, showToast],
  );
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((r) => r && handleResponse(r)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [handleResponse]);
  useEffect(() => {
    if (!data || !pending.current.length) return;
    const q = pending.current;
    pending.current = [];
    q.forEach(handleResponse);
  }, [data, handleResponse]);

  /* ---------- actions ---------- */
  const today = dkey(now);
  const a: Actions = {
    add: () => setForm(newForm('med')),
    take: (key) => {
      setLog(dkey(new Date()), key, { s: 'taken', at: hhmm(new Date()) });
      showToast({ msg: (data && itemByKey(data, key)?.name) + ' taken', undo: { day: dkey(new Date()), key } });
    },
    skip: (key) => {
      setLog(dkey(new Date()), key, { s: 'skipped', at: hhmm(new Date()) });
      showToast({ msg: 'Marked as skipped', undo: { day: dkey(new Date()), key } });
    },
    undo: (day, key) => {
      setLog(day, key, null);
      setToastState(null);
    },
    logPhysio: (key) => {
      const it = data && itemByKey(data, key);
      if (it && it.type === 'physio') setPhysio({ key, sets: it.sets, pain: 2, note: '' });
    },
    clearSample: () => update(() => blank()),
    edit: (it: Item) => setForm(newForm(it.type, it)),
    remove: (id) => {
      update((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
      setConfirmDel(null);
      showToast({ msg: 'Removed' });
    },
  };
  const m: MoreActions = {
    setName: (n) => update((d) => ({ ...d, name: n })),
    enableReminders: async () => {
      setAskOpen(false);
      if (perm && !perm.granted && !perm.canAsk) {
        Linking.openSettings().catch(() => {});
        return;
      }
      const p = await requestPermission();
      setPerm(p);
      if (!p.granted) showToast({ msg: 'Reminders stay off. You can turn them on in More.' });
      if (dataRef.current) reschedule(dataRef.current).then(setSched);
    },
    allowExact: async () => {
      await requestExact();
      refreshPerm();
    },
    test: async () => {
      await sendTest();
      showToast({ msg: 'Test reminder in 5 seconds. Lock your phone to see it.' });
    },
    setNag: (v) => update((d) => ({ ...d, settings: { ...settingsOf(d), nag: v } })),
    backup: () => {
      if (!data) return;
      Share.share({ title: 'PillTime backup ' + dkey(new Date()), message: JSON.stringify(data) }).catch(() => {});
    },
    restore: () => setSheet('restore'),
    wipe: () => setSheet('wipe'),
  };

  const go = (v: View_) => {
    setView(v);
    setConfirmDel(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  if (!ready || !data) return <View style={{ flex: 1, backgroundColor: C.ink }} />;

  // A loud banner on Today whenever reminders can't be trusted.
  const alert =
    data.sample || !data.items.length || !perm
      ? null
      : !perm.granted
        ? { msg: 'Reminders are off. PillTime can’t notify you at dose times.', label: perm.canAsk ? 'Turn on' : 'Open Settings', onPress: m.enableReminders }
        : !perm.exact
          ? { msg: 'Reminders may arrive a few minutes late on this phone.', label: 'Fix', onPress: m.allowExact }
          : null;

  return (
    <View style={st.root}>
      <StatusBar style="light" />
      <Grid />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[st.main, { paddingTop: insets.top + 22, paddingLeft: Math.max(18, insets.left), paddingRight: Math.max(18, insets.right) }]}
        keyboardShouldPersistTaps="handled"
      >
        {view === 'plan' ? (
          <Plan data={data} a={a} confirmDel={confirmDel} setConfirmDel={setConfirmDel} />
        ) : view === 'log' ? (
          <Log data={data} />
        ) : view === 'settings' ? (
          <More data={data} m={m} perm={perm} sched={sched} />
        ) : (
          <Today data={data} a={a} now={now} alert={alert} />
        )}
      </ScrollView>

      <TabBar view={view} go={go} add={a.add} bottom={insets.bottom} />

      {toast ? (
        <View style={[st.toast, { bottom: 96 + insets.bottom }]} accessibilityLiveRegion="polite">
          <T style={st.toastT}>{toast.msg}</T>
          {toast.undo ? (
            <Pressable onPress={() => a.undo(toast.undo!.day, toast.undo!.key)} accessibilityRole="button" hitSlop={8}>
              <T style={st.toastB}>Undo</T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <EntrySheet
        form={form}
        setForm={setForm}
        onClose={() => setForm(null)}
        onSave={(item, isEdit) => {
          update((d) => {
            const base = d.sample ? blank() : d;
            return {
              ...base,
              settings: base.settings || d.settings,
              items: isEdit ? base.items.map((x) => (x.id === item.id ? item : x)) : [...base.items, item],
            };
          });
          setForm(null);
          showToast({ msg: isEdit ? 'Saved' : 'Added to your plan' });
          if (!isEdit && perm && !perm.granted) setAskOpen(true);
        }}
      />
      <ReminderSheet visible={askOpen} canAsk={!perm || perm.canAsk} onEnable={m.enableReminders} onClose={() => setAskOpen(false)} />
      <PhysioSheet
        data={data}
        form={physio}
        setForm={setPhysio}
        onClose={() => setPhysio(null)}
        onSave={() => {
          if (!physio) return;
          setLog(today, physio.key, { s: 'done', at: hhmm(new Date()), sets: physio.sets, pain: physio.pain, note: physio.note.trim() });
          setPhysio(null);
          showToast({ msg: 'Session logged' });
        }}
      />
      <RestoreSheet
        key={sheet === 'restore' ? 'open' : 'closed'}
        visible={sheet === 'restore'}
        onClose={() => setSheet(null)}
        onRestore={(d) => {
          update(() => d);
          setSheet(null);
          go('today');
          showToast({ msg: 'Backup restored' });
        }}
      />
      <WipeSheet
        visible={sheet === 'wipe'}
        onClose={() => setSheet(null)}
        onWipe={() => {
          cancelAll().catch(() => {});
          update(() => blank());
          setSheet(null);
          go('today');
          showToast({ msg: 'Erased' });
        }}
      />

      {loader ? <Loader onDone={() => setLoader(false)} /> : null}
    </View>
  );
}

function TabBar({ view, go, add, bottom }: { view: View_; go: (v: View_) => void; add: () => void; bottom: number }) {
  const tab = (v: View_, label: string, icon: (c: string) => React.ReactNode) => {
    const on = view === v;
    return (
      <Pressable style={st.tab} onPress={() => go(v)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={on ? C.signal : C.mist} strokeWidth={1.8} strokeLinecap="round">
          {icon(on ? C.signal : C.mist)}
        </Svg>
        <T style={[st.tabT, on && { color: C.ice }]}>{label}</T>
      </Pressable>
    );
  };
  return (
    <View style={[st.tabs, { paddingBottom: 10 + bottom }]} accessibilityRole="tablist">
      {tab('today', 'Today', () => (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v5l3 2" />
        </>
      ))}
      {tab('plan', 'Plan', () => (
        <>
          <Rect x={5} y={4} width={14} height={17} rx={2} />
          <Path d="M9 9h6M9 13h6M9 17h3" />
        </>
      ))}
      <View style={st.tab}>
        <Pressable style={({ pressed }) => [st.plus, pressed && { opacity: 0.8 }]} onPress={add} accessibilityRole="button" accessibilityLabel="Add to plan">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth={2.2} strokeLinecap="round">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
        </Pressable>
      </View>
      {tab('log', 'Log', () => <Path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />)}
      {tab('settings', 'More', () => (
        <>
          <Circle cx={12} cy={12} r={3} />
          <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },
  main: { paddingBottom: 28, gap: 22, maxWidth: 560, width: '100%', alignSelf: 'center' },
  tabs: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.ink },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 50 },
  tabT: { color: C.mist, fontSize: 11 },
  plus: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.signal, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute', alignSelf: 'center', maxWidth: 420, marginHorizontal: 16, backgroundColor: C.ice, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
    flexDirection: 'row', gap: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8, zIndex: 30,
  },
  toastT: { color: C.ink, fontSize: 14, fontFamily: 'BricolageGrotesque_600SemiBold', flexShrink: 1 },
  toastB: { color: C.cobalt, fontFamily: 'BricolageGrotesque_700Bold' },
});
