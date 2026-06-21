import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import Header from './Header';

const meta = {
  title: 'Components/Header',
  component: Header,
  tags: ['autodocs'],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onRefresh: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Title renders
    expect(canvas.getByText('AI OS Kanban')).toBeInTheDocument();
    // Refresh button exists
    const refreshBtn = canvas.getByRole('button', { name: 'Refresh' });
    expect(refreshBtn).toBeInTheDocument();
    // Clicking refresh calls onRefresh
    await userEvent.click(refreshBtn);
    expect(args.onRefresh).toHaveBeenCalled();
    // Agent busy badge not present
    expect(canvas.queryByText('Agent Working')).not.toBeInTheDocument();
  },
};

export const AgentBusy: Story = {
  args: {
    onRefresh: fn(),
    agentBusy: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Agent Working badge visible
    expect(canvas.getByText('Agent Working')).toBeInTheDocument();
    // Pulse dot visible
    const pulseDot = canvasElement.querySelector('.animate-pulse');
    expect(pulseDot).toBeInTheDocument();
  },
};
