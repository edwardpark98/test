import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Line, Rect } from 'react-native-svg';
import { C, F } from './theme';
import { Grid, Mono } from './ui';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const DUR = 2800;
const PERIM = 2 * (120 - 56) + Math.PI * 56; // capsule outline length

/** Opening animation: dial ticks, a sweep hand, the capsule drawing and filling, then the word. */
export function Loader({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [p] = useState(() => new Animated.Value(0)); // 0..1 over DUR
  const [out] = useState(() => new Animated.Value(1));
  const done = useRef(false);

  const hide = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(out, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        p.setValue(1);
        t = setTimeout(hide, 300);
      } else {
        Animated.timing(p, { toValue: 1, duration: DUR, easing: Easing.linear, useNativeDriver: false }).start();
        t = setTimeout(hide, DUR + 300);
      }
    });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seg = (a: number, b: number, from: number, to: number, ease = (x: number) => x) =>
    p.interpolate({ inputRange: [0, a, b, 1], outputRange: [from, from, to, to], easing: ease, extrapolate: 'clamp' });

  const ticks = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * 2 * Math.PI - Math.PI / 2;
    const mj = i % 9 === 0;
    const r2 = 100 + (mj ? 12 : 7);
    const d = (i * 18) / DUR;
    ticks.push(
      <AnimatedLine
        key={i}
        x1={120 + 100 * Math.cos(a)}
        y1={120 + 100 * Math.sin(a)}
        x2={120 + r2 * Math.cos(a)}
        y2={120 + r2 * Math.sin(a)}
        stroke={mj ? C.ice : C.mist}
        strokeWidth={mj ? 2.5 : 1.4}
        strokeLinecap="round"
        opacity={seg(0.08 + d, 0.2 + d, 0, 1)}
      />,
    );
  }

  const sweepRot = seg(0.12, 0.8, 0, 360, Easing.bezier(0.45, 0, 0.2, 1)).interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const sweepOp = p.interpolate({ inputRange: [0, 0.12, 0.18, 0.8, 0.92, 1], outputRange: [0, 0, 1, 1, 0, 0] });
  const pulseOp = p.interpolate({ inputRange: [0, 0.72, 0.8, 1], outputRange: [0, 0, 0.6, 0] });
  const pulseSc = p.interpolate({ inputRange: [0, 0.72, 0.8, 1], outputRange: [0.8, 0.8, 1, 1.4] });
  const draw = seg(0.12, 0.48, PERIM, 0, Easing.bezier(0.65, 0, 0.35, 1));
  const fillY = seg(0.42, 0.7, 180, 118, Easing.bezier(0.3, 0.7, 0.2, 1));
  const seam = seg(0.6, 0.72, 0, 1);
  const tagOp = seg(0.78, 1, 0, 1);
  const tagLs = seg(0.78, 1, 5.5, 2.4);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.root, { opacity: out }]} accessibilityLabel="PillTime is loading" accessible>
      <Pressable style={StyleSheet.absoluteFill} onPress={hide}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: seg(0, 0.18, 0, 1) }]}>
          <Grid color="rgba(143,180,217,0.08)" />
        </Animated.View>
        <Animated.View style={[st.corner, { top: insets.top + 22, left: 22, opacity: seg(0, 0.18, 0, 1) }]}>
          <Mono style={st.cornerT}>FIG. 01 · DOSE</Mono>
        </Animated.View>
        <Animated.View style={[st.corner, { top: insets.top + 22, right: 22, opacity: seg(0, 0.18, 0, 1) }]}>
          <Mono style={st.cornerT}>24H</Mono>
        </Animated.View>
        <View style={st.center}>
          <View style={st.mark}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulseOp, transform: [{ scale: pulseSc }] }]}>
              <Svg width={220} height={220} viewBox="0 0 240 240">
                <Circle cx={120} cy={120} r={80} fill="none" stroke={C.signal} strokeWidth={1.5} />
              </Svg>
            </Animated.View>
            <Svg width={220} height={220} viewBox="0 0 240 240" style={StyleSheet.absoluteFill}>
              {ticks}
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: sweepOp, transform: [{ rotate: sweepRot }] }]}>
              <Svg width={220} height={220} viewBox="0 0 240 240">
                <Line x1={120} y1={120} x2={120} y2={22} stroke={C.signal} strokeWidth={1.5} strokeLinecap="round" />
                <Circle cx={120} cy={22} r={3.5} fill={C.signal} />
              </Svg>
            </Animated.View>
            <Svg width={220} height={220} viewBox="0 0 240 240" style={StyleSheet.absoluteFill}>
              <Defs>
                <ClipPath id="ldcap">
                  <Rect x={92} y={60} width={56} height={120} rx={28} />
                </ClipPath>
              </Defs>
              <G rotation={35} origin="120, 120">
                <G clipPath="url(#ldcap)">
                  <AnimatedRect x={80} y={fillY} width={80} height={80} fill={C.signal} />
                </G>
                <AnimatedLine x1={92} y1={120} x2={148} y2={120} stroke={C.ice} strokeWidth={2} opacity={seam} />
                <AnimatedRect
                  x={92}
                  y={60}
                  width={56}
                  height={120}
                  rx={28}
                  fill="none"
                  stroke={C.ice}
                  strokeWidth={2.5}
                  strokeDasharray={`${PERIM} ${PERIM}`}
                  strokeDashoffset={draw}
                />
              </G>
            </Svg>
          </View>
          <View style={st.word} accessible={false}>
            {'PillTime'.split('').map((ch, i) => {
              const d = (i * 35) / DUR;
              return (
                <Animated.Text
                  key={i}
                  style={[
                    st.letter,
                    { color: i >= 4 ? C.signal : C.ice },
                    { opacity: seg(0.62 + d, 0.8 + d, 0, 1), transform: [{ translateY: seg(0.62 + d, 0.8 + d, 18, 0, Easing.bezier(0.2, 0.8, 0.2, 1)) }] },
                  ]}
                >
                  {ch}
                </Animated.Text>
              );
            })}
          </View>
          <Animated.Text style={[st.tag, { opacity: tagOp, letterSpacing: tagLs }]}>YOUR PLAN · ON TIME</Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { backgroundColor: C.ink, zIndex: 50 },
  corner: { position: 'absolute' },
  cornerT: { fontSize: 11, letterSpacing: 1.76 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  mark: { width: 220, height: 220 },
  word: { flexDirection: 'row' },
  letter: { fontFamily: F.bold, fontSize: 44, letterSpacing: -1.3, lineHeight: 48 },
  tag: { fontFamily: F.mono, fontSize: 11, color: C.mist },
});
