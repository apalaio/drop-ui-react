import { useEffect } from 'react';
import { useThemeStore } from '../state/theme-store';

/** daisyUI's prebuilt stylesheet of every theme, copied to the app root by the build. */
export const ALL_THEMES_STYLESHEET = 'themes.css';

export function DocumentTheme() {
  const theme = useThemeStore((state) => state.theme);
  const allThemesRequested = useThemeStore((state) => state.allThemesRequested);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /*
   * No `precedence`: with it React moves the link to <head> and leaves it there after the component
   * is gone. Rendered in place it loads the same stylesheet and goes when the component does.
   * De-duplication and suspense behavior costs little here, as the link renders only in one place.
   */
  return allThemesRequested ? <link rel="stylesheet" href={ALL_THEMES_STYLESHEET} /> : null;
}
