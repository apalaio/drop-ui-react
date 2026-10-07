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

/**
 * `index.html` names the starting theme on `<html>` and links that theme's CSS, so the name is taken
 * from there rather than repeated. Any other start has no CSS on the page and needs the full set.
 */
const createInitialState = (declaredTheme: string | null): ThemeState =>
  declaredTheme !== null && THEMES.includes(declaredTheme)
    ? { theme: declaredTheme, allThemesRequested: false }
    : { theme: THEMES[0], allThemesRequested: true };

export function createThemeStore({
  announce,
  declaredTheme,
}: {
  announce: Announce;
  declaredTheme: string | null;
}): ThemeStore {
  return createStore<ThemeState & ThemeActions>()((set) => ({
    ...createInitialState(declaredTheme),
    loadAllThemes() {
      set({ allThemesRequested: true });
    },
    setTheme(theme) {
      if (THEMES.includes(theme)) {
        set({ theme, allThemesRequested: true });
        announce(`Theme changed to ${theme}.`);
      }
    },
  }));
}

export const ThemeStoreContext = createContext<ThemeStore | null>(null);

export function useThemeStore<T>(selector: (state: ThemeState & ThemeActions) => T): T {
  const store = useContext(ThemeStoreContext);
  if (!store) {
    throw new Error('useThemeStore needs a <ThemeStoreContext> provider above it.');
  }
  return useStore(store, selector);
}
