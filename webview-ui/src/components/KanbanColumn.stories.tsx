import type { Meta, StoryObj } from '@storybook/react';
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
  },
};
