import themeOrder from 'daisyui/functions/themeOrder';
import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, StoreApi } from 'zustand/vanilla';
import { Announce } from '../../../shared/announcer/announcer';

export interface ThemeState {
  theme: string;
  /** Whether the stylesheet holding every theme is wanted; the page starts with its starting theme's alone. */
  allThemesRequested: boolean;
}

export interface ThemeActions {
  loadAllThemes(): void;
  setTheme(theme: string): void;
}

export type ThemeStore = StoreApi<ThemeState & ThemeActions>;

export const THEMES: readonly string[] = themeOrder;

/** daisyUI's prebuilt stylesheet of every theme, copied to the app root by the build. */
export const ALL_THEMES_STYLESHEET = 'themes.css';

/**
 * `index.html` names the starting theme on `<html>` and links that theme's CSS, so the name is read
 * from there rather than repeated. Any other start has no CSS on the page and needs the full set.
 */
const createInitialState = (root: HTMLElement): ThemeState => {
  const declared = root.getAttribute('data-theme');
  return declared !== null && THEMES.includes(declared)
    ? { theme: declared, allThemesRequested: false }
    : { theme: THEMES[0], allThemesRequested: true };
};

export function createThemeStore({
  announce,
  document = window.document,
}: {
  announce: Announce;
  document?: Document;
}): ThemeStore {
  const store = createStore<ThemeState & ThemeActions>()((set) => ({
    ...createInitialState(document.documentElement),
    loadAllThemes() {
      set({ allThemesRequested: true });
    },
    setTheme(theme) {
      if (THEMES.includes(theme)) {
        set({ theme, allThemesRequested: true });
        // The only other sign of the change is the new colours.
        announce(`Theme changed to ${theme}.`);
      }
    },
  }));

  // On <html> rather than the app root, so popups rendered under <body> are themed as well.
  const applyTheme = (theme: string): void =>
    document.documentElement.setAttribute('data-theme', theme);

  const linkAllThemes = (): void => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ALL_THEMES_STYLESHEET;
    document.head.appendChild(link);
  };

  const initial = store.getState();
  applyTheme(initial.theme);
  if (initial.allThemesRequested) {
    linkAllThemes();
  }
  store.subscribe((state, previous) => {
    if (state.theme !== previous.theme) {
      applyTheme(state.theme);
    }
    if (state.allThemesRequested && !previous.allThemesRequested) {
      linkAllThemes();
    }
  });

  return store;
}

export const ThemeStoreContext = createContext<ThemeStore | null>(null);

export function useThemeStore<T>(selector: (state: ThemeState & ThemeActions) => T): T {
  const store = useContext(ThemeStoreContext);
  if (!store) {
    throw new Error('useThemeStore needs a <ThemeStoreContext> provider above it.');
  }
  return useStore(store, selector);
}
