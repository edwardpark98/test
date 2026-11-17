import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
  Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { at, Data, DEFAULT_TIMES, dkey, doseLine, fmtShort, hhmm, isData, Item, MEDS, parseD, plural, uid, UNITS } from './lib';
import { C, F } from './theme';
import { Btn, Eyebrow, Grid, Mono, T } from './ui';

/* ---------- sheet frame ---------- */
export function Sheet({
  visible, onClose, eyebrow, children, save,
}: { visible: boolean; onClose: () => void; eyebrow: string; children: React.ReactNode; save?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [rise] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (visible) {
      rise.setValue(0);
      Animated.timing(rise, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible, rise]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={sh.scrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <Animated.View
            accessibilityViewIsModal
            style={[
              sh.sheet,
              { marginTop: insets.top + 24, opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
            ]}
          >
            <Grid color="rgba(11,42,74,0.045)" />
            <View style={sh.header}>
              <Eyebrow paper>{eyebrow}</Eyebrow>
              <Pressable style={sh.x} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth={2} strokeLinecap="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={sh.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              {children}
            </ScrollView>
            {save ? <View style={[sh.save, { paddingBottom: 16 + insets.bottom }]}>{save}</View> : <View style={{ height: insets.bottom }} />}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SaveBtn({ label, onPress, disabled, tick }: { label: string; onPress: () => void; disabled?: boolean; tick?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [sh.saveBtn, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
    >
      <T style={sh.saveT}>{label}</T>
      {tick ? (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.signal} strokeWidth={2.2} strokeLinecap="round">
          <Path d="M5 12l5 5 9-10" />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const Lbl = ({ children }: { children: React.ReactNode }) => <Mono style={sh.lbl}>{children}</Mono>;

function Seg<V extends string | number>({ options, value, onChange, mono }: { options: [V, string][]; value: V; onChange: (v: V) => void; mono?: boolean }) {
  return (
    <View style={sh.seg} accessibilityRole="radiogroup">
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={String(v)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(v)}
            style={[sh.segB, on && sh.segOn]}
          >
            <T style={[sh.segT, on && { color: C.navy }, mono && { fontFamily: F.mono }]}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Step({ label, onDec, onInc, decLabel, incLabel }: { label: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string }) {
  return (
    <View style={sh.step}>
      <Pressable style={sh.stepB} onPress={onDec} accessibilityRole="button" accessibilityLabel={decLabel}>
        <T style={sh.stepBT}>−</T>
      </Pressable>
      <T style={sh.stepT}>{label}</T>
      <Pressable style={sh.stepB} onPress={onInc} accessibilityRole="button" accessibilityLabel={incLabel}>
        <T style={sh.stepBT}>+</T>
      </Pressable>
    </View>
  );
}

const Input = (p: React.ComponentProps<typeof TextInput>) => <TextInput placeholderTextColor="#7D93AB" {...p} style={[sh.inp, p.style]} />;

/** A time or date chip that opens the system picker. */
function PickField({
  mode, value, onChange, style, label,
}: { mode: 'time' | 'date'; value: Date; onChange: (d: Date) => void; style?: object; label: string }) {
  const [open, setOpen] = useState(false);
  const text = mode === 'time' ? hhmm(value) : fmtShort(dkey(value)) + ' ' + value.getFullYear();
  const press = () => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour: true,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(d);
        },
      });
    } else setOpen((o) => !o);
  };
  return (
    <>
      <Pressable onPress={press} style={style} accessibilityRole="button" accessibilityLabel={label + ', ' + text}>
        <Mono style={sh.pickT}>{text}</Mono>
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <View style={sh.iosPick}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={mode === 'time' ? 'spinner' : 'inline'}
            locale="en-GB"
            themeVariant="light"
            accentColor={C.cobalt}
            onChange={(_e, d) => d && onChange(d)}
          />
          <Btn kind="linkPaper" label="Done" onPress={() => setOpen(false)} />
        </View>
      ) : null}
    </>
  );
}

/* ---------- add / edit entry ---------- */
export type Form = {
  mode: 'med' | 'physio';
  editId: string | null;
  query: string;
  name: string;
  strength: string;
  qty: number;
  unit: string;
  times: string[];
  start: string;
  days: number;
  notes: string;
  prescriber: string;
  sets: number;
  reps: number;
};
export function newForm(mode: 'med' | 'physio', it?: Item): Form {
  const base: Form = {
    mode, editId: null, query: '', name: '', strength: '', qty: 1, unit: 'tablet', times: DEFAULT_TIMES[2].slice(), start: dkey(new Date()),
    days: 7, notes: '', prescriber: '', sets: 3, reps: 10,
  };
  if (!it) return base;
  return { ...base, ...JSON.parse(JSON.stringify(it)), mode: it.type, editId: it.id, query: '' };
}

function useNetSearch(q: string) {
  const [res, setRes] = useState<{ q: string; names: string[] }>({ q: '', names: [] });
  useEffect(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch('https://openprescribing.net/api/1.0/bnf_code/?q=' + encodeURIComponent(k) + '&format=json', { signal: ctl.signal })
        .then((r) => r.json())
        .then((js: { type: string; name: string }[]) => {
          const names = (js || [])
            .filter((x) => x.type === 'product' || x.type === 'presentation' || x.type === 'chemical')
            .map((x) => x.name)
            .filter((v, i, a) => a.indexOf(v) === i);
          setRes({ q: k, names });
        })
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  return res;
}

export function EntrySheet({ form, setForm, onClose, onSave }: { form: Form | null; setForm: (f: Form) => void; onClose: () => void; onSave: (it: Item, isEdit: boolean) => void }) {
  const net = useNetSearch(form?.query || '');
  const [freqKey, setFreqKey] = useState(0);
  if (!form) return <Sheet visible={false} onClose={onClose} eyebrow="">{null}</Sheet>;
  const f = form;
  const med = f.mode === 'med';
  const set = (p: Partial<Form>) => setForm({ ...f, ...p });

  const inc = (fld: 'qty' | 'sets' | 'reps' | 'days', dir: number) => {
    const ml = fld === 'qty' && f.unit === 'ml';
    const lim = ml ? [2.5, 100] : ({ qty: [1, 20], sets: [1, 10], reps: [1, 50], days: [0, 120] } as const)[fld];
    const dv = ml ? dir * 2.5 : dir;
    set({ [fld]: Math.max(lim[0], Math.min(lim[1], Math.round(((+f[fld] || 0) + dv) * 10) / 10)) } as Partial<Form>);
  };
  const pick = (name: string) => {
    const lm = name.toLowerCase();
    let unit = f.unit;
    UNITS.forEach((u) => {
      if (lm.indexOf(u) >= 0) unit = u;
    });
    if (/oral solution|suspension|liquid/.test(lm)) unit = 'ml';
    const sm = name.match(/(\d[\d.,/]*\s?(mg|microgram|micrograms|g|ml|mg\/\d+ml|units?)(\/\d+(\.\d+)?\s?ml)?)/i);
    set({ name, query: '', unit, strength: sm && !f.strength ? sm[0] : f.strength });
  };
  const save = () => {
    if (!f.name.trim()) return;
    const times = f.times.filter(Boolean).sort();
    const common = { id: f.editId || uid(), name: f.name.trim(), times, start: f.start || dkey(new Date()), days: +f.days || 0, notes: (f.notes || '').trim() };
    const item: Item = med
      ? { ...common, type: 'med', strength: (f.strength || '').trim(), qty: +f.qty || 1, unit: f.unit, prescriber: (f.prescriber || '').trim() }
      : { ...common, type: 'physio', sets: +f.sets, reps: +f.reps };
    onSave(item, !!f.editId);
  };

  const q = f.query.trim().toLowerCase();
  const loc = q.length >= 2
    ? MEDS.filter((m) => m.toLowerCase().indexOf(q) >= 0)
        .sort((a, b) => a.toLowerCase().indexOf(q) - b.toLowerCase().indexOf(q) || a.localeCompare(b))
        .slice(0, 6)
    : [];
  const netNames = net.q === q ? net.names.filter((n) => loc.indexOf(n) < 0).slice(0, 5) : [];
  const results: [string, string][] = [...loc.map((n) => [n, 'GENERIC NAME'] as [string, string]), ...netNames.map((n) => [n, 'NHS · PRODUCT'] as [string, string])];

  return (
    <Sheet
      visible
      onClose={onClose}
      eyebrow={f.editId ? 'EDIT ENTRY' : 'NEW ENTRY'}
      save={<SaveBtn label={f.editId ? 'Save changes' : 'Add to plan'} onPress={save} disabled={!f.name.trim()} tick />}
    >
      <T style={sh.h2}>{f.editId ? 'Edit ' + f.name : 'Add to your plan'}</T>
      {!f.editId ? (
        <Seg
          options={[['med', 'Medication'], ['physio', 'Physio']]}
          value={f.mode}
          onChange={(m) => {
            if (m !== f.mode) setForm(newForm(m));
          }}
        />
      ) : null}

      {med ? (
        <>
          <View style={sh.fld}>
            <Lbl>Medicine</Lbl>
            {f.name ? (
              <View style={sh.picked}>
                <T style={sh.pickedN}>{f.name}</T>
                <Pressable style={sh.pickedB} onPress={() => set({ name: '', query: '' })} accessibilityRole="button">
                  <T style={{ color: C.paper, fontSize: 14 }}>Change</T>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={sh.search}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth={2} strokeLinecap="round">
                    <Circle cx={11} cy={11} r={7} />
                    <Path d="M20 20l-4-4" />
                  </Svg>
                  <TextInput
                    style={sh.searchInp}
                    value={f.query}
                    onChangeText={(v) => set({ query: v })}
                    placeholder="Start typing, e.g. para"
                    placeholderTextColor="#7D93AB"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={!f.editId}
                    accessibilityLabel="Medicine"
                    returnKeyType="search"
                  />
                </View>
                {q.length < 2 ? (
                  <T style={sh.hint}>Type two or more letters.</T>
                ) : (
                  <>
                    {results.length ? (
                      <View style={sh.results}>
                        {results.map(([n, k]) => (
                          <Pressable key={n} style={({ pressed }) => [sh.result, pressed && { backgroundColor: 'rgba(29,95,184,0.08)' }]} onPress={() => pick(n)} accessibilityRole="button">
                            <T style={sh.resN}>{n}</T>
                            <Mono style={sh.resK}>{k}</Mono>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <T style={sh.hint}>No match in the list. Check the spelling on your label.</T>
                    )}
                    <Btn kind="linkPaper" label={'Use “' + f.query.trim() + '” as typed'} onPress={() => pick(f.query.trim())} />
                  </>
                )}
              </>
            )}
          </View>
          <View style={sh.fld}>
            <Lbl>Strength</Lbl>
            <Input value={f.strength} onChangeText={(v) => set({ strength: v })} placeholder="e.g. 400 mg" />
          </View>
          <View style={sh.fld}>
            <Lbl>Form</Lbl>
            <View style={sh.units}>
              {UNITS.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => set({ unit: u, qty: u === 'ml' ? Math.max(2.5, f.qty) : Math.max(1, Math.round(f.qty)) })}
                  style={[sh.unit, u === f.unit && sh.unitOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: u === f.unit }}
                >
                  <T style={[sh.unitT, u === f.unit && { color: C.paper }]}>{u}</T>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={sh.fld}>
            <Lbl>Each dose</Lbl>
            <Step label={plural(f.qty, f.unit)} onDec={() => inc('qty', -1)} onInc={() => inc('qty', 1)} decLabel="Less" incLabel="More" />
          </View>
        </>
      ) : (
        <>
          <View style={sh.fld}>
            <Lbl>Exercise</Lbl>
            <Input value={f.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Heel slides" autoFocus={!f.editId} />
          </View>
          <View style={sh.grid2}>
            <View style={[sh.fld, { flex: 1 }]}>
              <Lbl>Sets</Lbl>
              <Step label={String(f.sets)} onDec={() => inc('sets', -1)} onInc={() => inc('sets', 1)} decLabel="Fewer sets" incLabel="More sets" />
            </View>
            <View style={[sh.fld, { flex: 1 }]}>
              <Lbl>Reps</Lbl>
              <Step label={String(f.reps)} onDec={() => inc('reps', -1)} onInc={() => inc('reps', 1)} decLabel="Fewer reps" incLabel="More reps" />
            </View>
          </View>
        </>
      )}

      <View style={sh.fld}>
        <Lbl>{med ? 'Times a day' : 'Sessions a day'}</Lbl>
        <Seg
          mono
          options={[1, 2, 3, 4].map((i) => [i, i + '×'] as [number, string])}
          value={f.times.length}
          onChange={(n) => {
            const cur = f.times.slice();
            set({ times: DEFAULT_TIMES[n].map((d, i) => (cur.length === n ? cur[i] : d)) });
            setFreqKey((k) => k + 1);
          }}
        />
        <View style={sh.timegrid} key={freqKey}>
          {f.times.map((t, i) => (
            <PickField
              key={i}
              mode="time"
              label={'Time ' + (i + 1)}
              value={at(dkey(new Date()), t)}
              style={sh.timeChip}
              onChange={(d) => {
                const times = f.times.slice();
                times[i] = hhmm(d);
                set({ times });
              }}
            />
          ))}
        </View>
        <T style={sh.hint}>Tap a time to change it.</T>
      </View>

      <View style={sh.grid2}>
        <View style={[sh.fld, { flex: 1 }]}>
          <Lbl>Start date</Lbl>
          <PickField mode="date" label="Start date" value={parseD(f.start)} style={sh.dateChip} onChange={(d) => set({ start: dkey(d) })} />
        </View>
        <View style={[sh.fld, { flex: 1 }]}>
          <Lbl>For how long</Lbl>
          <Step label={f.days ? f.days + ' days' : 'Ongoing'} onDec={() => inc('days', -1)} onInc={() => inc('days', 1)} decLabel="Fewer days" incLabel="More days" />
        </View>
      </View>

      {med ? (
        <View style={sh.fld}>
          <Lbl>As prescribed by</Lbl>
          <Input value={f.prescriber} onChangeText={(v) => set({ prescriber: v })} placeholder="Optional, e.g. surgeon or GP" />
        </View>
      ) : null}
      <View style={sh.fld}>
        <Lbl>{med ? 'Instructions from the label' : 'Notes from your physio'}</Lbl>
        <Input
          value={f.notes}
          onChangeText={(v) => set({ notes: v })}
          placeholder={med ? 'e.g. With food' : 'e.g. Stop if pain goes above 6/10'}
          multiline
          style={sh.textarea}
        />
      </View>
      <Mono style={sh.note}>Enter what is on your prescription label. Medicine names are from the NHS dm+d list.</Mono>
    </Sheet>
  );
}

/* ---------- log physio session ---------- */
export type PhysioForm = { key: string; sets: number; pain: number; note: string };
export function PhysioSheet({
  data, form, setForm, onClose, onSave,
}: { data: Data; form: PhysioForm | null; setForm: (f: PhysioForm) => void; onClose: () => void; onSave: () => void }) {
  if (!form) return null;
  const it = data.items.find((i) => i.id === form.key.split('@')[0]);
  const max = it && it.type === 'physio' ? it.sets : form.sets;
  return (
    <Sheet visible onClose={onClose} eyebrow={'LOG SESSION · ' + form.key.split('@')[1]} save={<SaveBtn label="Save session" onPress={onSave} />}>
      <T style={sh.h2}>{it ? it.name : 'Session'}</T>
      <T style={sh.hint}>{it ? doseLine(it) : ''}</T>
      <View style={sh.fld}>
        <Lbl>Sets done</Lbl>
        <Step
          label={form.sets + ' of ' + max}
          onDec={() => setForm({ ...form, sets: Math.max(1, form.sets - 1) })}
          onInc={() => setForm({ ...form, sets: Math.min(10, form.sets + 1) })}
          decLabel="Fewer"
          incLabel="More"
        />
      </View>
      <View style={sh.fld}>
        <Lbl>Pain during the session</Lbl>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T style={sh.bigval}>{form.pain}</T>
          <T style={sh.hint}>out of 10</T>
        </View>
        <View style={sh.pain} accessibilityRole="adjustable" accessibilityLabel="Pain out of 10" accessibilityValue={{ min: 0, max: 10, now: form.pain }}>
          {Array.from({ length: 11 }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => setForm({ ...form, pain: i })}
              style={[sh.painB, i <= form.pain && { backgroundColor: i === form.pain ? C.cobalt : 'rgba(29,95,184,0.35)' }]}
              accessibilityLabel={'Pain ' + i}
            >
              <Mono style={[sh.painT, i <= form.pain && { color: C.white }]}>{i}</Mono>
            </Pressable>
          ))}
        </View>
        <View style={sh.painscale}>
          <Mono style={sh.painLbl}>0 NONE</Mono>
          <Mono style={sh.painLbl}>5</Mono>
          <Mono style={sh.painLbl}>10 WORST</Mono>
        </View>
      </View>
      <View style={sh.fld}>
        <Lbl>Note</Lbl>
        <Input value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} placeholder="Optional, e.g. stiff at the start" multiline style={sh.textarea} />
      </View>
    </Sheet>
  );
}

/* ---------- restore ---------- */
export function RestoreSheet({ visible, onClose, onRestore }: { visible: boolean; onClose: () => void; onRestore: (d: Data) => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('This replaces the plan and history on this phone.');
  const choose = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      setText(await new File(r.assets[0].uri).text());
    } catch {
      setMsg("Couldn't read that file. Try pasting the backup text instead.");
    }
  };
  const go = () => {
    try {
      const d = JSON.parse(text);
      if (!isData(d)) throw new Error('bad');
      onRestore(d);
    } catch {
      setMsg("That doesn't look like a PillTime backup. Paste the whole text, starting with {");
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="RESTORE" save={<SaveBtn label="Restore" onPress={go} disabled={!text.trim()} />}>
      <T style={sh.h2}>Restore a backup</T>
      <View style={sh.fld}>
        <Lbl>Paste your backup</Lbl>
        <Input value={text} onChangeText={setText} placeholder="Paste the backup text here" multiline style={sh.codebox} autoCapitalize="none" autoCorrect={false} />
      </View>
      <View style={sh.fld}>
        <Lbl>Or choose a backup file</Lbl>
        <Btn kind="outPaper" label="Choose file" onPress={choose} style={{ alignSelf: 'flex-start' }} />
      </View>
      <T style={sh.hint}>{msg}</T>
    </Sheet>
  );
}

/* ---------- erase ---------- */
export function WipeSheet({ visible, onClose, onWipe }: { visible: boolean; onClose: () => void; onWipe: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="ERASE" save={<SaveBtn label="Erase everything" onPress={onWipe} />}>
      <T style={sh.h2}>Erase everything?</T>
      <T style={sh.hint}>Your plan, your whole history and every scheduled reminder will be removed from this phone. Back up first if you might want it again.</T>
    </Sheet>
  );
}


const sh = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  sheet: { maxHeight: '100%', backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingHorizontal: 16, paddingBottom: 6 },
  x: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.pline, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 4, paddingBottom: 20, paddingHorizontal: 20, gap: 18 },
  h2: { fontFamily: F.semi, fontSize: 28, letterSpacing: -0.56, color: C.navy },
  save: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: C.pline, backgroundColor: C.paper },
  saveBtn: { minHeight: 56, borderRadius: 16, backgroundColor: C.navy, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  saveT: { color: C.paper, fontSize: 17, fontFamily: F.semi },
  lbl: { fontSize: 11, letterSpacing: 1.76, textTransform: 'uppercase', color: C.slate },
  fld: { gap: 8 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: 'rgba(11,42,74,0.07)' },
  segB: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.white, shadowColor: C.navy, shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segT: { color: C.slate, fontFamily: F.semi, fontSize: 15 },
  inp: { minHeight: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.pline, fontSize: 16, color: C.navy, fontFamily: F.regular },
  textarea: { minHeight: 84, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  codebox: { minHeight: 140, fontFamily: F.mono, fontSize: 11, paddingTop: 12, textAlignVertical: 'top' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.navy },
  searchInp: { flex: 1, fontSize: 17, color: C.navy, fontFamily: F.regular, minHeight: 48 },
  results: { padding: 4, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.pline },
  result: { minHeight: 48, justifyContent: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  resN: { fontSize: 15, fontFamily: F.semi, color: C.navy },
  resK: { fontSize: 10, letterSpacing: 1, color: C.slate },
  hint: { fontSize: 13, color: C.slate, lineHeight: 19 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.navy },
  pickedN: { flex: 1, fontSize: 16, fontFamily: F.semi, color: C.paper },
  pickedB: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(238,244,251,0.4)', justifyContent: 'center' },
  grid2: { flexDirection: 'row', gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 6, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.pline },
  stepB: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(11,42,74,0.07)', alignItems: 'center', justifyContent: 'center' },
  stepBT: { fontSize: 20, color: C.navy },
  stepT: { fontSize: 15, fontFamily: F.semi, color: C.navy, textAlign: 'center', flexShrink: 1, fontVariant: ['tabular-nums'] },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unit: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.pline, backgroundColor: C.white, justifyContent: 'center' },
  unitOn: { backgroundColor: C.navy, borderColor: C.navy },
  unitT: { fontSize: 14, color: C.navy },
  timegrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minHeight: 46, width: 108, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.navy, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  dateChip: { minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.pline, backgroundColor: C.white, justifyContent: 'center' },
  pickT: { fontSize: 15, color: C.navy },
  iosPick: { width: '100%', backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.pline, paddingHorizontal: 8, alignItems: 'center' },
  note: { fontSize: 11, lineHeight: 18, color: C.slate },
  bigval: { fontSize: 40, fontFamily: F.bold, letterSpacing: -1.2, color: C.navy, fontVariant: ['tabular-nums'] },
  pain: { flexDirection: 'row', gap: 3 },
  painB: { flex: 1, height: 44, borderRadius: 8, backgroundColor: 'rgba(11,42,74,0.07)', alignItems: 'center', justifyContent: 'center' },
  painT: { fontSize: 13, color: C.navy },
  painscale: { flexDirection: 'row', justifyContent: 'space-between' },
  painLbl: { fontSize: 11, color: C.slate },
});
