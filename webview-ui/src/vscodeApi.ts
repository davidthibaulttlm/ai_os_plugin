/**
 * Singleton for VS Code webview API.
 * acquireVsCodeApi() can only be called ONCE per webview.
 * This module ensures we call it once and reuse the instance everywhere.
 *
 * Uses try-catch to handle React StrictMode double-mounting where
 * the second mount may find the API already acquired.
 */

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

  // Log diagnostics once to find where acquireVsCodeApi lives
  if (!diagnosticsLogged) {
    diagnosticsLogged = true;
    const checks: Record<string, string> = {};
    checks['bare acquireVsCodeApi'] = typeof (acquireVsCodeApi as any);
    checks['window.acquireVsCodeApi'] = typeof (window as any).acquireVsCodeApi;
    checks['globalThis.acquireVsCodeApi'] = typeof (globalThis as any).acquireVsCodeApi;
    checks['window.name'] = (window as any).name || '(empty)';
    checks['navigator.userAgent'] = (navigator as any).userAgent?.substring(0, 50) || '(empty)';
    console.log('[AI OS IPC] Diagnostics:', JSON.stringify(checks));
  }

  // Try all possible locations
  let fn: Function | undefined;

  // 1. Try bare global
  if (typeof (acquireVsCodeApi as any) !== 'undefined') {
    try {
      fn = acquireVsCodeApi as any;
    } catch {}
  }

  // 2. Try window
  if (!fn && typeof (window as any).acquireVsCodeApi !== 'undefined') {
    try {
      fn = (window as any).acquireVsCodeApi;
    } catch {}
  }

  // 3. Try globalThis
  if (!fn && typeof (globalThis as any).acquireVsCodeApi !== 'undefined') {
    try {
      fn = (globalThis as any).acquireVsCodeApi;
    } catch {}
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
  return typeof (acquireVsCodeApi as any) !== 'undefined' ||
         typeof (window as any).acquireVsCodeApi !== 'undefined' ||
         typeof (globalThis as any).acquireVsCodeApi !== 'undefined';
}
