import { useEffect, useCallback, useState } from 'react';

/**
 * Hook for VS Code webview IPC communication.
 * Handles message sending and receiving with the extension host.
 */
export function useVsCode() {
  const [vsCodeApi, setVsCodeApi] = useState<VsCodeApi | null>(null);

  useEffect(() => {
    try {
      const api = acquireVsCodeApi();
      setVsCodeApi(api);
    } catch {
      // Running outside webview (e.g., dev server)
    }

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (typeof message !== 'object' || message === null) {
        return;
      }

      const handler = messageHandlers.get(message.type as string);
      if (handler) {
        handler(message);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const postMessage = useCallback(
    (type: string, data?: unknown) => {
      if (vsCodeApi) {
        vsCodeApi.postMessage({ type, data });
      }
    },
    [vsCodeApi]
  );

  return { postMessage };
}

/**
 * Message handler registry for incoming messages from extension host.
 */
const messageHandlers = new Map<string, (message: Record<string, unknown>) => void>();

/**
 * Register a handler for a specific message type.
 */
export function onMessage<T>(type: string, handler: (data: T) => void): void {
  messageHandlers.set(type, (message) => {
    if (message.data) {
      handler(message.data as T);
    }
  });
}

/**
 * Remove a previously registered handler for a specific message type.
 */
export function offMessage(type: string): void {
  messageHandlers.delete(type);
}
