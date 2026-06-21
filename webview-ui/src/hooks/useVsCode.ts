import { useEffect, useCallback, useRef } from 'react';
import { getVsCodeApi } from '../vscodeApi';

/**
 * Hook for VS Code webview IPC communication.
 * Handles message sending and receiving with the extension host.
 *
 * IMPORTANT: Uses getVsCodeApi() singleton to avoid calling acquireVsCodeApi() multiple times.
 */
export function useVsCode() {
  const apiRef = useRef<VsCodeApi | null>(null);

  useEffect(() => {
    const api = getVsCodeApi();
    console.log(`[AI OS IPC] Environment check: api available = ${!!api}`);

    if (!api) {
      console.error('[AI OS IPC] NOT running in VS Code webview! postMessage will not work.');
      return;
    }

    try {
      apiRef.current = api;
      console.log('[AI OS IPC] API ready, posting __ping__ test');
      api.postMessage({ type: '__ping__', data: { ts: Date.now() } });
      console.log('[AI OS IPC] __ping__ posted');
    } catch (e) {
      console.error('[AI OS IPC] postMessage threw exception', e);
    }

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (typeof message !== 'object' || message === null) {
        return;
      }

      const handlers = messageHandlers.get(message.type as string);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const postMessage = useCallback(
    (type: string, data?: unknown) => {
      const api = apiRef.current;
      console.log(`[AI OS IPC] postMessage called: type=${type}, api=${api ? 'exists' : 'NULL'}`);
      if (api) {
        try {
          api.postMessage({ type, data });
          console.log(`[AI OS IPC] postMessage succeeded: type=${type}`);
        } catch (e: any) {
          console.error(`[AI OS IPC] postMessage threw: ${e.message}`, { type });
        }
      } else {
        console.error(`[AI OS IPC] api is null — message DROPPED`, { type, data });
      }
    },
    []
  );

  return { postMessage };
}

/**
 * Message handler registry for incoming messages from extension host.
 * Supports multiple handlers per type (e.g. app-level + one-time success handlers).
 */
const messageHandlers = new Map<string, Array<(message: Record<string, unknown>) => void>>();

/**
 * Register a handler for a specific message type.
 * Multiple handlers can be registered for the same type.
 */
export function onMessage<T>(type: string, handler: (data: T) => void): void {
  const wrapped = (message: Record<string, unknown>) => {
    if (message.data) {
      handler(message.data as T);
    }
  };
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, []);
  }
  messageHandlers.get(type)!.push(wrapped);
}

/**
 * Remove ALL handlers for a message type (use in useEffect cleanup).
 */
export function offMessage(type: string): void {
  messageHandlers.delete(type);
}

