export type ElementType = 'div' | 'span' | 'text-input' | 'textfield' | 'datepicker' | 'dropdown';

/** What an element type is called wherever it is named to the user: the palette, labels, announcements. */
export const ELEMENT_LABELS: Record<ElementType, string> = {
  div: 'Block text',
  span: 'Inline text',
  'text-input': 'Text input',
  textfield: 'Textfield',
  datepicker: 'Datepicker',
  dropdown: 'Dropdown',
};

export interface PaletteItem {
  /** Unique per item, distinguishes it from every other item in the palette. */
  uid: string;
  type: ElementType;
  label: string;
}
