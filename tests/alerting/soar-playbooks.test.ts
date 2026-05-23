import { describe, expect, it } from 'vitest';
import {
  evaluatePlaybooks,
  DEFAULT_PLAYBOOKS,
  loadPlaybooksFromPath,
} from '../../src/alerting/soar-playbooks.js';

describe('soar-playbooks', () => {
  it('matches high-confidence semantic flag on run tool', () => {
    const matches = evaluatePlaybooks(
      { event: 'semantic_flag', confidence: 0.92, toolName: 'run_terminal' },
      DEFAULT_PLAYBOOKS,
    );
    expect(matches.some((m) => m.playbook === 'high-confidence-semantic-run')).toBe(true);
  });

  it('does not match below threshold', () => {
    const matches = evaluatePlaybooks(
      { event: 'semantic_flag', confidence: 0.5, toolName: 'run' },
      DEFAULT_PLAYBOOKS,
    );
    expect(matches.length).toBe(0);
  });

  it('loads default playbooks when config missing', () => {
    const pbs = loadPlaybooksFromPath('/nonexistent/soar-playbooks.json');
    expect(pbs.length).toBeGreaterThan(0);
  });
});
