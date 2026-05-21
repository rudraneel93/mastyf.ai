/**
 * Scan MCP tool definitions (name, description, inputSchema) — parity with
 * packages/core regex scanner and uploaded adversarial_test_harness.py.
 */
import { walkStringLeaves } from '../policy/arg-leaf-walker.js';
import { scanToolCallArguments, type InjectionFinding } from './prompt-injection-detector.js';

export interface ToolDefinitionLike {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/** Flatten tool metadata into pseudo-arguments for the request-path rule set. */
export function toolDefinitionToScanArgs(tool: ToolDefinitionLike): Record<string, unknown> {
  const args: Record<string, unknown> = {
    _tool_name: tool.name,
  };
  if (tool.description?.trim()) {
    args.description = tool.description;
    args.content = tool.description;
  }
  if (tool.inputSchema && typeof tool.inputSchema === 'object') {
    args.inputSchema = tool.inputSchema;
  }
  return args;
}

/** Scan tool definition text (description + schema leaves) for injection / exfil patterns. */
export function scanToolDefinition(tool: ToolDefinitionLike): InjectionFinding[] {
  const args = toolDefinitionToScanArgs(tool);
  const findings = scanToolCallArguments(args);
  const seen = new Set(findings.map((f) => `${f.patternId}:${f.matchPreview}`));

  for (const { value } of walkStringLeaves(args)) {
    if (!value.trim() || value.length < 12) continue;
    for (const f of scanToolCallArguments({ _leaf: value })) {
      const key = `${f.patternId}:${f.matchPreview}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  }

  return findings;
}

export function toolDefinitionIsMalicious(tool: ToolDefinitionLike): boolean {
  return scanToolDefinition(tool).some(
    (f) => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium',
  );
}
