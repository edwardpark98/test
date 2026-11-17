import React from 'react';
import { StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { Dial } from './Dial';
import {
  activeOn, addDays, adherence, Data, DAYS, dayOf, dkey, doseLine, dosesFor, fmtShort, hhmm, Item, MONTHS, parseD, settingsOf,
} from './lib';
import { PermState, ScheduleResult } from './notify';
import { C, F } from './theme';
import { Btn, Chip, Eyebrow, Mono, s, T } from './ui';

export type Actions = {
  add: () => void;
  take: (key: string) => void;
  skip: (key: string) => void;
  undo: (day: string, key: string) => void;
  logPhysio: (key: string) => void;
  clearSample: () => void;
  edit: (it: Item) => void;
  remove: (id: string) => void;
};

/* ---------- Today ---------- */
export function Today({ data, a, now }: { data: Data; a: Actions; now: Date }) {
  const { width } = useWindowDimensions();
  const k = dkey(now);
  const nm = now.getHours() * 60 + now.getMinutes();
  const doses = dosesFor(data, k);
  const log = data.logs[k] || {};
  const greet = now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening';

  const header = (
    <>
      {data.sample ? (
        <View style={st.banner}>
          <T style={st.bannerT}>Sample plan, to show how it works.</T>
          <Btn kind="link" label="Start my own plan" onPress={a.clearSample} />
        </View>
      ) : null}
      <View style={s.head}>
        <View style={s.stack}>
          <Eyebrow>{DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' · ' + hhmm(now)}</Eyebrow>
          <T style={s.h1}>{greet + (data.name ? ', ' + data.name : '')}</T>
        </View>
        <Chip>PILLTIME</Chip>
      </View>
    </>
  );

  if (!doses.length) {
    return (
      <>
        {header}
        <View style={s.empty}>
          <Eyebrow>NOTHING SCHEDULED TODAY</Eyebrow>
          <T style={s.h2}>Add your first medicine or exercise</T>
          <T style={s.emptyP}>Enter it exactly as it appears on your prescription label. Reminders and logging follow from there.</T>
          <Btn kind="primary" label="Add to plan" onPress={a.add} />
        </View>
      </>
    );
  }

  const pend = doses.filter((d) => !log[d.key]);
  const nx = pend.find((d) => d.m >= nm);
  const over = pend.filter((d) => d.m < nm);
  let c: { l: string; n: string; d: string; e: string };
  if (over.length) {
    const d0 = over[0];
    c = { l: 'DUE · ' + d0.time, n: d0.item.name, d: doseLine(d0.item), e: over.length > 1 ? over.length + ' due now' : 'due now' };
  } else if (nx) {
    const diff = nx.m - nm;
    c = { l: 'NEXT · ' + nx.time, n: nx.item.name, d: doseLine(nx.item), e: 'in ' + (diff >= 60 ? Math.floor(diff / 60) + ' h ' + (diff % 60) + ' min' : diff + ' min') };
  } else c = { l: 'TODAY', n: 'All logged', d: 'Nothing left today', e: 'see you tomorrow' };

  const tk = doses.filter((d) => log[d.key] && log[d.key].s !== 'skipped').length;
  const wk = adherence(data, 7);
  const dial = Math.min(300, width * 0.78);

  return (
    <>
      {header}
      <View style={{ width: dial, height: dial, alignSelf: 'center' }}>
        <Dial doses={doses} log={log} nowM={nm} size={dial} />
        <View style={[st.centre, { top: dial * 0.26, bottom: dial * 0.26, left: dial * 0.26, right: dial * 0.26 }]}>
          <Eyebrow style={{ textAlign: 'center' }}>{c.l}</Eyebrow>
          <T style={[st.cNm, { fontSize: Math.max(18, Math.min(24, width * 0.056)) }]} numberOfLines={2} adjustsFontSizeToFit>
            {c.n}
          </T>
          <T style={st.cDs} numberOfLines={2}>{c.d}</T>
          <Mono style={st.cEta}>{c.e}</Mono>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={st.progRow}>
          <Mono style={st.progT}>{tk + ' OF ' + doses.length + ' DONE'}</Mono>
          <Mono style={st.progT}>{'LAST 7 DAYS · ' + (wk == null ? '—' : wk + '%')}</Mono>
        </View>
        <View style={st.segs}>
          {doses.map((d) => {
            const l = log[d.key];
            return <View key={d.key} style={[st.seg, l && (l.s === 'skipped' ? st.segSkip : st.segOn)]} />;
          })}
        </View>
      </View>
      <View>
        <Eyebrow style={{ paddingBottom: 8 }}>SCHEDULE</Eyebrow>
        {doses.map((d) => {
          const l = log[d.key];
          const it = d.item;
          const due = !l && d.m <= nm;
          let sub = doseLine(it) + (it.notes ? ' · ' + it.notes : '');
          if (l && l.pain != null) sub = (l.sets != null ? l.sets + ' sets · ' : '') + 'pain ' + l.pain + '/10' + (l.note ? ' · ' + l.note : '');
          return (
            <View key={d.key} style={st.dose}>
              <View style={{ width: 54 }}>
                <Mono style={[st.doseT, due && { color: C.signal }]}>{d.time}</Mono>
                {due ? <Mono style={st.dueT}>DUE</Mono> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={[st.doseNm, l && st.doseDone]}>
                  {it.type === 'physio' ? <Mono style={st.kind}>PHYSIO </Mono> : null}
                  {it.name}
                </T>
                <T style={st.doseSub}>{sub}</T>
              </View>
              <View style={st.acts}>
                {l ? (
                  <Btn
                    kind={l.s === 'skipped' ? 'skipped' : 'state'}
                    label={l.s === 'skipped' ? 'Skipped' : it.type === 'physio' ? 'Done' : 'Taken'}
                    small={(l.at || '') + ' · undo'}
                    accessibilityLabel={'Undo ' + it.name + ' at ' + d.time}
                    onPress={() => a.undo(k, d.key)}
                  />
                ) : (
                  <>
                    <Btn kind="ghost" label="Skip" onPress={() => a.skip(d.key)} />
                    <Btn
                      kind="take"
                      label={it.type === 'physio' ? 'Log' : 'Take'}
                      onPress={() => (it.type === 'physio' ? a.logPhysio(d.key) : a.take(d.key))}
                    />
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <T style={s.foot}>Follow your pharmacy label and your clinician’s advice if anything here differs.</T>
    </>
  );
}

/* ---------- Plan ---------- */
export function Plan({ data, a, confirmDel, setConfirmDel }: { data: Data; a: Actions; confirmDel: string | null; setConfirmDel: (id: string | null) => void }) {
  const k = dkey(new Date());
  const head = (
    <View style={s.head}>
      <View style={s.stack}>
        <Eyebrow>YOUR PLAN</Eyebrow>
        <T style={s.h1}>What you take and do</T>
      </View>
    </View>
  );
  if (!data.items.length) {
    return (
      <>
        {head}
        <View style={s.empty}>
          <T style={s.h2}>Your plan is empty</T>
          <T style={s.emptyP}>Add each medicine and exercise from your discharge letter or prescription.</T>
          <Btn kind="primary" label="Add to plan" onPress={a.add} />
        </View>
      </>
    );
  }
  return (
    <>
      {head}
      {(
        [
          ['med', 'MEDICATION'],
          ['physio', 'PHYSIO'],
        ] as const
      ).map(([type, label]) => {
        const its = data.items.filter((i) => i.type === type);
        if (!its.length) return null;
        return (
          <View key={type} style={{ gap: 10 }}>
            <Eyebrow>{label}</Eyebrow>
            {its.map((it) => {
              const end = it.days ? addDays(it.start, it.days - 1) : null;
              const act = activeOn(it, k);
              const fut = k < it.start;
              const status = fut
                ? 'Starts ' + fmtShort(it.start)
                : !act
                  ? 'Finished ' + fmtShort(end!)
                  : it.days
                    ? 'Day ' + dayOf(it, k) + ' of ' + it.days + ' · ends ' + fmtShort(end!)
                    : 'Ongoing';
              const extra = [it.notes, it.type === 'med' && it.prescriber ? 'Prescribed by ' + it.prescriber : ''].filter(Boolean).join(' · ');
              return (
                <View key={it.id} style={s.card}>
                  <View style={[st.cardTop, { flexWrap: 'wrap' }]}>
                    <View style={{ gap: 4, flexGrow: 1, flexShrink: 1, flexBasis: 160 }}>
                      <T style={st.cardNm}>{it.name}</T>
                      <T style={st.cardSub}>{doseLine(it) + ' · ' + it.times.length + '× a day'}</T>
                    </View>
                    <Chip>{status.toUpperCase()}</Chip>
                  </View>
                  <View style={st.times}>
                    {it.times.map((t) => (
                      <View key={t} style={st.timeChip}>
                        <Mono style={{ color: C.ice }}>{t}</Mono>
                      </View>
                    ))}
                  </View>
                  {extra ? <T style={st.cardSub}>{extra}</T> : null}
                  {confirmDel === it.id ? (
                    <View style={st.row}>
                      <T style={{ fontSize: 14, flexBasis: '100%' }}>{'Remove ' + it.name + ' and its reminders?'}</T>
                      <Btn kind="danger" label="Remove" onPress={() => a.remove(it.id)} />
                      <Btn kind="out" label="Keep" onPress={() => setConfirmDel(null)} />
                    </View>
                  ) : (
                    <View style={st.row}>
                      <Btn kind="out" label="Edit" onPress={() => a.edit(it)} />
                      <Btn kind="out" label="Remove" onPress={() => setConfirmDel(it.id)} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

/* ---------- Log ---------- */
export function Log({ data }: { data: Data }) {
  const t = dkey(new Date());
  const bars = [];
  for (let i = 13; i >= 0; i--) {
    const k = addDays(t, -i);
    const ds = dosesFor(data, k);
    const lg = data.logs[k] || {};
    const n = ds.length;
    const tk = ds.filter((d) => lg[d.key] && lg[d.key].s !== 'skipped').length;
    const p = n ? tk / n : 0;
    bars.push({ k, n, h: n ? Math.max(3, p * 100) : 3, today: i === 0, lbl: i === 0 ? 'T' : DAYS[parseD(k).getDay()].charAt(0) });
  }
  const a7 = adherence(data, 7);
  const a14 = adherence(data, 14);
  const days = [];
  for (let j = 0; j < 14; j++) {
    const dk = addDays(t, -j);
    const lg2 = data.logs[dk];
    if (!lg2) continue;
    const ks = Object.keys(lg2);
    if (!ks.length) continue;
    const dd = parseD(dk);
    const entries = ks
      .map((key) => {
        const p = key.split('@');
        return { key, t: p[1], it: data.items.find((x) => x.id === p[0]), l: lg2[key] };
      })
      .sort((x, y) => (x.t < y.t ? -1 : 1));
    days.push(
      <View key={dk} style={{ gap: 2 }}>
        <Mono style={st.dayH}>{j === 0 ? 'TODAY' : DAYS[dd.getDay()] + ' ' + dd.getDate() + ' ' + MONTHS[dd.getMonth()]}</Mono>
        {entries.map((e) => (
          <View key={e.key} style={st.entry}>
            <Mono style={{ width: 54 }}>{e.t}</Mono>
            <T style={{ flex: 1, fontSize: 14 }}>{(e.it ? e.it.name : 'Removed item') + (e.l.pain != null ? ' · pain ' + e.l.pain + '/10' : '')}</T>
            <Mono style={{ fontSize: 11, color: e.l.s === 'skipped' ? C.mist : C.signal }}>{e.l.s === 'skipped' ? 'SKIPPED' : 'DONE ' + (e.l.at || '')}</Mono>
          </View>
        ))}
      </View>,
    );
  }
  return (
    <>
      <View style={s.head}>
        <View style={s.stack}>
          <Eyebrow>HISTORY</Eyebrow>
          <T style={s.h1}>How it’s going</T>
        </View>
      </View>
      <View style={s.card}>
        <View style={st.cardTop}>
          <Eyebrow style={{ flex: 1 }}>DOSES DONE, LAST 14 DAYS</Eyebrow>
          <Chip>{'7D ' + (a7 == null ? '—' : a7 + '%') + ' · 14D ' + (a14 == null ? '—' : a14 + '%')}</Chip>
        </View>
        <View style={st.bars} accessibilityLabel="Share of scheduled doses done each day for the last 14 days">
          {bars.map((b) => (
            <View key={b.k} style={st.barCol}>
              <View style={[st.bar, { height: `${b.h}%` }, !b.n ? st.barNone : b.today ? st.barToday : null]} />
            </View>
          ))}
        </View>
        <View style={st.barLbl}>
          {bars.map((b) => (
            <Mono key={b.k} style={st.barLblT}>{b.lbl}</Mono>
          ))}
        </View>
      </View>
      {days.length ? days : <T style={s.foot}>Nothing logged yet. Tap Take on the Today screen and it appears here.</T>}
    </>
  );
}

/* ---------- More ---------- */
export type MoreActions = {
  setName: (n: string) => void;
  enableReminders: () => void;
  allowExact: () => void;
  test: () => void;
  setNag: (v: boolean) => void;
  backup: () => void;
  restore: () => void;
  wipe: () => void;
};
export function More({ data, m, perm, sched }: { data: Data; m: MoreActions; perm: PermState | null; sched: ScheduleResult | null }) {
  const nag = settingsOf(data).nag;
  const next = sched?.next;
  const nextTxt = next
    ? (next.day === dkey(new Date()) ? 'today' : next.day === addDays(dkey(new Date()), 1) ? 'tomorrow' : fmtShort(next.day)) +
      ' at ' + next.time + ' · ' + next.doses.map((d) => d.item.name).join(', ')
    : null;
  return (
    <>
      <View style={s.head}>
        <View style={s.stack}>
          <Eyebrow>MORE</Eyebrow>
          <T style={s.h1}>Reminders and backup</T>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow>YOUR FIRST NAME (FOR THE GREETING)</Eyebrow>
          <TextInput
            style={st.nameInp}
            defaultValue={data.name}
            onChangeText={(v) => m.setName(v.trim())}
            placeholder="Optional"
            placeholderTextColor={C.mist}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>

        <View style={st.setrow}>
          <View style={{ flex: 1 }}>
            <T style={st.strong}>Phone reminders</T>
            <T style={st.setP}>
              {!perm
                ? 'Checking…'
                : !perm.granted
                  ? 'A notification at each dose time, even when PillTime is closed. Tap Turn on and allow notifications.'
                  : nextTxt
                    ? 'On. Next reminder ' + nextTxt + '.'
                    : 'On. Nothing left to remind you about in your plan.'}
            </T>
          </View>
          {perm && !perm.granted ? <Btn kind="out" label="Turn on" onPress={m.enableReminders} /> : perm?.granted ? <Btn kind="out" label="Test" onPress={m.test} /> : null}
        </View>

        {perm?.granted && !perm.exact ? (
          <View style={st.setrow}>
            <View style={{ flex: 1 }}>
              <T style={st.strong}>Exact timing</T>
              <T style={st.setP}>Android may deliver reminders a few minutes late until you allow alarms and reminders for PillTime.</T>
            </View>
            <Btn kind="out" label="Allow" onPress={m.allowExact} />
          </View>
        ) : null}

        <View style={st.setrow}>
          <View style={{ flex: 1 }}>
            <T style={st.strong}>Remind again if not logged</T>
            <T style={st.setP}>A second reminder 30 minutes later if you haven’t tapped Taken or Skip.</T>
          </View>
          <Switch value={nag} onValueChange={m.setNag} trackColor={{ true: C.signal, false: C.lineStrong }} thumbColor={C.ice} />
        </View>

        <View style={st.setrow}>
          <View style={{ flex: 1 }}>
            <T style={st.strong}>Back up</T>
            <T style={st.setP}>Your plan and log live only on this phone. Save a copy now and then.</T>
          </View>
          <Btn kind="out" label="Back up" onPress={m.backup} />
        </View>
        <View style={st.setrow}>
          <View style={{ flex: 1 }}>
            <T style={st.strong}>Restore</T>
            <T style={st.setP}>Load a backup you saved earlier, including one from the PillTime web app. This replaces what is here.</T>
          </View>
          <Btn kind="out" label="Restore" onPress={m.restore} />
        </View>
        <View style={st.setrow}>
          <View style={{ flex: 1 }}>
            <T style={st.strong}>Erase everything</T>
            <T style={st.setP}>Removes your plan, history and reminders from this phone.</T>
          </View>
          <Btn kind="out" label="Erase" onPress={m.wipe} />
        </View>
      </View>
      <T style={s.foot}>
        PillTime shows the schedule you enter, reminds you, and records what you did. It does not recommend or change treatment. Medicine names follow the NHS
        Dictionary of Medicines and Devices (dm+d). Contains public sector information licensed under the Open Government Licence v3.0.
      </T>
    </>
  );
}


const st = StyleSheet.create({
  banner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 14 },
  bannerT: { fontSize: 13, color: C.mist },
  centre: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 4 },
  cNm: { fontFamily: F.semi, textAlign: 'center', lineHeight: 26, letterSpacing: -0.2 },
  cDs: { fontSize: 14, color: C.mist, textAlign: 'center' },
  cEta: { color: C.signal, marginTop: 4 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progT: { letterSpacing: 0.7, fontVariant: ['tabular-nums'] },
  segs: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(143,180,217,0.22)' },
  segOn: { backgroundColor: C.signal },
  segSkip: { backgroundColor: 'rgba(143,180,217,0.45)' },
  dose: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  doseT: { fontSize: 13, fontVariant: ['tabular-nums'] },
  dueT: { fontSize: 10, letterSpacing: 1.2, color: C.signal },
  doseNm: { fontSize: 17, fontFamily: F.semi },
  doseDone: { color: C.mist, textDecorationLine: 'line-through' },
  doseSub: { fontSize: 13, color: C.mist },
  kind: { fontSize: 10, letterSpacing: 1.2, color: C.signal },
  acts: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  cardNm: { fontSize: 18, fontFamily: F.semi },
  cardSub: { fontSize: 14, color: C.mist, lineHeight: 20 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeChip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  bars: { flexDirection: 'row', gap: 5, alignItems: 'flex-end', height: 120, borderBottomWidth: 1, borderBottomColor: C.lineStrong, paddingBottom: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: C.signal, minHeight: 2 },
  barNone: { backgroundColor: 'rgba(143,180,217,0.2)' },
  barToday: { backgroundColor: C.ice },
  barLbl: { flexDirection: 'row', gap: 5 },
  barLblT: { flex: 1, fontSize: 9, textAlign: 'center' },
  dayH: { fontSize: 11, letterSpacing: 1.76, marginBottom: 6, fontFamily: F.monoMed },
  entry: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'baseline' },
  nameInp: { minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong, color: C.ice, fontFamily: F.regular, fontSize: 16 },
  setrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  strong: { fontFamily: F.semi },
  setP: { marginTop: 2, fontSize: 13, color: C.mist, lineHeight: 19 },
});
