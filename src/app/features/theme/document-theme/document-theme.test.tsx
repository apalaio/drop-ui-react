import { waitFor } from '@testing-library/react';
import { renderWithStores } from '../../../../test/render-with-stores';
import { ThemeStore } from '../state/theme-store';
import { ALL_THEMES_STYLESHEET, DocumentTheme } from './document-theme';

describe(DocumentTheme.name, () => {
  const startingTheme = 'fantasy';
  const otherTheme = 'dracula';
  const unknownTheme = 'not-a-daisyui-theme';

  function mount(theme: string): ThemeStore {
    return renderWithStores(<DocumentTheme />, { theme }).themeStore;
  }

  function allThemesStylesheets(): Element[] {
    return Array.from(
      document.querySelectorAll(`link[rel="stylesheet"][href="${ALL_THEMES_STYLESHEET}"]`),
    );
  }

  describe('with the theme the page declares', () => {
    beforeEach(() => {
      mount(startingTheme);
    });

    it('should apply the theme to the whole document', () => {
      expect(document.documentElement).toHaveAttribute('data-theme', startingTheme);
    });

    it('should not load the other themes', () => {
      expect(allThemesStylesheets().length).toBe(0);
    });
  });

  describe('with a theme the page has no stylesheet for', () => {
    beforeEach(() => {
      mount(unknownTheme);
    });

    it('should load every theme', () => {
      expect(allThemesStylesheets().length).toBe(1);
    });
  });

  describe('when another theme is set', () => {
    beforeEach(() => {
      mount(startingTheme).getState().setTheme(otherTheme);
    });

    it('should apply it to the whole document', async () => {
      await waitFor(() =>
        expect(document.documentElement).toHaveAttribute('data-theme', otherTheme),
      );
    });

    it('should load every theme', async () => {
      await waitFor(() => expect(allThemesStylesheets().length).toBe(1));
    });
  });

  describe('when every theme is requested', () => {
    let themeStore: ThemeStore;

    beforeEach(() => {
      themeStore = mount(startingTheme);
      themeStore.getState().loadAllThemes();
    });

    it('should load every theme', async () => {
      await waitFor(() => expect(allThemesStylesheets().length).toBe(1));
    });

    it('should leave the theme as it was', async () => {
      await waitFor(() => expect(allThemesStylesheets().length).toBe(1));

      expect(document.documentElement).toHaveAttribute('data-theme', startingTheme);
    });

    it('should load them once however often they are requested', async () => {
      themeStore.getState().loadAllThemes();
      themeStore.getState().setTheme(otherTheme);

      await waitFor(() =>
        expect(document.documentElement).toHaveAttribute('data-theme', otherTheme),
      );
      expect(allThemesStylesheets().length).toBe(1);
    });
  });

  describe('when it is removed from the page', () => {
    it('should take the stylesheet of every theme with it', () => {
      const { unmount } = renderWithStores(<DocumentTheme />, { theme: unknownTheme });

      unmount();

      expect(allThemesStylesheets().length).toBe(0);
    });
  });
});
