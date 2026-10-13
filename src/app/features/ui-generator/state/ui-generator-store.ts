import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, StoreApi } from 'zustand/vanilla';
import { Announce } from '../../../shared/announcer/announcer';
import { GeneratedElement } from '../../builder/models/generated-element';
import { UiGeneratorError, UiGeneratorService } from '../services/ui-generator-service';

export type UiGeneratorStatus = 'idle' | 'generating' | 'error';

export interface UiGeneratorState {
  status: UiGeneratorStatus;
  error: string | null;
}

export interface UiGeneratorActions {
  generate(text: string): Promise<GeneratedElement[] | null>;
}

export type UiGeneratorStore = StoreApi<UiGeneratorState & UiGeneratorActions>;

export const GENERATE_FAILED = 'Could not generate a UI.';
export const NOTHING_GENERATED = 'That description did not produce any elements.';

export function createUiGeneratorStore({
  announce,
  service,
  initial,
}: {
  announce: Announce;
  service: UiGeneratorService;
  initial?: Partial<UiGeneratorState>;
}): UiGeneratorStore {
  return createStore<UiGeneratorState & UiGeneratorActions>()((set, get) => ({
    status: 'idle',
    error: null,
    ...initial,
    async generate(text) {
      const description = text.trim();
      if (get().status === 'generating' || description === '') {
        return null;
      }
      set({ status: 'generating', error: null });
      const fail = (error: string): null => {
        set({ status: 'error', error });
        announce(error);
        return null;
      };
      try {
        const elements = await service.generate(description);
        // An empty answer is reported, not returned: loading it would only empty the canvas.
        if (elements.length === 0) {
          return fail(NOTHING_GENERATED);
        }
        set({ status: 'idle' });
        return elements;
      } catch (failure) {
        return fail(failure instanceof UiGeneratorError ? failure.message : GENERATE_FAILED);
      }
    },
  }));
}

export const UiGeneratorStoreContext = createContext<UiGeneratorStore | null>(null);

export function useUiGeneratorStore<T>(
  selector: (state: UiGeneratorState & UiGeneratorActions) => T,
): T {
  const store = useContext(UiGeneratorStoreContext);
  if (!store) {
    throw new Error('useUiGeneratorStore needs a <UiGeneratorStoreContext> provider above it.');
  }
  return useStore(store, selector);
}
