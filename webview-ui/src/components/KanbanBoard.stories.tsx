import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import KanbanBoard from './KanbanBoard';
import { useBoardStore, type KanbanColumn, type IssueItem } from "../store/boardStore";

const columns: KanbanColumn[] = [
  { id: 'brain_dump', name: 'BRAIN_DUMP', color: '#6b7280' },
  { id: 'ai_spec', name: 'AI_SPEC', color: '#3b82f6' },
  { id: 'human_spec_review', name: 'HUMAN_SPEC_REVIEW', color: '#f59e0b' },
  { id: 'ai_code', name: 'AI_CODE', color: '#8b5cf6' },
  { id: 'human_code_review', name: 'HUMAN_CODE_REVIEW', color: '#ef4444' },
  { id: 'pr_done', name: 'PR_DONE', color: '#22c55e' },
];

const meta = {
  title: 'Components/KanbanBoard',
  component: KanbanBoard,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const items = (context.parameters as { items?: IssueItem[] }).items ?? [];
      useBoardStore.setState({
        columns,
        items,
        loading: false,
        error: null,
        selectedItemId: null,
      });
      return <Story />;
    },
  ],
} satisfies Meta<typeof KanbanBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyBoard: Story = {
  args: {
    onMoveItem: fn(),
    onReorderItem: fn(),
    onSaveColumnPrompt: fn(),
    onResetColumnPrompt: fn(),
    onRequestColumnPrompts: fn(),
    columnPromptData: null,
  },
  parameters: {
    items: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // All 6 columns render
    expect(canvas.getByText('BRAIN_DUMP (0)')).toBeInTheDocument();
    expect(canvas.getByText('AI_SPEC (0)')).toBeInTheDocument();
    expect(canvas.getByText('HUMAN_SPEC_REVIEW (0)')).toBeInTheDocument();
    expect(canvas.getByText('AI_CODE (0)')).toBeInTheDocument();
    expect(canvas.getByText('HUMAN_CODE_REVIEW (0)')).toBeInTheDocument();
    expect(canvas.getByText('PR_DONE (0)')).toBeInTheDocument();
  },
};

const populatedItems: IssueItem[] = [
  { id: '1', type: 'ISSUE', title: 'Brain dump idea', number: 1, status: 'BRAIN_DUMP', url: '#', repo: 'repo' },
  { id: '2', type: 'ISSUE', title: 'AI writing spec', number: 2, status: 'AI_SPEC', url: '#', repo: 'repo', priority: 'high' },
  { id: '3', type: 'PULL_REQUEST', title: 'Human reviewing spec', number: 3, status: 'HUMAN_SPEC_REVIEW', url: '#', repo: 'repo' },
  { id: '4', type: 'ISSUE', title: 'AI coding feature', number: 4, status: 'AI_CODE', url: '#', repo: 'repo', priority: 'critical' },
  { id: '5', type: 'ISSUE', title: 'Code review in progress', number: 5, status: 'HUMAN_CODE_REVIEW', url: '#', repo: 'repo' },
  { id: '6', type: 'PULL_REQUEST', title: 'Merged feature', number: 6, status: 'PR_DONE', url: '#', repo: 'repo' },
];

export const PopulatedBoard: Story = {
  args: {
    onMoveItem: fn(),
    onReorderItem: fn(),
    onSaveColumnPrompt: fn(),
    onResetColumnPrompt: fn(),
    onRequestColumnPrompts: fn(),
    columnPromptData: null,
  },
  parameters: {
    items: populatedItems,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Items distributed across columns
    expect(canvas.getByText('Brain dump idea')).toBeInTheDocument();
    expect(canvas.getByText('AI writing spec')).toBeInTheDocument();
    expect(canvas.getByText('Human reviewing spec')).toBeInTheDocument();
    expect(canvas.getByText('AI coding feature')).toBeInTheDocument();
    expect(canvas.getByText('Code review in progress')).toBeInTheDocument();
    expect(canvas.getByText('Merged feature')).toBeInTheDocument();
  },
};
