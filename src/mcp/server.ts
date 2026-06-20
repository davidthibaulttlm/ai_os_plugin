/**
 * MCP Server entry point — runs as a standalone Node.js child process.
 * Exposes kanban board data as MCP tools and resources over stdio transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import tool and resource handlers
import { registerBoardTools } from './tools/board';
import { registerIssueTools } from './tools/issues';
import { registerStatsTools } from './tools/stats';
import { registerBoardResources } from './resources/boardState';

const server = new McpServer({
  name: 'ai-os-kanban',
  version: '1.0.0',
});

// Register all tools
registerBoardTools(server);
registerIssueTools(server);
registerStatsTools(server);

// Register all resources
registerBoardResources(server);

async function main(): Promise<void> {
  try {
    const mode = process.env.AI_OS_MODE ?? 'claude';
    const stateFile = process.env.AI_OS_STATE_FILE;

    if (!stateFile) {
      process.stderr.write('[AI OS] MCP server starting (VS Code provider mode)\n');
    } else {
      process.stderr.write(`[AI OS] MCP server starting (mode=${mode}, stateFile=${stateFile})\n`);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);

    process.stderr.write('[AI OS] MCP server running on stdio\n');
  } catch (error) {
    process.stderr.write(`[AI OS] MCP server fatal error: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main();
