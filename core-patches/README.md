# BB core integration

Base repository: https://github.com/get-bb/bb
Base commit: `d5f04df266cbac8983a0e9d3518fc6740e048471` (SDK source 0.4.94).

**Optional.** Ultra Launcher works on stock BB without it: the dialog hides the
composer's model button, renders its own presets menu, and seeds the composer
with the chosen preset. The only thing this patch buys is avoiding the host's
re-seed behaviour (changing a seed also resets the project/environment pickers).

This patch is not installed in the running BB application. It adds
`NewThreadComposerProps.experimental_ModelPicker`, a component override that
receives live host catalog/state and guarded selection callbacks. Rendering
failures fall back to the native picker.

Apply to a BB source checkout at the base commit:

```sh
git apply --check /path/to/new-thread-model-picker.patch
git apply /path/to/new-thread-model-picker.patch
pnpm install --frozen-lockfile
pnpm exec turbo run typecheck --filter=@bb/app
pnpm exec turbo run typecheck --filter=@get-bb/plugin-sdk
pnpm exec turbo run test --filter=@bb/app -- ExecutionControls.custom-picker PluginNewThreadComposer
```

Then run/build that BB checkout using its development instructions and install
this Ultra Launcher plugin into that instance. Applying source files alone does
not update an installed desktop app. Do not patch generated app bundles.

For general distribution, land this API in a BB release first, pin the published
SDK, and record that BB version in the plugin compatibility documentation.

## Preset application

The renderer receives `onPresetSelect` for an entire provider/model/reasoning/
service-tier combination. BB fetches the routed catalog before changing state,
rejects unavailable combinations, blocks submission while loading, and preserves
the draft/environment/permissions. The plugin owns preset storage and settings.

## Verified locally

- 53 focused BB tests: 50 composer tests and 3 custom-picker boundary tests.
- 10 plugin tests: presets-only rendering, full-combination application, errors,
  keyboard navigation, settings save/cancel/conflicts, storage concurrency,
  validation and reordering.
- Plugin TypeScript, BB app/SDK typechecks, plugin build and preview build.
- Reloaded Ultra Launcher 0.2.0-preview.2 into stock BB; the preset-list CLI returns
  the initial empty preset state. Settings are registered on that version.

Verified on stock BB (no patch) at 0.2.0-preview.3, driving the real app at
127.0.0.1:38886: presets created from the settings section, the Cmd+N dialog
shows the presets menu with the host model button hidden, selecting a preset
updates the host composer (`Codex: 5.6-Sol · Max reasoning` →
`Codex: 6-Astra · High reasoning`), and the choice is remembered across opens.
Desktop-app and mobile layouts remain unverified.
