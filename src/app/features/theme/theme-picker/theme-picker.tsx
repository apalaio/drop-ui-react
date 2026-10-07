import { Menu } from '@base-ui/react/menu';
import { useRef } from 'react';
import { THEMES, useThemeStore } from '../state/theme-store';

const CURRENT_THEME_ID = 'theme-picker-current';

function Swatch() {
  return (
    <>
      <span className="size-1 rounded-full bg-base-content" />
      <span className="size-1 rounded-full bg-primary" />
      <span className="size-1 rounded-full bg-secondary" />
      <span className="size-1 rounded-full bg-accent" />
    </>
  );
}

export function ThemePicker({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const loadAllThemes = useThemeStore((state) => state.loadAllThemes);
  const checkedItem = useRef<HTMLElement | null>(null);

  return (
    <div className={className}>
      <Menu.Root
        modal={false}
        onOpenChange={(open) => {
          if (open) {
            loadAllThemes();
          }
        }}
        onOpenChangeComplete={(open) => {
          if (open) {
            checkedItem.current?.focus();
          }
        }}
      >
        <Menu.Trigger
          className="btn btn-ghost btn-sm gap-1.5 px-1.5"
          aria-label="Change theme"
          aria-describedby={CURRENT_THEME_ID}
        >
          <span
            className="grid shrink-0 grid-cols-2 gap-0.5 rounded-md border border-base-content/10 bg-base-100 p-1"
            aria-hidden="true"
          >
            <Swatch />
          </span>
          Theme
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 2048 2048"
            className="size-2 fill-current opacity-60"
            aria-hidden="true"
          >
            <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z" />
          </svg>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner align="start" className="z-50">
            {/* Base UI names the popup after its trigger, and aria-labelledby would win over the label. */}
            <Menu.Popup
              className="max-h-96 w-56 overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-md outline-none"
              aria-label="Themes"
              aria-labelledby={undefined}
            >
              <Menu.RadioGroup
                render={<ul />}
                className="menu w-full flex-nowrap p-1"
                value={theme}
                onValueChange={(picked: string) => setTheme(picked)}
              >
                {THEMES.map((name) => (
                  <li key={name} role="none">
                    {/* The label keeps typeahead on the theme name, whatever else the row renders. */}
                    <Menu.RadioItem
                      ref={name === theme ? checkedItem : undefined}
                      className="gap-3 px-2"
                      value={name}
                      label={name}
                      closeOnClick
                    >
                      <span
                        className="grid shrink-0 grid-cols-2 gap-0.5 rounded-md bg-base-100 p-1 shadow-sm"
                        aria-hidden="true"
                        data-theme={name}
                      >
                        <Swatch />
                      </span>
                      <span className="truncate">{name}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className={`size-3 shrink-0${name === theme ? '' : ' invisible'}`}
                        aria-hidden="true"
                      >
                        <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z" />
                      </svg>
                    </Menu.RadioItem>
                  </li>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <span id={CURRENT_THEME_ID} hidden>
        Current theme: {theme}
      </span>
    </div>
  );
}
