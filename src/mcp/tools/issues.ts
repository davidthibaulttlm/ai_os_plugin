/**
 * MCP issue tools: get_issue_details
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readBoardState, isStale } from './utils';

export function registerIssueTools(server: McpServer): void {
  server.tool(
    'get_issue_details',
    'Get details for a specific issue by its number',
    { issueNumber: z.number().int().positive().describe('The issue number on the board') },
    async ({ issueNumber }) => {
      const state = readBoardState();
      if (!state) {
        return {
          content: [{ type: 'text' as const, text: 'No board loaded. Open a board in AI OS first.' }],
          isError: true,
        };
      }

      const stale = isStale(state);
      const issue = state.issues?.find((i) => i.number === issueNumber);
      if (!issue) {
        return {
          content: [{ type: 'text' as const, text: `Issue #${issueNumber} not found on the board` }],
          isError: true,
        };
      }

      let text = JSON.stringify(issue, null, 2);
      if (stale) {
        text += '\n\n[WARNING: Board data may be stale (last updated >60s ago)]';
      }
      return {
        content: [{ type: 'text' as const, text }],
      };
    }
  );
}
