import { screen } from '@testing-library/react';
import { App } from './app';
import { renderWithStores } from './test/render-with-stores';

describe(App.name, () => {
  const theme = 'dracula';

  it('should render the builder shell', () => {
    renderWithStores(<App />, { dnd: false });

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should apply the theme to the document', () => {
    renderWithStores(<App />, { dnd: false, theme });

    expect(document.documentElement).toHaveAttribute('data-theme', theme);
  });
});
