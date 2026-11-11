export type Vector = [number, number, number];
export type State = { positionKm: Vector; velocityKmS: Vector };
export type DataKind = 'public_elements' | 'synthetic' | 'user_import';
export interface GP {
  [key: string]: unknown;
  OBJECT_NAME: string;
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  EPHEMERIS_TYPE: 0;
  CLASSIFICATION_TYPE: 'U' | 'C';
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  CENTER_NAME: 'EARTH';
  REF_FRAME: 'TEME';
  TIME_SYSTEM: 'UTC';
  MEAN_ELEMENT_THEORY: 'SGP4';
}
export interface OrbitalObject {
  id: string;
  name: string;
  catalogId: number | null;
  gp: GP;
  tle?: [string, string];
  physical: { massKg: null; sizeM: null; tumbleRadS: null; basis: 'not_in_orbital_elements' };
}
export interface Dataset {
  id: string;
  name: string;
  kind: DataKind;
  source: string;
  sourceUrl: string | null;
  acquiredAt: string;
  referenceStart: string;
  contentSha256: string;
  inputFormat: 'omm' | 'tle';
  rawInput: unknown;
  objects: OrbitalObject[];
}
export interface ScreeningParameters {
  datasetId: string;
  primaryId: string;
  startUtc: string;
  hours: number;
  cadenceSeconds: number;
  thresholdKm: number;
}
export interface Encounter {
  id: string;
  primaryId: string;
  secondaryId: string;
  tcaUtc: string;
  missDistanceKm: number;
  relativeVelocityKmS: number;
  rangeRateBeforeKmS: number;
  rangeRateAfterKmS: number;
  bracketUtc: [string, string];
  primaryEpochOffsetHours: number;
  secondaryEpochOffsetHours: number;
  matchesGeometryThreshold: boolean;
}
export interface Failure {
  objectId: string;
  utc: string;
  reason: string;
}
export interface TrajectorySample {
  utc: string;
  positionKm: Vector;
  velocityKmS: Vector;
}
export interface Analysis {
  id: string;
  createdAt: string;
  engineVersion: string;
  dataset: Dataset;
  parameters: ScreeningParameters;
  endUtc: string;
  frame: 'TEME';
  timeSystem: 'UTC';
  events: Encounter[];
  trajectories: Record<string, TrajectorySample[]>;
  coverage: {
    status: 'sampled' | 'partial';
    pairsScreened: number;
    evaluations: number;
    failures: Failure[];
    exclusions: { objectId: string; reason: string }[];
  };
  limitations: string[];
}
export interface Decision {
  id: string;
  analysisId: string;
  eventId: string;
  action: 'review' | 'request_data' | 'coordinate';
  note: string;
  author: string;
  createdAt: string;
}
