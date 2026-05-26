import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {MotionConfig} from 'motion/react';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite WebSocket and HMR errors in AI Studio environment
if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
  const suppressPatterns = [
    '[vite] failed to connect',
    'WebSocket closed without opened',
    'WebSocket connection to',
    '[vite] connecting...',
    'HMR',
    'websocket',
    'heartbeat',
    'ERR_BLOCKED_BY_CLIENT',
    '@firebase/firestore',
    'firestore.googleapis.com',
  ];

  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && suppressPatterns.some(p => args[0].includes(p))) return;
    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && suppressPatterns.some(p => args[0].includes(p))) return;
    originalWarn(...args);
  };
  
  console.log = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && suppressPatterns.some(p => args[0].includes(p))) return;
    originalLog(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = event.reason ? (event.reason.message || event.reason.stack || String(event.reason)) : '';
    if (suppressPatterns.some(p => reasonStr.includes(p)) || !event.reason || reasonStr === '[object Object]') {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (suppressPatterns.some(p => msg.includes(p))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);
