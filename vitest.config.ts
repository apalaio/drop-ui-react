import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/*
 * Every package a component test loads in the browser, bundled together before the first test.
 * A package left out is bundled on first use, with its own copy of React, and every hook then
 * throws "Invalid hook call". A new import from node_modules (a Base UI subpath included) goes here.
 */
const BROWSER_DEPENDENCIES = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  'zustand',
  'zustand/vanilla',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@base-ui/react/alert-dialog',
  '@base-ui/react/dialog',
  '@base-ui/react/menu',
  'daisyui/functions/themeOrder',
  '@testing-library/react',
  '@testing-library/jest-dom/vitest',
];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/*.spec.ts'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
      {
        plugins: [react()],
        optimizeDeps: { include: BROWSER_DEPENDENCIES },
        test: {
          name: 'components',
          globals: true,
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/setup.browser.ts', 'src/test/setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
