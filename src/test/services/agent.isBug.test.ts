import { describe, it, expect } from 'vitest';
import { AgentService } from '../../services/agent';

describe('AgentService.isBug', () => {
  it('detects "bug" label', () => {
    expect(AgentService.isBug(['bug'])).toBe(true);
  });

  it('detects "Bug" label (case-insensitive)', () => {
    expect(AgentService.isBug(['Bug'])).toBe(true);
  });

  it('detects "BUG" label', () => {
    expect(AgentService.isBug(['BUG'])).toBe(true);
  });

  it('detects "type/bug" label', () => {
    expect(AgentService.isBug(['type/bug'])).toBe(true);
  });

  it('returns false for non-bug labels', () => {
    expect(AgentService.isBug(['feature', 'enhancement'])).toBe(false);
  });

  it('returns false for empty labels', () => {
    expect(AgentService.isBug([])).toBe(false);
  });
});
