import { useCallback, useEffect, useRef, useState } from 'react';
import {
  abortCapture,
  CAPTURE_RULES,
  captureGates,
  createCaptureState,
  EMPTY_INPUT,
  recenterCapture,
  requestCapture,
  startCaptureRun,
  telemetry,
} from '@orbit/core/capture';
import type { CaptureState, PilotInput, ScenarioId } from '@orbit/core/capture';
import { Icon } from '../components/Icon';
import { advanceCaptureFrame } from './clock';
import { createCaptureScene } from './scene';
import type { CaptureScene, SceneStatus, MechanismEvidence } from './scene';
import { ARM_RIG, mechanismCycle } from '@orbit/core/mechanism';
import FaultReplay from '../demo/FaultReplay';
import type { FaultEvidence } from '../demo/FaultReplay';
import manifest from './asset-manifest.json';
import './capture.css';

export interface PlanningContext {
  analysisId: string;
  kind: string;
  referenceName: string;
  targetName: string;
}
const PHASE: Record<CaptureState['phase'], string> = {
  idle: 'Awaiting approach',
  approach: 'Approaching target',
  hold: 'Stand-off hold',
  capturing: 'Caging sequence',
  secured: 'Target latched · conceptual',
  retreat: 'Retreat in progress',
  aborted: 'Retreat complete',
  collision: 'Proxy collision · reset required',
};
const KEYMAP: Record<string, keyof PilotInput | undefined> = {
  w: 'forward',
  s: 'forward',
  a: 'right',
  d: 'right',
  r: 'up',
  f: 'up',
  ArrowLeft: 'yaw',
  ArrowRight: 'yaw',
  ArrowUp: 'pitch',
  ArrowDown: 'pitch',
  q: 'roll',
  e: 'roll',
  ' ': 'brake',
};
const fmt = (v: number, digits = 2) => v.toFixed(digits);
export default function CaptureLab({
  context,
  onOpenOrbit,
}: {
  context?: PlanningContext;
  onOpenOrbit?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    scene = useRef<CaptureScene | null>(null);
  const state = useRef(createCaptureState()),
    input = useRef({ ...EMPTY_INPUT }),
    keys = useRef(new Set<string>()),
    speedRef = useRef(2),
    previewRef = useRef<string | null>(null),
    armedRef = useRef(false);
  const trace = useRef<
    {
      timeS: number;
      phase: string;
      position: number[];
      velocity: number[];
      rangeM: number;
      relativeSpeedMS: number;
      alignmentDeg: number;
    }[]
  >([]);
  const [snapshot, setSnapshot] = useState(state.current),
    [scenario, setScenario] = useState<ScenarioId>('nominal'),
    [collector, setCollector] = useState('collector-split'),
    [target, setTarget] = useState('upper-stage');
  const [statuses, setStatuses] = useState<Record<string, SceneStatus>>({}),
    [fatal, setFatal] = useState(''),
    [generation, setGeneration] = useState(0),
    [speed, setSpeed] = useState(2),
    [armed, setArmed] = useState(false),
    [preview, setPreview] = useState<string | null>(null),
    [explosion, setExplosion] = useState(0),
    [message, setMessage] = useState('');
  const [cameraView, setCameraView] = useState<'first-person' | 'mechanism'>('first-person'),
    [rigEvidence, setRigEvidence] = useState<MechanismEvidence | null>(null),
    [showFault, setShowFault] = useState(false);
  const faultEvidence = useRef<FaultEvidence | null>(null),
    faultSection = useRef<HTMLDivElement>(null),
    cameraViewRef = useRef(cameraView);
  const recordFaultEvidence = useCallback((data: FaultEvidence) => {
    faultEvidence.current = data;
  }, []);
  useEffect(() => {
    cameraViewRef.current = cameraView;
    scene.current?.cameraMode(cameraView);
  }, [cameraView, generation]);
  useEffect(() => {
    if (showFault) faultSection.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [showFault]);
  const commit = (s: CaptureState) => {
    state.current = s;
    setSnapshot(s);
  };
  const clearInput = () => {
    keys.current.clear();
    input.current = { ...EMPTY_INPUT };
  };
  const releaseControls = () => {
    clearInput();
    armedRef.current = false;
    setArmed(false);
  };
  const reset = (nextScenario = scenario) => {
    releaseControls();
    trace.current = [];
    setMessage('');
    commit(createCaptureState(nextScenario));
  };
  const ready =
    ['collector', 'target', 'arms'].every((slot) => statuses[slot]?.status === 'ready') && !fatal;
  const t = telemetry(snapshot),
    gate =
      snapshot.entryEvidence && ['capturing', 'secured'].includes(snapshot.phase)
        ? { ready: true, gates: snapshot.entryEvidence.gates }
        : captureGates(snapshot),
    previewAsset = manifest.assets.find((a) => a.id === preview);
  const terminal = ['secured', 'aborted', 'collision'].includes(snapshot.phase);
  const cycle = mechanismCycle(snapshot.captureProgress);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    previewRef.current = preview;
    scene.current?.preview(preview);
  }, [preview, generation]);
  useEffect(() => {
    scene.current?.explode(explosion);
  }, [explosion, generation]);
  useEffect(() => {
    const element = canvas.current!;
    let runtime: CaptureScene;
    let frame = 0,
      disposed = false,
      last = performance.now(),
      accumulator = 0,
      lastUI = 0,
      lastTrace = -1;
    setStatuses({});
    try {
      runtime = createCaptureScene(
        element,
        (status) => {
          if (!disposed) setStatuses((current) => ({ ...current, [status.slot]: status }));
        },
        () => {
          state.current = { ...state.current, running: false };
          if (!disposed)
            setFatal(
              'WebGL context was lost. Reinitialize the view to continue; the scenario has been paused.',
            );
        },
      );
      scene.current = runtime;
      runtime.cameraMode(cameraViewRef.current);
    } catch (error) {
      setFatal(
        `3D rendering is unavailable: ${(error as Error).message}. Try a WebGL 2 capable browser or reinitialize the view.`,
      );
      return;
    }
    const observer = new ResizeObserver(() => runtime.resize());
    observer.observe(element);
    runtime.resize();
    const updateKeys = () => {
      const k = keys.current;
      input.current = {
        forward: Number(k.has('w')) - Number(k.has('s')),
        right: Number(k.has('d')) - Number(k.has('a')),
        up: Number(k.has('r')) - Number(k.has('f')),
        brake: k.has(' '),
        yaw: Number(k.has('ArrowLeft')) - Number(k.has('ArrowRight')),
        pitch: Number(k.has('ArrowUp')) - Number(k.has('ArrowDown')),
        roll: Number(k.has('q')) - Number(k.has('e')),
      };
    };
    const down = (e: KeyboardEvent) => {
      if (!armedRef.current || document.activeElement !== element || previewRef.current) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key in KEYMAP) {
        e.preventDefault();
        keys.current.add(key);
        updateKeys();
      }
      if (e.repeat) return;
      if (key === 'c') {
        e.preventDefault();
        commit(requestCapture(state.current));
      }
      if (key === 'x') {
        e.preventDefault();
        commit(abortCapture(state.current));
      }
      if (key === 'g') {
        e.preventDefault();
        commit(startCaptureRun(state.current, 'guided'));
      }
      if (key === 't') {
        e.preventDefault();
        commit(recenterCapture(state.current));
      }
      if (key === 'Escape') {
        releaseControls();
        commit({ ...state.current, running: false });
        element.blur();
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current.delete(key);
      updateKeys();
    };
    const pause = () => {
      clearInput();
      armedRef.current = false;
      if (!disposed) {
        setArmed(false);
        commit({ ...state.current, running: false });
      }
    };
    const visibility = () => {
      last = performance.now();
      accumulator = 0;
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    let pointer: { id: number; x: number; y: number } | null = null;
    const pointerDown = (e: PointerEvent) => {
      if (
        previewRef.current ||
        cameraViewRef.current !== 'first-person' ||
        ['secured', 'aborted', 'collision', 'capturing', 'retreat'].includes(state.current.phase)
      )
        return;
      element.focus();
      element.setPointerCapture(e.pointerId);
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      armedRef.current = true;
      setArmed(true);
      if (
        !['secured', 'aborted', 'collision', 'capturing', 'retreat'].includes(state.current.phase)
      )
        commit(startCaptureRun(state.current, 'manual'));
    };
    const pointerMove = (e: PointerEvent) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      const dx = e.clientX - pointer.x,
        dy = e.clientY - pointer.y;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      state.current = {
        ...state.current,
        yaw: state.current.yaw - dx * 0.0024,
        pitch: Math.max(-1.3, Math.min(1.3, state.current.pitch - dy * 0.0024)),
      };
    };
    const pointerEnd = () => {
      pointer = null;
    };
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerEnd);
    element.addEventListener('pointercancel', pointerEnd);
    const render = (now: number) => {
      if (disposed) return;
      const wall = (now - last) / 1000;
      last = now;
      if (!previewRef.current && state.current.running) {
        const advanced = advanceCaptureFrame(
          state.current,
          input.current,
          wall,
          speedRef.current,
          accumulator,
        );
        state.current = advanced.state;
        accumulator = advanced.remainderS;
      } else accumulator = 0;
      if (state.current.timeS - lastTrace >= 0.25) {
        const telemetryValue = telemetry(state.current);
        trace.current.push({
          timeS: state.current.timeS,
          phase: state.current.phase,
          position: [...state.current.position],
          velocity: [...state.current.velocity],
          rangeM: telemetryValue.rangeM,
          relativeSpeedMS: telemetryValue.relativeSpeedMS,
          alignmentDeg: telemetryValue.alignmentDeg,
        });
        if (trace.current.length > 2400) trace.current.shift();
        lastTrace = state.current.timeS;
      }
      if (state.current.timeS < lastTrace) lastTrace = -1;
      runtime.render(state.current);
      if (now - lastUI > 100) {
        setSnapshot(state.current);
        setRigEvidence(runtime.evidence());
        lastUI = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerEnd);
      element.removeEventListener('pointercancel', pointerEnd);
      runtime.dispose();
      scene.current = null;
      keys.current.clear();
      input.current = { ...EMPTY_INPUT };
    };
  }, [generation]);
  useEffect(() => {
    scene.current?.load('collector', collector);
  }, [collector, generation]);
  useEffect(() => {
    scene.current?.load('target', target);
  }, [target, generation]);
  const inspect = (id: string) => {
    if (preview === id) return;
    releaseControls();
    commit({ ...state.current, running: false });
    setStatuses((current) => ({ ...current, preview: { slot: 'preview', id, status: 'loading' } }));
    setPreview(id);
    setExplosion(0);
    viewport.current?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  const takeControls = () => {
    setCameraView('first-person');
    commit(startCaptureRun(state.current, 'manual'));
    armedRef.current = true;
    setArmed(true);
    canvas.current?.focus();
  };
  const pulse = (axis: 'forward' | 'right' | 'up', value: number) => {
    if (!ready || preview || terminal) return;
    commit(startCaptureRun(state.current, 'manual'));
    input.current = { ...EMPTY_INPUT, [axis]: value };
  };
  const exportTrace = () => {
    const selected = manifest.assets.filter((a) =>
      [collector, target, 'caging-arm'].includes(a.id),
    );
    const payload = {
      schemaVersion: 2,
      classification: 'synthetic_concept_rehearsal',
      exportedAt: new Date().toISOString(),
      planningContext: context ?? null,
      planningContextNote:
        'Context only. No catalog state, measured shape or physical property is transferred into this near-field scene.',
      rules: CAPTURE_RULES,
      scenario,
      selectedAssets: selected,
      sourceManifest: manifest,
      runtimeRigDefinition: ARM_RIG,
      mechanismEvidence: scene.current?.evidence() ?? null,
      independentFaultEvidence: faultEvidence.current,
      scriptReference: 'Fetscape / docs/pitch/DEMO_90S.md / 2026-11-11',
      state: state.current,
      trace: trace.current,
      traceNote:
        'Quarter-second sampled simulator truth, up to 2400 samples. Not an exact input replay, navigation estimate, contact simulation, flight or capture validation.',
    };
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = `fetscape-verification-${scenario}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const failed = Object.values(statuses).filter(
    (s) => s.status === 'error' && s.slot !== 'preview',
  );
  return (
    <div className="capture-lab">
      <section className="demo-story">
        <div>
          <span className="eyebrow">FETSCAPE · ENGINEERING PILOT DEMO</span>
          <h2>Find planning mistakes before execution.</h2>
          <p>
            Help mission and GNC engineers review encounter geometry, test degraded-thrust
            withdrawal, and inspect capture assumptions before execution.
          </p>
        </div>
        <div className="demo-steps">
          <button onClick={onOpenOrbit}>
            <b>01</b>
            <span>
              Inspect orbital geometry<small>0:22–0:35 · public-data reference</small>
            </span>
          </button>
          <button onClick={() => setShowFault((value) => !value)} aria-expanded={showFault}>
            <b>02</b>
            <span>
              Test degraded thrust<small>0:35–1:02 · seed-7 comparison</small>
            </span>
          </button>
          <button
            onClick={() =>
              viewport.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          >
            <b>03</b>
            <span>
              Track the grasp point<small>1:02–1:15 · mechanism concept</small>
            </span>
          </button>
          <button onClick={exportTrace}>
            <b>04</b>
            <span>
              Export the evidence<small>Next: one engineering pilot</small>
            </span>
          </button>
        </div>
      </section>
      {showFault ? (
        <div ref={faultSection}>
          <FaultReplay onEvidence={recordFaultEvidence} />
        </div>
      ) : null}
      <div className="capture-intro">
        <span className="capture-classification">
          <i />
          AUTHORED MECHANISM CONCEPT
        </span>
        <p>Actual segmented meshes · authored arm joints · synthetic pose and motion</p>
        <button className="button secondary" onClick={exportTrace}>
          <Icon name="download" size={15} />
          Export rehearsal
        </button>
      </div>
      {context ? (
        <div className="capture-context">
          <Icon name="layers" size={15} />
          <span>
            Planning context:{' '}
            <strong>
              {context.referenceName} → {context.targetName}
            </strong>
            <small>
              Visual stand-ins and synthetic local state. These meshes are not observations or
              reconstructions of the catalog objects.
            </small>
          </span>
        </div>
      ) : null}
      <div className="capture-layout">
        <section
          className="flight-viewport"
          ref={viewport}
          aria-label="Capture rehearsal flight deck"
          data-phase={snapshot.phase}
          data-mechanism-stage={cycle.stage}
          data-camera-view={cameraView}
        >
          <canvas
            key={generation}
            ref={canvas}
            tabIndex={0}
            aria-label="First-person debris capture viewport"
            aria-describedby="flight-instructions"
          />
          <div className="flight-vignette" />
          <div className="flight-top">
            <div>
              <span className="flight-label">
                {preview
                  ? 'ASSET INSPECTION'
                  : cameraView === 'first-person'
                    ? 'COLLECTOR / FORWARD CAMERA'
                    : 'MECHANISM OBSERVER / EXTERNAL VIEW'}
              </span>
              <strong>
                {previewAsset?.label ?? manifest.assets.find((a) => a.id === target)?.label}
              </strong>
            </div>
            <div className="flight-top-actions">
              <span>T+{snapshot.timeS.toFixed(1)}s</span>
              {!preview ? (
                <button
                  className="camera-toggle"
                  aria-label={
                    cameraView === 'first-person'
                      ? 'Show mechanism camera'
                      : 'Show first-person camera'
                  }
                  onClick={() =>
                    setCameraView(cameraView === 'first-person' ? 'mechanism' : 'first-person')
                  }
                >
                  {cameraView === 'first-person' ? 'Mechanism camera' : 'First-person camera'}
                </button>
              ) : null}
              <button
                aria-label="Full screen capture view"
                title="Full screen"
                onClick={() => {
                  void viewport.current
                    ?.requestFullscreen()
                    .catch(() =>
                      setMessage(
                        'Full screen is unavailable in this browser. The embedded view remains usable.',
                      ),
                    );
                }}
              >
                ⛶
              </button>
            </div>
          </div>
          {!preview ? (
            <>
              <div className={`flight-reticle ${gate.ready ? 'ready' : ''}`} aria-hidden="true">
                <span />
                <i />
                <b>+</b>
              </div>
              <div className="flight-left">
                <div>
                  <span>RANGE / SIM</span>
                  <strong aria-label="Simulated target range">
                    {fmt(t.rangeM)}
                    <small>m</small>
                  </strong>
                </div>
                <div>
                  <span>RELATIVE SPEED</span>
                  <strong>
                    {fmt(t.relativeSpeedMS, 3)}
                    <small>m/s</small>
                  </strong>
                </div>
                <div>
                  <span>CLOSING SPEED</span>
                  <strong>
                    {fmt(t.closingSpeedMS, 3)}
                    <small>m/s</small>
                  </strong>
                </div>
              </div>
              <div className="flight-right">
                <div>
                  <span>BORESIGHT ERROR</span>
                  <strong>
                    {fmt(t.alignmentDeg, 1)}
                    <small>°</small>
                  </strong>
                </div>
                <div>
                  <span>ASSUMED TUMBLE</span>
                  <strong>
                    {fmt(t.tumbleDegS, 1)}
                    <small>°/s</small>
                  </strong>
                </div>
                <div>
                  <span>MECHANISM CYCLE</span>
                  <strong>
                    {Math.round(snapshot.captureProgress * 100)}
                    <small>%</small>
                  </strong>
                </div>
              </div>
              <div
                className={`flight-phase ${snapshot.phase === 'collision' ? 'danger' : ''} ${gate.ready || snapshot.phase === 'secured' ? 'ready' : ''}`}
              >
                <span className="flight-label">
                  {snapshot.mode === 'guided' ? 'SCRIPTED LOCAL CONTROLLER' : 'MANUAL REHEARSAL'}
                </span>
                <strong data-testid="rehearsal-status">
                  {snapshot.phase === 'capturing' ? cycle.stage : PHASE[snapshot.phase]}
                </strong>
                <span>
                  {snapshot.phase === 'secured'
                    ? 'SIMULATED LATCH · NO FORCE SENSOR'
                    : snapshot.phase === 'capturing'
                      ? 'ENTRY CONDITIONS RECORDED'
                      : gate.ready
                        ? 'CAPTURE GATES MET'
                        : snapshot.running
                          ? 'SIMULATION RUNNING'
                          : 'SIMULATION PAUSED'}
                </span>
              </div>
            </>
          ) : (
            <div className="inspection-controls">
              <span>
                {previewAsset?.parts} mesh {previewAsset?.parts === 1 ? 'part' : 'parts'} ·{' '}
                {previewAsset?.triangles.toLocaleString()} triangles
              </span>
              {previewAsset && previewAsset.parts > 1 ? (
                <label>
                  Explode segments
                  <input
                    aria-label="Explode model segments"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={explosion}
                    onChange={(e) => setExplosion(Number(e.target.value))}
                  />
                </label>
              ) : (
                <small>Static source mesh · no source rig or animation</small>
              )}
              <button onClick={() => setPreview(null)}>
                Return to first-person <Icon name="arrow" size={14} />
              </button>
            </div>
          )}
          <div className="flight-bottom">
            <span>SIMULATOR TRUTH · LOCAL XYZ · NO SENSOR ESTIMATE</span>
            <span>
              {preview
                ? 'MODEL SCALE NORMALIZED'
                : `${speed}× TIME · ${armed ? 'CONTROLS ACTIVE' : 'CLICK VIEW TO FLY'}`}
            </span>
          </div>
          {(!ready && !preview) || fatal ? (
            <div className="flight-loading" role={fatal || failed.length ? 'alert' : 'status'}>
              <Icon name="orbit" size={30} />
              <strong>
                {fatal
                  ? '3D view unavailable'
                  : failed.length
                    ? 'Model loading failed'
                    : 'Preparing your spacecraft…'}
              </strong>
              <p>
                {fatal ||
                  failed.map((s) => `${s.id}: ${s.error}`).join(' · ') ||
                  'Loading local GLB models and materials. No external asset service.'}
              </p>
              {fatal || failed.length ? (
                <button
                  onClick={() => {
                    setFatal('');
                    setPreview(null);
                    reset();
                    setGeneration((g) => g + 1);
                  }}
                >
                  Reinitialize 3D view
                </button>
              ) : (
                <span>
                  {
                    Object.values(statuses).filter(
                      (s) => s.status === 'ready' && s.slot !== 'preview',
                    ).length
                  }{' '}
                  / 3 assemblies ready
                </span>
              )}
            </div>
          ) : null}
          {preview && statuses.preview?.status === 'loading' ? (
            <div className="inspection-loading">Loading {previewAsset?.label}…</div>
          ) : null}
          {preview && statuses.preview?.status === 'error' ? (
            <div className="inspection-loading" role="alert">
              Could not load {previewAsset?.label}: {statuses.preview.error}. Return to first-person
              or select another model.
            </div>
          ) : null}
        </section>
        <aside className="capture-checklist">
          <span className="eyebrow">DEMONSTRATION GATES</span>
          <h2>Approach. Align. Capture.</h2>
          <p>
            {snapshot.entryEvidence && ['capturing', 'secured'].includes(snapshot.phase)
              ? 'Recorded entry conditions at capture. Current berth distance can differ.'
              : 'Live entry conditions from exact simulator state.'}{' '}
            They do not demonstrate sensing or certified capture safety.
          </p>
          <div className="capture-gates">
            {gate.gates.map((g) => (
              <div key={g.id} className={g.passed ? 'passed' : ''}>
                <span>{g.passed ? '✓' : '·'}</span>
                <p>{g.label}</p>
              </div>
            ))}
          </div>
          <button
            className="capture-action"
            disabled={
              !ready ||
              !!preview ||
              terminal ||
              snapshot.phase === 'capturing' ||
              snapshot.phase === 'retreat'
            }
            onClick={() => commit(requestCapture(state.current))}
          >
            <Icon name="target" size={19} />
            {snapshot.phase === 'capturing' ? 'Closing cage…' : 'Close cage / capture'}
            <kbd>C</kbd>
          </button>
          <button
            className="abort-action"
            disabled={!ready || !!preview || terminal || snapshot.phase === 'retreat'}
            onClick={() => commit(abortCapture(state.current))}
          >
            Abort & retreat <kbd>X</kbd>
          </button>
          <div className="capture-rule-note">
            Demonstration target span: {CAPTURE_RULES.targetLongestSideM} m. Proxy collision radius:{' '}
            {CAPTURE_RULES.collisionProxyRadiusM} m. All are selected assumptions, not measured
            properties.
          </div>
        </aside>
      </div>
      <div className="mechanism-strip" aria-label="Mechanism sequence">
        {[
          'deploy arms',
          'track & grasp',
          'retract to cradle',
          'close collector',
          'verify latch',
          'secured',
        ].map((stage) => (
          <span
            key={stage}
            className={
              (snapshot.phase === 'capturing' || snapshot.phase === 'secured') &&
              cycle.stage === stage
                ? 'active'
                : ''
            }
          >
            {stage}
          </span>
        ))}
      </div>
      <div className="rig-evidence">
        <span>
          <strong>Collector:</strong>{' '}
          {rigEvidence?.collectorSegments.join(' + ') || 'static mesh configuration'}
        </span>
        <span>
          <strong>Arm chain:</strong> shoulder → elbow → wrist → fingers
        </span>
        <span>
          <strong>Commanded tip error:</strong>{' '}
          <output aria-label="Rig tracking error">
            {rigEvidence?.arms.length
              ? Math.max(...rigEvidence.arms.map((a) => a.errorM)).toFixed(3)
              : '—'}{' '}
            m
          </output>
        </span>
        <span>Authored kinematics · no force or latch sensor</span>
      </div>
      <div className="grasp-reference">
        <strong>Why matching the centre is insufficient</strong>
        <span>v_grasp = v_COM + ω × r_offset</span>
        <span>
          Script reference: 2 m × 3°/s = <b>0.105 m/s</b> tangential speed.
        </span>
        <small>Illustrative calculation, separate from this mesh's authored grasp anchors.</small>
      </div>
      <div className="flight-controls">
        <div className="flight-commands">
          <button
            className="button primary"
            disabled={
              !ready ||
              !!preview ||
              terminal ||
              snapshot.phase === 'capturing' ||
              snapshot.phase === 'retreat'
            }
            onClick={() => {
              releaseControls();
              commit(startCaptureRun(state.current, 'guided'));
            }}
          >
            Guided approach <kbd>G</kbd>
          </button>
          <button
            className="button secondary"
            disabled={
              !ready ||
              !!preview ||
              terminal ||
              snapshot.phase === 'capturing' ||
              snapshot.phase === 'retreat'
            }
            onClick={takeControls}
          >
            Take controls
          </button>
          <button
            className="icon-button"
            aria-label={snapshot.running ? 'Pause capture rehearsal' : 'Resume capture rehearsal'}
            disabled={!ready || !!preview || terminal || snapshot.phase === 'idle'}
            onClick={() => commit({ ...state.current, running: !state.current.running })}
          >
            <Icon name={snapshot.running ? 'pause' : 'play'} size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Reset capture rehearsal"
            title="Reset scenario"
            onClick={() => reset()}
          >
            <Icon name="refresh" size={16} />
          </button>
          <label>
            Time
            <select
              aria-label="Capture simulation speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[1, 2, 4, 8].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <p id="flight-instructions">
          <kbd>W/S</kbd> forward/back <kbd>A/D</kbd> strafe <kbd>R/F</kbd> up/down <kbd>Space</kbd>{' '}
          brake · drag / arrows to aim · <kbd>Q/E</kbd> roll · <kbd>T</kbd> recenter ·{' '}
          <kbd>Esc</kbd> release
        </p>
      </div>
      <div className="touch-thrusters" aria-label="On-screen translation controls">
        {[
          ['forward', 1, 'Forward'],
          ['forward', -1, 'Back'],
          ['right', -1, 'Left'],
          ['right', 1, 'Right'],
          ['up', 1, 'Up'],
          ['up', -1, 'Down'],
        ].map(([axis, value, label]) => (
          <button
            key={String(label)}
            disabled={!ready || !!preview || terminal}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              pulse(axis as 'forward' | 'right' | 'up', Number(value));
            }}
            onPointerUp={clearInput}
            onPointerCancel={clearInput}
            onLostPointerCapture={clearInput}
          >
            {label}
          </button>
        ))}
        <button
          disabled={!ready || !!preview || terminal}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            input.current = { ...EMPTY_INPUT, brake: true };
          }}
          onPointerUp={clearInput}
          onPointerCancel={clearInput}
          onLostPointerCapture={clearInput}
        >
          Brake
        </button>
      </div>
      {message ? (
        <p className="capture-message" role="status">
          {message}
        </p>
      ) : null}
      <div className="capture-config">
        <label>
          Rehearsal scenario
          <select
            aria-label="Capture scenario"
            value={scenario}
            onChange={(e) => {
              const id = e.target.value as ScenarioId;
              setScenario(id);
              reset(id);
            }}
          >
            <option value="nominal">Nominal / slow tumble</option>
            <option value="tumbling">Excessive tumble / gate rejection</option>
            <option value="drifting">Lateral drift / tracking approach</option>
          </select>
        </label>
        <label>
          Collector configuration
          <select
            aria-label="Collector configuration"
            value={collector}
            onChange={(e) => {
              setCollector(e.target.value);
              reset();
            }}
          >
            {manifest.assets
              .filter((a) => a.role === 'collector')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Visual target
          <select
            aria-label="Capture visual target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              reset();
            }}
          >
            {manifest.assets
              .filter((a) => a.role === 'target')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
          </select>
        </label>
        <div>
          <span>CAGING EQUIPMENT</span>
          <strong>Meshy modular robotic arm</strong>
          <small>Authored shoulder, elbow, wrist and finger bones</small>
        </div>
      </div>
      <div className="capture-lower">
        <section className="panel capture-log">
          <div className="panel-heading">
            <h2>Rehearsal log</h2>
            <span className="plain-badge">LOCAL SESSION</span>
          </div>
          {[...snapshot.events]
            .reverse()
            .slice(0, 7)
            .map((e, i) => (
              <article key={`${e.timeS}-${e.type}-${i}`}>
                <time>T+{fmt(e.timeS, 1)}s</time>
                <strong>{e.type.replaceAll('_', ' ')}</strong>
                <p>{e.detail}</p>
              </article>
            ))}
        </section>
        <section className="panel capture-boundary">
          <span className="eyebrow">WHAT THIS SOFTWARE DEMONSTRATES</span>
          <h2>Inspect the plan. Preserve the evidence.</h2>
          <p>
            Our first pilot hypothesis is a servicing-mission or GNC engineer reviewing one case.
            Use failure comparisons, grasp geometry and an exported record to test whether planning
            mistakes can be found earlier.
          </p>
          <p>
            Motion is synthetic, local and kinematic. The original sources have no rigs;
            software-authored bones now drive the actual arm mesh, and pivots drive the two
            collector segments. There is no image-based sensing, contact force, momentum exchange,
            coupled-body control or removal trajectory.
          </p>
          <p>
            Earth and stars provide visual context, not a propagated camera view. Passing these
            gates does not validate spacecraft hardware or a mission.
          </p>
        </section>
      </div>
      <section className="panel asset-library">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">YOUR BLENDER ASSETS, CONNECTED</span>
            <h2>8 source files. 7 unique models.</h2>
          </div>
          <span className="plain-badge">
            {(manifest.assets.reduce((sum, a) => sum + a.bytes, 0) / 1e6).toFixed(1)} MB TOTAL
          </span>
        </div>
        <p>
          Two upper-stage files are byte-identical and share one web asset. Original Blender files
          are untouched; web copies retain textures and bounded geometry.
        </p>
        <div className="asset-grid">
          {manifest.assets.map((asset) => (
            <button
              key={asset.id}
              className={preview === asset.id ? 'selected' : ''}
              onClick={() => inspect(asset.id)}
            >
              <Icon
                name={
                  asset.role === 'collector'
                    ? 'orbit'
                    : asset.role === 'equipment'
                      ? 'grid'
                      : 'target'
                }
                size={22}
              />
              <strong>{asset.label}</strong>
              <span>
                {asset.role.toUpperCase()} · {asset.parts} {asset.parts === 1 ? 'PART' : 'PARTS'}
              </span>
              <small>
                {(asset.bytes / 1e6).toFixed(1)} MB · {asset.triangles.toLocaleString()} tris
              </small>
              <b>Inspect model ↗</b>
            </button>
          ))}
        </div>
        {previewAsset ? (
          <div className="asset-provenance">
            <strong>{previewAsset.label} · source provenance</strong>
            {previewAsset.sourceAliases.map((name) => (
              <code key={name}>{name}</code>
            ))}
            <code>Source SHA-256: {previewAsset.sourceSha256}</code>
            <p>No measured dimensions, dynamics or capture interface are implied by this mesh.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
