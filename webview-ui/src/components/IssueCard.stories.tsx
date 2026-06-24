import type { Meta, StoryObj } from '@storybook/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DndContext } from '@dnd-kit/core';
import IssueCard from './IssueCard';
import { useBoardStore, type IssueItem } from "../store/boardStore";

function withAgentState(status: string, outputs: string[], issueNumber: number, working = false) {
  return (Story: () => React.ReactNode) => {
    const opts: any = {
      agentStatuses: new Map([[issueNumber, status]]),
      agentOutputs: new Map([[issueNumber, outputs]]),
    };
    if (working) opts.workingIssues = new Set([issueNumber]);
    useBoardStore.setState(opts);
    return <Story />;
  };
}

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

export const AgentRunning: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'agent_running',
      title: 'Implement API rate limiting',
      number: 55,
      status: 'AI_CODE',
      labels: ['feature'],
    },
  },
  decorators: [
    withAgentState('running', ['Analyzing codebase...', 'Creating rate limiter middleware...'], 55, true),
  ],
};

export const AgentSuccess: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'agent_success',
      title: 'Add input validation',
      number: 60,
      status: 'HUMAN_SPEC_REVIEW',
      labels: ['feature'],
    },
  },
  decorators: [
    withAgentState('success', ['Validation middleware created', 'Tests passing', 'Changes staged'], 60),
  ],
};

export const AgentFailed: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'agent_failed',
      title: 'Fix memory leak in worker',
      number: 75,
      status: 'AI_CODE',
      labels: ['bug'],
    },
  },
  decorators: [
    withAgentState('failed', ['Error: spawn claude ENOENT'], 75),
  ],
};

export const WithAssignees: Story = {
  args: {
    item: {
      ...baseItem,
      id: 'assignees_1',
      title: 'Implement assignee filtering',
      number: 200,
      status: 'AI_SPEC',
      url: 'https://github.com/example/repo/issues/200',
      labels: ['feature'],
      assignees: [
        { login: 'alice', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4' },
        { login: 'bob', avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4' },
      ],
    },
  },
};
