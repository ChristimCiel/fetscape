/**
 * Fetscape v1 MVP - Core Types
 * AI-native space operations workspace for OPEN LAB 2026 AI Build Challenge
 */

export type Language = 'en' | 'zh-TW';

export interface AgentConfig {
  language: Language;
  apiKey?: string;
  provider?: 'anthropic' | 'openai' | 'deterministic';
  maxTokens: number;
}

export interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: number;
}

export interface AgentStep {
  thought?: string;
  toolCalls: ToolCall[];
  results: ToolResult[];
}

export interface AgentTrace {
  id: string;
  task: string;
  steps: AgentStep[];
  finalResponse?: string;
  verificationStatus: 'pending' | 'verified' | 'blocked';
  blockedClaims?: string[];
  createdAt: number;
  completedAt?: number;
  tokenUsage: number;
}

export interface ViewSpec {
  type: 'mission-readiness' | 'debris-removal' | 'report';
  title: string;
  sections: ViewSection[];
}

export interface ViewSection {
  id: string;
  type: 'metrics' | 'chart' | 'table' | 'text' | 'approval';
  title?: string;
  content: unknown;
}

export interface ApprovalRequest {
  id: string;
  type: 'export' | 'file' | 'email' | 'draft';
  title: string;
  description: string;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected';
}

// Lane A: Mission-Readiness Types
export interface MissionProfile {
  name: string;
  mass?: number;
  orbit: {
    semiMajorAxis?: number;
    inclination?: number;
    eccentricity?: number;
    altitude?: number;
  };
  launchDate?: string;
  hasNoPropulsion?: boolean;
}

export interface DeorbitAnalysis {
  estimatedLifetimeYears: number;
  complies25Year: boolean;
  complies5Year: boolean;
  method: string;
  assumptions: string[];
  uncertainties: string[];
}

export interface RegulationCitation {
  source: string;
  section: string;
  text: string;
  url?: string;
}

export interface OrbitalShellDensity {
  altitudeKm: number;
  objectCount: number;
  meanMotionDayInv: number;
}

export interface CloseApproach {
  targetName: string;
  targetId: string;
  tcaUtc: string;
  missDistanceKm: number;
  relativeVelocityKmS: number;
  isFiltered: boolean;
  note: string;
}

export interface MissionReadinessReport {
  profile: MissionProfile;
  shellDensity: OrbitalShellDensity;
  closeApproaches: CloseApproach[];
  deorbitAnalysis: DeorbitAnalysis;
  regulations: RegulationCitation[];
  recommendations: string[];
  disclaimers: string[];
}

// Lane B: Debris-Removal Types
export interface DebrisTarget {
  id: string;
  name: string;
  catalogId?: string;
  altitude: number;
  inclination: number;
  mass?: number;
  size?: number;
  rankingScore: number;
  rankingCriteria: {
    criterion: string;
    value: string | number;
    weight: number;
  }[];
  feasibilityNotes: string[];
}

export interface MissionConcept {
  targetId: string;
  transferDeltaV?: number;
  planeChangeDeltaV?: number;
  estimatedDuration?: number;
  captureApproach: string;
  risks: string[];
  requiredData: string[];
}

// Safety Boundaries
export interface SafetyViolation {
  type: 'prohibited_term' | 'unsupported_claim' | 'maneuver_advice' | 'commanding';
  content: string;
  context: string;
  severity: 'error' | 'warning';
}

export interface VerificationResult {
  passed: boolean;
  violations: SafetyViolation[];
  supportedClaims: string[];
  unsupportedClaims: string[];
}
