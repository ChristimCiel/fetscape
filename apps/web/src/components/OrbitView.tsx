import { useMemo, useState } from 'react';
import type { Analysis, State, TrajectorySample, Vector } from '@orbit/core';
import { norm, relativeRIC, subtract } from '@orbit/core/geometry';
import { number } from '../api';
export function displayState(samples: TrajectorySample[], time: number): State | null {
  if (
    !samples.length ||
    time < Date.parse(samples[0].utc) ||
    time > Date.parse(samples.at(-1)!.utc)
  )
    return null;
  let low = 0,
    high = samples.length - 1;
  while (high - low > 1) {
    const m = (low + high) >> 1;
    if (Date.parse(samples[m].utc) <= time) low = m;
    else high = m;
  }
  const a = samples[low],
    b = samples[high],
    ta = Date.parse(a.utc),
    tb = Date.parse(b.utc);
  if (time === ta) return a;
  if (time === tb) return b;
  if (tb - ta > 120001) return null;
  const f = (time - ta) / (tb - ta);
  return {
    positionKm: a.positionKm.map((v, i) => v + (b.positionKm[i] - v) * f) as Vector,
    velocityKmS: a.velocityKmS.map((v, i) => v + (b.velocityKmS[i] - v) * f) as Vector,
  };
}
const COLORS = ['#a4efcf', '#f5c471', '#819bd6', '#d19aca', '#92adb5', '#b9ba8c', '#c2b8dd'];
export function OrbitView({
  run,
  targetId,
  time,
}: {
  run: Analysis;
  targetId: string;
  time: number;
}) {
  const [yaw, setYaw] = useState(28);
  const project = (p: Vector) => {
    const a = (yaw * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      x = p[0] * c - p[1] * s,
      y = p[0] * s + p[1] * c;
    return [365 + x * 0.0205, 232 - (p[2] * 0.88 - y * 0.47) * 0.0205, p[2] * 0.47 + y * 0.88];
  };
  const lines = useMemo(() => {
    const start = Math.max(Date.parse(run.parameters.startUtc), time - 45 * 60000),
      end = start + 90 * 60000;
    return run.dataset.objects.map((o, index) => ({
      o,
      color:
        o.id === run.parameters.primaryId
          ? COLORS[0]
          : o.id === targetId
            ? COLORS[1]
            : COLORS[(index + 2) % COLORS.length],
      samples: run.trajectories[o.id].filter(
        (s) => Date.parse(s.utc) >= start && Date.parse(s.utc) <= end,
      ),
    }));
  }, [run, targetId, time]);
  const paths = (front: boolean) =>
    lines.map(({ o, color, samples }) => {
      const segments: string[] = [];
      let current = '';
      samples.forEach((s) => {
        const p = project(s.positionKm),
          ok = front ? p[2] >= 0 : p[2] < 0;
        if (ok) current += `${current ? ' L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
        else if (current) {
          segments.push(current);
          current = '';
        }
      });
      if (current) segments.push(current);
      return segments.map((d, i) => (
        <path
          key={`${o.id}-${i}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={o.id === targetId || o.id === run.parameters.primaryId ? 1.7 : 0.8}
          opacity={front ? 0.85 : 0.3}
        />
      ));
    });
  return (
    <div className="orbit-scene">
      <div className="scene-label">
        <span className="live-dot" />
        ORBITAL REPLAY<span>TEME · inertial view</span>
      </div>
      <svg
        role="img"
        aria-label="SGP4 orbital trajectories around Earth, plotted in TEME coordinates"
        viewBox="0 0 730 460"
      >
        <defs>
          <radialGradient id="planet" cx="30%" cy="26%">
            <stop stopColor="#355568" />
            <stop offset=".72" stopColor="#182e40" />
            <stop offset="1" stopColor="#0e1d2d" />
          </radialGradient>
          <radialGradient id="halo">
            <stop offset=".75" stopColor="#44677c" stopOpacity="0" />
            <stop offset=".92" stopColor="#44677c" stopOpacity=".12" />
            <stop offset="1" stopColor="#44677c" stopOpacity="0" />
          </radialGradient>
          <clipPath id="earth-clip">
            <circle cx="365" cy="232" r="130.75" />
          </clipPath>
        </defs>
        {Array.from({ length: 26 }, (_, i) => (
          <circle
            key={i}
            cx={((i * 137 + 41) % 710) + 10}
            cy={((i * 79 + 23) % 425) + 12}
            r={i % 4 === 0 ? 1 : 0.6}
            fill="#8295aa"
            opacity=".45"
          />
        ))}
        <line x1="365" y1="48" x2="365" y2="417" stroke="#263748" strokeDasharray="3 7" />
        <ellipse
          cx="365"
          cy="232"
          rx="242"
          ry="83"
          fill="none"
          stroke="#23384a"
          strokeDasharray="3 8"
        />
        {paths(false)}
        <circle cx="365" cy="232" r="158" fill="url(#halo)" />
        <circle
          cx="365"
          cy="232"
          r="130.75"
          fill="url(#planet)"
          stroke="#476378"
          strokeWidth=".6"
        />
        <g clipPath="url(#earth-clip)" fill="none" stroke="#6c8b9f" strokeWidth=".55" opacity=".18">
          {[-90, -45, 0, 45, 90].map((v) => (
            <ellipse key={v} cx="365" cy={232 + v} rx={Math.sqrt(130.75 ** 2 - v ** 2)} ry="16" />
          ))}
          {[32, 75, 112].map((v) => (
            <ellipse key={v} cx="365" cy="232" rx={v} ry="130.75" />
          ))}
        </g>
        {paths(true)}
        {lines.map(({ o, color }) => {
          const state = displayState(run.trajectories[o.id], time);
          if (!state) return null;
          const [x, y, z] = project(state.positionKm);
          if (z < 0 && Math.hypot(x - 365, y - 232) < 130.75) return null;
          const chosen = o.id === targetId || o.id === run.parameters.primaryId;
          return (
            <g key={o.id}>
              <circle cx={x} cy={y} r={chosen ? 9 : 5} fill={color} opacity=".1" />
              <circle cx={x} cy={y} r={chosen ? 3.7 : 2} fill={color} />
              {chosen ? (
                <text x={x + 10} y={y - 10} fill={color} fontSize="10" fontFamily="monospace">
                  {o.name}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x="25" y="431" fill="#72899d" fontSize="10" fontFamily="monospace">
          EARTH RADIUS 6,378 km · ORBITS TO SCALE
        </text>
      </svg>
      <div className="scene-bottom">
        <div className="legend">
          <span>
            <i style={{ background: COLORS[0] }} />
            Reference
          </span>
          <span>
            <i style={{ background: COLORS[1] }} />
            Selected object
          </span>
        </div>
        <label className="view-control">
          View
          <input
            aria-label="Orbit view angle"
            type="range"
            min="0"
            max="360"
            value={yaw}
            onChange={(e) => setYaw(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
export function RangeChart({
  run,
  targetId,
  eventTime,
  miss,
}: {
  run: Analysis;
  targetId: string;
  eventTime: number;
  miss: number;
}) {
  const points = useMemo(() => {
    const a = run.trajectories[run.parameters.primaryId],
      b = run.trajectories[targetId] ?? [];
    const data = a
      .filter((s) => Math.abs(Date.parse(s.utc) - eventTime) < 12 * 60000)
      .flatMap((s) => {
        const other = displayState(b, Date.parse(s.utc));
        return other
          ? [{ t: Date.parse(s.utc), r: norm(subtract(other.positionKm, s.positionKm)) }]
          : [];
      });
    data.push({ t: eventTime, r: miss });
    return data.sort((x, y) => x.t - y.t);
  }, [run, targetId, eventTime, miss]);
  const max = Math.max(...points.map((p) => p.r), 1),
    left = eventTime - 12 * 60000;
  const px = (t: number) => 46 + ((t - left) / (24 * 60000)) * 620,
    py = (r: number) => 156 - (r / max) * 120;
  return (
    <svg
      className="range-chart"
      role="img"
      aria-label="Range around the selected closest approach, with the computed TCA marked"
      viewBox="0 0 700 195"
    >
      <defs>
        <linearGradient id="range-fill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#278a77" stopOpacity=".16" />
          <stop offset="1" stopColor="#278a77" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1="46" y1={py(max * f)} x2="666" y2={py(max * f)} stroke="#e6ebed" />
          <text x="37" y={py(max * f) + 4} textAnchor="end" fontSize="10" fill="#7a8794">
            {number(max * f, 0)}
          </text>
        </g>
      ))}
      <path
        d={`M${px(points[0]?.t ?? eventTime)},156 ${points.map((p) => `L${px(p.t)},${py(p.r)}`).join(' ')} L${px(points.at(-1)?.t ?? eventTime)},156Z`}
        fill="url(#range-fill)"
      />
      <path
        d={points.map((p, i) => `${i ? 'L' : 'M'}${px(p.t)},${py(p.r)}`).join(' ')}
        stroke="#278a77"
        strokeWidth="2"
        fill="none"
      />
      <line
        x1={px(eventTime)}
        y1="20"
        x2={px(eventTime)}
        y2="157"
        stroke="#bd934e"
        strokeDasharray="3 4"
      />
      <circle
        cx={px(eventTime)}
        cy={py(miss)}
        r="4"
        fill="#bd934e"
        stroke="white"
        strokeWidth="2"
      />
      <text x={px(eventTime) + 8} y="18" fontSize="10" fill="#9b772e">
        COMPUTED TCA
      </text>
      <text x="46" y="179" fontSize="10" fill="#7a8794">
        −12 min
      </text>
      <text x="640" y="179" fontSize="10" fill="#7a8794">
        +12 min
      </text>
      <text x="6" y="16" fontSize="10" fill="#7a8794">
        km
      </text>
    </svg>
  );
}
export function RelativeView({ run, targetId }: { run: Analysis; targetId: string }) {
  const a = run.trajectories[run.parameters.primaryId],
    b = run.trajectories[targetId] ?? [];
  const points = a.slice(0, 46).flatMap((s) => {
    const other = displayState(b, Date.parse(s.utc));
    return other ? [relativeRIC(s, other).positionKm] : [];
  });
  const scale = 110 / Math.max(1, ...points.flatMap((p) => [Math.abs(p[0]), Math.abs(p[1])]));
  return (
    <svg
      className="relative-chart"
      role="img"
      aria-label="First 90 minutes of relative motion projected onto radial and along-track axes"
      viewBox="0 0 450 290"
    >
      <line x1="25" x2="425" y1="143" y2="143" stroke="#e4e9ed" />
      <line x1="225" x2="225" y1="25" y2="265" stroke="#e4e9ed" />
      <path
        d={points
          .map((p, i) => `${i ? 'L' : 'M'}${225 + p[1] * scale},${143 - p[0] * scale}`)
          .join(' ')}
        fill="none"
        stroke="#2c8979"
        strokeWidth="1.7"
      />
      <circle cx="225" cy="143" r="4" fill="#c1994d" />
      <text x="232" y="135" fontSize="10" fill="#9b772e">
        reference
      </text>
      <text x="310" y="278" fontSize="10" fill="#7a8794">
        along-track (km)
      </text>
      <text x="15" y="20" fontSize="10" fill="#7a8794">
        radial (km) · autoscale ±{number(110 / scale, 0)}
      </text>
    </svg>
  );
}
