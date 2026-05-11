import { describe, it, expect } from 'vitest';
import { PricingClient } from '../src/clients/pricing-client.js';

describe('PricingClient', () => {
  const client = new PricingClient();

  it('calculates cost for known model (gpt-4o)', () => {
    const cost = client.calculateCost(1_000_000, 'gpt-4o');
    expect(cost).toBe(5.0); // $5 per 1M input tokens
  });

  it('calculates output cost at higher rate', () => {
    const cost = client.calculateCost(1_000_000, 'gpt-4o', true);
    expect(cost).toBe(15.0); // $15 per 1M output tokens
  });

  it('handles fractional tokens', () => {
    const cost = client.calculateCost(1000, 'gpt-4o');
    expect(cost).toBeCloseTo(0.005, 5); // 1000 tokens at $5/M = $0.005
  });

  it('uses default rate for unknown model', () => {
    const cost = client.calculateCost(1_000_000, 'unknown-model');
    expect(cost).toBe(10.0); // Default $10/M input
  });

  it('uses default output rate for unknown model', () => {
    const cost = client.calculateCost(1_000_000, 'unknown-model', true);
    expect(cost).toBe(30.0); // Default $30/M output
  });

  it('returns pricing for known model', () => {
    const pricing = client.getPricingForModel('claude-3-5-sonnet');
    expect(pricing).toEqual({ input: 3.0, output: 15.0 });
  });

  it('returns null for unknown model', () => {
    expect(client.getPricingForModel('nonexistent')).toBeNull();
  });

  it('lists all known models (bootstrap + live)', async () => {
    // Bootstrap has 37 models — live fetch adds 2100+
    const bootstrapCount = client.listModels().length;
    expect(bootstrapCount).toBeGreaterThanOrEqual(37);
    expect(client.listModels()).toContain('gpt-4o');
    expect(client.listModels()).toContain('claude-3-5-sonnet');
    expect(client.listModels()).toContain('deepseek-chat');
    expect(client.listModels()).toContain('gemini-2.5-pro');
    expect(client.listModels()).toContain('grok-3');
    // Live fetch should add many more (non-blocking, but verify it completes)
    await client.refreshLivePricing();
    const liveCount = client.listModels().length;
    expect(liveCount).toBeGreaterThan(bootstrapCount);
  });

  it('can add custom pricing at runtime', () => {
    client.addPricing('my-custom-model', 0.5, 1.0);
    expect(client.getPricingForModel('my-custom-model')).toEqual({ input: 0.5, output: 1.0 });
    expect(client.calculateCost(1_000_000, 'my-custom-model')).toBe(0.5);
  });

  it('calculates cheapest model cost correctly', () => {
    const cost = client.calculateCost(1_000_000, 'gemini-2.0-flash-lite');
    expect(cost).toBe(0.075); // $0.075 per 1M input tokens
  });

  it('calculates expensive model cost correctly', () => {
    const cost = client.calculateCost(1_000_000, 'gpt-4.5-preview');
    expect(cost).toBe(75.0); // $75 per 1M input tokens
  });
});