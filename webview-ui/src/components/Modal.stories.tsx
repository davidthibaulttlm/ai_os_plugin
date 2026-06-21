import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
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

function ModalButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground cursor-pointer text-sm">
      {children}
    </button>
  );
}

function expectText(canvasElement: HTMLElement, ...texts: string[]) {
  const canvas = within(canvasElement);
  texts.forEach((text) => expect(canvas.getByText(text)).toBeInTheDocument());
}

function createModalStory(
  title: string,
  texts: string[],
  children: React.ReactNode,
  maxWidth?: string
): Story {
  const args: any = { title, onClose: () => void 0, children };
  if (maxWidth) args.maxWidth = maxWidth;
  return {
    args,
    play: async ({ canvasElement }) => {
      expectText(canvasElement, ...texts);
    },
  };
}

export const Default = createModalStory(
  'Example Modal',
  ['Example Modal', 'This is a reusable modal dialog.'],
  <div>
    <p className="mb-4">This is a reusable modal dialog.</p>
    <div className="flex justify-end">
      <ModalButton>Close</ModalButton>
    </div>
  </div>
) as Story;

export const Wide = createModalStory(
  'Wide Modal',
  ['Wide Modal', 'This modal uses a wider max-width.'],
  <div>
    <p className="mb-4">This modal uses a wider max-width.</p>
    <div className="flex justify-end">
      <ModalButton>Close</ModalButton>
    </div>
  </div>,
  'max-w-[800px]'
) as Story;

export const WithForm: Story = {
  args: {
    title: 'Edit Settings',
    onClose: () => { /* no-op for storybook */ },
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
          <ModalButton>Save</ModalButton>
        </div>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Edit Settings')).toBeInTheDocument();
    expect(canvas.getByText('Name')).toBeInTheDocument();
    expect(canvas.getByText('Description')).toBeInTheDocument();
  },
};
