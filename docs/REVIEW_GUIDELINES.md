# Review Guidelines

Use this checklist before adding or updating a marketplace plugin in this repository.

## Manifest review

- `id`, `version`, `kind`, `scope`, `displayName`, and `description` are present
- `compatibility.versionRange` matches tested Cerebr versions
- permissions are minimal and resource-scoped unless there is a compatibility reason not to be
- `activationEvents` are narrow and intentional
- `background` packages set `requiresExtension: true`
- `install.packageUrl` points at a versioned `plugin.json`

## Contribution review

- declarative packages use the smallest contribution surface that solves the problem
- `promptFragments` and `requestPolicies` are scoped correctly
- page-only contributions stay in `scope = "page"`
- shell-only contributions stay in `scope = "shell"`
- shell execute actions are safe and predictable

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

## Third-party upstream plugins

- vendor reviewed third-party packages into this repository; do not point the official registry at an unreviewed user repository or release asset
- keep the plugin id stable if the package has already shipped via sideload and you want marketplace install to take over the same stored package/settings
- record the upstream repository and tracked tag in `plugins/<plugin-id>/UPSTREAM.json`
- use `npm run check:upstream` or `.github/workflows/upstream-check.yml` to detect newer upstream tags
- upstream checks are alert-only; new upstream tags still require a manual review before they are vendored here
