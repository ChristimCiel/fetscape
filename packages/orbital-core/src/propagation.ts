import { json2satrec, twoline2satrec, propagate, gstime, eciToEcf } from 'satellite.js';
import type { OrbitalObject, State } from './types.js';
import { norm, subtract, dot } from './geometry.js';
export class PropagationError extends Error {
  constructor(
    public objectId: string,
    public utc: string,
    reason: string,
  ) {
    super(reason);
    this.name = 'PropagationError';
  }
}
export function propagator(object: OrbitalObject): (millis: number) => State {
  const sat = object.tle ? twoline2satrec(...object.tle) : json2satrec(object.gp);
  return (millis) => {
    const state = propagate(sat, new Date(millis));
    if (!state?.position || !state.velocity || sat.error !== 0)
      throw new PropagationError(
        object.id,
        new Date(millis).toISOString(),
        `SGP4 error ${sat.error}`,
      );
    const p = state.position,
      v = state.velocity;
    const result: State = { positionKm: [p.x, p.y, p.z], velocityKmS: [v.x, v.y, v.z] };
    if (![...result.positionKm, ...result.velocityKmS].every(Number.isFinite))
      throw new PropagationError(object.id, new Date(millis).toISOString(), 'Non-finite state');
    return result;
  };
}
export function geometry(a: State, b: State) {
  const r = subtract(b.positionKm, a.positionKm),
    v = subtract(b.velocityKmS, a.velocityKmS);
  const range = norm(r),
    rangeDerivative = dot(r, v);
  return {
    distanceKm: range,
    relativeVelocityKmS: norm(v),
    rangeRateKmS: range > 0 ? rangeDerivative / range : 0,
    derivativeHalfSquaredRange: rangeDerivative,
  };
}
/** Visualization transform only: GMST rotation, UTC used as UT1 approximation, no EOP/polar motion. */
export function temeToEcef(state: State, millis: number): State {
  const theta = gstime(new Date(millis));
  const p = eciToEcf(
    { x: state.positionKm[0], y: state.positionKm[1], z: state.positionKm[2] },
    theta,
  );
  const v = eciToEcf(
    { x: state.velocityKmS[0], y: state.velocityKmS[1], z: state.velocityKmS[2] },
    theta,
  );
  const omega = 7.29211514670698e-5;
  return { positionKm: [p.x, p.y, p.z], velocityKmS: [v.x + omega * p.y, v.y - omega * p.x, v.z] };
}
