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

    // Ensure the persistent window listener is attached (singleton on window.__aiOsIPC).
    // No need to add/remove here — ensureListener() guarantees exactly one listener.
    ensureListener();
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
 * Persistent message handler registry — stored on `window` so it survives
 * module reloads when the webview HTML is reassigned (panel reuse).
 * This prevents the "15 duplicate logs" bug where each reload stacked
 * a new window.addEventListener while old ones remained active.
 */
interface IPCRegistry {
  handlers: Map<string, Array<(message: Record<string, unknown>) => void>>;
  listenerAttached: boolean;
}

declare global {
  interface Window {
    __aiOsIPC?: IPCRegistry;
  }
}

function getRegistry(): IPCRegistry {
  if (!window.__aiOsIPC) {
    window.__aiOsIPC = {
      handlers: new Map(),
      listenerAttached: false,
    };
  }
  return window.__aiOsIPC;
}

/**
 * Single persistent window message listener.
 * Attached exactly once — survives module reloads.
 */
function ensureListener(): void {
  const registry = getRegistry();
  if (!registry.listenerAttached) {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (typeof message !== 'object' || message === null) return;
      const handlers = registry.handlers.get(message.type as string);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    };
    window.addEventListener('message', messageHandler);
    registry.listenerAttached = true;
  }
}

/**
 * Register a handler for a specific message type.
 * Replaces any existing handler for the same type to prevent accumulation.
 */
export function onMessage<T>(type: string, handler: (data: T) => void): void {
  ensureListener();
  const wrapped = (message: Record<string, unknown>) => {
    if (message.data) {
      handler(message.data as T);
    }
  };
  getRegistry().handlers.set(type, [wrapped]);
}

/**
 * Remove ALL handlers for a message type (use in useEffect cleanup).
 */
export function offMessage(type: string): void {
  getRegistry().handlers.delete(type);
}

