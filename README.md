# cerebr-plugins

Curated plugin registry for Cerebr.

This repository is the source of truth for the official reviewed marketplace registry and reviewed plugin packages.

## Repository layout

```text
cerebr-plugins/
  plugin-registry.json
  plugins/<plugin-id>/<version>/plugin.json
  plugins/<plugin-id>/<version>/*.js
  runtime/
  docs/
  schemas/
  scripts/
```

## What this repository is for

- host reviewed marketplace plugins
- publish a stable `plugin-registry.json`
- keep plugin packages versioned
- give Cerebr a remote source that can update without shipping a full app release

## Runtime contract baseline

The current reviewed package baseline is the refactored plugin runtime:

- manifest `schemaVersion = 1` and `schemaVersion = 2` are accepted
- new packages should prefer `schemaVersion = 2`
- declarative packages should prefer `contributions`
- reviewed packages should declare explicit `activationEvents`
- registry entries may include `activationEvents` and `contributionTypes`

## Packaging rule for script plugins

Remote marketplace script packages must be self-contained.

Do not import Cerebr host internals using relative paths into the main Cerebr repository. If you need a helper such as `definePlugin`, bundle it locally inside the package or use [runtime/define-plugin.js](./runtime/define-plugin.js).

## Development

```bash
npm run check
```

That command validates:

- `plugin-registry.json`
- every referenced `plugin.json`
- package existence for every `install.packageUrl`
- registry/package id and version alignment
- v2 activation/contribution metadata

## Sync bundled fallback into the main app repo

After updating the official registry or any reviewed plugin package here, sync the bundled fallback snapshot in the main Cerebr repository:

```bash
npm run sync:cerebr
```

That mirrors these paths into `../cerebr/statics/`:

- `plugin-registry.json`
- `plugins/**`
- `runtime/**`

## Related repositories

- main app: `Cerebr`
- starter template: `cerebr-plugin-template`
