// Data model, storage and schedule logic, ported from the PillTime web app.
// The stored shape matches the web app's backup format, so a backup made
// there can be restored here.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MedItem = {
  id: string;
  type: 'med';
  name: string;
  strength: string;
  qty: number;
  unit: string;
  times: string[];
  start: string;
  days: number;
  notes: string;
  prescriber: string;
};
export type PhysioItem = {
  id: string;
  type: 'physio';
  name: string;
  sets: number;
  reps: number;
  times: string[];
  start: string;
  days: number;
  notes: string;
};
export type Item = MedItem | PhysioItem;
export type LogEntry = {
  s: 'taken' | 'skipped' | 'done';
  at: string;
  sets?: number;
  pain?: number;
  note?: string;
};
export type DayLog = Record<string, LogEntry>;
export type Settings = { nag: boolean };
export type Data = {
  v: 1;
  name: string;
  items: Item[];
  logs: Record<string, DayLog>;
  sample: boolean;
  settings?: Settings;
};
export type Dose = { key: string; item: Item; time: string; m: number };

export const MEDS = ['Aciclovir','Alendronic acid','Allopurinol','Amitriptyline','Amlodipine','Amoxicillin','Apixaban','Aspirin','Atenolol','Atorvastatin','Baclofen','Beclometasone','Bendroflumethiazide','Bisacodyl','Bisoprolol','Budesonide','Bumetanide','Buprenorphine','Calcium carbonate','Candesartan','Carbamazepine','Cefalexin','Cefuroxime','Celecoxib','Cetirizine','Chlorphenamine','Ciprofloxacin','Citalopram','Clarithromycin','Clindamycin','Clopidogrel','Co-amoxiclav','Co-codamol','Co-dydramol','Codeine phosphate','Colchicine','Colecalciferol','Cyclizine','Dabigatran etexilate','Dalteparin sodium','Dapagliflozin','Desogestrel','Dexamethasone','Diazepam','Diclofenac sodium','Digoxin','Dihydrocodeine','Docusate sodium','Domperidone','Doxazosin','Doxycycline','Duloxetine','Edoxaban','Empagliflozin','Enoxaparin sodium','Erythromycin','Escitalopram','Esomeprazole','Etoricoxib','Famotidine','Fentanyl','Ferrous fumarate','Ferrous sulfate','Fexofenadine','Finasteride','Flucloxacillin','Fluconazole','Fluoxetine','Folic acid','Furosemide','Gabapentin','Gliclazide','Glyceryl trinitrate','Hydrocortisone','Hydroxychloroquine','Ibuprofen','Indapamide','Insulin glargine','Irbesartan','Isosorbide mononitrate','Ispaghula husk','Lactulose','Lamotrigine','Lansoprazole','Levetiracetam','Levofloxacin','Levothyroxine sodium','Lisinopril','Loperamide','Loratadine','Lorazepam','Losartan','Macrogol compound','Meloxicam','Metformin','Methocarbamol','Methotrexate','Metoclopramide','Metoprolol','Metronidazole','Mirtazapine','Montelukast','Morphine sulfate','Naproxen','Nitrofurantoin','Nortriptyline','Omeprazole','Ondansetron','Oxybutynin','Oxycodone','Paracetamol','Perindopril','Phenoxymethylpenicillin','Pravastatin','Prednisolone','Pregabalin','Prochlorperazine','Propranolol','Quetiapine','Ramipril','Rivaroxaban','Rosuvastatin','Salbutamol','Senna','Sertraline','Simvastatin','Sitagliptin','Sodium valproate','Solifenacin','Spironolactone','Sumatriptan','Tamsulosin','Tapentadol','Ticagrelor','Tinzaparin sodium','Tizanidine','Topiramate','Tramadol','Tranexamic acid','Trimethoprim','Valsartan','Venlafaxine','Warfarin','Zopiclone'];
export const UNITS = ['tablet','capsule','ml','sachet','puff','drop','injection','patch','dose'];
export const DEFAULT_TIMES: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '22:00'],
};
export const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
export const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

/* ---------- helpers ---------- */
export const pad = (n: number) => (n < 10 ? '0' : '') + n;
export const dkey = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export function parseD(k: string) {
  const p = k.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
export function addDays(k: string, n: number) {
  const d = parseD(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
}
export function mins(t: string) {
  const p = t.split(':');
  return +p[0] * 60 + +p[1];
}
export const nowMins = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
export const hhmm = (d: Date) => pad(d.getHours()) + ':' + pad(d.getMinutes());
export const uid = () => Math.random().toString(36).slice(2, 9);
export const plural = (n: number, u: string) => (u === 'ml' ? n + ' ml' : n + ' ' + u + (n === 1 ? '' : 's'));
export function fmtShort(k: string) {
  const d = parseD(k);
  const m = MONTHS[d.getMonth()];
  return d.getDate() + ' ' + m.charAt(0) + m.slice(1).toLowerCase();
}
/** Date at a given day key and HH:MM, local time. */
export function at(k: string, t: string) {
  const d = parseD(k);
  const p = t.split(':');
  d.setHours(+p[0], +p[1], 0, 0);
  return d;
}

/* ---------- schedule logic ---------- */
export function activeOn(item: Item, k: string) {
  if (k < item.start) return false;
  if (!item.days) return true;
  return k <= addDays(item.start, item.days - 1);
}
export function dosesFor(d: Data, k: string): Dose[] {
  const out: Dose[] = [];
  d.items.forEach((it) => {
    if (!activeOn(it, k)) return;
    it.times.forEach((t) => out.push({ key: it.id + '@' + t, item: it, time: t, m: mins(t) }));
  });
  out.sort((a, b) => a.m - b.m || Number(a.item.type === 'physio') - Number(b.item.type === 'physio'));
  return out;
}
export const doseLine = (it: Item) =>
  it.type === 'physio'
    ? it.sets + ' sets × ' + it.reps + ' reps'
    : (it.strength ? it.strength + ' · ' : '') + plural(it.qty, it.unit);
export const dayOf = (it: Item, k: string) => Math.round((+parseD(k) - +parseD(it.start)) / 864e5) + 1;

export function adherence(d: Data, n: number) {
  const t = dkey(new Date());
  let sch = 0;
  let tk = 0;
  for (let i = n; i >= 1; i--) {
    const k = addDays(t, -i);
    const lg = d.logs[k] || {};
    dosesFor(d, k).forEach((x) => {
      sch++;
      if (lg[x.key] && lg[x.key].s !== 'skipped') tk++;
    });
  }
  return sch ? Math.round((tk / sch) * 100) : null;
}

export const itemByKey = (d: Data, k: string) => d.items.find((i) => i.id === k.split('@')[0]);

/* ---------- storage ---------- */
const KEY = 'pilltime.v1';
export const blank = (): Data => ({ v: 1, name: '', items: [], logs: {}, sample: false, settings: { nag: true } });
export const settingsOf = (d: Data): Settings => ({ nag: true, ...(d.settings || {}) });

export function sample(): Data {
  const t = dkey(new Date());
  const s = addDays(t, -8);
  const d: Data = {
    v: 1,
    name: '',
    sample: true,
    logs: {},
    settings: { nag: true },
    items: [
      { id: 's1', type: 'med', name: 'Paracetamol', strength: '500 mg', qty: 2, unit: 'tablet', times: ['08:00','12:00','16:00','22:00'], start: s, days: 21, notes: 'Do not take other paracetamol products', prescriber: '' },
      { id: 's2', type: 'med', name: 'Ibuprofen', strength: '400 mg', qty: 1, unit: 'tablet', times: ['09:00','13:00','19:00'], start: s, days: 14, notes: 'With food', prescriber: '' },
      { id: 's3', type: 'med', name: 'Omeprazole', strength: '20 mg', qty: 1, unit: 'capsule', times: ['08:00'], start: s, days: 14, notes: 'Before breakfast', prescriber: '' },
      { id: 's4', type: 'physio', name: 'Heel slides', sets: 3, reps: 10, times: ['10:00','15:00','20:00'], start: s, days: 42, notes: 'Stop if pain goes above 6/10' },
    ],
  };
  const nm0 = nowMins();
  dosesFor(d, t).forEach((x) => {
    if (x.m < nm0 - 45) {
      d.logs[t] = d.logs[t] || {};
      d.logs[t][x.key] = { s: 'taken', at: x.time };
    }
  });
  for (let i = 8; i >= 1; i--) {
    const k = addDays(t, -i);
    d.logs[k] = {};
    dosesFor(d, k).forEach((x, j) => {
      d.logs[k][x.key] = (i + j) % 9 !== 0 ? { s: 'taken', at: x.time } : { s: 'skipped', at: x.time };
    });
  }
  return d;
}

export function isData(d: unknown): d is Data {
  return !!d && typeof d === 'object' && Array.isArray((d as Data).items) && typeof (d as Data).logs === 'object';
}

export async function load(): Promise<Data | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (isData(d)) return d;
    }
  } catch {}
  return null;
}
export async function persist(d: Data) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(d));
  } catch {}
}
