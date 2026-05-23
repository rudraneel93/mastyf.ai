import Ajv from "ajv";
import type { Issue, ToolDefinition } from "./types.js";
import { runRegexScan } from "./regex-scanner.js";

const ajv = new Ajv({ strict: false, validateSchema: true, allErrors: false });

const SUSPICIOUS_PARAM_NAMES = [
  /inject/i, /override/i, /system_prompt/i, /instruction/i,
  /before_all/i, /after_all/i, /always_run/i, /hidden/i,
];

const MAX_SCHEMA_DEPTH = 8;
const COMMAND_LIKE = /command|cmd|shell|exec|script|query|sql/i;

interface SchemaProp {
  description?: string;
  default?: unknown;
  enum?: unknown[];
  type?: string;
  maxLength?: number;
  properties?: Record<string, SchemaProp>;
}

function scanProperty(
  tool: ToolDefinition,
  paramName: string,
  paramDef: SchemaProp,
  path: string,
  depth: number,
  issues: Issue[],
): void {
  if (depth > MAX_SCHEMA_DEPTH) return;

  for (const pattern of SUSPICIOUS_PARAM_NAMES) {
    if (pattern.test(paramName)) {
      issues.push({
        id: "MCPG-S-001",
        layer: "schema",
        severity: "warning",
        category: "suspicious-param-name",
        message: `Parameter "${path}" matches injection-suggestive pattern`,
        evidence: paramName,
        confidence: 0.7,
      });
    }
  }

  if (
    paramDef.type === "string"
    && paramDef.maxLength == null
    && COMMAND_LIKE.test(paramName)
  ) {
    issues.push({
      id: "MCPG-S-004",
      layer: "schema",
      severity: "warning",
      category: "unbounded-string",
      message: `Parameter "${path}" lacks maxLength on command-like field`,
      evidence: paramName,
      confidence: 0.65,
    });
  }

  if (paramDef.description) {
    const synthetic: ToolDefinition = {
      name: `${tool.name}.${path}`,
      description: paramDef.description,
    };
    issues.push(
      ...runRegexScan(synthetic).map((issue) => ({
        ...issue,
        id: issue.id.replace("MCPG-R-", "MCPG-S-P-"),
        layer: "schema" as const,
        message: `[param: ${path}] ${issue.message}`,
        confidence: 0.85,
      })),
    );
  }

  if (paramDef.default !== undefined) {
    const defaultStr = String(paramDef.default);
    if (defaultStr.length > 50) {
      issues.push({
        id: "MCPG-S-002",
        layer: "schema",
        severity: "warning",
        category: "suspicious-default",
        message: `Parameter "${path}" has an unusually long default value`,
        evidence: defaultStr.slice(0, 100),
        confidence: 0.5,
      });
    }
    const defaultTool: ToolDefinition = {
      name: `${tool.name}.${path}.default`,
      description: defaultStr,
    };
    issues.push(
      ...runRegexScan(defaultTool).map((issue) => ({
        ...issue,
        id: issue.id.replace("MCPG-R-", "MCPG-S-D-"),
        layer: "schema" as const,
        message: `[param: ${path} default] ${issue.message}`,
        confidence: 0.9,
      })),
    );
  }

  if (paramDef.enum) {
    for (const enumVal of paramDef.enum) {
      const enumStr = String(enumVal);
      if (enumStr.length > 80) {
        issues.push({
          id: "MCPG-S-003",
          layer: "schema",
          severity: "warning",
          category: "suspicious-enum",
          message: `Parameter "${path}" has an unusually long enum value`,
          evidence: enumStr.slice(0, 100),
          confidence: 0.5,
        });
      }
    }
  }

  if (paramDef.properties) {
    for (const [nestedName, nestedDef] of Object.entries(paramDef.properties)) {
      scanProperty(tool, nestedName, nestedDef, `${path}.${nestedName}`, depth + 1, issues);
    }
  }
}

function validateInputSchema(tool: ToolDefinition, issues: Issue[]): boolean {
  const schema = tool.inputSchema;
  if (!schema || typeof schema !== "object") return true;
  try {
    const valid = ajv.validateSchema(schema as object);
    if (!valid) {
      issues.push({
        id: "MCPG-S-005",
        layer: "schema",
        severity: "warning",
        category: "invalid-json-schema",
        message: `Tool "${tool.name}" inputSchema is not valid JSON Schema`,
        evidence: ajv.errors?.[0]?.message ?? "validateSchema failed",
        confidence: 0.9,
      });
      return false;
    }
  } catch (err) {
    issues.push({
      id: "MCPG-S-005",
      layer: "schema",
      severity: "warning",
      category: "invalid-json-schema",
      message: `Tool "${tool.name}" inputSchema validation error`,
      evidence: err instanceof Error ? err.message : String(err),
      confidence: 0.85,
    });
    return false;
  }
  return true;
}

export function runSchemaScan(tool: ToolDefinition): Issue[] {
  const issues: Issue[] = [];
  const schema = tool.inputSchema as { properties?: Record<string, SchemaProp> } | undefined;
  if (!validateInputSchema(tool, issues)) return issues;
  if (!schema?.properties) return issues;

  for (const [paramName, paramDef] of Object.entries(schema.properties)) {
    scanProperty(tool, paramName, paramDef, paramName, 1, issues);
  }

  return issues;
}
