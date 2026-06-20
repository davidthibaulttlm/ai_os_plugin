/**
 * MCP board resources: board://state, board://column/{name}
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readBoardState } from '../tools/utils';

export function registerBoardResources(server: McpServer): void {
  // Static resource: board://state
  server.resource(
    'board-state',
    'board://state',
    {
      title: 'Board State',
      description: 'Full kanban board state as JSON',
      mimeType: 'application/json',
    },
    (uri) => {
      const state = readBoardState();
      if (!state) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'No board loaded. Open a board in AI OS first.' }),
          }],
        };
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(state, null, 2),
        }],
      };
    }
  );

  // Dynamic resource template: board://column/{name}
  server.resource(
    'board-column',
    new ResourceTemplate('board://column/{name}', {
      list: async () => {
        const state = readBoardState();
        if (!state || !state.columns) {
          return { resources: [] };
        }
        return {
          resources: Object.keys(state.columns).map((name) => ({
            uri: `board://column/${name}`,
            name,
          })),
        };
      },
    }),
    {
      title: 'Board Column',
      description: 'Issues in a specific kanban column',
      mimeType: 'application/json',
    },
    async (uri, { name }) => {
      const state = readBoardState();
      if (!state) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'No board loaded. Open a board in AI OS first.' }),
          }],
        };
      }

      const issues = state.columns?.[name as string] ?? [];
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({ column: name, issues }, null, 2),
        }],
      };
    }
  );
}
