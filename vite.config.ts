import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: 'web',
  build: { outDir: here('./dist'), emptyOutDir: true },
  plugins: [
    react(),
    tailwindcss(),
    // Share local D1/R2 state with the wrangler CLI used by scripts/ (repo-root .wrangler/state).
    cloudflare({ configPath: here('./wrangler.jsonc'), persistState: { path: here('./.wrangler/state') } }),
  ],
});
