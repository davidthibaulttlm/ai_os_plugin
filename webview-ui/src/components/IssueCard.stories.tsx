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
