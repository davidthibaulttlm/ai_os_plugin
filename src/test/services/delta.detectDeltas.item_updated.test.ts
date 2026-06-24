import { describe, it, expect } from 'vitest';
import { detectDeltas } from '../../services/delta';
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
      assignees: { nodes: [] },
      labels: { nodes: labels.map((name) => ({ name, color: 'ffffff' })) },
    },
  };
}

describe('detectDeltas - item_updated', () => {
  it('detects title changes', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set(1, { githubId: 1, status: 'AI_SPEC', title: 'Old Title', labels: [], assignees: [] });

    const item = createItem({ databaseId: 1, status: 'AI_SPEC', title: 'New Title' });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_updated');
    expect(events[0].issueId).toBe(1);
    expect(events[0].data).toHaveProperty('oldTitle', 'Old Title');
    expect(events[0].data).toHaveProperty('title', 'New Title');
  });

  it('detects label changes', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set(1, { githubId: 1, status: 'AI_SPEC', title: 'Same Title', labels: ['bug'], assignees: [] });

    const item = createItem({ databaseId: 1, status: 'AI_SPEC', title: 'Same Title', labels: ['bug', 'priority/high'] });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_updated');
    expect(events[0].data).toHaveProperty('labels');
  });

  it('does NOT fire when only label order changes (same labels)', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set(1, { githubId: 1, status: 'AI_SPEC', title: 'Same', labels: ['bug', 'priority/high'], assignees: [] });

    const item = createItem({ databaseId: 1, status: 'AI_SPEC', title: 'Same', labels: ['priority/high', 'bug'] });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(0);
  });

  it('emits both item_moved and item_updated when status and title change', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set(1, { githubId: 1, status: 'BRAIN_DUMP', title: 'Old Title', labels: [], assignees: [] });

    const item = createItem({ databaseId: 1, status: 'AI_CODE', title: 'New Title' });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type)).toContain('item_moved');
    expect(events.map((e) => e.type)).toContain('item_updated');
  });

  it('no event when nothing changes', () => {
    const lastState = new Map<number, { githubId: number; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set(1, { githubId: 1, status: 'AI_SPEC', title: 'Same', labels: ['bug'], assignees: [] });

    const item = createItem({ databaseId: 1, status: 'AI_SPEC', title: 'Same', labels: ['bug'] });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(0);
  });
});
