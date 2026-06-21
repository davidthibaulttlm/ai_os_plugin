/** Webview logger — posts log messages to extension host via IPC for unified Output panel logging */

import { getVsCodeApi } from './vscodeApi';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function postLog(level: LogLevel, message: string): void {
  const api = getVsCodeApi();
  if (api) {
    try {
      api.postMessage({ type: '__log__', data: { level, message } });
    } catch {
      // Extension host not available — fallback to console
      logToConsole(level, message);
    }
  } else {
    // Storybook/dev mode — log to console
    logToConsole(level, message);
  }
}

function logToConsole(level: LogLevel, message: string): void {
  switch (level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'debug':
      console.debug(message);
      break;
    default:
      console.log(message);
  }
}

export const logger = {
  debug: (message: string) => postLog('debug', message),
  info: (message: string) => postLog('info', message),
  warn: (message: string) => postLog('warn', message),
  error: (message: string) => postLog('error', message),
};
