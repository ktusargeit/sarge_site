import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global uncaught error handler to prevent stuck white screen on dynamic chunk failures
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch')
    ) {
      const reloaded = sessionStorage.getItem('chunk_reload_attempt');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload_attempt', 'true');
        window.location.reload();
      }
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || String(event?.reason || '');
    if (
      reason.includes('dynamically imported module') ||
      reason.includes('Loading chunk') ||
      reason.includes('Failed to fetch')
    ) {
      const reloaded = sessionStorage.getItem('chunk_reload_attempt');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload_attempt', 'true');
        window.location.reload();
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
