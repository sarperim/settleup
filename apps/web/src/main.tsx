import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Placeholder entry point (TKT-foundation-001). TKT-foundation-005 replaces
// this with the real SPA shell (router + layout + API client).
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <h1>Settle Up</h1>
  </StrictMode>,
);
