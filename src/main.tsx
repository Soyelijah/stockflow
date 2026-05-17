import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite WebSocket errors in AI Studio environment
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && (args[0].includes('[vite] failed to connect') || args[0].includes('WebSocket'))) {
      return;
    }
    originalError(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason);
    if (msg.includes('WebSocket') || msg.includes('vite')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
