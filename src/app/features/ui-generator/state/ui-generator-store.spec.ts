import { Announce } from '../../../shared/announcer/announcer';
import { GeneratedElement } from '../../builder/models/generated-element';
import { UiGeneratorError, UiGeneratorService } from '../services/ui-generator-service';
import {
  createUiGeneratorStore,
  GENERATE_FAILED,
  NOTHING_GENERATED,
  UiGeneratorState,
  UiGeneratorStore,
} from './ui-generator-store';

describe('UiGeneratorStore', () => {
  const text = 'a signup form with name, birthday and country';
  const elements: GeneratedElement[] = [
    { type: 'text-input', text: 'Your name' },
    { type: 'datepicker' },
  ];
  const reason = 'Describe the UI in at most 2000 characters.';
  const failure = new Error('offline');

  let announce: ReturnType<typeof vi.fn<Announce>>;
  let service: { generate: ReturnType<typeof vi.fn<UiGeneratorService['generate']>> };

  function createStore(initial?: Partial<UiGeneratorState>): UiGeneratorStore {
    return createUiGeneratorStore({ announce, service, initial });
  }

  function unanswered(): Promise<GeneratedElement[]> {
    return new Promise(() => undefined);
  }

  beforeEach(() => {
    announce = vi.fn<Announce>();
    service = {
      generate: vi.fn<UiGeneratorService['generate']>().mockResolvedValue(elements),
    };
  });

  describe('at the start', () => {
    it('is idle', () => {
      const store = createStore();

      expect(store.getState().status).toBe('idle');
    });

    it('has no error', () => {
      const store = createStore();

      expect(store.getState().error).toBeNull();
    });

    it('asks the service for nothing', () => {
      createStore();

      expect(service.generate).not.toHaveBeenCalled();
    });

    it('announces nothing', () => {
      createStore();

      expect(announce).not.toHaveBeenCalled();
    });

    it('takes the state it is given', () => {
      const store = createStore({ status: 'error', error: reason });

      expect(store.getState().status).toBe('error');
      expect(store.getState().error).toBe(reason);
    });
  });

  describe('generate', () => {
    it('asks the service with the text', async () => {
      const store = createStore();

      await store.getState().generate(text);

      expect(service.generate).toHaveBeenCalledTimes(1);
      expect(service.generate).toHaveBeenCalledWith(text);
    });

    it('asks without the blanks around the text', async () => {
      const store = createStore();

      await store.getState().generate(`  ${text}\n`);

      expect(service.generate).toHaveBeenCalledWith(text);
    });

    it('is generating while the elements are on their way', () => {
      service.generate.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().generate(text);

      expect(store.getState().status).toBe('generating');
    });

    it('resolves with the elements once they have arrived', async () => {
      const store = createStore();

      expect(await store.getState().generate(text)).toBe(elements);
    });

    it('is idle again once the elements have arrived', async () => {
      const store = createStore();

      await store.getState().generate(text);

      expect(store.getState().status).toBe('idle');
      expect(store.getState().error).toBeNull();
    });

    it('announces nothing when the elements arrive', async () => {
      const store = createStore();

      await store.getState().generate(text);

      expect(announce).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty text', ''],
      ['a text of blanks', ' \n\t '],
    ])('ignores %s', async (_, blank) => {
      const store = createStore();

      const result = await store.getState().generate(blank);

      expect(result).toBeNull();
      expect(service.generate).not.toHaveBeenCalled();
      expect(store.getState().status).toBe('idle');
    });

    it('keeps an earlier error when it ignores a blank text', async () => {
      const store = createStore({ status: 'error', error: reason });

      await store.getState().generate('');

      expect(store.getState().error).toBe(reason);
    });

    it('asks once however often it is called while generating', () => {
      service.generate.mockReturnValue(unanswered());
      const store = createStore();

      void store.getState().generate(text);
      void store.getState().generate(text);

      expect(service.generate).toHaveBeenCalledTimes(1);
    });

    it('resolves a call made while generating with nothing', async () => {
      service.generate.mockReturnValue(unanswered());
      const store = createStore();
      void store.getState().generate(text);

      expect(await store.getState().generate(text)).toBeNull();
    });

    it('asks again for every call once the last answer has arrived', async () => {
      const store = createStore();

      await store.getState().generate(text);
      await store.getState().generate(text);

      expect(service.generate).toHaveBeenCalledTimes(2);
    });

    describe('when the backend explains its refusal', () => {
      beforeEach(() => {
        service.generate.mockRejectedValue(new UiGeneratorError(reason));
      });

      it('resolves with nothing', async () => {
        const store = createStore();

        expect(await store.getState().generate(text)).toBeNull();
      });

      it('holds the reason as its error', async () => {
        const store = createStore();

        await store.getState().generate(text);

        expect(store.getState().status).toBe('error');
        expect(store.getState().error).toBe(reason);
      });

      it('announces the reason', async () => {
        const store = createStore();

        await store.getState().generate(text);

        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith(reason);
      });
    });

    describe('when the answer has no elements', () => {
      beforeEach(() => {
        service.generate.mockResolvedValue([]);
      });

      it('resolves with nothing', async () => {
        const store = createStore();

        expect(await store.getState().generate(text)).toBeNull();
      });

      it('holds that nothing was generated as its error', async () => {
        const store = createStore();

        await store.getState().generate(text);

        expect(store.getState().status).toBe('error');
        expect(store.getState().error).toBe(NOTHING_GENERATED);
      });

      it('announces that nothing was generated', async () => {
        const store = createStore();

        await store.getState().generate(text);

        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith(NOTHING_GENERATED);
      });
    });

    describe('when the request fails in any other way', () => {
      beforeEach(() => {
        service.generate.mockRejectedValue(failure);
      });

      it('resolves with nothing', async () => {
        const store = createStore();

        expect(await store.getState().generate(text)).toBeNull();
      });

      it('holds a general error and not the technical one', async () => {
        const store = createStore();

        await store.getState().generate(text);

        expect(store.getState().status).toBe('error');
        expect(store.getState().error).toBe(GENERATE_FAILED);
      });

      it('announces the general error', async () => {
        const store = createStore();

        await store.getState().generate(text);

        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith(GENERATE_FAILED);
      });
    });

    describe('after a failure', () => {
      it('drops the error while the next elements are on their way', async () => {
        service.generate.mockRejectedValueOnce(failure).mockReturnValue(unanswered());
        const store = createStore();
        await store.getState().generate(text);

        void store.getState().generate(text);

        expect(store.getState().status).toBe('generating');
        expect(store.getState().error).toBeNull();
      });

      it('generates the next time', async () => {
        service.generate.mockRejectedValueOnce(failure);
        const store = createStore();
        await store.getState().generate(text);

        const result = await store.getState().generate(text);

        expect(result).toBe(elements);
        expect(store.getState().status).toBe('idle');
        expect(store.getState().error).toBeNull();
      });
    });
  });
});
