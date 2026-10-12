# Ultra Launcher

A keyboard-first thread launcher for [BB](https://getbb.app). Open a composer
from any screen, choose a saved model preset, and start a thread without losing
your place.

## Install

```sh
bb plugin install https://github.com/dillionverma/bb-plugin-ultra-launcher
```

Requires BB 0.46+ and Plugin SDK 0.4.87+. No BB patches required.

## Use

Press **Cmd/Ctrl+N**, choose a project and preset, and write your prompt.

- **Enter** creates a thread and opens it.
- **Cmd/Ctrl+Enter** creates a thread in the background, with an Open action in the notification.
- **Shift+Enter** inserts a newline.
- **Escape** closes the launcher and keeps your draft.

You can also open **Ultra Launcher: new thread** from BB's command palette.
On compact screens, the launcher becomes a bottom sheet.

## Settings

In **Settings → Plugins → Ultra Launcher**, manage presets and the
**Take over Ctrl/Cmd+N** setting. The launcher also offers preset editing,
renaming, deletion, and drag reordering. Save up to 30 combinations of provider,
model, reasoning level, and service tier. The last selected preset is remembered
across windows. New installations receive presets from available providers.

Hotkey takeover moves BB's New thread shortcut to Cmd/Ctrl+Shift+O. Turning it
off restores the default if the plugin still owns that binding. User overrides
are preserved. Release the shortcut before uninstalling with
`bb ultra-launcher release`.

```sh
bb ultra-launcher status
bb ultra-launcher presets
bb ultra-launcher claim
bb ultra-launcher release
bb ultra-launcher restore-defaults
```

`restore-defaults` replaces your saved presets. Switching presets can reset
project and environment choices because BB re-seeds its composer; choose the
preset before changing those fields.

## Development

```sh
npm ci
npm test
npm run typecheck
bb plugin build
bb plugin install .
bb plugin dev
```

`npm run preview` shows the preset controls with sample catalogs. Build first
to generate the styles. Verify thread creation in BB, since the preview does
not create threads.

MIT. See [LICENSE](LICENSE).
