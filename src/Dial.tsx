import React from 'react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { DayLog, Dose } from './lib';
import { C, F } from './theme';

/** 24-hour dial: hour ticks, elapsed arc, a "now" hand and a dot per dose time. */
export function Dial({ doses, log, nowM, size }: { doses: Dose[]; log: DayLog; nowM: number; size: number }) {
  const CX = 150;
  const R = 118;
  const pt = (m: number, r: number) => {
    const a = (m / 1440) * 2 * Math.PI - Math.PI / 2;
    return [CX + r * Math.cos(a), CX + r * Math.sin(a)];
  };
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const mj = i % 6 === 0;
    const a = pt(i * 60, R + 14);
    const b = pt(i * 60, R + (mj ? 24 : 19));
    ticks.push(
      <Line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.mist} strokeWidth={mj ? 2 : 1} strokeLinecap="round" opacity={mj ? 0.9 : 0.45} />,
    );
  }
  const s0 = pt(0, R);
  const e = pt(nowM, R);
  const h = pt(nowM, R - 30);
  const h0 = pt(nowM, R - 58);
  const byT: Record<number, Dose[]> = {};
  doses.forEach((d) => (byT[d.m] = byT[d.m] || []).push(d));

  return (
    <Svg width={size} height={size} viewBox="0 0 300 300" accessibilityLabel="24-hour dial of today's plan">
      {ticks}
      <Circle cx={150} cy={150} r={118} fill="none" stroke="rgba(143,180,217,0.22)" strokeWidth={10} />
      {nowM > 0 ? (
        <Path
          d={`M ${s0[0]} ${s0[1]} A ${R} ${R} 0 ${nowM > 720 ? 1 : 0} 1 ${e[0]} ${e[1]}`}
          fill="none"
          stroke={C.signal}
          strokeWidth={10}
          strokeLinecap="round"
          opacity={0.35}
        />
      ) : null}
      <Line x1={h0[0]} y1={h0[1]} x2={h[0]} y2={h[1]} stroke={C.signal} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 5" />
      <Circle cx={h[0]} cy={h[1]} r={4} fill={C.signal} />
      {Object.keys(byT).map((m) => {
        const g = byT[+m];
        const all = g.every((d) => log[d.key]);
        const p = pt(+m, R);
        return <Circle key={m} cx={p[0]} cy={p[1]} r={9} fill={all ? C.signal : C.ink} stroke={all ? C.signal : C.ice} strokeWidth={2} />;
      })}
      {(
        [
          ['00', 150, 58],
          ['06', 246, 154],
          ['12', 150, 250],
          ['18', 54, 154],
        ] as const
      ).map((l) => (
        <SvgText key={l[0]} x={l[1]} y={l[2]} textAnchor="middle" fontFamily={F.mono} fontSize={10} fill={C.mist}>
          {l[0]}
        </SvgText>
      ))}
    </Svg>
  );
}
