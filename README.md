# Ultra Launcher

From thought to running agent. A keyboard-first launcher for BB.

A plugin for [BB](https://getbb.app).

## Highlights

- **Cmd/Ctrl+N.** Open a floating composer without leaving your current thread.
- **Choose a preset.** Save provider, model, reasoning, and service-tier combinations in your preferred order.
- **Keep moving.** Enter creates and opens a thread; Cmd/Ctrl+Enter creates it in the background.
- **Make it yours.** Edit, reorder, and restore model presets from the launcher or plugin settings.

## Install

```sh
bb plugin install https://github.com/dillionverma/bb-plugin-ultra-launcher
```

Requires BB 0.43+ and a compatible Plugin SDK (see `package.json`).

## Use

Press **Cmd/Ctrl+N**, select a project and preset, and write your prompt.

`bb quick-thread status` checks shortcut ownership. `bb quick-thread presets` lists saved presets. The optional host model-picker patch is documented in [core-patches](core-patches/README.md).

## Designed to stay responsive

The composer is mounted when needed rather than eagerly at startup. Saved presets keep frequent model choices close. No latency benchmark is claimed.

## Development

```sh
npm ci
npm run typecheck
npm test
bb plugin build .
```

Focused fixes and reproducible bug reports are welcome. Include BB version, platform, and steps to reproduce.

## Compatibility

The repository and display name are independent of BB’s persistent plugin identity. The internal ID remains `quick-thread` so existing settings, stored data, CLI commands, and integrations continue to work.

## The Ultra suite

Built for getting work done across multiple threads, agents, and projects. Install only the pieces you need.

- [Ultra Sidebar](https://github.com/dillionverma/bb-plugin-ultra-sidebar) — Organize parallel work.
- [Ultra Topbar](https://github.com/dillionverma/bb-plugin-ultra-topbar) — Turn threads into pull requests.
- [Linear Panel](https://github.com/dillionverma/bb-plugin-linear-panel) — Keep issues beside execution.
- [Usage Window](https://github.com/dillionverma/bb-plugin-usage-window) — Keep account capacity in view.

## Credits

Based on [Quick Thread by marospekarik](https://github.com/marospekarik/bb-plugin-quick-thread), with a redesigned composer and model presets. Original MIT notice is preserved in LICENSE.

## License

MIT. See [LICENSE](LICENSE).
