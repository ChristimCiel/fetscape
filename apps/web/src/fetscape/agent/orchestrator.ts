/**
 * Agent orchestrator — typed tool calls into deterministic tools.
 * Deterministic / judge mode never hits the network (replay only).
 */

import type {
  AgentConfig,
  AgentTrace,
  AgentStep,
  ToolCall,
  ToolResult,
  MissionProfile,
} from '../types';
import { estimateDeorbitLifetime, getComplianceStatus } from '../tools/deorbit';
import { retrieveRegulations, generateComplianceChecklist } from '../tools/regulations';
import {
  getReplayCloseApproachSnapshot,
  type CloseApproachSnapshot,
} from '../tools/close-approach-replay';
import { SafetyLinter } from '../safety/linter';

const REPLAY_DENSITY = {
  targetAltitudeKm: 510,
  objectsInShell: 1247,
  shellRangeKm: [485, 535] as [number, number],
  nearbyBins: [
    { altitudeKm: 450, count: 892 },
    { altitudeKm: 500, count: 1247 },
    { altitudeKm: 550, count: 2103 },
  ],
  totalActive: 9847,
  dataSource: 'Replay snapshot (judge mode / CI) — not a live CelesTrak pull',
  acquiredAt: '2026-11-25T19:00:00.000Z',
};

export class AgentOrchestrator {
  private config: AgentConfig;
  private linter: SafetyLinter;
  private tokenUsage = 0;

  constructor(config: AgentConfig) {
    this.config = config;
    this.linter = new SafetyLinter();
  }

  private get offline(): boolean {
    return this.config.provider === 'deterministic' || !this.config.apiKey;
  }

  async analyzeMissionReadiness(profile: MissionProfile): Promise<AgentTrace> {
    const trace: AgentTrace = {
      id: `trace-${Date.now()}`,
      task: `Mission readiness analysis for ${profile.name}`,
      steps: [],
      verificationStatus: 'pending',
      createdAt: Date.now(),
      tokenUsage: 0,
    };

    try {
      const altitudeKm = profile.orbit.altitude ?? 510;
      const steps: AgentStep[] = [];

      steps.push(
        await this.executeStep({
          thought: `Analyzing orbital shell density around ${altitudeKm} km`,
          toolCalls: [
            {
              id: `tool-${Date.now()}-1`,
              tool: 'analyze_shell_density',
              arguments: { altitudeKm, shellThicknessKm: 50 },
              timestamp: Date.now(),
            },
          ],
        }),
      );

      const deorbitStep = await this.executeStep({
        thought: 'Estimating post-mission deorbit lifetime',
        toolCalls: [
          {
            id: `tool-${Date.now()}-2`,
            tool: 'estimate_deorbit_lifetime',
            arguments: {
              altitudeKm,
              massKg: profile.mass,
              inclination: profile.orbit.inclination,
              eccentricity: profile.orbit.eccentricity,
            },
            timestamp: Date.now(),
          },
        ],
      });
      steps.push(deorbitStep);

      steps.push(
        await this.executeStep({
          thought: 'Loading close-approach geometric screening (replay)',
          toolCalls: [
            {
              id: `tool-${Date.now()}-3`,
              tool: 'load_close_approach_snapshot',
              arguments: {},
              timestamp: Date.now(),
            },
          ],
        }),
      );

      steps.push(
        await this.executeStep({
          thought: 'Retrieving applicable regulations',
          toolCalls: [
            {
              id: `tool-${Date.now()}-4`,
              tool: 'retrieve_regulations',
              arguments: {
                jurisdiction: 'taiwan',
                missionType: 'leo',
                hasNoPropulsion: profile.hasNoPropulsion ?? true,
              },
              timestamp: Date.now(),
            },
          ],
        }),
      );

      const deorbitResult = deorbitStep.results[0]?.data as
        { estimatedLifetimeYears?: number } | undefined;
      steps.push(
        await this.executeStep({
          thought: 'Generating compliance checklist',
          toolCalls: [
            {
              id: `tool-${Date.now()}-5`,
              tool: 'generate_compliance_checklist',
              arguments: {
                hasNoPropulsion: profile.hasNoPropulsion ?? true,
                altitude: altitudeKm,
                estimatedLifetime: deorbitResult?.estimatedLifetimeYears ?? 0,
              },
              timestamp: Date.now(),
            },
          ],
        }),
      );

      trace.steps = steps;
      trace.completedAt = Date.now();
      trace.tokenUsage = this.tokenUsage;

      const response = this.generateReport(trace);
      const safetyCheck = this.linter.ensureCompliance(response);
      if (!safetyCheck.compliant) {
        trace.verificationStatus = 'blocked';
        trace.blockedClaims = safetyCheck.violations.map((v) => v.content);
      } else {
        trace.verificationStatus = 'verified';
      }
      trace.finalResponse = response;
    } catch (error) {
      console.error('[Orchestrator] Error:', error);
      trace.verificationStatus = 'blocked';
      trace.blockedClaims = [(error as Error).message];
      trace.completedAt = Date.now();
    }

    return trace;
  }

  private async executeStep(step: Omit<AgentStep, 'results'>): Promise<AgentStep> {
    const results: ToolResult[] = [];
    for (const toolCall of step.toolCalls) {
      try {
        results.push(await this.executeTool(toolCall));
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          success: false,
          error: (error as Error).message,
          timestamp: Date.now(),
        });
      }
    }
    return { ...step, results };
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      let data: unknown;
      switch (toolCall.tool) {
        case 'analyze_shell_density': {
          if (this.offline) {
            data = {
              ...REPLAY_DENSITY,
              targetAltitudeKm: (toolCall.arguments.altitudeKm as number) ?? 510,
            };
          } else {
            const { analyzeShellDensity } = await import('../tools/celestrak');
            data = await analyzeShellDensity(
              toolCall.arguments.altitudeKm as number,
              (toolCall.arguments.shellThicknessKm as number) ?? 50,
            );
          }
          break;
        }
        case 'estimate_deorbit_lifetime':
          data = estimateDeorbitLifetime(
            toolCall.arguments as Parameters<typeof estimateDeorbitLifetime>[0],
          );
          break;
        case 'retrieve_regulations':
          data = retrieveRegulations(
            toolCall.arguments as Parameters<typeof retrieveRegulations>[0],
          );
          break;
        case 'generate_compliance_checklist':
          data = generateComplianceChecklist(
            toolCall.arguments as Parameters<typeof generateComplianceChecklist>[0],
          );
          break;
        case 'load_close_approach_snapshot':
          // Always use bundled replay in MVP judge/CI; live CelesTrak is optional later.
          data = getReplayCloseApproachSnapshot();
          break;
        default:
          throw new Error(`Unknown tool: ${toolCall.tool}`);
      }
      return { toolCallId: toolCall.id, success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: (error as Error).message,
        timestamp: Date.now(),
      };
    }
  }

  private generateReport(trace: AgentTrace): string {
    const { steps } = trace;
    let report = '# Mission Readiness Analysis Report\n\n';
    report +=
      '**DISCLAIMER**: This is a decision support tool. All outputs require human review by qualified operators. This system cannot command satellites and does not provide maneuver recommendations.\n\n';

    const densityData = steps[0]?.results[0]?.data as typeof REPLAY_DENSITY | undefined;
    if (densityData) {
      report += '## Orbital Shell Density Analysis\n\n';
      report += `- **Target Altitude**: ${densityData.targetAltitudeKm} km\n`;
      report += `- **Objects in Shell**: ${densityData.objectsInShell}\n`;
      report += `- **Total Active Objects**: ${densityData.totalActive}\n`;
      report += `- **Data Source**: ${densityData.dataSource}\n\n`;
      report +=
        '**Note**: Count based on mean altitude approximation from mean motion. Actual shell population may vary.\n\n';
    }

    const deorbitData = steps[1]?.results[0]?.data as ReturnType<
      typeof estimateDeorbitLifetime
    > | null;
    if (deorbitData) {
      report += '## Deorbit Lifetime Analysis\n\n';
      report += `- **Estimated Lifetime**: ${deorbitData.estimatedLifetimeYears} years\n`;
      report += `- **FCC 5-Year Compliance**: ${deorbitData.complies5Year ? 'Compliant' : 'Non-compliant'}\n`;
      report += `- **NSTC 25-Year Compliance**: ${deorbitData.complies25Year ? 'Compliant' : 'Non-compliant'}\n`;
      report += `- **Method**: ${deorbitData.method}\n\n`;
      report += '### Assumptions\n';
      for (const assumption of deorbitData.assumptions) report += `- ${assumption}\n`;
      report += '\n### Uncertainties\n';
      for (const uncertainty of deorbitData.uncertainties) report += `- ${uncertainty}\n`;
      report += '\n';
      const compliance = getComplianceStatus(deorbitData);
      report += `**Compliance Status**: ${compliance.status.toUpperCase()}\n\n`;
      report += `${compliance.message}\n\n`;
    }

    const caData = steps[2]?.results[0]?.data as CloseApproachSnapshot | undefined;
    if (caData?.disclaimer) {
      report += '## Close Approach Screening\n\n';
      report += `**${caData.disclaimer}**\n\n`;
      report += `- **Data Source**: ${caData.dataSource}\n`;
      report += `- **Analysis Window**: ${caData.startUtc} + ${caData.hours} hours\n`;
      report += `- **Geometry Threshold**: ${caData.thresholdKm} km\n`;
      report += `- **Objects Screened**: ${caData.totalScreened}\n`;
      if (caData.excludedDocked?.length) {
        report += `- **Excluded docked / same-object**: ${caData.excludedDocked.join(', ')}\n`;
      }
      report += '\n';
      if (caData.approaches.length) {
        report += '### Identified Events (geometric screening only)\n\n';
        report += '| Object | TCA (UTC) | Miss Distance | Rel. Velocity | Note |\n';
        report += '|--------|-----------|---------------|---------------|------|\n';
        for (const approach of caData.approaches.slice(0, 10)) {
          const tca = approach.tcaUtc.slice(0, 16);
          report += `| ${approach.targetName} | ${tca} | ${approach.missDistanceKm.toFixed(1)} km | ${approach.relativeVelocityKmS.toFixed(2)} km/s | ${approach.note} |\n`;
        }
        report += '\n';
      } else {
        report += 'No close approaches within threshold detected in analysis window.\n\n';
      }
    }

    const regData = steps[3]?.results[0]?.data as
      ReturnType<typeof retrieveRegulations> | undefined;
    if (regData) {
      report += '## Applicable Regulations\n\n';
      for (const reg of regData.slice(0, 5)) {
        report += `### ${reg.source}\n`;
        report += `**${reg.section}**: ${reg.text}\n`;
        if (reg.url) report += `[Full document](${reg.url})\n`;
        report += '\n';
      }
    }

    const checklistData = steps[4]?.results[0]?.data as
      ReturnType<typeof generateComplianceChecklist> | undefined;
    if (checklistData) {
      report += '## Compliance Checklist\n\n';
      for (const item of checklistData) {
        report += `- **${item.item}** (${item.status}): ${item.notes}\n`;
      }
      report += '\n';
    }

    report += '---\n\n';
    report +=
      '**GEOMETRIC SCREENING ONLY**: Close approach analysis uses geometric separation only. Not probability of collision (Pc). Full conjunction assessment requires covariance data and a licensed SSA provider.\n\n';
    report +=
      '**Decision support only**. No maneuver recommendations. No satellite commanding.\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Analysis ID**: ${trace.id}\n`;
    return report;
  }

  getTokenUsage(): number {
    return this.tokenUsage;
  }
}
