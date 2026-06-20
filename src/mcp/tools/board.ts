/**
 * MCP board tools: get_kanban_board, get_column_issues
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readBoardState } from './utils';

const FIXED_COLUMNS = ['BRAIN_DUMP', 'AI_SPEC', 'HUMAN_SPEC_REVIEW', 'AI_CODE', 'HUMAN_CODE_REVIEW', 'PR_DONE'] as const;
const ColumnSchema = z.enum(FIXED_COLUMNS);

export function registerBoardTools(server: McpServer): void {
  server.tool(
    'get_kanban_board',
    'Get the full kanban board state including all columns and issues',
    {},
    async () => {
      const state = readBoardState();
      if (!state) {
        return {
          content: [{ type: 'text' as const, text: 'No board loaded. Open a board in AI OS first.' }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(state, null, 2) }],
      };
    }
  );

  server.tool(
    'get_column_issues',
    'Get issues in a specific kanban column',
    { column: ColumnSchema },
    async ({ column }) => {
      const state = readBoardState();
      if (!state) {
        return {
          content: [{ type: 'text' as const, text: 'No board loaded. Open a board in AI OS first.' }],
          isError: true,
        };
      }

      const issues = state.columns?.[column] ?? [];
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ column, issues }, null, 2) }],
      };
    }
  );
}
