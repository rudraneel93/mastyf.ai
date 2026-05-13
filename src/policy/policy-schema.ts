import { z } from 'zod';

const RuleSchema = z.object({
  name: z.string().min(1),
  action: z.enum(['block', 'flag', 'pass']),
  tools: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  patterns: z.array(z.string()).optional(),
  maxCallsPerMinute: z.number().positive().optional(),
  maxTokens: z.number().positive().optional(),
  clients: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
});

export const PolicySchema = z.object({
  version: z.string(),
  policy: z.object({
    mode: z.enum(['audit', 'warn', 'block']),
    default_action: z.enum(['pass', 'block', 'flag']).optional(),
    rules: z.array(RuleSchema),
  }),
});