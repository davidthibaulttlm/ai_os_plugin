let vsCodeApi: VsCodeApi | undefined = undefined;
let acquireFailed = false;
let diagnosticsLogged = false;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (vsCodeApi) {
    return vsCodeApi;
  }
  if (acquireFailed) {
    return undefined;
  }

  if (!diagnosticsLogged) {
    diagnosticsLogged = true;
    const checks: Record<string, string> = {};
    checks['bare acquireVsCodeApi'] = typeof acquireVsCodeApi;
    checks['window.acquireVsCodeApi'] = typeof window.acquireVsCodeApi;
    checks['globalThis.acquireVsCodeApi'] = typeof (globalThis as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi;
    checks['window.name'] = window.name || '(empty)';
    checks['navigator.userAgent'] = navigator.userAgent?.substring(0, 50) || '(empty)';
    console.log('[AI OS IPC] Diagnostics:', JSON.stringify(checks));
  }

  let fn: Function | undefined;

  if (typeof acquireVsCodeApi !== 'undefined') {
    try {
      fn = acquireVsCodeApi;
    } catch (_e) {
      // acquireVsCodeApi not available in this context
    }
  }

  if (!fn && typeof window.acquireVsCodeApi !== 'undefined') {
    try {
      fn = window.acquireVsCodeApi!;
    } catch (_e) {
      // acquireVsCodeApi not available on window
    }
  }

  if (!fn && typeof (globalThis as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi !== 'undefined') {
    try {
      fn = (globalThis as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi!;
    } catch (_e) {
      // acquireVsCodeApi not available on globalThis
    }
  }

  if (!fn) {
    console.error('[AI OS IPC] acquireVsCodeApi not found in any location!');
    acquireFailed = true;
    return undefined;
  }

  try {
    vsCodeApi = fn();
    console.log('[AI OS IPC] acquireVsCodeApi() succeeded!');
  } catch (e) {
    console.error('[AI OS IPC] acquireVsCodeApi() failed:', e);
    acquireFailed = true;
  }
  return vsCodeApi;
}

export function isVsCode(): boolean {
  return typeof acquireVsCodeApi !== 'undefined' ||
         typeof window.acquireVsCodeApi !== 'undefined' ||
         typeof (globalThis as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi !== 'undefined';
}
