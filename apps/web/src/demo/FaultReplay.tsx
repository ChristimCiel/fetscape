import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
export interface FaultEvidence {
  kind: string;
  scenario: string;
  seed: number;
  sourceSha256: string;
  interpretation: string;
  baseline: { final_range_m: number; outcome: string; samples: { t: number; range: number }[] };
  revised: { final_range_m: number; outcome: string; samples: { t: number; range: number }[] };
  criterion: { timeS: number; minimumFinalSeparationM: number };
}
export default function FaultReplay({ onEvidence }: { onEvidence: (data: FaultEvidence) => void }) {
  const [data, setData] = useState<FaultEvidence | null>(null),
    [time, setTime] = useState(650),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/verification/weak-thrust-seed7.json', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Replay HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        onEvidence(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [onEvidence]);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        delta = ((now - previous) / 1000) * 60;
      previous = now;
      setTime((t) => Math.min(650, t + delta));
    }, 100);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (time >= 650) setPlaying(false);
  }, [time]);
  if (error)
    return (
      <div className="message error" role="alert">
        {error}
      </div>
    );
  if (!data)
    return <div className="loading-state">Loading the frozen seed-7 fault comparison…</div>;
  const value = (samples: FaultEvidence['baseline']['samples']) => {
    const i = Math.min(samples.length - 1, Math.max(0, Math.floor(time / 2))),
      a = samples[i],
      b = samples[Math.min(i + 1, samples.length - 1)];
    return b.t === a.t ? a.range : a.range + ((b.range - a.range) * (time - a.t)) / (b.t - a.t);
  };
  const x = (t: number) => 48 + (t / 650) * 610,
    y = (r: number) => 197 - (r / 140) * 165;
  const path = (samples: FaultEvidence['baseline']['samples']) =>
    samples
      .filter((s) => s.t <= time)
      .map((s, i) => `${i ? 'L' : 'M'}${x(s.t)},${y(s.range)}`)
      .join(' ');
  return (
    <section className="panel fault-replay" aria-label="Degraded thrust evidence">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SCRIPT 0:35–1:02 · EXISTING MODEL OUTPUT</span>
          <h2>Test the escape when thrust falls to 30%.</h2>
        </div>
        <span className="plain-badge">SYNTHETIC · SEED 7</span>
      </div>
      <p>
        Same case, different thrust assumptions. This is a frozen replay of the independent
        HCW/Kalman study; it does not drive the capture scene.
      </p>
      <div className="fault-metrics">
        <div>
          <span>Original · still assumes full thrust</span>
          <strong>
            {value(data.baseline.samples).toFixed(1)} <small>m</small>
          </strong>
          <b>{time >= 650 ? 'END CRITERION NOT MET' : 'REPLAYING'}</b>
        </div>
        <div>
          <span>Revision · simulator-provided availability</span>
          <strong>
            {value(data.revised.samples).toFixed(1)} <small>m</small>
          </strong>
          <b>{time >= 650 ? 'CUSTOM END CRITERION MET' : 'REPLAYING'}</b>
        </div>
        <div>
          <span>Replay time</span>
          <strong>
            {Math.round(time)} <small>s</small>
          </strong>
          <b>100 m AT 650 s · CUSTOM CRITERION</b>
        </div>
      </div>
      <svg
        viewBox="0 0 700 235"
        role="img"
        aria-label="Baseline and revised final separation under reduced thrust"
      >
        <line x1="48" y1={y(100)} x2="658" y2={y(100)} stroke="#8caba0" strokeDasharray="4 5" />
        <text x="650" y={y(100) - 7} textAnchor="end" fill="#77978a" fontSize="10">
          CUSTOM 100 m END CRITERION
        </text>
        {[0, 50, 100, 140].map((r) => (
          <g key={r}>
            <line x1="48" y1={y(r)} x2="658" y2={y(r)} stroke="#e5ecec" />
            <text x="39" y={y(r) + 4} textAnchor="end" fill="#8d9fa9" fontSize="10">
              {r}
            </text>
          </g>
        ))}
        <line x1={x(130)} y1="22" x2={x(130)} y2="197" stroke="#b49361" strokeDasharray="3 4" />
        <text x={x(130) + 7} y="20" fontSize="10" fill="#9b7948">
          FAULT AT 130 s
        </text>
        <path d={path(data.baseline.samples)} fill="none" stroke="#c48e62" strokeWidth="2" />
        <path d={path(data.revised.samples)} fill="none" stroke="#2d927d" strokeWidth="2" />
        <line x1={x(time)} y1="25" x2={x(time)} y2="197" stroke="#889da6" opacity=".5" />
        <text x="48" y="220" fill="#8d9fa9" fontSize="10">
          0 s
        </text>
        <text x="630" y="220" fill="#8d9fa9" fontSize="10">
          650 s
        </text>
      </svg>
      <div className="fault-controls">
        <button
          className="button secondary"
          onClick={() => {
            if (time >= 650) setTime(0);
            setPlaying(!playing);
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={15} />
          {playing ? 'Pause comparison' : 'Replay comparison'}
        </button>
        <button
          className="text-button"
          onClick={() => {
            setTime(130);
            setPlaying(false);
          }}
        >
          Jump to fault
        </button>
        <button
          className="text-button"
          onClick={() => {
            setTime(650);
            setPlaying(false);
          }}
        >
          Show endpoint
        </button>
        <input
          aria-label="Fault comparison replay time"
          type="range"
          min="0"
          max="650"
          step="1"
          value={time}
          onChange={(e) => {
            setTime(Number(e.target.value));
            setPlaying(false);
          }}
        />
      </div>
      <p className="fine-print">
        59.520106 m versus 129.769781 m at t = 650 s. Failure to meet this criterion does not mean
        collision; meeting it does not prove safe withdrawal for all faults. Revised thrust
        availability is supplied by the simulator, not diagnosed by hardware.
      </p>
    </section>
  );
}
