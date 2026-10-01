import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Global stylesheets (TKT-ui-001): tokens first, then the self-hosted font
// faces, then the element defaults/shared classes that consume both. This is
// the single place global CSS enters the app; page-specific CSS is colocated
// with its page component.
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';

import App from './App';

// SPA entry point (TKT-foundation-005): mount the router tree. Deep-link
// navigation works because the dev server (and later the API's static
// serving) falls back to index.html for unknown paths.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
