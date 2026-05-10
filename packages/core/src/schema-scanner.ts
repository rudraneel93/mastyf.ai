import type { Issue, ToolDefinition } from "./types.js";
import { runRegexScan } from "./regex-scanner.js";

// Schema-specific additional checks beyond description scanning
const SUSPICIOUS_PARAM_NAMES = [
  /inject/i, /override/i, /system_prompt/i, /instruction/i,
  /before_all/i, /after_all/i, /always_run/i, /hidden/i,
];

export function runSchemaScan(tool: ToolDefinition): Issue[] {
  const issues: Issue[] = [];
  const schema = tool.inputSchema;
  if (!schema?.properties) return issues;

  for (const [paramName, paramDef] of Object.entries(schema.properties)) {
    // 1. Suspicious parameter names
    for (const pattern of SUSPICIOUS_PARAM_NAMES) {
      if (pattern.test(paramName)) {
        issues.push({
          id: "MCPG-S-001",
          layer: "schema",
          severity: "warning",
          category: "suspicious-param-name",
          message: `Parameter name "${paramName}" matches injection-suggestive pattern`,
          evidence: paramName,
          confidence: 0.7,
        });
      }
    }

    // 2. Scan parameter descriptions for injection patterns
    if (paramDef.description) {
      const synthetic: ToolDefinition = {
        name: `${tool.name}.${paramName}`,
        description: paramDef.description,
      };
      const paramIssues = runRegexScan(synthetic).map(issue => ({
        ...issue,
        id: issue.id.replace("MCPG-R-", "MCPG-S-P-"),
        layer: "schema" as const,
        message: `[param: ${paramName}] ${issue.message}`,
        confidence: 0.85,
      }));
      issues.push(...paramIssues);
    }

    // 3. Suspicious default values
    if (paramDef.default !== undefined) {
      const defaultStr = String(paramDef.default);
      if (defaultStr.length > 50) {
        issues.push({
          id: "MCPG-S-002",
          layer: "schema",
          severity: "warning",
          category: "suspicious-default",
          message: `Parameter "${paramName}" has an unusually long default value`,
          evidence: defaultStr.slice(0, 100),
          confidence: 0.5,
        });
      }

      // Check if default value contains injection patterns
      const defaultTool: ToolDefinition = {
        name: `${tool.name}.${paramName}.default`,
        description: defaultStr,
      };
      const defaultIssues = runRegexScan(defaultTool).map(issue => ({
        ...issue,
        id: issue.id.replace("MCPG-R-", "MCPG-S-D-"),
        layer: "schema" as const,
        message: `[param: ${paramName} default] ${issue.message}`,
        confidence: 0.9,
      }));
      issues.push(...defaultIssues);
    }

    // 4. Enum values that look like injection payloads
    if (paramDef.enum) {
      for (const enumVal of paramDef.enum) {
        const enumStr = String(enumVal);
        if (enumStr.length > 80) {
          issues.push({
            id: "MCPG-S-003",
            layer: "schema",
            severity: "warning",
            category: "suspicious-enum",
            message: `Parameter "${paramName}" has an unusually long enum value`,
            evidence: enumStr.slice(0, 100),
            confidence: 0.5,
          });
        }
      }
    }
  }

  return issues;
}