import { Menu } from '@base-ui/react/menu';
import { useRef } from 'react';

/*
 * Base UI moves focus into an opened menu on the next animation frame. Until then keys still go to
 * the trigger, where a second Enter closes the menu again and End does nothing. A menu opened from
 * the keyboard therefore gets its first item focused as soon as it has rendered, which is what
 * someone typing ahead (and the end-to-end suite) relies on.
 */
export function useFirstItemFocus() {
  const popup = useRef<HTMLDivElement | null>(null);

  function focusFirstItem(open: boolean, { event }: Menu.Root.ChangeEventDetails): void {
    // A key press, and the click a key press produces, both report a click count of zero.
    if (open && (event as UIEvent).detail === 0) {
      queueMicrotask(() =>
        popup.current
          ?.querySelector<HTMLElement>('[role="menuitem"]')
          ?.focus({ preventScroll: true }),
      );
    }
  }

  return { popup, focusFirstItem };
}
