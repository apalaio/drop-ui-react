import { DropdownOption } from './dropdown-option';

/** An element as the generation endpoint describes it: what a canvas element holds, minus identity and position. */
export type GeneratedElement =
  | { type: 'div' | 'span'; text: string }
  | { type: 'text-input' | 'textfield'; text: string }
  | { type: 'datepicker' }
  | { type: 'dropdown'; options: DropdownOption[] };

export interface GeneratedUi {
  elements: GeneratedElement[];
}
