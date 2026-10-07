import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import {
  BuilderStoreContext,
  createBuilderStore,
} from './app/features/builder/state/builder-store';
import { createThemeStore, ThemeStoreContext } from './app/features/theme/state/theme-store';
import { createAnnouncer } from './app/shared/announcer/announcer';
import './styles.css';

/*
 * No popup in this app animates, yet Base UI keeps a closed menu or dialog mounted until the next
 * animation frame to find that out. When that frame is late, the items of a closed menu are still
 * on the page next to those of the menu opened after it. This is Base UI's own switch for skipping
 * the wait; its declaration is in a file the package does not export, hence the cast.
 */
(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true;

const announce = createAnnouncer();
const builderStore = createBuilderStore({ announce });
const themeStore = createThemeStore({
  announce,
  declaredTheme: document.documentElement.getAttribute('data-theme'),
});

const root = createRoot(document.getElementById('root')!);

/*
 * `render` alone only schedules the first render, which then lands after the page's load event.
 * Flushed, the app is on the page by then, so a Tab pressed as soon as the page has loaded finds the
 * first control instead of an empty root.
 */
flushSync(() =>
  root.render(
    <StrictMode>
      <ThemeStoreContext value={themeStore}>
        <BuilderStoreContext value={builderStore}>
          <App />
        </BuilderStoreContext>
      </ThemeStoreContext>
    </StrictMode>,
  ),
);
