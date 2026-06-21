import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import ColumnSettingsModal from './ColumnSettingsModal';

const meta = {
  title: 'ColumnSettingsModal',
  component: ColumnSettingsModal,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ColumnSettingsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultSystemPrompt = 'You are an expert software architect and technical writer.';
const defaultDeveloperPrompt = 'Write a technical specification with these sections...';

const mockOnClose = () => void 0;
const mockOnSavePrompt = (_column: string, _promptType: 'system' | 'developer', _value: string) => void 0;
const mockOnResetPrompt = (_column: string, _promptType: 'system' | 'developer') => void 0;

const baseArgs = {
  onClose: mockOnClose,
  onSavePrompt: mockOnSavePrompt,
  onResetPrompt: mockOnResetPrompt,
};

function expectColumnTitle(canvasElement: HTMLElement, title: string) {
  const canvas = within(canvasElement);
  expect(canvas.getByText(`Column Settings: ${title}`)).toBeInTheDocument();
}

function createStory(
  column: string,
  systemPrompt: string,
  developerPrompt: string,
  systemDefault: string,
  developerDefault: string,
  extraChecks?: (canvas: ReturnType<typeof within>) => void
): Story {
  return {
    args: {
      ...baseArgs,
      column,
      systemPrompt,
      developerPrompt,
      systemDefault,
      developerDefault,
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      expectColumnTitle(canvasElement, column.replace(/_/g, ' '));
      extraChecks?.(canvas);
    },
  };
}

const aiSpecChecks = (canvas: ReturnType<typeof within>) => {
  expect(canvas.getByText('System Prompt')).toBeInTheDocument();
  expect(canvas.getByText('Developer Prompt')).toBeInTheDocument();
};

export const AISpecModal = createStory(
  'AI_SPEC', defaultSystemPrompt, defaultDeveloperPrompt, defaultSystemPrompt, defaultDeveloperPrompt, aiSpecChecks
) as Story;

export const AICodeModal = createStory(
  'AI_CODE', 'You are a senior software engineer.', 'Implement the code for this issue.',
  'You are a senior software engineer.', 'Implement the code for this issue.'
) as Story;

export const HumanColumnDisabled = createStory(
  'HUMAN_SPEC_REVIEW', '', '', '', ''
) as Story;

export const CustomPrompts = createStory(
  'AI_SPEC', 'Custom system prompt written by user.', 'Custom developer prompt with specific rules.',
  defaultSystemPrompt, defaultDeveloperPrompt
) as Story;
