---
name: ultra-launcher
description: Use when the user asks who owns Cmd+N in BB, wants Ultra Launcher to take over or release the shortcut, wants to list or reset its model presets, or asks how the launcher starts threads.
---

# Ultra Launcher

Ultra Launcher opens a floating new-thread composer with Ctrl/Cmd+N. It keeps
up to 30 model presets, each a provider, model, reasoning level and service
tier.

## Commands

- `bb ultra-launcher status` says whether Ctrl/Cmd+N opens the launcher, and why.
- `bb ultra-launcher claim` takes Ctrl/Cmd+N and moves BB's own New thread
  shortcut to Ctrl/Cmd+Shift+O.
- `bb ultra-launcher release` gives Ctrl/Cmd+N back to BB's New thread. Run it
  before you uninstall the plugin.
- `bb ultra-launcher presets` prints the saved presets as JSON.
- `bb ultra-launcher restore-defaults` replaces the saved presets with defaults
  built from the providers this BB has. It deletes the user's presets, so ask
  first.

If `status` says the user bound BB's New thread to Ctrl/Cmd+N themselves, the
plugin leaves that binding alone. To free the shortcut, run
`bb settings keyboard set thread.new disabled`.

The **Take over Ctrl/Cmd+N** setting under **Settings → Ultra Launcher** does
the same as `claim` and `release`.

## In the launcher

- Enter creates the thread and opens it.
- Ctrl/Cmd+Enter creates it in the background and shows a toast with Open.
- Shift+Enter adds a line, and Esc closes the launcher and keeps the draft.

Switching presets resets the environment choice, so choose the preset first.
