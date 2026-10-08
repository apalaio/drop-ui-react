import { Announce } from '../../../shared/announcer/announcer';
import { Fact } from '../models/fact';
import { FactService } from '../services/fact-service';
import { createFactStore, FactState, FactStore, LOAD_FAILED } from './fact-store';

describe('FactStore', () => {
  const today: Fact = { id: 'today', text: 'Honey never spoils.' };
  const random: Fact = { id: 'random', text: 'Bananas are berries.' };
  const failure = new Error('offline');

  let announce: ReturnType<typeof vi.fn<Announce>>;
  let service: {
    today: ReturnType<typeof vi.fn<FactService['today']>>;
    random: ReturnType<typeof vi.fn<FactService['random']>>;
  };

  function createStore(initial?: Partial<FactState>): FactStore {
    return createFactStore({ announce, service, initial });
  }

  function unanswered(): Promise<Fact> {
    return new Promise(() => undefined);
  }

  beforeEach(() => {
    announce = vi.fn<Announce>();
    service = {
      today: vi.fn<FactService['today']>().mockResolvedValue(today),
      random: vi.fn<FactService['random']>().mockResolvedValue(random),
    };
  });

  describe('at the start', () => {
    it('has no fact', () => {
      const store = createStore();

      expect(store.getState().fact).toBeNull();
    });

    it('is idle', () => {
      const store = createStore();

      expect(store.getState().status).toBe('idle');
    });

    it('asks the service for nothing', () => {
      createStore();

      expect(service.today).not.toHaveBeenCalled();
      expect(service.random).not.toHaveBeenCalled();
    });

    it('announces nothing', () => {
      createStore();

      expect(announce).not.toHaveBeenCalled();
    });

    it('takes the state it is given', () => {
      const store = createStore({ fact: random, status: 'loaded' });

      expect(store.getState().fact).toBe(random);
      expect(store.getState().status).toBe('loaded');
    });
  });

  describe('loadToday', () => {
    it('is loading while the fact is on its way', () => {
      service.today.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().loadToday();

      expect(store.getState().status).toBe('loading');
    });

    it('has no fact while the first one is on its way', () => {
      service.today.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().loadToday();

      expect(store.getState().fact).toBeNull();
    });

    it('holds the fact of the day once it has arrived', async () => {
      const store = createStore();

      await store.getState().loadToday();

      expect(store.getState().fact).toBe(today);
    });

    it('is loaded once the fact has arrived', async () => {
      const store = createStore();

      await store.getState().loadToday();

      expect(store.getState().status).toBe('loaded');
    });

    it('asks once however often it is called while loading', () => {
      service.today.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().loadToday();
      void store.getState().loadToday();

      expect(service.today).toHaveBeenCalledTimes(1);
    });

    it('does not ask again once a fact has arrived', async () => {
      const store = createStore();
      await store.getState().loadToday();

      await store.getState().loadToday();

      expect(service.today).toHaveBeenCalledTimes(1);
    });

    it('does not ask while another fact is on its way', () => {
      service.random.mockReturnValue(unanswered());
      const store = createStore();
      void store.getState().loadRandom();

      void store.getState().loadToday();

      expect(service.today).not.toHaveBeenCalled();
    });

    it('leaves a fact that is already there alone', async () => {
      const store = createStore({ fact: random, status: 'loaded' });

      await store.getState().loadToday();

      expect(store.getState().fact).toBe(random);
      expect(service.today).not.toHaveBeenCalled();
    });

    it('reports a fact that could not be loaded', async () => {
      service.today.mockRejectedValue(failure);
      const store = createStore();

      await store.getState().loadToday();

      expect(store.getState().status).toBe('error');
      expect(store.getState().fact).toBeNull();
    });

    it('does not ask again after a failure', async () => {
      service.today.mockRejectedValue(failure);
      const store = createStore();
      await store.getState().loadToday();

      await store.getState().loadToday();

      expect(service.today).toHaveBeenCalledTimes(1);
    });

    it('announces nothing when the fact arrives', async () => {
      const store = createStore();

      await store.getState().loadToday();

      expect(announce).not.toHaveBeenCalled();
    });

    it('announces nothing when the fact could not be loaded', async () => {
      service.today.mockRejectedValue(failure);
      const store = createStore();

      await store.getState().loadToday();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('loadRandom', () => {
    it('is loading while the fact is on its way', () => {
      service.random.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().loadRandom();

      expect(store.getState().status).toBe('loading');
    });

    it('keeps the previous fact while the next one is on its way', async () => {
      service.random.mockReturnValue(unanswered());
      const store = createStore();
      await store.getState().loadToday();

      void store.getState().loadRandom();

      expect(store.getState().fact).toBe(today);
    });

    it('replaces the fact once the next one has arrived', async () => {
      const store = createStore();
      await store.getState().loadToday();

      await store.getState().loadRandom();

      expect(store.getState().fact).toBe(random);
      expect(store.getState().status).toBe('loaded');
    });

    it('announces the fact that arrived', async () => {
      const store = createStore();

      await store.getState().loadRandom();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(random.text);
    });

    it('announces nothing while the fact is on its way', () => {
      service.random.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().loadRandom();

      expect(announce).not.toHaveBeenCalled();
    });

    it('asks once however often it is called while loading', () => {
      service.random.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().loadRandom();
      void store.getState().loadRandom();

      expect(service.random).toHaveBeenCalledTimes(1);
    });

    it('does not ask while the fact of the day is on its way', () => {
      service.today.mockReturnValue(unanswered());
      const store = createStore();
      void store.getState().loadToday();

      void store.getState().loadRandom();

      expect(service.random).not.toHaveBeenCalled();
    });

    it('asks again for every call once the last fact has arrived', async () => {
      const store = createStore();

      await store.getState().loadRandom();
      await store.getState().loadRandom();

      expect(service.random).toHaveBeenCalledTimes(2);
    });

    it('reports a fact that could not be loaded', async () => {
      service.random.mockRejectedValue(failure);
      const store = createStore();

      await store.getState().loadRandom();

      expect(store.getState().status).toBe('error');
    });

    it('keeps the previous fact when the next one could not be loaded', async () => {
      service.random.mockRejectedValue(failure);
      const store = createStore();
      await store.getState().loadToday();

      await store.getState().loadRandom();

      expect(store.getState().fact).toBe(today);
    });

    it('announces that the fact could not be loaded', async () => {
      service.random.mockRejectedValue(failure);
      const store = createStore();

      await store.getState().loadRandom();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(LOAD_FAILED);
    });

    it('loads a fact after a failure', async () => {
      service.today.mockRejectedValue(failure);
      const store = createStore();
      await store.getState().loadToday();

      await store.getState().loadRandom();

      expect(store.getState().fact).toBe(random);
      expect(store.getState().status).toBe('loaded');
    });
  });
});
