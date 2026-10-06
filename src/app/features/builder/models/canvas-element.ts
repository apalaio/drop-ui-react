import { DropdownOption } from './dropdown-option';
import { ElementType } from './palette-item';

/** An element instance placed on the canvas. Its position among the elements of its cell is its order in that cell. */
interface BaseCanvasElement<T extends ElementType> {
  /** Unique per dropped instance; dropping the same palette item twice yields two uids. */
  uid: string;
  type: T;
  /** uid of the palette item this element was created from. */
  paletteUid: string;
  row: number;
  column: number;
}

export interface TextCanvasElement extends BaseCanvasElement<'div' | 'span'> {
  text: string;
}

/** `text` is the placeholder; `value` is what the user typed. */
export interface TextControlCanvasElement extends BaseCanvasElement<'text-input' | 'textfield'> {
  text: string;
  value: string;
}

export interface DatepickerCanvasElement extends BaseCanvasElement<'datepicker'> {
  /** `yyyy-mm-dd`, or empty when no date is picked. */
  value: string;
}

export interface DropdownCanvasElement extends BaseCanvasElement<'dropdown'> {
  options: DropdownOption[];
  /** Value of the selected option; empty only while there are no options. */
  value: string;
}

export type CanvasElement =
  | TextCanvasElement
  | TextControlCanvasElement
  | DatepickerCanvasElement
  | DropdownCanvasElement;
