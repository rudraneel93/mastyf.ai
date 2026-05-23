export type PipelineStage = {
  id: string;
  label: string;
  short: string;
  explanation: string;
};

export const THREAT_LAB_STAGES: PipelineStage[] = [
  {
    id: 'sources',
    label: 'Detection sources',
    short: 'Inputs',
    explanation:
      'Swarm bypasses, semantic true-positives, ThreatIntel CVEs, and corpus attacks — authentic signals only.',
  },
  {
    id: 'llm',
    label: 'Ollama LLM',
    short: 'Discover',
    explanation:
      'Local LLM proposes attack class, hypothesis, corpus fixture, and optional YAML rule. Human review required.',
  },
  {
    id: 'validate',
    label: 'Validation gates',
    short: 'Validate',
    explanation: 'Schema validation, dangerous-regex rejection, replay block test, and fingerprint dedupe.',
  },
  {
    id: 'manifest',
    label: 'Candidate manifest',
    short: 'Manifest',
    explanation: 'Signed threat-lab-candidates.json with provenance. Dashboard accept/reject workflow.',
  },
  {
    id: 'accept',
    label: 'Human accept',
    short: 'Review',
    explanation: 'Accept applies policyRule to live policy. Reject discards. Fixtures stay in harness for regression.',
  },
];

export const AUTO_RESEARCH_STAGES: PipelineStage[] = [
  {
    id: 'detect',
    label: 'Live detections',
    short: 'Detect',
    explanation: 'Semantic flags, repeat blocks, ThreatIntel, swarm bypasses, and corpus seeds enqueue events.',
  },
  {
    id: 'queue',
    label: 'Debounced queue',
    short: 'Queue',
    explanation: 'Debounced events with hourly rate cap. Duplicate fingerprints skipped.',
  },
  {
    id: 'llm',
    label: 'LLM research',
    short: 'Research',
    explanation: 'Same Threat Lab LLM path with minimum confidence gate (default 0.85).',
  },
  {
    id: 'taxonomy',
    label: 'Taxonomy classify',
    short: 'Classify',
    explanation: 'Map discoveries to corpus categories before write.',
  },
  {
    id: 'write',
    label: 'adv fixture write',
    short: 'Write',
    explanation: 'Validated adv-*.json under adversarial-harness — audit only, no policy auto-apply.',
  },
];
