// Phone reminders: local notifications scheduled on the device itself, so they
// arrive with the app closed and the phone offline. The schedule is rebuilt
// whenever the plan or the log changes and whenever the app comes to the front.
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, at, Data, dkey, doseLine, dosesFor, Dose, settingsOf } from './lib';

export const CHANNEL = 'doses';
export const CAT_MED = 'pilltime_dose';
export const CAT_PHYSIO = 'pilltime_physio';
export const ACT_TAKE = 'take';
export const ACT_SNOOZE = 'snooze';
export const ACT_SKIP = 'skip';

const HORIZON_DAYS = 7; // schedule this far ahead
const MAX_PENDING = 60; // iOS keeps at most 64 pending local notifications per app
const NAG_AFTER_MIN = 30;
export const SNOOZE_MIN = 10;

export type ReminderData = { day: string; keys: string[]; time: string; kind: 'primary' | 'nag' | 'snooze' | 'nudge' };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: AndroidNotificationPriority.MAX,
  }),
});

let setupDone: Promise<void> | null = null;
export function setupNotifications() {
  if (!setupDone) {
    setupDone = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Dose reminders',
          description: 'A reminder at each dose or physio time in your plan',
          importance: AndroidImportance.MAX,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#4C9BFF',
          sound: 'default',
          lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
        });
      }
      const open = { opensAppToForeground: true, isDestructive: false, isAuthenticationRequired: false };
      await Notifications.setNotificationCategoryAsync(CAT_MED, [
        { identifier: ACT_TAKE, buttonTitle: 'Taken', options: open },
        { identifier: ACT_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MIN} min`, options: open },
        { identifier: ACT_SKIP, buttonTitle: 'Skip', options: open },
      ]);
      await Notifications.setNotificationCategoryAsync(CAT_PHYSIO, [
        { identifier: ACT_TAKE, buttonTitle: 'Done', options: open },
        { identifier: ACT_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MIN} min`, options: open },
        { identifier: ACT_SKIP, buttonTitle: 'Skip', options: open },
      ]);
    })().catch(() => {
      setupDone = null;
    });
  }
  return setupDone;
}

/* ---------- permissions ---------- */
export type PermState = { granted: boolean; canAsk: boolean; exact: boolean };
export async function getPermState(): Promise<PermState> {
  const p = await Notifications.getPermissionsAsync();
  const granted =
    p.granted ||
    p.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
    p.ios?.status === IosAuthorizationStatus.AUTHORIZED;
  return { granted, canAsk: p.canAskAgain, exact: await exactGranted() };
}
export async function requestPermission() {
  await setupNotifications(); // Android shows its prompt only once a channel exists
  await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return getPermState();
}
async function exactGranted() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}
export async function requestExact() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/* ---------- content ---------- */
function content(d: Data, day: string, time: string, doses: Dose[], kind: ReminderData['kind']): Notifications.NotificationContentInput {
  const physioOnly = doses.every((x) => x.item.type === 'physio');
  const lead = kind === 'nag' ? 'Still due · ' : kind === 'snooze' ? 'Reminder · ' : '';
  const title =
    doses.length === 1
      ? lead + (doses[0].item.type === 'physio' ? 'Physio: ' : '') + doses[0].item.name + ' · ' + time
      : lead + doses.length + ' due at ' + time;
  const body =
    doses.length === 1
      ? doseLine(doses[0].item) + (doses[0].item.notes ? ' · ' + doses[0].item.notes : '')
      : doses.map((x) => x.item.name + ' · ' + doseLine(x.item)).join('\n');
  const data: ReminderData = { day, keys: doses.map((x) => x.key), time, kind };
  return {
    title,
    body,
    data,
    sound: 'default',
    categoryIdentifier: physioOnly ? CAT_PHYSIO : CAT_MED,
    color: '#4C9BFF',
  };
}
function trigger(date: Date): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL };
}

/* ---------- scheduling ---------- */
type Slot = { day: string; time: string; when: Date; doses: Dose[] };

/** Upcoming dose times that are not logged yet, grouped by day and time. */
function upcoming(d: Data, fromDay: string, days: number, sinceMs: number): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const k = addDays(fromDay, i);
    const lg = d.logs[k] || {};
    const by: Record<string, Dose[]> = {};
    dosesFor(d, k).forEach((x) => {
      if (!lg[x.key]) (by[x.time] = by[x.time] || []).push(x);
    });
    Object.keys(by)
      .sort()
      .forEach((t) => {
        const when = at(k, t);
        if (+when > sinceMs) out.push({ day: k, time: t, when, doses: by[t] });
      });
  }
  return out;
}

export type ScheduleResult = { granted: boolean; count: number; next: Slot | null; until: Date | null };
let chain: Promise<ScheduleResult> = Promise.resolve({ granted: false, count: 0, next: null, until: null });

/** Rebuild every reminder from the plan. Calls are queued so they never overlap. */
export function reschedule(d: Data): Promise<ScheduleResult> {
  chain = chain.then(
    () => doReschedule(d),
    () => doReschedule(d),
  );
  return chain;
}

async function doReschedule(d: Data): Promise<ScheduleResult> {
  await setupNotifications();
  const perm = await getPermState();
  if (!perm.granted) return { granted: false, count: 0, next: null, until: null };

  const now = Date.now();
  const today = dkey(new Date());
  const loggedOn = (day: string, keys: string[]) => keys.every((k) => (d.logs[day] || {})[k]);

  // Keep snoozes the person asked for, unless those doses have been logged since.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  let kept = 0;
  for (const n of existing) {
    const data = n.content.data as Partial<ReminderData> | undefined;
    if (data?.kind === 'snooze' && data.day && data.keys && !loggedOn(data.day, data.keys)) {
      kept++;
      continue;
    }
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }

  // Clear delivered reminders for doses that are now logged.
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      const data = n.request.content.data as Partial<ReminderData> | undefined;
      if (data?.day && data.keys && loggedOn(data.day, data.keys)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {}

  const budget = MAX_PENDING - kept - 1; // one spare for the "open the app" nudge

  // "Still due" follow-ups for the next 24 hours, including doses already overdue today.
  // These are reserved first: a follow-up today matters more than a first reminder six days out.
  const nags: { s: Slot; when: Date }[] = [];
  if (settingsOf(d).nag) {
    const nagFrom = now - NAG_AFTER_MIN * 60e3;
    upcoming(d, addDays(today, -1), 3, nagFrom)
      .filter((s) => +s.when < now + 24 * 3600e3)
      .forEach((s) => {
        const when = new Date(+s.when + NAG_AFTER_MIN * 60e3);
        if (+when > now + 5e3) nags.push({ s, when });
      });
  }
  const nagBudget = Math.min(nags.length, Math.floor(budget / 3));

  const slots = upcoming(d, today, HORIZON_DAYS, now);
  const primaries = slots.slice(0, Math.max(0, budget - nagBudget));
  let count = 0;
  for (const s of primaries) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'p|' + s.day + '|' + s.time,
      content: content(d, s.day, s.time, s.doses, 'primary'),
      trigger: trigger(s.when),
    });
    count++;
  }
  for (const { s, when } of nags.slice(0, nagBudget)) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'n|' + s.day + '|' + s.time,
      content: content(d, s.day, s.time, s.doses, 'nag'),
      trigger: trigger(when),
    });
    count++;
  }

  // If the plan runs past what is scheduled, ask the person to open the app so it can schedule more.
  const last = primaries[primaries.length - 1];
  const more = slots.length > primaries.length || upcoming(d, addDays(today, HORIZON_DAYS), 1, 0).length > 0;
  if (last && more) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'nudge',
      content: {
        title: 'Open PillTime to keep reminders coming',
        body: 'Your next reminders are scheduled when you open the app.',
        data: { day: last.day, keys: [], time: last.time, kind: 'nudge' } satisfies ReminderData,
        sound: 'default',
      },
      trigger: trigger(new Date(+last.when + 60e3)),
    });
    count++;
  }

  return { granted: true, count: count + kept, next: slots[0] || null, until: last ? last.when : null };
}

export async function snooze(d: Data, data: ReminderData) {
  const doses = dosesFor(d, data.day).filter((x) => data.keys.includes(x.key));
  if (!doses.length) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 's|' + data.day + '|' + data.time + '|' + Date.now(),
    content: content(d, data.day, data.time, doses, 'snooze'),
    trigger: trigger(new Date(Date.now() + SNOOZE_MIN * 60e3)),
  });
}

export async function sendTest() {
  await setupNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'PillTime test reminder', body: 'Reminders are working on this phone.', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

export async function cancelAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
