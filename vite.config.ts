import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /*
     * daisyUI's prebuilt themes, served in dev and copied by the build. `index.html` links the
     * starting theme from `themes/`; ThemeStore fetches `themes.css`, which holds all of them.
     */
    viteStaticCopy({
      targets: [
        { src: 'node_modules/daisyui/theme/*.css', dest: 'themes', rename: { stripBase: true } },
        { src: 'node_modules/daisyui/themes.css', dest: '.', rename: { stripBase: true } },
      ],
    }),
  ],
});
