import { useEffect, useCallback, useRef } from 'react';
import { getVsCodeApi } from '../vscodeApi';
import { logger } from '../logger';

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
    logger.debug(`[useVsCode.useEffect] Environment check: api available = ${!!api}`);

    if (!api) {
      logger.error('[useVsCode.useEffect] NOT running in VS Code webview! postMessage will not work.');
      return;
    }

    try {
      apiRef.current = api;
      logger.debug('[useVsCode.useEffect] API ready, posting __ping__ test');
      api.postMessage({ type: '__ping__', data: { ts: Date.now() } });
      logger.debug('[useVsCode.useEffect] __ping__ posted');
    } catch (e) {
      logger.error(`[useVsCode.useEffect] postMessage threw exception: ${(e as Error).message}`);
    }

    // Ensure the persistent window listener is attached (singleton on window.__aiOsIPC).
    // No need to add/remove here — ensureListener() guarantees exactly one listener.
    ensureListener();
  }, []);

  const postMessage = useCallback(
    (type: string, data?: unknown) => {
      const api = apiRef.current;
      logger.debug(`[useVsCode.postMessage] type=${type}, api=${api ? 'exists' : 'NULL'}`);
      if (api) {
        try {
          api.postMessage({ type, data });
          logger.debug(`[useVsCode.postMessage] Succeeded: type=${type}`);
        } catch (e) {
          logger.error(`[useVsCode.postMessage] Threw: ${(e as Error).message}, type=${type}`);
        }
      } else {
        logger.error(`[useVsCode.postMessage] api is null — message DROPPED, type=${type}`);
      }
    },
    []
  );

  return { postMessage };
}

/**
 * IPCRegistry — Persistent message handler registry.
 *
 * Stored on `window.__aiOsIPC` so it survives module reloads when the webview
 * HTML is reassigned (panel reuse). This is the recommended pattern for VS Code
 * webviews: a single persistent `window.addEventListener('message', ...)` that
 * dispatches to a Map of type→handlers, avoiding the common bug where each
 * module reload stacks a new listener while old ones remain active.
 *
 * - `onMessage(type, handler)` registers a handler for a message type.
 * - `offMessage(type)` removes all handlers for a message type (use in useEffect cleanup).
 * - `ensureListener()` guarantees exactly one window listener is attached.
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

