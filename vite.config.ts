import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  /* The empty prefix reads the unprefixed API_PORT the Express server reads from the same `.env`. */
  const apiPort = Number(loadEnv(mode, process.cwd(), '')['API_PORT']) || 3001;

  return {
    plugins: [
      react(),
      tailwindcss(),
      /*
       * daisyUI's prebuilt themes, served in dev and copied by the build. `index.html` links the
       * starting theme from `themes/`; DocumentTheme links `themes.css`, which holds all of them.
       */
      viteStaticCopy({
        targets: [
          { src: 'node_modules/daisyui/theme/*.css', dest: 'themes', rename: { stripBase: true } },
          { src: 'node_modules/daisyui/themes.css', dest: '.', rename: { stripBase: true } },
        ],
      }),
    ],
    server: {
      // By address: the backend listens on IPv4 loopback only, and `localhost` may resolve to ::1.
      proxy: { '/api': `http://127.0.0.1:${apiPort}` },
    },
  };
});
