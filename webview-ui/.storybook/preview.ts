import type { Preview } from '@storybook/react';

// Mock acquireVsCodeApi for Storybook (not available outside VS Code)
const mockVsCodeApi = {
  postMessage: (message: unknown) => console.log('[VS Code Mock] postMessage:', message),
  getState: () => null,
  setState: (state: unknown) => console.log('[VS Code Mock] setState:', state),
};

(globalThis as Record<string, unknown>).acquireVsCodeApi = () => mockVsCodeApi;

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
