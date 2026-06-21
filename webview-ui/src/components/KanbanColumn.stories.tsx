import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { DndContext } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import type { KanbanColumn as KanbanColumnType, IssueItem } from '../store/boardStore';

const meta = {
  title: 'Components/KanbanColumn',
  component: KanbanColumn,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <Story />
      </DndContext>
    ),
  ],
} satisfies Meta<typeof KanbanColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

const brainDumpColumn: KanbanColumnType = {
  id: 'brain_dump',
  name: 'BRAIN_DUMP',
  color: '#6b7280',
};

const aiSpecColumn: KanbanColumnType = {
  id: 'ai_spec',
  name: 'AI_SPEC',
  color: '#3b82f6',
};

const prDoneColumn: KanbanColumnType = {
  id: 'pr_done',
  name: 'PR_DONE',
  color: '#22c55e',
};

export const Empty: Story = {
  args: {
    column: brainDumpColumn,
    items: [],
    onOpenSettings: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Column header renders with correct name
    expect(canvas.getByText('BRAIN_DUMP (0)')).toBeInTheDocument();
    const settingsBtn = canvas.getByTitle('Column settings');
    expect(settingsBtn).toBeInTheDocument();
  },
};

const sampleItems: IssueItem[] = [
  {
    id: 'issue_1',
    type: 'ISSUE',
    title: 'Implement user authentication',
    number: 42,
    status: 'AI_SPEC',
    url: 'https://github.com/example/repo/issues/42',
    repo: 'example/repo',
    priority: 'high',
    labels: ['feature', 'auth'],
  },
  {
    id: 'issue_2',
    type: 'ISSUE',
    title: 'Add API rate limiting',
    number: 43,
    status: 'AI_SPEC',
    url: 'https://github.com/example/repo/issues/43',
    repo: 'example/repo',
    priority: 'medium',
    labels: ['backend'],
  },
];

export const WithItems: Story = {
  args: {
    column: aiSpecColumn,
    items: sampleItems,
    onOpenSettings: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Column header shows correct count
    expect(canvas.getByText('AI_SPEC (2)')).toBeInTheDocument();
    // Both issue cards render
    expect(canvas.getByText('Implement user authentication')).toBeInTheDocument();
    expect(canvas.getByText('Add API rate limiting')).toBeInTheDocument();
  },
};

const manyItems: IssueItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: `done_${i}`,
  type: 'ISSUE' as const,
  title: `Completed feature ${i + 1}`,
  number: 100 + i,
  status: 'PR_DONE',
  url: `https://github.com/example/repo/issues/${100 + i}`,
  repo: 'example/repo',
}));

export const ManyItems: Story = {
  args: {
    column: prDoneColumn,
    items: manyItems,
    onOpenSettings: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Column header shows correct count
    expect(canvas.getByText('PR_DONE (10)')).toBeInTheDocument();
    // First item visible
    expect(canvas.getByText('Completed feature 1')).toBeInTheDocument();
  },
};

const priorityOrderedItems: IssueItem[] = [
  {
    id: 'priority_1',
    type: 'ISSUE',
    title: 'Critical bug - highest priority',
    number: 301,
    status: 'AI_CODE',
    url: 'https://github.com/example/repo/issues/301',
    repo: 'example/repo',
    priority: 'critical',
    labels: ['bug'],
  },
  {
    id: 'priority_2',
    type: 'ISSUE',
    title: 'High priority feature',
    number: 302,
    status: 'AI_CODE',
    url: 'https://github.com/example/repo/issues/302',
    repo: 'example/repo',
    priority: 'high',
    labels: ['feature'],
  },
  {
    id: 'priority_3',
    type: 'ISSUE',
    title: 'Medium priority task',
    number: 303,
    status: 'AI_CODE',
    url: 'https://github.com/example/repo/issues/303',
    repo: 'example/repo',
    priority: 'medium',
    labels: [],
  },
];

export const PriorityOrder: Story = {
  args: {
    column: aiSpecColumn,
    items: priorityOrderedItems,
    onOpenSettings: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('AI_SPEC (3)')).toBeInTheDocument();
    expect(canvas.getByText('Critical bug - highest priority')).toBeInTheDocument();
    expect(canvas.getByText('High priority feature')).toBeInTheDocument();
    expect(canvas.getByText('Medium priority task')).toBeInTheDocument();
  },
};
