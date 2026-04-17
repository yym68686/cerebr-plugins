# Submit A Plugin

This repository is curated. Plugins are added by review, not by automatic self-service publishing.

## Expected submission contents

- plugin goal and user value
- supported scope: `page`, `shell`, `prompt`, or `background`
- requested permissions and why each one is needed
- activation strategy and why those `activationEvents` are appropriate
- compatibility range
- installable package folder
- screenshots or a short demo for UI-affecting plugins

## Current preferred package baseline

- `schemaVersion = 2`
- explicit `activationEvents`
- resource-scoped permissions such as `page:selection:read`, `shell:input:write`, or `bridge:send:shell`
- declarative packages use `contributions` when possible
- remote script packages are self-contained

## Acceptance bar

- clear user value
- limited and defensible permissions
- bounded activation and runtime behavior
- no dependency on private host internals
- script packages are self-contained
- package passes `npm run check`

## Recommended starting point

Start from the separate `cerebr-plugin-template` repository, then prepare a reviewed package for this repository once the plugin is ready.
