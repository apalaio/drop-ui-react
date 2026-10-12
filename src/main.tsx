import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import {
  BuilderStoreContext,
  createBuilderStore,
} from './app/features/builder/state/builder-store';
import { createFactService } from './app/features/fact/services/fact-service';
import { createFactStore, FactStoreContext } from './app/features/fact/state/fact-store';
import { createThemeStore, ThemeStoreContext } from './app/features/theme/state/theme-store';
import { createUiGeneratorService } from './app/features/ui-generator/services/ui-generator-service';
import {
  createUiGeneratorStore,
  UiGeneratorStoreContext,
} from './app/features/ui-generator/state/ui-generator-store';
import { createAnnouncer } from './app/shared/announcer/announcer';
import { createHttpClient } from './app/shared/http/http-client';
import { rejectHttpErrors, timeout } from './app/shared/http/http-interceptors';
import './styles.css';

const REQUEST_TIMEOUT_MS = 10_000;
// A generation waits for a language model, which takes far longer than a fact does.
const GENERATION_TIMEOUT_MS = 60_000;

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
const http = createHttpClient([rejectHttpErrors, timeout(REQUEST_TIMEOUT_MS)]);
const factStore = createFactStore({ announce, service: createFactService(http) });
// Without rejectHttpErrors: the service reads the reason out of a failed response itself.
const generationHttp = createHttpClient([timeout(GENERATION_TIMEOUT_MS)]);
const uiGeneratorStore = createUiGeneratorStore({
  announce,
  service: createUiGeneratorService(generationHttp),
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
          <FactStoreContext value={factStore}>
            <UiGeneratorStoreContext value={uiGeneratorStore}>
              <App />
            </UiGeneratorStoreContext>
          </FactStoreContext>
        </BuilderStoreContext>
      </ThemeStoreContext>
    </StrictMode>,
  ),
);
