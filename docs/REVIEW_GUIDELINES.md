# Review Guidelines

Use this checklist before adding or updating a marketplace plugin in this repository.

## Manifest review

- `id`, `version`, `kind`, `scope`, `displayName`, and `description` are present
- `compatibility.versionRange` matches tested Cerebr versions
- permissions are minimal
- `background` packages set `requiresExtension: true`
- `install.packageUrl` points at a versioned `plugin.json`

## Runtime review

- plugin does not depend on private or unstable host DOM internals
- hooks are bounded and should complete within the host timeout budget
- failure mode is safe
- UI plugins clean up mounted elements and watchers
- request-modifying plugins are narrow and intentional

## Packaging review

- remote script plugins are self-contained
- script entry and local imports stay within this repository origin
- package files are versioned under `plugins/<plugin-id>/<version>/`
- `plugin-registry.json` points to the latest reviewed version

## Release review

- run `npm run check`
- verify GitHub Pages will expose `plugin-registry.json` and package files
- if a plugin is being disabled, set `availability.status = "disabled"` and include a reason
