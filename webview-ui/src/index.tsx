import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getVsCodeApi } from './vscodeApi';
import './styles/index.css';

// Report errors to extension host using singleton API
window.addEventListener('error', (e) => {
  console.error('[AI OS React] JS error:', e.message, e.filename, e.lineno);
  try {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        type: '__react_error__',
        data: { message: e.message, filename: e.filename, lineno: e.lineno }
      });
    }
  } catch {}
});

console.log('[AI OS React] index.tsx loaded, mounting...');
const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[AI OS React] #root element not found!');
  try {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: '__react_error__', data: { message: '#root element not found' } });
    }
  } catch {}
} else {
  console.log('[AI OS React] #root found, creating React root...');
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('[AI OS React] React mounted successfully');
    try {
      const api = getVsCodeApi();
      if (api) {
        api.postMessage({ type: '__react_ready__', data: { ts: Date.now() } });
      }
    } catch {}
  } catch (e) {
    console.error('[AI OS React] React mount failed:', e);
    try {
      const api = getVsCodeApi();
      if (api) {
        api.postMessage({ type: '__react_error__', data: { message: String(e) } });
      }
    } catch {}
  }
}
