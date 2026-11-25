/**
 * Fetscape v1 MVP - Agent Orchestrator
 * Plans steps and makes typed tool calls into deterministic tools
 */

import type {
  AgentConfig,
  AgentTrace,
  AgentStep,
  ToolCall,
  ToolResult,
  MissionProfile,
  MissionReadinessReport,
} from '../types';
import { analyzeShellDensity } from '../tools/celestrak';
import { estimateDeorbitLifetime, getComplianceStatus } from '../tools/deorbit';
import { retrieveRegulations, generateComplianceChecklist } from '../tools/regulations';
import { SafetyLinter } from '../safety/linter';

export class AgentOrchestrator {
  private config: AgentConfig;
  private linter: SafetyLinter;
  private tokenUsage: number = 0;

  constructor(config: AgentConfig) {
    this.config = config;
    this.linter = new SafetyLinter();
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
      const steps: AgentStep[] = [];

      // Step 1: Analyze orbital shell density
      const densityStep = await this.executeStep({
        thought: `Analyzing orbital shell density around ${profile.orbit.altitude ?? 'target'} km`,
        toolCalls: [
          {
            id: `tool-${Date.now()}-1`,
            tool: 'analyze_shell_density',
            arguments: {
              altitudeKm: profile.orbit.altitude ?? 510,
              shellThicknessKm: 50,
            },
            timestamp: Date.now(),
          },
        ],
      });
      steps.push(densityStep);

      // Step 2: Estimate deorbit lifetime
      const deorbitStep = await this.executeStep({
        thought: 'Estimating post-mission deorbit lifetime',
        toolCalls: [
          {
            id: `tool-${Date.now()}-2`,
            tool: 'estimate_deorbit_lifetime',
            arguments: {
              altitudeKm: profile.orbit.altitude ?? 510,
              massKg: profile.mass,
              inclination: profile.orbit.inclination,
              eccentricity: profile.orbit.eccentricity,
            },
            timestamp: Date.now(),
          },
        ],
      });
      steps.push(deorbitStep);

      // Step 3: Retrieve regulations
      const regStep = await this.executeStep({
        thought: 'Retrieving applicable regulations',
        toolCalls: [
          {
            id: `tool-${Date.now()}-3`,
            tool: 'retrieve_regulations',
            arguments: {
              jurisdiction: 'taiwan',
              missionType: 'leo',
              hasNoPropulsion: profile.hasNoPropulsion ?? true,
            },
            timestamp: Date.now(),
          },
        ],
      });
      steps.push(regStep);

      // Step 4: Generate compliance checklist
      const deorbitResult = deorbitStep.results[0]?.data as any;
      const checklistStep = await this.executeStep({
        thought: 'Generating compliance checklist',
        toolCalls: [
          {
            id: `tool-${Date.now()}-4`,
            tool: 'generate_compliance_checklist',
            arguments: {
              hasNoPropulsion: profile.hasNoPropulsion ?? true,
              altitude: profile.orbit.altitude ?? 510,
              estimatedLifetime: deorbitResult?.estimatedLifetimeYears ?? 0,
            },
            timestamp: Date.now(),
          },
        ],
      });
      steps.push(checklistStep);

      trace.steps = steps;
      trace.completedAt = Date.now();
      trace.tokenUsage = this.tokenUsage;

      // Generate final response with safety checks
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
        const result = await this.executeTool(toolCall);
        results.push(result);
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          success: false,
          error: (error as Error).message,
          timestamp: Date.now(),
        });
      }
    }

    return {
      ...step,
      results,
    };
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let data: unknown;

      switch (toolCall.tool) {
        case 'analyze_shell_density':
          data = await analyzeShellDensity(
            toolCall.arguments.altitudeKm as number,
            (toolCall.arguments.shellThicknessKm as number) ?? 50,
          );
          break;

        case 'estimate_deorbit_lifetime':
          data = estimateDeorbitLifetime(toolCall.arguments as any);
          break;

        case 'retrieve_regulations':
          data = retrieveRegulations(toolCall.arguments as any);
          break;

        case 'generate_compliance_checklist':
          data = generateComplianceChecklist(toolCall.arguments as any);
          break;

        default:
          throw new Error(`Unknown tool: ${toolCall.tool}`);
      }

      return {
        toolCallId: toolCall.id,
        success: true,
        data,
        timestamp: Date.now(),
      };
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

    // Shell density
    const densityData = steps[0]?.results[0]?.data as any;
    if (densityData) {
      report += '## Orbital Shell Density Analysis\n\n';
      report += `- **Target Altitude**: ${densityData.targetAltitudeKm} km\n`;
      report += `- **Objects in Shell** (±${densityData.shellRangeKm[1] - densityData.targetAltitudeKm} km): ${densityData.objectsInShell}\n`;
      report += `- **Total Active Objects**: ${densityData.totalActive}\n`;
      report += `- **Data Source**: ${densityData.dataSource}\n\n`;
      report +=
        '**Note**: Count based on mean altitude approximation from mean motion. Actual shell population may vary.\n\n';
    }

    // Deorbit analysis
    const deorbitData = steps[1]?.results[0]?.data as any;
    if (deorbitData) {
      report += '## Deorbit Lifetime Analysis\n\n';
      report += `- **Estimated Lifetime**: ${deorbitData.estimatedLifetimeYears} years\n`;
      report += `- **FCC 5-Year Compliance**: ${deorbitData.complies5Year ? '✓ Compliant' : '✗ Non-compliant'}\n`;
      report += `- **NSTC 25-Year Compliance**: ${deorbitData.complies25Year ? '✓ Compliant' : '✗ Non-compliant'}\n`;
      report += `- **Method**: ${deorbitData.method}\n\n`;

      report += '### Assumptions\n';
      for (const assumption of deorbitData.assumptions) {
        report += `- ${assumption}\n`;
      }
      report += '\n';

      report += '### Uncertainties\n';
      for (const uncertainty of deorbitData.uncertainties) {
        report += `- ${uncertainty}\n`;
      }
      report += '\n';

      const compliance = getComplianceStatus(deorbitData);
      report += `**Compliance Status**: ${compliance.status.toUpperCase()}\n\n`;
      report += `${compliance.message}\n\n`;
    }

    // Regulations
    const regData = steps[2]?.results[0]?.data as any[];
    if (regData) {
      report += '## Applicable Regulations\n\n';
      for (const reg of regData.slice(0, 5)) {
        report += `### ${reg.source}\n`;
        report += `**${reg.section}**: ${reg.text}\n`;
        if (reg.url) {
          report += `📄 [Full document](${reg.url})\n`;
        }
        report += '\n';
      }
    }

    // Checklist
    const checklistData = steps[3]?.results[0]?.data as any[];
    if (checklistData) {
      report += '## Compliance Checklist\n\n';
      for (const item of checklistData) {
        const icon =
          item.status === 'required' ? '⚠️' : item.status === 'recommended' ? '💡' : 'ℹ️';
        report += `${icon} **${item.item}** (${item.status})\n`;
        report += `   ${item.notes}\n\n`;
      }
    }

    report += '---\n\n';
    report +=
      '**GEOMETRIC SCREENING ONLY**: Close approach analysis (if performed) uses geometric separation only. Not probability of collision (Pc). Full conjunction assessment requires covariance data and licensed SSA provider.\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Analysis ID**: ${trace.id}\n`;

    return report;
  }

  getTokenUsage(): number {
    return this.tokenUsage;
  }
}
