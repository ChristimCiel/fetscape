/**
 * Interactive LEO altitude × inclination cross-section with disposal rule lines.
 */

import { useMemo, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import type { Language, MissionProfile } from './types';
import type { RankedDerelict } from './tools/debris-ranking';
import { getBundledDerelictCatalog } from './tools/debris-ranking';
import { calculateMeanAltitude } from './tools/celestrak';
import { ruleAltitudes } from './tools/ruleAltitudes';
import { tSuite } from '../suite/i18n';

const A0 = 300;
const A1 = 1000;
const X0 = 56;
const X1 = 620;
const Y0 = 440;
const Y1 = 24;

function yOf(a: number) {
  return Y0 - ((a - A0) / (A1 - A0)) * (Y0 - Y1);
}
function xOf(i: number) {
  return X0 + (i / 120) * (X1 - X0);
}
function altFromSvgY(py: number) {
  return A0 + ((Y0 - py) / (Y0 - Y1)) * (A1 - A0);
}

export interface OrbitShellPlotProps {
  mode: 'ready' | 'adr';
  profile: MissionProfile;
  altitude: number;
  onAltitude: (n: number) => void;
  ranked: RankedDerelict[];
  selectedId: string;
  onSelect: (id: string) => void;
  language: Language;
  yearsText?: string;
  highlightMarker?: boolean;
}

export default function OrbitShellPlot({
  mode,
  profile,
  altitude,
  onAltitude,
  ranked,
  selectedId,
  onSelect,
  language,
  yearsText = '',
  highlightMarker = false,
}: OrbitShellPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const catalog = useMemo(() => getBundledDerelictCatalog(), []);
  const rules = useMemo(
    () =>
      ruleAltitudes({
        massKg: profile.mass,
        inclination: profile.orbit.inclination,
      }),
    [profile.mass, profile.orbit.inclination],
  );

  const dots = useMemo(() => {
    return catalog.objects.map((obj, k) => {
      const alt = calculateMeanAltitude(obj.MEAN_MOTION);
      const inc = obj.INCLINATION;
      const cx = xOf(inc) + ((k * 37) % 13) - 6;
      const cy = yOf(Math.min(A1, Math.max(A0, alt)));
      return { obj, alt, inc, cx, cy, k, id: String(obj.NORAD_CAT_ID) };
    });
  }, [catalog.objects]);

  const aboveCount = useMemo(() => dots.filter((d) => d.alt > A1).length, [dots]);

  const top5 = ranked.slice(0, 5);
  const top5Ids = new Set(top5.map((r) => String(r.catalogId)));

  const labelOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    const placed: { y: number; id: string }[] = [];
    for (const r of top5) {
      const d = dots.find((x) => x.id === String(r.catalogId));
      if (!d || d.alt > A1) continue;
      let oy = 0;
      for (const p of placed) {
        if (Math.abs(p.y + (offsets.get(p.id) ?? 0) - (d.cy + oy)) < 12) oy += 12;
      }
      offsets.set(d.id, oy);
      placed.push({ y: d.cy, id: d.id });
    }
    return offsets;
  }, [top5, dots]);

  const snapAlt = useCallback((raw: number) => {
    return Math.max(A0, Math.min(A1, Math.round(raw / 5) * 5));
  }, []);

  const clientToAlt = useCallback(
    (clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return altitude;
      const rect = svg.getBoundingClientRect();
      const py = ((clientY - rect.top) / rect.height) * 500;
      return snapAlt(altFromSvgY(py));
    },
    [altitude, snapAlt],
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    if (mode !== 'ready') return;
    dragging.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    onAltitude(clientToAlt(e.clientY));
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || mode !== 'ready') return;
    onAltitude(clientToAlt(e.clientY));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const onBgClick = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (mode !== 'ready') return;
    const target = e.target as Element;
    if (target.closest('[data-sat]')) return;
    onAltitude(clientToAlt(e.clientY));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== 'ready') return;
    let next = altitude;
    if (e.key === 'ArrowUp') next = altitude + 5;
    else if (e.key === 'ArrowDown') next = altitude - 5;
    else if (e.key === 'PageUp') next = altitude + 50;
    else if (e.key === 'PageDown') next = altitude - 50;
    else if (e.key === 'Home') next = A0;
    else if (e.key === 'End') next = A1;
    else return;
    e.preventDefault();
    onAltitude(snapAlt(next));
  };

  const mx = xOf(profile.orbit.inclination ?? 0);
  const my = yOf(altitude);
  const labelW = 74;
  const labelX = Math.min(mx + 14, X1 - labelW - 4);

  const acquired = catalog.meta.acquiredAt.slice(0, 10);
  const n = catalog.objects.length;

  return (
    <>
      <svg
        ref={svgRef}
        className="fx-plot"
        viewBox="0 0 640 500"
        role="img"
        aria-label="Altitude versus inclination plot with disposal rule lines"
        onPointerDown={onBgClick}
      >
        {mode === 'ready' ? (
          <>
            <rect
              x={X0}
              y={yOf(rules.h5)}
              width={X1 - X0}
              height={Y0 - yOf(rules.h5)}
              fill="var(--fx-band-5)"
            />
            <rect
              x={X0}
              y={yOf(rules.h25)}
              width={X1 - X0}
              height={yOf(rules.h5) - yOf(rules.h25)}
              fill="var(--fx-band-25)"
            />
          </>
        ) : null}

        {Array.from({ length: 8 }, (_, i) => A0 + i * 100).map((a) => (
          <g key={a}>
            <line x1={X0} x2={X1} y1={yOf(a)} y2={yOf(a)} stroke="var(--fx-hair)" />
            <text
              x={X0 - 8}
              y={yOf(a) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--fx-ink-3)"
              fontFamily="var(--sx-mono)"
            >
              {a}
            </text>
          </g>
        ))}
        {[0, 30, 60, 90, 120].map((i) => (
          <text
            key={i}
            x={xOf(i)}
            y={Y0 + 18}
            textAnchor="middle"
            fontSize="11"
            fill="var(--fx-ink-3)"
            fontFamily="var(--sx-mono)"
          >
            {i}°
          </text>
        ))}
        <text x={X0 - 8} y={Y1 - 6} textAnchor="end" fontSize="11" fill="var(--fx-ink-3)">
          km
        </text>
        <text x={X1} y={Y0 + 34} textAnchor="end" fontSize="11" fill="var(--fx-ink-3)">
          {language === 'en' ? 'inclination' : '傾角'}
        </text>
        <path
          d={`M ${X0 - 30} ${Y0 + 60} Q 338 ${Y0 + 18} ${X1 + 30} ${Y0 + 60}`}
          fill="none"
          stroke="var(--fx-cyan)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        <text x="338" y={Y0 + 46} textAnchor="middle" fontSize="11" fill="var(--fx-ink-3)">
          {tSuite('v2.plot.earth', language)}
        </text>

        {mode === 'ready' ? (
          <>
            <line
              x1={X0}
              x2={X1}
              y1={yOf(rules.h5)}
              y2={yOf(rules.h5)}
              stroke="var(--fx-cyan)"
              strokeOpacity="0.55"
              strokeDasharray="4 4"
            />
            <text
              x={X0 + 8}
              y={yOf(rules.h5) - 6}
              fontSize="11"
              fill="var(--fx-cyan)"
              fontFamily="var(--sx-mono)"
            >
              {tSuite('v2.line.5', language).replace('{h}', String(rules.h5))}
            </text>
            <line
              x1={X0}
              x2={X1}
              y1={yOf(rules.h25)}
              y2={yOf(rules.h25)}
              stroke="var(--fx-cyan)"
              strokeOpacity="0.55"
              strokeDasharray="4 4"
            />
            <text
              x={X0 + 8}
              y={yOf(rules.h25) - 6}
              fontSize="11"
              fill="var(--fx-cyan)"
              fontFamily="var(--sx-mono)"
            >
              {tSuite('v2.line.25', language).replace('{h}', String(rules.h25))}
            </text>
          </>
        ) : null}

        <text x={X1} y={Y1 - 6} textAnchor="end" fontSize="11" fill="var(--fx-ink-3)">
          {tSuite('v2.plot.above', language).replace('{n}', String(aboveCount))}
        </text>

        {dots.map((d) => {
          if (d.alt > A1) return null;
          const isTop = mode === 'adr' && top5Ids.has(d.id);
          const rank = top5.findIndex((r) => String(r.catalogId) === d.id);
          const selected =
            isTop && selectedId === (ranked.find((r) => String(r.catalogId) === d.id)?.id ?? '');
          return (
            <g key={d.id}>
              <circle
                cx={d.cx}
                cy={d.cy}
                r={isTop ? 5 : 3}
                fill={isTop ? 'var(--fx-cyan)' : 'none'}
                stroke={isTop ? 'none' : 'var(--fx-ink-3)'}
                style={mode === 'adr' && isTop ? { cursor: 'pointer' } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mode === 'adr' && isTop) {
                    const row = ranked.find((r) => String(r.catalogId) === d.id);
                    if (row) onSelect(row.id);
                  }
                }}
              />
              {isTop ? (
                <>
                  <circle
                    cx={d.cx}
                    cy={d.cy}
                    r={selected ? 11 : 8}
                    fill="none"
                    stroke="var(--fx-cyan)"
                    strokeOpacity={selected ? 1 : 0.4}
                  />
                  <text
                    x={d.cx + 14}
                    y={d.cy + 4 + (labelOffsets.get(d.id) ?? 0)}
                    fontSize="11"
                    fill="var(--fx-ink)"
                    fontFamily="var(--sx-mono)"
                  >
                    {rank + 1}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        {mode === 'ready' ? (
          <>
            <line x1={X0} x2={X1} y1={my} y2={my} stroke="var(--fx-cyan)" strokeOpacity="0.25" />
            <g
              data-sat
              tabIndex={0}
              role="slider"
              aria-label="Altitude"
              aria-valuemin={A0}
              aria-valuemax={A1}
              aria-valuenow={altitude}
              aria-valuetext={`${altitude} km, re-enters in ${yearsText} years`}
              style={{ cursor: 'grab', outline: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onKeyDown={onKeyDown}
            >
              <circle
                cx={mx}
                cy={my}
                r={22}
                fill="none"
                stroke={highlightMarker ? 'var(--fx-cyan)' : 'transparent'}
                strokeWidth="2"
              />
              <circle cx={mx} cy={my} r="18" fill="var(--fx-cyan)" fillOpacity="0.12" />
              <circle cx={mx} cy={my} r="7" fill="var(--fx-cyan)" />
              <rect
                x={labelX}
                y={my - 13}
                width={labelW}
                height="26"
                rx="6"
                fill="var(--fx-raise)"
                stroke="var(--fx-hair-2)"
              />
              <text
                x={labelX + labelW / 2}
                y={my + 4}
                textAnchor="middle"
                fontSize="12"
                fill="var(--fx-ink)"
                fontFamily="var(--sx-mono)"
              >
                {altitude} km
              </text>
            </g>
          </>
        ) : null}
      </svg>
      <div className="fx-hint">
        <span>{mode === 'ready' ? tSuite('v2.hint.drag', language) : ''}</span>
        <span>
          {tSuite('v2.hint.src', language).replace('{n}', String(n)).replace('{date}', acquired)}
        </span>
      </div>
    </>
  );
}
