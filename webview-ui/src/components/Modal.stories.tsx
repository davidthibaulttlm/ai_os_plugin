import type { Meta, StoryObj } from '@storybook/react';
import Modal from './Modal';

const meta = {
  title: 'Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Example Modal',
    onClose: () => {},
    children: (
      <div>
        <p className="mb-4">This is a reusable modal dialog.</p>
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground cursor-pointer text-sm">
            Close
          </button>
        </div>
      </div>
    ),
  },
};

export const Wide: Story = {
  args: {
    title: 'Wide Modal',
    onClose: () => {},
    maxWidth: 'max-w-[800px]',
    children: (
      <div>
        <p className="mb-4">This modal uses a wider max-width.</p>
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground cursor-pointer text-sm">
            Close
          </button>
        </div>
      </div>
    ),
  },
};

export const WithForm: Story = {
  args: {
    title: 'Edit Settings',
    onClose: () => {},
    children: (
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Name</label>
          <input
            className="w-full p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded text-sm"
            defaultValue="Example"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Description</label>
          <textarea
            className="w-full min-h-[80px] p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded text-sm resize-vertical"
            defaultValue="A description..."
          />
        </div>
        <div className="flex justify-end mt-4">
          <button className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground cursor-pointer text-sm">
            Save
          </button>
        </div>
      </div>
    ),
  },
};
