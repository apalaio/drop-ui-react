import { screen } from '@testing-library/react';
import { App } from './app';
import { renderWithStores } from './test/render-with-stores';

describe(App.name, () => {
  it('should render the builder shell', () => {
    renderWithStores(<App />, { dnd: false });

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
