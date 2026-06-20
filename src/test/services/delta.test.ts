import { describe, it, expect } from 'vitest';
import { extractStatus, detectDeltas, hashToNumber, extractLabels } from '../../services/delta';
import type { ProjectItemNode, FieldValue } from '../../services/graphql';

// --- Helper to build a minimal ProjectItemNode ---
function createItem(options: {
  id?: string;
  databaseId?: number | null;
  status?: string | null;
  title?: string;
  labels?: string[];
}): ProjectItemNode {
  const id = options.id ?? 'test-node-id';
  const databaseId = options.databaseId ?? null;
  const title = options.title ?? 'Test Issue';
  const status = options.status;
  const labels = options.labels ?? [];

  const fieldValuesNodes: FieldValue[] = [];

  if (status !== null && status !== undefined) {
    fieldValuesNodes.push({
      name: status,
      field: { name: 'Status', id: 'status-field-id' },
    });
  }

  return {
    id,
    databaseId,
    type: 'ISSUE',
    fieldValues: { nodes: fieldValuesNodes },
    content: {
      id,
      number: databaseId ?? 0,
      title,
      url: 'https://github.com/test/repo/issues/1',
      state: 'open',
      repository: { id: 'repo-id', name: 'repo', owner: { login: 'owner' } },
      labels: { nodes: labels.map((name) => ({ name, color: 'ffffff' })) },
    },
  };
}

describe('extractStatus', () => {
  it('returns the Status field name when present', () => {
    const item = createItem({ status: 'AI_SPEC' });
    expect(extractStatus(item)).toBe('AI_SPEC');
  });

  it('returns UNKNOWN when no Status field exists', () => {
    const item = createItem({ status: null });
    expect(extractStatus(item)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when fieldValues is empty', () => {
    const item: ProjectItemNode = {
      id: 'x',
      databaseId: 1,
      type: 'ISSUE',
      fieldValues: { nodes: [] },
      content: null,
    };
    expect(extractStatus(item)).toBe('UNKNOWN');
  });

  it('skips non-Status fields', () => {
    const item: ProjectItemNode = {
      id: 'x',
      databaseId: 1,
      type: 'ISSUE',
      fieldValues: {
        nodes: [
          {
            name: 'bug',
            field: { name: 'Labels', id: 'labels-field-id' },
          },
        ],
      },
      content: {
        id: 'x',
        number: 1,
        title: 't',
        url: 'u',
        state: 'open',
        repository: { id: 'r', name: 'r', owner: { login: 'o' } },
        labels: { nodes: [] },
      },
    };
    expect(extractStatus(item)).toBe('UNKNOWN');
  });

  it('returns correct status for various column names', () => {
    const columns = ['BRAIN_DUMP', 'AI_SPEC', 'HUMAN_SPEC_REVIEW', 'AI_CODE', 'HUMAN_CODE_REVIEW', 'PR_DONE'];
    for (const col of columns) {
      const item = createItem({ status: col });
      expect(extractStatus(item)).toBe(col);
    }
  });
});

describe('hashToNumber', () => {
  it('returns a positive number', () => {
    const result = hashToNumber('some-id');
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const a = hashToNumber('abc123');
    const b = hashToNumber('abc123');
    expect(a).toBe(b);
  });

  it('produces different values for different inputs', () => {
    const a = hashToNumber('id-one');
    const b = hashToNumber('id-two');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const result = hashToNumber('');
    expect(result).toBe(0);
  });

  it('handles long IDs', () => {
    const longId = 'X'.repeat(1000);
    const result = hashToNumber(longId);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe('detectDeltas', () => {
  it('detects new items', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[] }>();
    const item = createItem({ databaseId: 42, status: 'AI_SPEC', title: 'New feature' });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_added');
    expect(events[0].issueId).toBe(42);
    expect(events[0].data).toHaveProperty('status', 'AI_SPEC');
  });

  it('detects moved items (status changed)', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[] }>();
    lastState.set(1, { githubId: 1, status: 'BRAIN_DUMP', title: 'Move me', labels: [] });

    const item = createItem({ databaseId: 1, status: 'AI_CODE', title: 'Move me' });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_moved');
    expect(events[0].data).toHaveProperty('from', 'BRAIN_DUMP');
    expect(events[0].data).toHaveProperty('to', 'AI_CODE');
  });

  it('detects removed items', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[] }>();
    lastState.set(99, { githubId: 99, status: 'AI_SPEC', title: 'Removed', labels: [] });

    const events = detectDeltas(lastState, []);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_removed');
    expect(events[0].issueId).toBe(99);
  });

  it('returns no events when state is unchanged', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[] }>();
    lastState.set(1, { githubId: 1, status: 'AI_SPEC', title: 'Same', labels: [] });

    const item = createItem({ databaseId: 1, status: 'AI_SPEC', title: 'Same' });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(0);
  });

  it('uses hashToNumber fallback when databaseId is null', () => {
    const item = createItem({ id: 'fixed-id', databaseId: null, status: 'AI_CODE', title: 'No DB ID' });
    const events = detectDeltas(new Map(), [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_added');
    // issueId should be the hash of 'fixed-id'
    expect(events[0].issueId).toBe(hashToNumber('fixed-id'));
  });

  it('detects multiple deltas in one pass', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[] }>();
    lastState.set(1, { githubId: 1, status: 'BRAIN_DUMP', title: 'Moved', labels: [] });
    lastState.set(2, { githubId: 2, status: 'AI_SPEC', title: 'Removed', labels: [] });

    const items: ProjectItemNode[] = [
      createItem({ databaseId: 1, status: 'AI_CODE', title: 'Moved' }),
      createItem({ databaseId: 3, status: 'AI_SPEC', title: 'Added' }),
    ];

    const events = detectDeltas(lastState, items);

    expect(events).toHaveLength(3);
    const types = events.map((e) => e.type);
    expect(types).toContain('item_moved');
    expect(types).toContain('item_added');
    expect(types).toContain('item_removed');
  });
});

describe('extractLabels', () => {
  it('extracts label names from item content', () => {
    const item = createItem({ databaseId: 1, status: 'AI_SPEC', labels: ['bug', 'priority/high'] });
    const labels = extractLabels(item);
    expect(labels).toEqual(['bug', 'priority/high']);
  });

  it('returns empty array when no labels', () => {
    const item = createItem({ databaseId: 1, status: 'AI_SPEC', labels: [] });
    const labels = extractLabels(item);
    expect(labels).toEqual([]);
  });

  it('returns empty array when content is null', () => {
    const item: ProjectItemNode = {
      id: 'x',
      databaseId: 1,
      type: 'ISSUE',
      fieldValues: { nodes: [] },
      content: null,
    };
    const labels = extractLabels(item);
    expect(labels).toEqual([]);
  });
});
