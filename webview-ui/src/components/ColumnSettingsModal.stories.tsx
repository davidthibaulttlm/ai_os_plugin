import type { Meta, StoryObj } from '@storybook/react';
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

export const AISpecModal: Story = {
  args: {
    column: 'AI_SPEC',
    systemPrompt: defaultSystemPrompt,
    developerPrompt: defaultDeveloperPrompt,
    systemDefault: defaultSystemPrompt,
    developerDefault: defaultDeveloperPrompt,
  },
};

export const AICodeModal: Story = {
  args: {
    column: 'AI_CODE',
    systemPrompt: 'You are a senior software engineer.',
    developerPrompt: 'Implement the code for this issue.',
    systemDefault: 'You are a senior software engineer.',
    developerDefault: 'Implement the code for this issue.',
  },
};

export const HumanColumnDisabled: Story = {
  args: {
    column: 'HUMAN_SPEC_REVIEW',
    systemPrompt: '',
    developerPrompt: '',
    systemDefault: '',
    developerDefault: '',
    onSavePrompt: () => {},
    onResetPrompt: () => {},
  },
};

export const CustomPrompts: Story = {
  args: {
    column: 'AI_SPEC',
    systemPrompt: 'Custom system prompt written by user.',
    developerPrompt: 'Custom developer prompt with specific rules.',
    systemDefault: defaultSystemPrompt,
    developerDefault: defaultDeveloperPrompt,
  },
};
