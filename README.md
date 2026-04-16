# cerebr-plugins

Curated plugin registry for Cerebr.

This repository is intended to back the Cerebr marketplace with reviewed plugin packages that can be fetched and installed from a remote registry.

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

- Host reviewed marketplace plugins
- Publish a stable `plugin-registry.json`
- Keep plugin packages versioned
- Give Cerebr a remote source that can be updated without shipping a full app release

## What this repository is not for

- Unreviewed arbitrary third-party remote code
- Developer-mode local sideloading
- Built-in plugins that only live inside the main Cerebr repository

## GitHub Pages

Serve this repository with GitHub Pages from the branch root.

Expected registry URL:

```text
https://yym68686.github.io/cerebr-plugins/plugin-registry.json
```

The current Cerebr marketplace code is configured to use that URL as the curated remote registry, with a bundled local fallback.

## Important packaging rule for script plugins

Remote marketplace script packages must be self-contained.

Do not import Cerebr host internals using relative paths into the main Cerebr repository, because remote packages are loaded from this repository's origin, not from the Cerebr app origin.

If you need a helper such as `definePlugin`, bundle it locally inside this repository or inside the plugin package itself. The shared helper for reviewed script plugins lives at [runtime/define-plugin.js](./runtime/define-plugin.js).

## Development

```bash
npm run check
```

That command validates:

- `plugin-registry.json`
- every referenced `plugin.json`
- package existence for every `install.packageUrl`
- basic script entry existence for script plugins

## Related repositories

- Main app: `Cerebr`
- Starter template: `cerebr-plugin-template`

## Current reviewed plugins

- `official.prompt.concise-reply`
- `official.prompt.translation-tone`
- `official.page.explain-selection`
- `official.shell.reasoning-retry`
- `official.page.article-focus`
