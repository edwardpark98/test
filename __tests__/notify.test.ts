// Tests for the reminder planner: what gets scheduled, and that reminders keep coming
// without the app being opened.
import { describe, expect, it, jest } from '@jest/globals';
import { addDays, blank, Data, dkey, Item, sample } from '../src/lib';
import { planReminders, reminderDay } from '../src/notify';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationPriority: { MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
}));

const NOW = new Date(2026, 10, 17, 12, 0).getTime(); // Tuesday 17 Nov 2026, 12:00 local
const TODAY = dkey(new Date(NOW));
const BUDGET = 60;

function med(id: string, times: string[], extra: Partial<Item> = {}): Item {
  return { id, type: 'med', name: 'Med ' + id, strength: '', qty: 1, unit: 'tablet', times, start: addDays(TODAY, -3), days: 0, notes: '', prescriber: '', ...extra } as Item;
}
function plan(items: Item[], tweak: (d: Data) => void = () => {}) {
  const d: Data = { ...blank(), items };
  tweak(d);
  return planReminders(d, NOW, BUDGET);
}

describe('planReminders', () => {
  it('schedules nothing for the sample plan', () => {
    const p = planReminders(sample(), NOW, BUDGET);
    expect(p.mode).toBe('sample');
    expect(p.items).toHaveLength(0);
  });

  it('covers every weekday slot with a weekly repeat for an ongoing medicine', () => {
    const p = plan([med('a', ['08:00', '20:00'])]);
    expect(p.mode).toBe('weekly');
    const weekly = p.items.filter((x) => x.kind === 'weekly');
    // 7 weekdays x 2 times, including today's 08:00, which already passed and starts next week.
    expect(weekly).toHaveLength(14);
    expect(new Set(weekly.map((x) => x.id)).size).toBe(14);
    expect(weekly.every((x) => x.repeat)).toBe(true);
    const todayMorning = weekly.find((x) => x.id === 'w|3|08:00'); // Tuesday = 3 (Sunday = 1)
    expect(todayMorning?.day).toBe(addDays(TODAY, 7));
    // Follow-ups for the next 24 hours: today 20:00 and tomorrow 08:00.
    expect(p.items.filter((x) => x.kind === 'nag').map((x) => x.id)).toEqual(['n|' + TODAY + '|20:00', 'n|' + addDays(TODAY, 1) + '|08:00']);
  });

  it('skips a dose logged early today and covers the same slot next week', () => {
    const p = plan([med('a', ['20:00'])], (d) => {
      d.logs[TODAY] = { 'a@20:00': { s: 'taken', at: '11:50' } };
    });
    expect(p.items.find((x) => x.day === TODAY)).toBeUndefined();
    expect(p.items.find((x) => x.id === 'w|3|20:00')).toBeUndefined();
    expect(p.items.find((x) => x.id === 'p|' + addDays(TODAY, 7) + '|20:00')).toBeDefined();
  });

  it('uses one-offs, not weekly repeats, for a course that ends this week', () => {
    const p = plan([med('a', ['09:00'], { start: addDays(TODAY, -4), days: 7 })]); // last day = TODAY + 2
    expect(p.items.some((x) => x.repeat)).toBe(false);
    expect(p.items.filter((x) => x.kind === 'primary').map((x) => x.day)).toEqual([addDays(TODAY, 1), addDays(TODAY, 2)]);
  });

  it('does not fire a weekly repeat before a medicine starts', () => {
    const p = plan([med('a', ['09:00'], { start: addDays(TODAY, 3) })]);
    for (const x of p.items.filter((i) => i.repeat)) {
      expect(x.day >= addDays(TODAY, 3)).toBe(true);
    }
    // The start day's weekday this week would be wrong for a repeat that began earlier.
    expect(p.items.some((x) => x.day < addDays(TODAY, 3))).toBe(false);
  });

  it('falls back to a window with an open-the-app nudge when the plan is too busy', () => {
    const times = ['06:00', '07:00', '09:00', '10:00', '13:00', '14:00', '16:00', '17:00', '19:00', '21:00'];
    const p = plan([med('a', times)]);
    expect(p.mode).toBe('window');
    expect(p.items.length).toBeLessThanOrEqual(BUDGET);
    expect(p.items.at(-1)?.kind).toBe('nudge');
  });

  it('never exceeds the budget and never repeats an id', () => {
    for (let n = 1; n <= 10; n++) {
      const times = Array.from({ length: n }, (_, i) => String(6 + i).padStart(2, '0') + ':30');
      const p = plan([med('a', times), med('b', times.slice(0, 2))]);
      expect(p.items.length).toBeLessThanOrEqual(BUDGET);
      expect(new Set(p.items.map((x) => x.id)).size).toBe(p.items.length);
    }
  });

  it('still covers every dose a week later without the app being opened (gate 1)', () => {
    const times = ['08:00', '13:00', '20:00'];
    const p = plan([med('a', times), med('b', ['08:00'])]);
    const weekly = p.items.filter((x) => x.repeat);
    for (let i = 7; i < 14; i++) {
      const day = addDays(TODAY, i);
      const wd = new Date(day + 'T00:00:00').getDay() + 1;
      for (const t of times) expect(weekly.some((x) => x.id === 'w|' + wd + '|' + t)).toBe(true);
    }
  });

  it('turns off follow-ups when the setting is off', () => {
    const p = plan([med('a', ['20:00'])], (d) => {
      d.settings = { nag: false };
    });
    expect(p.items.some((x) => x.kind === 'nag')).toBe(false);
  });
});

describe('reminderDay', () => {
  it('logs a weekly reminder against the day it arrived', () => {
    const arrived = new Date(2026, 11, 1, 8, 0).getTime();
    const n = { date: arrived, request: { identifier: 'w|3|08:00', content: { data: { kind: 'weekly', day: TODAY, keys: ['a@08:00'], time: '08:00' } } } };
    expect(reminderDay(n as never)).toBe('2026-12-01');
  });
  it('uses the stored day for a one-off reminder', () => {
    const n = { date: NOW, request: { identifier: 'p', content: { data: { kind: 'primary', day: '2026-11-20', keys: [], time: '08:00' } } } };
    expect(reminderDay(n as never)).toBe('2026-11-20');
  });
});
