import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { C, F } from './theme';

/** The 26px blueprint grid behind the screens and sheets. */
export function Grid({ color = 'rgba(143,180,217,0.065)' }: { color?: string }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="g" width={26} height={26} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0.5} x2={26} y2={0.5} stroke={color} strokeWidth={1} />
          <Line x1={0.5} y1={0} x2={0.5} y2={26} stroke={color} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#g)" />
    </Svg>
  );
}

export function T({ style, ...p }: TextProps) {
  return <Text {...p} style={[s.t, style]} maxFontSizeMultiplier={1.6} />;
}
export function Mono({ style, ...p }: TextProps) {
  return <Text {...p} style={[s.mono, style]} maxFontSizeMultiplier={1.4} />;
}
export function Eyebrow({ style, children, paper }: { style?: StyleProp<TextStyle>; children: React.ReactNode; paper?: boolean }) {
  return <Mono style={[s.eyebrow, paper && { color: C.slate }, style]}>{children}</Mono>;
}
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.chip}>
      <Mono style={s.chipT}>{children}</Mono>
    </View>
  );
}

type BtnKind = 'take' | 'ghost' | 'state' | 'skipped' | 'primary' | 'out' | 'outPaper' | 'danger' | 'link' | 'linkPaper';
export function Btn({
  kind,
  label,
  small,
  style,
  textStyle,
  ...p
}: PressableProps & { kind: BtnKind; label: string; small?: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      {...p}
      style={({ pressed }) => [s.btn, bs[kind], pressed && { opacity: 0.7 }, p.disabled && { opacity: 0.45 }, style]}
    >
      <T style={[s.btnT, bt[kind], textStyle]}>{label}</T>
      {small ? <Mono style={s.small}>{small}</Mono> : null}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  t: { fontFamily: F.regular, color: C.ice, fontSize: 16 },
  mono: { fontFamily: F.mono, color: C.mist, fontSize: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 1.76, color: C.mist, textTransform: 'uppercase' },
  chip: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  chipT: { fontSize: 11, letterSpacing: 1.3, color: C.mist },
  h1: { fontFamily: F.semi, fontSize: 32, lineHeight: 34, letterSpacing: -0.64, color: C.ice },
  h2: { fontFamily: F.semi, fontSize: 20, letterSpacing: -0.2, color: C.ice },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  stack: { gap: 6, flexShrink: 1 },
  foot: { fontFamily: F.mono, fontSize: 11, lineHeight: 18, color: C.mist },
  btn: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnT: { fontSize: 14, fontFamily: F.semi },
  small: { fontSize: 10, color: C.mist, marginTop: 1 },
  card: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 18, padding: 16, gap: 10, backgroundColor: C.card },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, borderRadius: 20, paddingVertical: 28, paddingHorizontal: 20, gap: 14, alignItems: 'flex-start' },
  emptyP: { color: C.mist, lineHeight: 24 },
});

const bs = StyleSheet.create({
  take: { minWidth: 72, borderWidth: 1.5, borderColor: C.ice, backgroundColor: C.ice },
  ghost: { minWidth: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: C.lineStrong },
  state: { borderWidth: 1.5, borderColor: C.signal },
  skipped: { borderWidth: 1.5, borderColor: C.mist, borderStyle: 'dashed' },
  primary: { minHeight: 52, paddingHorizontal: 20, borderRadius: 14, backgroundColor: C.signal },
  out: { paddingHorizontal: 14, borderWidth: 1, borderColor: C.lineStrong },
  outPaper: { paddingHorizontal: 14, borderWidth: 1, borderColor: C.pline },
  danger: { paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.ice },
  link: { paddingHorizontal: 0, alignItems: 'flex-start' },
  linkPaper: { paddingHorizontal: 0, alignItems: 'flex-start' },
});
const bt = StyleSheet.create({
  take: { color: C.ink },
  ghost: { color: C.mist, fontFamily: F.regular, fontSize: 13 },
  state: { color: C.signal, fontSize: 13, lineHeight: 15 },
  skipped: { color: C.mist, fontSize: 13, lineHeight: 15 },
  primary: { color: C.ink, fontSize: 16 },
  out: { color: C.ice },
  outPaper: { color: C.navy },
  danger: { color: C.ice },
  link: { color: C.signal },
  linkPaper: { color: C.cobalt },
});
