import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  createFactServiceStub,
  FACT_OF_THE_DAY,
  RANDOM_FACT,
  renderWithStores,
} from '../../../../test/render-with-stores';
import { Fact } from '../models/fact';
import { FactService } from '../services/fact-service';
import { FactPanel } from './fact-panel';

describe(FactPanel.name, () => {
  const loading = 'Loading…';
  const failed = 'Could not load a fact.';
  const another = 'Another fact';
  const retry = 'Try again';

  const unanswered = (): Promise<Fact> => new Promise(() => undefined);
  const refused = (): Promise<Fact> => Promise.reject(new Error('offline'));

  function button(name: string): HTMLElement {
    return screen.getByRole('button', { name });
  }

  describe('while the fact of the day is on its way', () => {
    beforeEach(() => {
      renderWithStores(<FactPanel />, {
        factService: { ...createFactServiceStub(), today: unanswered },
      });
    });

    it('should render the loading text', () => {
      expect(screen.getByText(loading)).toBeInTheDocument();
    });

    it('should not render the failure text', () => {
      expect(screen.queryByText(failed)).not.toBeInTheDocument();
    });

    it('should mark the button as unavailable', () => {
      expect(button(another)).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('once the fact of the day has arrived', () => {
    beforeEach(async () => {
      renderWithStores(<FactPanel />);
      await screen.findByText(FACT_OF_THE_DAY.text);
    });

    it('should render the fact', () => {
      expect(screen.getByText(FACT_OF_THE_DAY.text)).toBeInTheDocument();
    });

    it('should not render the loading text', () => {
      expect(screen.queryByText(loading)).not.toBeInTheDocument();
    });

    it('should not render the failure text', () => {
      expect(screen.queryByText(failed)).not.toBeInTheDocument();
    });

    it('should offer another fact', () => {
      expect(button(another)).toHaveAttribute('aria-disabled', 'false');
    });

    it('should not offer to try again', () => {
      expect(screen.queryByRole('button', { name: retry })).not.toBeInTheDocument();
    });
  });

  describe('when the fact of the day cannot be loaded', () => {
    beforeEach(async () => {
      renderWithStores(<FactPanel />, {
        factService: { ...createFactServiceStub(), today: refused },
      });
      await screen.findByText(failed);
    });

    it('should render the failure text', () => {
      expect(screen.getByText(failed)).toBeInTheDocument();
    });

    it('should not render the loading text', () => {
      expect(screen.queryByText(loading)).not.toBeInTheDocument();
    });

    it('should offer to try again', () => {
      expect(button(retry)).toHaveAttribute('aria-disabled', 'false');
    });

    it('should not offer another fact', () => {
      expect(screen.queryByRole('button', { name: another })).not.toBeInTheDocument();
    });

    it('should render a fact when trying again works', async () => {
      fireEvent.click(button(retry));

      expect(await screen.findByText(RANDOM_FACT.text, { selector: 'p' })).toBeInTheDocument();
    });

    it('should offer another fact once trying again has worked', async () => {
      fireEvent.click(button(retry));

      expect(await screen.findByRole('button', { name: another })).toBeInTheDocument();
    });
  });

  describe('when another fact is asked for', () => {
    beforeEach(async () => {
      renderWithStores(<FactPanel />);
      await screen.findByText(FACT_OF_THE_DAY.text);
      fireEvent.click(button(another));
    });

    it('should render the new fact', async () => {
      expect(await screen.findByText(RANDOM_FACT.text, { selector: 'p' })).toBeInTheDocument();
    });

    it('should not render the fact of the day any more', async () => {
      await waitFor(() => expect(screen.queryByText(FACT_OF_THE_DAY.text)).not.toBeInTheDocument());
    });

    it('should announce the new fact', async () => {
      expect(
        await screen.findByText(RANDOM_FACT.text, { selector: '[aria-live]' }),
      ).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('while another fact is on its way', () => {
    beforeEach(async () => {
      renderWithStores(<FactPanel />, {
        factService: { ...createFactServiceStub(), random: unanswered },
      });
      await screen.findByText(FACT_OF_THE_DAY.text);
      fireEvent.click(button(another));
    });

    it('should keep rendering the previous fact', () => {
      expect(screen.getByText(FACT_OF_THE_DAY.text)).toBeInTheDocument();
    });

    it('should not render the loading text', () => {
      expect(screen.queryByText(loading)).not.toBeInTheDocument();
    });

    it('should mark the button as unavailable', () => {
      expect(button(another)).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('when another fact cannot be loaded', () => {
    beforeEach(async () => {
      renderWithStores(<FactPanel />, {
        factService: { ...createFactServiceStub(), random: refused },
      });
      await screen.findByText(FACT_OF_THE_DAY.text);
      fireEvent.click(button(another));
      await screen.findByText(failed, { selector: 'p' });
    });

    it('should render the failure text in place of the previous fact', () => {
      expect(screen.queryByText(FACT_OF_THE_DAY.text)).not.toBeInTheDocument();
    });

    it('should offer to try again', () => {
      expect(button(retry)).toBeInTheDocument();
    });

    it('should announce the failure', async () => {
      expect(await screen.findByText(failed, { selector: '[aria-live]' })).toHaveAttribute(
        'aria-live',
        'polite',
      );
    });
  });

  describe('with a fact that is already loaded', () => {
    let requests: number;

    beforeEach(() => {
      requests = 0;
      const service: FactService = {
        ...createFactServiceStub(),
        today: () => {
          requests += 1;
          return Promise.resolve(FACT_OF_THE_DAY);
        },
      };
      renderWithStores(<FactPanel />, {
        factService: service,
        factState: { fact: RANDOM_FACT, status: 'loaded' },
      });
    });

    it('should render that fact', () => {
      expect(screen.getByText(RANDOM_FACT.text)).toBeInTheDocument();
    });

    it('should not ask for the fact of the day', () => {
      expect(requests).toBe(0);
    });
  });
});
