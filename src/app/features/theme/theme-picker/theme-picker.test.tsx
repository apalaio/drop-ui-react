import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { renderWithStores } from '../../../../test/render-with-stores';
import { ALL_THEMES_STYLESHEET, THEMES } from '../state/theme-store';
import { ThemePicker } from './theme-picker';

describe(ThemePicker.name, () => {
  const triggerLabel = 'Change theme';
  const startingTheme = 'fantasy';
  const otherTheme = 'dracula';

  function openList(): void {
    fireEvent.click(screen.getByRole('button', { name: triggerLabel }));
  }

  function allThemesStylesheet(): Element | null {
    return document.head.querySelector(`link[rel="stylesheet"][href="${ALL_THEMES_STYLESHEET}"]`);
  }

  beforeEach(() => {
    renderWithStores(<ThemePicker />, { theme: startingTheme });
  });

  describe('before the button is clicked', () => {
    it('should not render the theme list', () => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should not render any theme', () => {
      expect(screen.queryAllByRole('menuitemradio').length).toBe(0);
    });

    it('should not load the other themes', () => {
      expect(allThemesStylesheet()).not.toBeInTheDocument();
    });

    it('should describe the button with the current theme', () => {
      expect(screen.getByRole('button', { name: triggerLabel })).toHaveAccessibleDescription(
        `Current theme: ${startingTheme}`,
      );
    });

    it('should mark the button as collapsed', () => {
      expect(screen.getByRole('button', { name: triggerLabel })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  describe('when the button is clicked', () => {
    beforeEach(() => openList());

    it('should render the theme list', async () => {
      expect(await screen.findByRole('menu', { name: 'Themes' })).toBeInTheDocument();
    });

    it('should load every theme', async () => {
      await waitFor(() => expect(allThemesStylesheet()).toBeInTheDocument());
    });

    it('should list every daisyUI theme', async () => {
      const themes = (await screen.findAllByRole('menuitemradio')).map((theme) =>
        theme.textContent?.trim(),
      );

      expect(themes).toEqual(THEMES);
    });

    it('should mark the current theme as checked', async () => {
      expect(await screen.findByRole('menuitemradio', { name: startingTheme })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('should mark only the current theme as checked', async () => {
      await screen.findByRole('menu');

      expect(screen.getAllByRole('menuitemradio', { checked: true }).length).toBe(1);
    });

    it('should focus the current theme', async () => {
      const current = await screen.findByRole('menuitemradio', { name: startingTheme });

      await waitFor(() => expect(current).toHaveFocus());
    });
  });

  describe('when the list is open and keys are pressed', () => {
    beforeEach(async () => {
      openList();
      const current = await screen.findByRole('menuitemradio', { name: startingTheme });
      await waitFor(() => expect(current).toHaveFocus());
    });

    it('should focus the theme whose name is typed', async () => {
      await userEvent.keyboard('dra');

      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', { name: otherTheme })).toHaveFocus(),
      );
    });

    it('should close the list and return focus to the button on Escape', async () => {
      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: triggerLabel })).toHaveFocus());
    });

    it('should leave the theme as it was on Escape', async () => {
      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(document.documentElement).toHaveAttribute('data-theme', startingTheme);
    });
  });

  describe('when a theme is picked', () => {
    beforeEach(async () => {
      openList();
      fireEvent.click(await screen.findByRole('menuitemradio', { name: otherTheme }));
    });

    it('should apply the theme to the whole document', async () => {
      await waitFor(() =>
        expect(document.documentElement).toHaveAttribute('data-theme', otherTheme),
      );
    });

    it('should close the theme list', async () => {
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    });

    it('should describe the button with the picked theme', async () => {
      await waitFor(() =>
        expect(screen.getByRole('button', { name: triggerLabel })).toHaveAccessibleDescription(
          `Current theme: ${otherTheme}`,
        ),
      );
    });

    it('should announce the picked theme', async () => {
      expect(await screen.findByText(`Theme changed to ${otherTheme}.`)).toHaveAttribute(
        'aria-live',
        'polite',
      );
    });

    it('should mark the picked theme as checked when the list is reopened', async () => {
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      openList();

      expect(await screen.findByRole('menuitemradio', { name: otherTheme })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('should no longer mark the previous theme as checked when the list is reopened', async () => {
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      openList();

      expect(await screen.findByRole('menuitemradio', { name: startingTheme })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
  });
});
