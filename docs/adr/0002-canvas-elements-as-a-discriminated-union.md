# ADR 0002: Canvas elements are a discriminated union

- **Status:** Accepted
- **Date:** 2026-10-05
- **Scope:** [`canvas-element.ts`](../../src/app/features/builder/models/canvas-element.ts) and everything that reads or creates a canvas element

## Context

A canvas element is one instance the user has dropped on the canvas. Until this decision, every element had the same shape whatever its type:

```ts
export interface CanvasElement {
  uid: string;
  type: ElementType; // 'div' | 'span' | 'text-input' | 'textfield' | 'datepicker' | 'dropdown'
  paletteUid: string;
  text: string;
  options?: DropdownOption[];
  row: number;
  column: number;
}
```

That was adequate for `div` and `span`. Adding form elements exposed three problems:

- **Fields existed where they meant nothing.** Datepickers and dropdowns were stored with the text "enter text", which neither renders.
- **Fields were absent where they mattered.** A new dropdown had `options` undefined, so readers had to treat "no list" and "empty list" as separate cases.
- **The model did not say which type has which field.** That rule was kept outside it, in a hand-maintained set of "textless" types in the component. `updateText` on a datepicker and `updateOptions` on a span both type-checked and both succeeded.

More element types with their own properties are expected, so each new one would have widened the flat shape further.

## Decision

`CanvasElement` is a union of interfaces. Each interface extends a shared base and names the element types it covers, so `type` is the discriminant:

```ts
interface BaseCanvasElement<T extends ElementType> {
  uid: string;
  type: T;
  paletteUid: string;
  row: number;
  column: number;
}

export interface TextCanvasElement extends BaseCanvasElement<'div' | 'span'> {
  text: string;
}

export interface TextControlCanvasElement extends BaseCanvasElement<'text-input' | 'textfield'> {
  text: string; // the placeholder
  value: string; // what the user typed
}

export interface DatepickerCanvasElement extends BaseCanvasElement<'datepicker'> {
  value: string;
}

export interface DropdownCanvasElement extends BaseCanvasElement<'dropdown'> {
  options: DropdownOption[];
  value: string; // value of the selected option
}

export type CanvasElement =
  | TextCanvasElement
  | TextControlCanvasElement
  | DatepickerCanvasElement
  | DropdownCanvasElement;
```

`DropdownOption` is part of this model and lives next to it, in [`dropdown-option.ts`](../../src/app/features/builder/models/dropdown-option.ts).

The rules that go with it:

1. **The base is not exported.** Code outside the model file uses `CanvasElement` or one of the concrete interfaces.
2. **An interface is grouped by fields, not by type.** `div` and `span` share `TextCanvasElement`, and `text-input` and `textfield` share `TextControlCanvasElement`, because each pair carries the same data. A type gets its own interface when its fields differ.
3. **Type-specific fields are required.** A dropdown always has an `options` array, which starts empty. Every form control always has a `value`, which starts as the empty string. What the user enters in a control is state, not DOM: a control is recreated whenever its element changes cell, and only state survives that.
4. **Elements are created in one place.** `createElement` in [`builder-store.ts`](../../src/app/features/builder/state/builder-store.ts) switches on the type and returns the right shape. It has no `default` branch, so a type without a case fails to compile.
5. **Code narrows before using a type-specific field**, with `element.type === 'dropdown'`, `'text' in element` or `'value' in element`.
6. **Store updates ignore elements of the wrong kind.** `updateText` changes only elements that have text; `updateValue` changes only elements that have a value; `updateOptions` changes only dropdowns.
7. **A component that edits one kind takes the narrowed element.** In [`dropped-element.tsx`](../../src/app/features/builder/dropped-element/dropped-element.tsx), `EditTextDialog` takes a `TextCanvasElement | TextControlCanvasElement` and `EditOptionsDialog` a `DropdownCanvasElement`, so neither can be rendered for the wrong kind.
8. **The component narrows with a `switch` and checks exhaustiveness.** `ElementBody` in [`dropped-element.tsx`](../../src/app/features/builder/dropped-element/dropped-element.tsx) switches on `element.type`, returns the markup of each type from its own `case`, and ends with `default: return assertNever(element);`.

### Adding an element type

1. Add the name to `ElementType` in [`palette-item.ts`](../../src/app/features/builder/models/palette-item.ts).
2. Add an interface extending `BaseCanvasElement<'new-type'>`, or add the name to an existing interface that has the same fields. List a new interface in the `CanvasElement` union.
3. Fix what the compiler reports: the `ELEMENT_LABELS` and `OUTLINE` records, the `createElement` switch, and the `switch` in `ElementBody`.
4. Add the palette entry to the store's initial state, and to the list the store spec expects. Nothing flags a missing entry: the type simply cannot be dragged onto the canvas.

## Consequences

**Benefits**

- An element holds only the fields its type uses, which is also the shape that would be saved once the canvas is persisted.
- Misuse is a compile error: reading `options` on a non-dropdown, rendering `EditTextDialog` for a datepicker, or adding a type without handling it.
- The "which types have text" rule is the model itself. The separate set of textless types is gone.

**Costs and things to know**

- **Element types are named in two places**, `ElementType` and the interfaces. The compiler keeps them in step, but both must be edited.
- **Reading a type-specific field takes a narrowing step** that the flat shape did not need.
- **Narrowing is repeated wherever the kind matters.** The "Edit text" menu item is rendered only when `'text' in element`, and the dialog it opens narrows again before it renders, because which dialog is open and what kind the element is are separate facts to the compiler.
- **The exhaustiveness check must be handed the element, not its type.** After the last `case`, `element` itself has narrowed to `never`, which is what `assertNever(element)` accepts. It also throws at run time, for an element that reached the component without passing the type checker.
- **Test fixtures must be built per kind.** `{ ...div, type: 'dropdown', options }` compiles, because spreading skips excess-property checks, but the object still carries `text` at runtime and `'text' in element` is then true for a dropdown.
- **Creating an element is a switch rather than one object literal.**

## Alternatives considered

- **Keep the flat interface and add optional fields.** Rejected for the three problems described in Context, which grow with each new type.
- **One interface per element type.** Rejected: `div` and `span` would be two identical interfaces, as would `text-input` and `textfield`. Grouping by fields keeps the union short, and a type can be split out later without touching the others.
- **Derive `ElementType` from the union (`CanvasElement['type']`).** This would leave one place to name a type. Not done because `ElementType` is defined with the palette model, which the element model imports; reversing that dependency was not worth it at this size.
- **A generic `props` bag per element.** Rejected: it moves the type-specific fields out of sight of the type checker, which is the problem this decision solves.
