import themeOrder from 'daisyui/functions/themeOrder';
import { Announce } from '../../../shared/announcer/announcer';
import { ALL_THEMES_STYLESHEET, createThemeStore, THEMES, ThemeStore } from './theme-store';

describe('ThemeStore', () => {
  const startingTheme = 'fantasy';
  const otherTheme = 'dracula';
  const unknownTheme = 'not-a-daisyui-theme';

  let page: Document;
  let root: HTMLElement;
  let announce: ReturnType<typeof vi.fn<Announce>>;

  function createStore(): ThemeStore {
    return createThemeStore({ announce, document: page });
  }

  function appliedTheme(): string | null {
    return root.getAttribute('data-theme');
  }

  function allThemesStylesheets(): HTMLLinkElement[] {
    return Array.from(page.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter(
      (link) => link.getAttribute('href') === ALL_THEMES_STYLESHEET,
    );
  }

  beforeEach(() => {
    page = document.implementation.createHTMLDocument();
    root = page.documentElement;
    root.setAttribute('data-theme', startingTheme);
    announce = vi.fn<Announce>();
  });

  it('offers every theme daisyUI ships', () => {
    expect(THEMES).toEqual(themeOrder);
  });

  describe('starting theme', () => {
    it('is the theme the document declares', () => {
      const store = createStore();

      expect(store.getState().theme).toBe(startingTheme);
    });

    it('stays applied to the root element', () => {
      createStore();

      expect(appliedTheme()).toBe(startingTheme);
    });

    it('does not load the other themes', () => {
      createStore();

      expect(allThemesStylesheets()).toEqual([]);
    });

    it('is the first theme when the document declares none', () => {
      root.removeAttribute('data-theme');

      const store = createStore();

      expect(store.getState().theme).toBe(THEMES[0]);
      expect(appliedTheme()).toBe(THEMES[0]);
    });

    it('is the first theme when the document declares one daisyUI does not ship', () => {
      root.setAttribute('data-theme', unknownTheme);

      const store = createStore();

      expect(store.getState().theme).toBe(THEMES[0]);
      expect(appliedTheme()).toBe(THEMES[0]);
    });

    it('loads every theme when it could not come from the document', () => {
      root.removeAttribute('data-theme');

      createStore();

      expect(allThemesStylesheets().length).toBe(1);
    });

    it('is announced to no one', () => {
      createStore();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('document', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('data-theme');
      document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
    });

    it('is left alone when the store is given another one', () => {
      const store = createStore();

      store.getState().setTheme(otherTheme);

      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
      expect(document.head.querySelector('link[rel="stylesheet"]')).toBeNull();
    });

    it('is the page itself unless the store is given another one', () => {
      document.documentElement.setAttribute('data-theme', startingTheme);
      const store = createThemeStore({ announce });

      store.getState().setTheme(otherTheme);

      expect(document.documentElement.getAttribute('data-theme')).toBe(otherTheme);
      expect(appliedTheme()).toBe(startingTheme);
    });
  });

  describe('loadAllThemes', () => {
    it('adds the stylesheet holding every theme', () => {
      const store = createStore();

      store.getState().loadAllThemes();

      expect(allThemesStylesheets().length).toBe(1);
    });

    it('leaves the theme as it was', () => {
      const store = createStore();

      store.getState().loadAllThemes();

      expect(store.getState().theme).toBe(startingTheme);
    });

    it('adds the stylesheet only once', () => {
      const store = createStore();
      store.getState().loadAllThemes();
      allThemesStylesheets();

      store.getState().loadAllThemes();
      store.getState().setTheme(otherTheme);

      expect(allThemesStylesheets().length).toBe(1);
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

    it('applies a selected theme to the root element', () => {
      const store = createStore();

      store.getState().setTheme(otherTheme);

      expect(appliedTheme()).toBe(otherTheme);
    });

    it('loads every theme, as only the starting one is on the page', () => {
      const store = createStore();

      store.getState().setTheme(otherTheme);

      expect(allThemesStylesheets().length).toBe(1);
    });

    it('ignores a theme daisyUI does not ship', () => {
      const store = createStore();

      store.getState().setTheme(unknownTheme);

      expect(store.getState().theme).toBe(startingTheme);
      expect(appliedTheme()).toBe(startingTheme);
      expect(allThemesStylesheets()).toEqual([]);
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
