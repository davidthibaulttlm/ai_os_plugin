/**
 * MCP stats tools: get_project_stats
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readBoardState, isStale } from './utils';

export function registerStatsTools(server: McpServer): void {
  server.tool(
    'get_project_stats',
    'Get project statistics including column counts and total issues',
    {},
    async () => {
      const state = readBoardState();
      if (!state) {
        return {
          content: [{ type: 'text' as const, text: 'No board loaded. Open a board in AI OS first.' }],
          isError: true,
        };
      }

      const columnCounts: Record<string, number> = {};
      let totalIssues = 0;

      if (state.columns) {
        for (const [column, issues] of Object.entries(state.columns)) {
          columnCounts[column] = issues.length;
          totalIssues += issues.length;
        }
      }

      const stats = {
        columnCounts,
        totalIssues,
        lastUpdated: state.lastUpdated,
        stale: isStale(state),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }],
      };
    }
  );
}
