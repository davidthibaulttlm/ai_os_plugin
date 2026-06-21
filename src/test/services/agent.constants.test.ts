import { describe, it, expect } from 'vitest';
import { AI_ELIGIBLE_COLUMNS, HUMAN_COLUMNS } from '../../services/agent';

describe('AI_ELIGIBLE_COLUMNS constant', () => {
  it('contains AI_CODE, AI_SPEC, and BRAIN_DUMP', () => {
    expect(AI_ELIGIBLE_COLUMNS).toContain('AI_CODE');
    expect(AI_ELIGIBLE_COLUMNS).toContain('AI_SPEC');
    expect(AI_ELIGIBLE_COLUMNS).toContain('BRAIN_DUMP');
  });

  it('does not contain human columns', () => {
    for (const col of HUMAN_COLUMNS) {
      expect(AI_ELIGIBLE_COLUMNS).not.toContain(col as typeof AI_ELIGIBLE_COLUMNS[number]);
    }
  });
});

describe('HUMAN_COLUMNS constant', () => {
  it('contains HUMAN_SPEC_REVIEW, HUMAN_CODE_REVIEW, and PR_DONE', () => {
    expect(HUMAN_COLUMNS).toContain('HUMAN_SPEC_REVIEW');
    expect(HUMAN_COLUMNS).toContain('HUMAN_CODE_REVIEW');
    expect(HUMAN_COLUMNS).toContain('PR_DONE');
  });
});
