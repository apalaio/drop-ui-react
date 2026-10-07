import themeOrder from 'daisyui/functions/themeOrder';
import { Announce } from '../../../shared/announcer/announcer';
import { createThemeStore, THEMES, ThemeStore } from './theme-store';

describe('ThemeStore', () => {
  const startingTheme = 'fantasy';
  const otherTheme = 'dracula';
  const unknownTheme = 'not-a-daisyui-theme';

  let announce: ReturnType<typeof vi.fn<Announce>>;

  function createStore(declaredTheme: string | null = startingTheme): ThemeStore {
    return createThemeStore({ announce, declaredTheme });
  }

  beforeEach(() => {
    announce = vi.fn<Announce>();
  });

  it('offers every theme daisyUI ships', () => {
    expect(THEMES).toEqual(themeOrder);
  });

  describe('starting theme', () => {
    it('is the theme the page declares', () => {
      const store = createStore();

      expect(store.getState().theme).toBe(startingTheme);
    });

    it('does not request the other themes', () => {
      const store = createStore();

      expect(store.getState().allThemesRequested).toBe(false);
    });

    it('is the first theme when the page declares none', () => {
      const store = createStore(null);

      expect(store.getState().theme).toBe(THEMES[0]);
    });

    it('is the first theme when the page declares one daisyUI does not ship', () => {
      const store = createStore(unknownTheme);

      expect(store.getState().theme).toBe(THEMES[0]);
    });

    it('requests every theme when it could not come from the page', () => {
      const store = createStore(null);

      expect(store.getState().allThemesRequested).toBe(true);
    });

    it('is announced to no one', () => {
      createStore();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('loadAllThemes', () => {
    it('requests every theme', () => {
      const store = createStore();

      store.getState().loadAllThemes();

      expect(store.getState().allThemesRequested).toBe(true);
    });

    it('leaves the theme as it was', () => {
      const store = createStore();

      store.getState().loadAllThemes();

      expect(store.getState().theme).toBe(startingTheme);
    });

    it('announces nothing', () => {
      const store = createStore();

      store.getState().loadAllThemes();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('setTheme', () => {
    it('switches to a selected theme', () => {
      const store = createStore();

      store.getState().setTheme(otherTheme);

      expect(store.getState().theme).toBe(otherTheme);
    });

    it('requests every theme, as only the starting one is on the page', () => {
      const store = createStore();

      store.getState().setTheme(otherTheme);

      expect(store.getState().allThemesRequested).toBe(true);
    });

    it('ignores a theme daisyUI does not ship', () => {
      const store = createStore();

      store.getState().setTheme(unknownTheme);

      expect(store.getState().theme).toBe(startingTheme);
      expect(store.getState().allThemesRequested).toBe(false);
    });

    it('announces the selected theme', () => {
      const store = createStore();

      store.getState().setTheme(otherTheme);

      expect(announce).toHaveBeenCalledWith(`Theme changed to ${otherTheme}.`);
    });

    it('announces nothing for a theme daisyUI does not ship', () => {
      const store = createStore();

      store.getState().setTheme(unknownTheme);

      expect(announce).not.toHaveBeenCalled();
    });
  });
});
