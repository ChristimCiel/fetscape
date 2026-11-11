"""Synthetic RPO experiment. Research demonstration, never flight guidance.

Truth: nonlinear Earth point-mass gravity in inertial coordinates (RK4).
Estimator: linear HCW motion in the target's rotating radial/along-track frame.
Sensor: synthetic range + two angles to an assumed acquired target point.
No image detection, target attitude estimation, contact or spacecraft hardware.
"""
from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np


def matrix_exp(value: np.ndarray) -> np.ndarray:
    """Small dense scaling/squaring Taylor exponential; validated analytically.

    Kept local because the host scipy binary cannot load. This routine is for
    the fixed 9x9, 1 s research model, not a general flight math library.
    """
    norm = float(np.linalg.norm(value, ord=np.inf))
    scale = max(0, int(math.ceil(math.log2(max(norm/0.5, 1.0)))))
    reduced = value/(2**scale)
    term = np.eye(value.shape[0])
    result = term.copy()
    for k in range(1, 40):
        term = term@reduced/k
        result += term
        if np.linalg.norm(term, ord=np.inf) < 1e-17:
            break
    for _ in range(scale):
        result = result@result
    return result

OUT = Path(__file__).resolve().parent
MU = 3.986004418e14
RADIUS = 6378137.0 + 700000.0
N = math.sqrt(MU / RADIUS**3)
DT = 1.0
OMEGA = np.array([0.0, 0.0, N])
A = np.zeros((6, 6))
A[:3, 3:] = np.eye(3)
A[3, 0], A[3, 4], A[4, 3], A[5, 2] = 3*N*N, 2*N, -2*N, -N*N
B = np.zeros((6, 3))
B[3:, :] = np.eye(3)
aug = np.zeros((9, 9))
aug[:6, :6], aug[:6, 6:] = A, B
discrete = matrix_exp(aug * DT)
PHI, BD = discrete[:6, :6], discrete[:6, 6:]
H = np.column_stack((np.eye(3), np.zeros((3, 3))))
QA = 2.5e-7
PROCESS = QA*np.block([[np.eye(3)*DT**3/3, np.eye(3)*DT**2/2],
                      [np.eye(3)*DT**2/2, np.eye(3)*DT]])


@dataclass(frozen=True)
class Config:
    duration_s: int = 650
    mass_kg: float = 500.0
    max_acceleration_m_s2: float = 0.01
    max_speed_m_s: float = 0.30
    hold_distance_m: float = 25.0
    retreat_distance_m: float = 130.0
    exclusion_radius_m: float = 10.0
    range_sigma_m: float = 0.15
    angle_sigma_rad: float = math.radians(0.15)
    max_measurement_age_s: float = 5.0
    nis_gate: float = 16.27
    safety_buffer_m: float = 3.0
    fault_time_s: int = 130
    health_aware: bool = True


CASES = [
    {'id': 'nominal', 'label': 'Nominal approach',
     'description': 'No injected failure. Approach a 25 m hold point. No contact.'},
    {'id': 'sensor_loss', 'label': 'Relative sensor loss',
     'description': 'All relative observations stop at 130 s. Onboard prediction and retreat continue.'},
    {'id': 'outliers', 'label': 'Wrong-track observations',
     'description': 'A 20 m Cartesian track offset begins at 130 s. Innovation gating may reject it.'},
    {'id': 'weak_thrust', 'label': 'Reduced thrust authority',
     'description': 'Available thrust drops to 30% at 130 s. A simulated health flag triggers retreat.'},
    {'id': 'control_loss', 'label': 'Complete thrust loss',
     'description': 'Available thrust drops to zero at 130 s. A retreat command cannot restore control.'},
]


def basis(t: float) -> np.ndarray:
    c, s = math.cos(N*t), math.sin(N*t)
    return np.array([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]])


def target(t: float) -> tuple[np.ndarray, np.ndarray]:
    q = basis(t)
    return q @ np.array([RADIUS, 0.0, 0.0]), q @ np.array([0.0, RADIUS*N, 0.0])


def relative_to_inertial(state: np.ndarray, t: float = 0.0) -> np.ndarray:
    rt, vt = target(t)
    q = basis(t)
    return np.r_[rt + q@state[:3], vt + q@(state[3:] + np.cross(OMEGA, state[:3]))]


def inertial_to_relative(state: np.ndarray, t: float) -> np.ndarray:
    rt, vt = target(t)
    q = basis(t)
    pos = q.T@(state[:3]-rt)
    vel = q.T@(state[3:]-vt)-np.cross(OMEGA, pos)
    return np.r_[pos, vel]


def truth_rhs(t: float, state: np.ndarray, acceleration: np.ndarray) -> np.ndarray:
    r = state[:3]
    return np.r_[state[3:], -MU*r/np.linalg.norm(r)**3 + basis(t)@acceleration]


def truth_step(state: np.ndarray, t: float, acceleration: np.ndarray,
               dt: float = DT) -> np.ndarray:
    k1 = truth_rhs(t, state, acceleration)
    k2 = truth_rhs(t+dt/2, state+dt*k1/2, acceleration)
    k3 = truth_rhs(t+dt/2, state+dt*k2/2, acceleration)
    k4 = truth_rhs(t+dt, state+dt*k3, acceleration)
    return state + dt*(k1+2*k2+2*k3+k4)/6


def observe(true_position: np.ndarray, rng: np.random.Generator, cfg: Config,
            wrong_track: bool = False) -> tuple[np.ndarray, np.ndarray]:
    """Target already acquired. Ideal known own attitude/frame alignment.

    Range/angles are transformed into a relative position fix with a local
    first-order covariance. The target sends no telemetry or beacon signal.
    This explicitly excludes acquisition, pose, illumination and occlusion.
    """
    p = true_position.copy()
    if wrong_track:
        p += np.array([20.0, 0.0, 0.0])
    distance = np.linalg.norm(p)
    az = math.atan2(p[1], p[0])
    el = math.atan2(p[2], math.hypot(p[0], p[1]))
    distance += rng.normal(0.0, cfg.range_sigma_m)
    az += rng.normal(0.0, cfg.angle_sigma_rad)
    el += rng.normal(0.0, cfg.angle_sigma_rad)
    ca, sa, ce, se = math.cos(az), math.sin(az), math.cos(el), math.sin(el)
    position_fix = distance*np.array([ce*ca, ce*sa, se])
    jac = np.array([[ce*ca, -distance*ce*sa, -distance*se*ca],
                    [ce*sa, distance*ce*ca, -distance*se*sa],
                    [se, 0.0, distance*ce]])
    noise = np.diag([cfg.range_sigma_m**2, cfg.angle_sigma_rad**2, cfg.angle_sigma_rad**2])
    cov = jac@noise@jac.T + np.eye(3)*1e-8
    return position_fix, cov


def update(mean: np.ndarray, cov: np.ndarray, fix: np.ndarray,
           measurement_cov: np.ndarray, gate: float) -> tuple[np.ndarray, np.ndarray, bool, float]:
    innovation = fix-H@mean
    s = H@cov@H.T+measurement_cov
    nis = float(innovation@np.linalg.solve(s, innovation))
    if nis > gate:
        return mean, cov, False, nis
    gain = np.linalg.solve(s, H@cov).T
    new_mean = mean+gain@innovation
    # Joseph update preserves covariance symmetry/positive semidefiniteness.
    m = np.eye(6)-gain@H
    new_cov = m@cov@m.T+gain@measurement_cov@gain.T
    return new_mean, (new_cov+new_cov.T)/2, True, nis


def capped(vector: np.ndarray, limit: float) -> np.ndarray:
    mag = np.linalg.norm(vector)
    return vector*min(1.0, limit/max(mag, 1e-12))


def command(mean: np.ndarray, cov: np.ndarray, age_s: float, mode: str,
            health: str, cfg: Config, reported_authority: float = 1.0) -> tuple[np.ndarray, str, str, float]:
    """Controller input has estimated state only. No truth state argument."""
    p, v = mean[:3], mean[3:]
    distance = max(np.linalg.norm(p), 1e-8)
    sigma = math.sqrt(max(float(np.linalg.eigvalsh(cov[:3, :3])[-1]), 0.0))
    closing = max(0.0, -float(p@v)/distance)
    available = reported_authority if cfg.health_aware else 1.0
    stopping = closing**2/(2*max(cfg.max_acceleration_m_s2*available, 1e-9))
    margin = distance-3*sigma-cfg.exclusion_radius_m-stopping-cfg.safety_buffer_m
    reason = ''
    if mode != 'RETREAT':
        if age_s > cfg.max_measurement_age_s:
            mode, reason = 'RETREAT', 'Accepted relative observation is stale'
        elif health != 'OK':
            mode, reason = 'RETREAT', 'Actuator health flag reports degraded authority'
        elif margin <= 0:
            mode, reason = 'RETREAT', 'Conservative stopping-distance margin exhausted'
    goal = np.array([0.0, -cfg.hold_distance_m, 0.0])
    if mode == 'RETREAT':
        goal = p/distance*cfg.retreat_distance_m
    desired_velocity = capped(0.015*(goal-p), cfg.max_speed_m_s)
    drift = (A@mean)[3:]
    desired_acceleration = capped(-drift + 0.09*(desired_velocity-v),
                                  cfg.max_acceleration_m_s2*available)
    acceleration = desired_acceleration/available if available > 0 else np.zeros(3)
    if mode != 'RETREAT' and np.linalg.norm(p-goal) < 1.0 and np.linalg.norm(v) < 0.025:
        mode = 'HOLD'
    return acceleration, mode, reason, margin


def run(case_id: str, seed: int, cfg: Config = Config(), record: bool = False) -> dict:
    if case_id not in {c['id'] for c in CASES}:
        raise ValueError(f'Unknown case {case_id}')
    rng = np.random.default_rng(seed)
    initial = np.r_[np.array([0.0, -120.0, 1.0])+rng.normal(0.0, 0.35, 3),
                    rng.normal(0.0, 0.008, 3)]
    true_eci = relative_to_inertial(initial)
    mean = initial + np.r_[rng.normal(0.0, 0.5, 3), rng.normal(0.0, 0.02, 3)]
    cov = np.diag([1.0]*3+[0.05**2]*3)
    mode, last_observation = 'APPROACH', 0.0
    events, rows, errors = [], [], []
    rejected, minimum_range, dv, retreat_time = 0, float('inf'), 0.0, None
    actuator_scale = 1.0+rng.normal(0.0, 0.02, 3)
    exclusion_breach = False
    three_sigma_hits = 0
    for k in range(cfg.duration_s+1):
        time = k*DT
        truth = inertial_to_relative(true_eci, time)
        failed = time >= cfg.fault_time_s
        observation_ok = not(case_id == 'sensor_loss' and failed)
        nis = None
        if observation_ok:
            fix, r = observe(truth[:3], rng, cfg, case_id == 'outliers' and failed)
            mean, cov, accepted, nis = update(mean, cov, fix, r, cfg.nis_gate)
            if accepted:
                last_observation = time
            else:
                rejected += 1
        health = 'OK'
        authority = 1.0
        if failed and case_id in {'weak_thrust', 'control_loss'}:
            health = 'DEGRADED'
            authority = 0.3 if case_id == 'weak_thrust' else 0.0
        # The scenario supplies an ideal actuator-authority report. It does not
        # reveal relative truth. A real report needs hardware/FDIR validation.
        action, mode, reason, margin = command(mean, cov, time-last_observation, mode, health, cfg, authority)
        if reason:
            retreat_time = time
            events.append({'time_s': time, 'event': reason})
        actual_acceleration = action*actuator_scale*authority
        distance = float(np.linalg.norm(truth[:3]))
        minimum_range = min(minimum_range, distance)
        error = float(np.linalg.norm(mean[:3]-truth[:3]))
        errors.append(error)
        bound = 3*math.sqrt(max(float(np.linalg.eigvalsh(cov[:3, :3])[-1]), 0))
        three_sigma_hits += int(error <= bound)
        exclusion_breach |= distance < cfg.exclusion_radius_m
        if record and (k % 2 == 0 or reason or k == cfg.duration_s):
            rows.append({'t':time, 'p':truth[:3].tolist(), 'estimate':mean[:3].tolist(),
                         'range':distance, 'error':error, 'bound':bound,
                         'age':time-last_observation, 'speed':float(np.linalg.norm(truth[3:])),
                         'command_n':float(np.linalg.norm(action)*cfg.mass_kg),
                         'actual_n':float(np.linalg.norm(actual_acceleration)*cfg.mass_kg),
                         'mode':mode, 'margin':margin})
        if k == cfg.duration_s:
            break
        dv += float(np.linalg.norm(actual_acceleration))*DT
        true_eci = truth_step(true_eci, time, actual_acceleration)
        reported_fraction = authority if cfg.health_aware else 1.0
        mean = PHI@mean+BD@(action*reported_fraction)
        cov = PHI@cov@PHI.T+PROCESS
    final = inertial_to_relative(true_eci, cfg.duration_s*DT)
    goal = np.array([0.0, -cfg.hold_distance_m, 0.0])
    terminal_position_error = float(np.linalg.norm(final[:3]-goal))
    terminal_speed = float(np.linalg.norm(final[3:]))
    if case_id == 'control_loss':
        outcome = 'CONTROL LOST'
    elif exclusion_breach:
        outcome = 'EXCLUSION BREACH'
    elif mode == 'RETREAT':
        outcome = 'RETREATED' if np.linalg.norm(final[:3]) >= 100 else 'RETREAT INCOMPLETE'
    elif terminal_position_error <= 2 and terminal_speed <= 0.03:
        outcome = 'HOLD REACHED'
    else:
        outcome = 'HOLD NOT REACHED'
    return {'case':case_id, 'seed':seed, 'outcome':outcome, 'min_range_m':minimum_range,
            'final_range_m':float(np.linalg.norm(final[:3])),
            'terminal_hold_error_m':terminal_position_error, 'terminal_speed_m_s':terminal_speed,
            'position_rmse_m':math.sqrt(float(np.mean(np.square(errors)))),
            'max_position_error_m':max(errors), 'observed_bound_coverage':three_sigma_hits/(cfg.duration_s+1),
            'delta_v_m_s':dv, 'rejected_measurements':rejected,
            'retreat_time_s':retreat_time, 'events':events, 'samples':rows}


def main() -> None:
    cfg = Config()
    examples = [run(c['id'], 7, cfg, True) for c in CASES]
    sweeps = []
    for case in CASES:
        trials = [run(case['id'], seed, cfg) for seed in range(30)]
        outcomes = {}
        for trial in trials:
            outcomes[trial['outcome']] = outcomes.get(trial['outcome'], 0)+1
        sweeps.append({'case':case['id'], 'trials':30, 'seeds':list(range(30)),
                       'outcomes':outcomes,
                       'minimum_range_m':min(t['min_range_m'] for t in trials),
                       'worst_terminal_hold_error_m':max(t['terminal_hold_error_m'] for t in trials),
                       'position_rmse_median_m':float(np.median([t['position_rmse_m'] for t in trials])),
                       'max_position_error_m':max(t['max_position_error_m'] for t in trials),
                       'retreat_time_s':sorted({t['retreat_time_s'] for t in trials if t['retreat_time_s'] is not None})})
        print(json.dumps(sweeps[-1]), flush=True)
    baseline_cfg = Config(health_aware=False)
    baseline_trials = [run('weak_thrust', seed, baseline_cfg) for seed in range(30)]
    baseline_outcomes = {}
    for trial in baseline_trials:
        baseline_outcomes[trial['outcome']] = baseline_outcomes.get(trial['outcome'],0)+1
    comparison = {'case':'weak_thrust', 'trials':30,
                  'baseline':'Estimator assumes commanded thrust is applied',
                  'baseline_outcomes':baseline_outcomes,
                  'baseline_rmse_median_m':float(np.median([x['position_rmse_m'] for x in baseline_trials])),
                  'revised':'Estimator and controller use an ideal injected actuator-authority report',
                  'baseline_example':run('weak_thrust',7,baseline_cfg,True)}
    print(json.dumps({k:v for k,v in comparison.items() if k!='baseline_example'}),flush=True)
    payload = {'title':'ADR RPO research demonstrator', 'config':asdict(cfg),
               'model':{'truth':'Nonlinear inertial point-mass gravity, RK4, 1 s step',
                        'estimator':'HCW linear Kalman filter, first-order Cartesian fix covariance',
                        'controller':'Velocity-limited PD with HCW drift cancellation and heuristic retreat guard',
                        'frame':'Target LVLH: x radial outward, y along-track, z orbit-normal',
                        'orbit_altitude_m':700000, 'earth_mu_m3_s2':MU,
                        'assumptions':['Target point already acquired', 'Known, exact own attitude and target circular reference orbit',
                                       'Synthetic range and bearing observations, not images', 'No target pose or tumble estimation',
                                       'No contact, coupled-body control, radiation, thermal, battery, RF or reentry model',
                                       'Health flags and the exact degraded-authority fraction are injected scenario inputs, not validated hardware telemetry or fault diagnosis',
                                       'No delayed observations or correlated sensor biases in this campaign',
                                       'Three-sigma bound is a model diagnostic, not certified coverage or collision probability',
                                       'Finite numerical sample horizon, not a formal safety proof']},
               'cases':CASES, 'examples':examples, 'sweeps':sweeps, 'comparison':comparison,
               'sources':[{'label':'MIT HCW derivation','url':'https://ocw.mit.edu/courses/16-346-astrodynamics-fall-2008/e4f0632a9f1c98f7e9b25492e1a30eb1_lec_26.pdf'},
                          {'label':'Stanford SPEED+ / SHIRT image benchmarks','url':'https://slab.stanford.edu/projects/datasets'},
                          {'label':'NASA JPL GNC testbed','url':'https://www.jpl.nasa.gov/site/research/research-community/laboratories-facilities/guidance-and-control-spacecraft-autonomy-testbed/'}]}
    (OUT/'results.json').write_text(json.dumps(payload, separators=(',',':')), encoding='utf-8')
    (OUT/'sweep-summary.json').write_text(json.dumps(sweeps,indent=2),encoding='utf-8')


if __name__ == '__main__':
    main()
