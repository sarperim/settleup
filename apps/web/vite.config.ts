import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal Vite config for the React SPA skeleton (TKT-foundation-001).
// TKT-foundation-005 builds the real SPA shell on top of this.
export default defineConfig({
  plugins: [react()],
});
