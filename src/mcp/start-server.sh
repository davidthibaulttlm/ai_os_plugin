#!/bin/bash
# Wrapper script for running MCP server from Windows via WSL
# This ensures env vars are set and node is found

export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export AI_OS_STATE_FILE="${AI_OS_STATE_FILE:-}"
export AI_OS_MODE="${AI_OS_MODE:-claude}"

exec /usr/bin/node /home/splashxxx/ai_os_plugin/out/mcp/server.js
