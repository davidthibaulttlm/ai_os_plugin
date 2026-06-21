import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression tests for IPC singleton registry fix.
 *
 * Bug: When the webview HTML was reassigned (panel reuse), the JS module
 * reloaded - creating a NEW `messageHandlers` Map and a NEW
 * `window.addEventListener`. The OLD listener remained permanently attached,
 * stacking up to 15+ listeners = 15 duplicate log lines per single IPC message.
 *
 * Fix: `window.__aiOsIPC` singleton registry + `ensureListener()` guard
 * guarantees exactly ONE window listener across all module reloads.
 *
 * These tests replicate the exact logic from useVsCode.ts to verify the pattern
 * without needing a browser environment.
 */
describe('IPC Registry - singleton listener (regression)', () => {
  // Minimal mock of a Window object to test the singleton pattern
  interface MockWindow {
    listeners: Map<string, Array<(e: any) => void>>;
    addEventListener(type: string, handler: (e: any) => void): void;
    dispatchEvent(event: any): boolean;
  }

  interface IPCRegistry {
    handlers: Map<string, Array<(message: Record<string, unknown>) => void>>;
    listenerAttached: boolean;
  }

  let mockWin: MockWindow;
  let registryRef: { current: IPCRegistry | undefined };

  function createMockWindow(): MockWindow {
    const listeners = new Map<string, Array<(e: any) => void>>();
    return {
      listeners,
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type)!.push(handler);
      },
      dispatchEvent(event) {
        const handlers = listeners.get(event.type);
        if (handlers) {
          for (const h of handlers) h(event);
        }
        return true;
      },
    };
  }

  function getRegistry(win: MockWindow & { __aiOsIPC?: IPCRegistry }): IPCRegistry {
    if (!win.__aiOsIPC) {
      win.__aiOsIPC = {
        handlers: new Map(),
        listenerAttached: false,
      };
    }
    return win.__aiOsIPC;
  }

  function ensureListener(win: MockWindow & { __aiOsIPC?: IPCRegistry }): void {
    const reg = getRegistry(win);
    if (!reg.listenerAttached) {
      const messageHandler = (event: any) => {
        const message = event.data;
        if (typeof message !== 'object' || message === null) return;
        const handlers = reg.handlers.get(message.type as string);
        if (handlers) {
          for (const handler of handlers) {
            handler(message);
          }
        }
      };
      win.addEventListener('message', messageHandler);
      reg.listenerAttached = true;
    }
  }

  function onMessage(
    win: MockWindow & { __aiOsIPC?: IPCRegistry },
    type: string,
    handler: (data: unknown) => void
  ): void {
    ensureListener(win);
    const wrapped = (message: Record<string, unknown>) => {
      if (message.data) {
        handler(message.data);
      }
    };
    getRegistry(win).handlers.set(type, [wrapped]);
  }

  function getMessageListenerCount(win: MockWindow): number {
    return win.listeners.get('message')?.length ?? 0;
  }

  beforeEach(() => {
    mockWin = createMockWindow();
    registryRef = { current: undefined };
  });

  afterEach(() => {
    delete (mockWin as any).__aiOsIPC;
  });

  it('attaches exactly ONE window listener after first onMessage', () => {
    onMessage(mockWin, 'test', vi.fn());
    expect(getMessageListenerCount(mockWin)).toBe(1);
  });

  it('does NOT add a second listener when ensureListener called again (simulates module reload)', () => {
    onMessage(mockWin, 'test', vi.fn());
    expect(getMessageListenerCount(mockWin)).toBe(1);

    // Simulate module reload - ensureListener called again
    ensureListener(mockWin);

    // Still exactly 1 listener
    expect(getMessageListenerCount(mockWin)).toBe(1);
  });

  it('onMessage replaces handler (does NOT push) for same type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    onMessage(mockWin, 'columnPrompts', handler1);
    onMessage(mockWin, 'columnPrompts', handler2);

    // Fire a message
    mockWin.dispatchEvent({
      type: 'message',
      data: { type: 'columnPrompts', data: { column: 'AI_SPEC' } },
    });

    // Only handler2 should fire (handler1 was replaced)
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith({ column: 'AI_SPEC' });
  });

  it('handler count stays at 1 after 15 simulated reloads', () => {
    // This is the exact regression scenario: 15 panel opens = 15 listeners
    for (let i = 0; i < 15; i++) {
      onMessage(mockWin, 'columnPrompts', vi.fn());
      ensureListener(mockWin);
    }

    expect(getMessageListenerCount(mockWin)).toBe(1);
  });

  it('new handler after reload receives messages (old handler replaced)', () => {
    const oldHandler = vi.fn();
    const newHandler = vi.fn();

    onMessage(mockWin, 'boardData', oldHandler);

    // Simulate reload: register new handler
    onMessage(mockWin, 'boardData', newHandler);

    mockWin.dispatchEvent({
      type: 'message',
      data: { type: 'boardData', data: { columns: [], items: [] } },
    });

    expect(oldHandler).not.toHaveBeenCalled();
    expect(newHandler).toHaveBeenCalledWith({ columns: [], items: [] });
  });
});
