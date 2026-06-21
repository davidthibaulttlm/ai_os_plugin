import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentService } from '../../services/agent';
import { PollerService } from '../../services/poller';

/**
 * Regression test: Poller "stop" should log exactly once per stop cycle.
 *
 * Bug: boardHandlers.ts called `poller.stop()` explicitly before
 * `poller.start()`, but `start()` also calls `this.stop()` internally.
 * Result: "Poller stopped" logged twice for what should be a single stop.
 *
 * Fix: Removed redundant `poller.stop()` calls from boardHandlers.ts.
 * This test verifies `start()` only calls `stop()` once internally.
 */
describe('PollerService.stop - no double stop (regression)', () => {
  let logCalls: string[];
  let mockGraphql: any;
  let mockCallback: ReturnType<typeof vi.fn>;
  let mockAgentService: Partial<AgentService>;

  beforeEach(() => {
    logCalls = [];
    mockCallback = vi.fn();
    mockAgentService = { setBoardState: vi.fn() };
    mockGraphql = { getProjectItems: vi.fn().mockResolvedValue([]) };

    // Mock the logger module to capture log calls
    vi.doMock('../../services/logger', () => ({
      logger: {
        info: (msg: string) => logCalls.push(msg),
        warn: (msg: string) => logCalls.push(msg),
        error: (msg: string) => logCalls.push(msg),
        debug: (msg: string) => logCalls.push(msg),
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('start() calls stop() exactly once (no double stop)', async () => {
    // Re-import with mocked logger
    const { PollerService: Poller } = await import('../../services/poller.js');
    const poller = new Poller();
    poller.setAgentService(mockAgentService as AgentService);

    // First start
    poller.start(mockGraphql, 'project-1', mockCallback);
    await new Promise((r) => setTimeout(r, 30));

    const stopsAfterFirstStart = logCalls.filter(c => c.includes('Poller stopped')).length;
    expect(stopsAfterFirstStart).toBe(1);

    // Second start (simulates boardHandlers calling start again)
    logCalls.length = 0;
    poller.start(mockGraphql, 'project-2', mockCallback);
    await new Promise((r) => setTimeout(r, 30));

    // start() internally calls stop() once — that's the only stop
    const stopsAfterSecondStart = logCalls.filter(c => c.includes('Poller stopped')).length;
    expect(stopsAfterSecondStart).toBe(1);

    poller.stop();
  });

  it('explicit stop() before start() causes double stop (demonstrates the bug pattern)', async () => {
    const { PollerService: Poller } = await import('../../services/poller.js');
    const poller = new Poller();
    poller.setAgentService(mockAgentService as AgentService);

    // First start
    poller.start(mockGraphql, 'project-1', mockCallback);
    await new Promise((r) => setTimeout(r, 30));
    logCalls.length = 0;

    // BUG PATTERN: explicit stop() then start() — this is what boardHandlers used to do
    poller.stop();
    const stopsBeforeStart = logCalls.filter(c => c.includes('Poller stopped')).length;
    expect(stopsBeforeStart).toBe(1);

    logCalls.length = 0;
    poller.start(mockGraphql, 'project-2', mockCallback);
    await new Promise((r) => setTimeout(r, 30));

    // start() calls stop() again — total 2 stops for what should be 1 transition
    const stopsFromStart = logCalls.filter(c => c.includes('Poller stopped')).length;
    expect(stopsFromStart).toBe(1);

    // Total: 2 stops (1 explicit + 1 from start) — this is the bug
    // The fix is: DON'T call stop() before start(). Just call start().
    poller.stop();
  });
});
