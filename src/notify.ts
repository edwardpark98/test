// Phone reminders: local notifications scheduled on the device itself, so they
// arrive with the app closed and the phone offline. Dose times repeat weekly, so
// they keep coming even if the app is never opened; the schedule is rebuilt
// whenever the plan or the log changes and whenever the app comes to the front.
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, at, Data, dkey, doseLine, dosesFor, Dose, parseD, settingsOf } from './lib';

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

export type ReminderData = { day: string; keys: string[]; time: string; kind: 'primary' | 'weekly' | 'nag' | 'snooze' | 'nudge' };

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
    interruptionLevel: 'timeSensitive', // breaks through Focus on iOS (needs the entitlement in app.json)
  };
}
function trigger(date: Date): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL };
}
function weekly(day: string, time: string): Notifications.NotificationTriggerInput {
  const p = time.split(':');
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: parseD(day).getDay() + 1, // 1 = Sunday
    hour: +p[0],
    minute: +p[1],
    channelId: CHANNEL,
  };
}

/** The day a delivered reminder belongs to. A weekly reminder keeps its first day in its data, so use the delivery date. */
export function reminderDay(n: Notifications.Notification): string | undefined {
  const data = n.request.content.data as Partial<ReminderData> | undefined;
  if (data?.kind !== 'weekly') return data?.day;
  const ms = n.date < 1e12 ? n.date * 1000 : n.date;
  return dkey(new Date(ms));
}

/* ---------- planning (pure, so it can be tested) ---------- */
type Slot = { day: string; time: string; when: Date; doses: Dose[] };
export type Planned = { id: string; kind: ReminderData['kind']; day: string; time: string; doses: Dose[]; when: Date | null; repeat: boolean };
export type ReminderPlan = { mode: 'weekly' | 'window' | 'sample' | 'empty'; items: Planned[]; next: Slot | null; until: Date | null };

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

const keyset = (ds: Dose[]) => ds.map((x) => x.key).sort().join(',');

/**
 * Work out every reminder to schedule.
 *
 * Weekly mode (the normal case): each dose time on each of the next 7 days becomes a
 * weekly repeating reminder, so reminders keep coming indefinitely even if the app is
 * never opened. A time becomes a one-off instead when it differs a week later (a course
 * ending or starting) or is partly logged. A dose logged early today gets no reminder
 * today and a one-off for the same time next week.
 *
 * Window mode (a plan too busy for the 64-notification limit): one-off reminders for as
 * far ahead as fit, then an "open the app" nudge.
 */
export function planReminders(d: Data, now: number, budget: number): ReminderPlan {
  if (d.sample) return { mode: 'sample', items: [], next: null, until: null };
  const today = dkey(new Date(now));
  const slots = upcoming(d, today, HORIZON_DAYS, now);
  const slotDoses = (k: string, t: string) => dosesFor(d, k).filter((x) => x.time === t);

  const nags: Planned[] = [];
  if (settingsOf(d).nag) {
    upcoming(d, addDays(today, -1), 3, now - NAG_AFTER_MIN * 60e3)
      .filter((s) => +s.when < now + 24 * 3600e3)
      .forEach((s) => {
        const when = new Date(+s.when + NAG_AFTER_MIN * 60e3);
        if (+when > now + 5e3) nags.push({ id: 'n|' + s.day + '|' + s.time, kind: 'nag', day: s.day, time: s.time, doses: s.doses, when, repeat: false });
      });
  }

  const primary: Planned[] = [];
  const followOn: Planned[] = [];
  const weeklyFrom = (k: string, t: string, doses: Dose[]): Planned => ({
    id: 'w|' + (parseD(k).getDay() + 1) + '|' + t, kind: 'weekly', day: k, time: t, doses, when: at(k, t), repeat: true,
  });
  const oneOff = (k: string, t: string, doses: Dose[]): Planned => ({ id: 'p|' + k + '|' + t, kind: 'primary', day: k, time: t, doses, when: at(k, t), repeat: false });
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const k = addDays(today, i);
    const k7 = addDays(k, 7);
    const times = Array.from(new Set([...dosesFor(d, k), ...dosesFor(d, k7)].map((x) => x.time))).sort();
    for (const t of times) {
      const all = slotDoses(k, t);
      const next = slotDoses(k7, t);
      const passed = +at(k, t) <= now;
      if (passed || !all.length) {
        // The slot has passed today, or only starts next week: cover next week's occurrence.
        // A weekly repeat is safe only for a passed slot; otherwise it would also fire this week.
        if (!next.length) continue;
        if (passed && keyset(next) === keyset(slotDoses(addDays(k7, 7), t))) primary.push(weeklyFrom(k7, t, next));
        else followOn.push(oneOff(k7, t, next));
        continue;
      }
      const pending = all.filter((x) => !(d.logs[k] || {})[x.key]);
      if (pending.length === all.length && keyset(all) === keyset(next)) {
        primary.push(weeklyFrom(k, t, all));
        continue;
      }
      if (pending.length) primary.push({ ...oneOff(k, t, pending) });
      if (next.length) followOn.push(oneOff(k7, t, next));
    }
  }
  if (!primary.length && !followOn.length) return { mode: 'empty', items: [], next: null, until: null };

  if (primary.length <= budget) {
    const room = budget - primary.length;
    const extras = [...nags, ...followOn].slice(0, room);
    return { mode: 'weekly', items: [...primary, ...extras], next: slots[0] || null, until: null };
  }

  // Too busy for weekly mode: one-offs as far ahead as fit, follow-ups reserved first.
  const nagBudget = Math.min(nags.length, Math.floor((budget - 1) / 3));
  const shown = slots.slice(0, Math.max(0, budget - 1 - nagBudget));
  const items: Planned[] = shown.map((s) => ({ id: 'p|' + s.day + '|' + s.time, kind: 'primary', day: s.day, time: s.time, doses: s.doses, when: s.when, repeat: false }));
  items.push(...nags.slice(0, nagBudget));
  const last = shown[shown.length - 1];
  if (last) items.push({ id: 'nudge', kind: 'nudge', day: last.day, time: last.time, doses: [], when: new Date(+last.when + 60e3), repeat: false });
  return { mode: 'window', items, next: slots[0] || null, until: last ? last.when : null };
}

/* ---------- scheduling ---------- */
export type ScheduleResult = { granted: boolean; count: number; mode: ReminderPlan['mode'] | 'off'; next: Slot | null; until: Date | null };
let chain: Promise<ScheduleResult> = Promise.resolve({ granted: false, count: 0, mode: 'off', next: null, until: null });

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
  if (!perm.granted) return { granted: false, count: 0, mode: 'off', next: null, until: null };

  const loggedOn = (day: string | undefined, keys: string[] | undefined) => !!day && !!keys && keys.every((k) => (d.logs[day] || {})[k]);

  // Keep snoozes the person asked for, unless those doses have been logged since.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  let kept = 0;
  for (const n of existing) {
    const data = n.content.data as Partial<ReminderData> | undefined;
    if (!d.sample && data?.kind === 'snooze' && data.keys?.length && !loggedOn(data.day, data.keys)) {
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
      if (data?.keys?.length && loggedOn(reminderDay(n), data.keys)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {}

  const plan = planReminders(d, Date.now(), MAX_PENDING - kept);
  for (const p of plan.items) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content:
        p.kind === 'nudge'
          ? {
              title: 'Open PillTime to keep reminders coming',
              body: 'Your next reminders are scheduled when you open the app.',
              data: { day: p.day, keys: [], time: p.time, kind: 'nudge' } satisfies ReminderData,
              sound: 'default',
              interruptionLevel: 'timeSensitive',
            }
          : content(d, p.day, p.time, p.doses, p.kind),
      trigger: p.repeat ? weekly(p.day, p.time) : trigger(p.when!),
    });
  }
  return { granted: true, count: plan.items.length + kept, mode: plan.mode, next: plan.next, until: plan.until };
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
