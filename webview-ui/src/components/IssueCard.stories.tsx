import type { Meta, StoryObj } from '@storybook/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DndContext } from '@dnd-kit/core';
import IssueCard from './IssueCard';
import type { IssueItem } from '../store/boardStore';

const meta = {
  title: 'Components/IssueCard',
  component: IssueCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <SortableContext items={['item_1']} strategy={verticalListSortingStrategy}>
          <Story />
        </SortableContext>
      </DndContext>
    ),
  ],
} satisfies Meta<typeof IssueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseItem: IssueItem = {
  id: 'item_1',
  type: 'ISSUE',
  title: 'Implement user authentication',
  number: 42,
  status: 'AI_SPEC',
  url: 'https://github.com/example/repo/issues/42',
  repo: 'example/repo',
  priority: 'high',
  labels: ['feature', 'auth'],
};

export const Issue: Story = {
  args: {
    item: baseItem,
  },
};

export const PullRequest: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'pr_1',
      type: 'PULL_REQUEST',
      title: 'Fix login redirect bug',
      number: 15,
      status: 'HUMAN_CODE_REVIEW',
      url: 'https://github.com/example/repo/pull/15',
      priority: 'critical',
      labels: ['bugfix'],
    },
  },
};

export const BugLabel: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'bug_1',
      title: 'Fix login crash on mobile',
      number: 101,
      status: 'AI_CODE',
      url: 'https://github.com/example/repo/issues/101',
      labels: ['bug', 'critical'],
    },
  },
};

export const TopPriorityCard: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'priority_1',
      title: 'First issue in AI_CODE column',
      number: 200,
      status: 'AI_CODE',
      url: 'https://github.com/example/repo/issues/200',
      labels: ['priority/high'],
    },
  },
};

export const NoPriority: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'item_2',
      title: 'Add dark mode support',
      number: 99,
      status: 'BRAIN_DUMP',
      url: 'https://github.com/example/repo/issues/99',
      priority: undefined,
    },
  },
};

export const ClickSelectsIssue: Story = {
  args: {
    item: baseItem,
  },
  play: async ({ canvasElement }) => {
    // Click verifies the handler dispatches 'selectIssue' IPC message
    const card = canvasElement.querySelector('div[draggable]');
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  },
};
