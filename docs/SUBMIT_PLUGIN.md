# Submit A Plugin

This repository is curated. Plugins are added by review, not by automatic self-service publishing.

## Expected submission contents

- plugin goal and user value
- supported scope: `page`, `shell`, `prompt`, or `background`
- requested permissions and why each one is needed
- compatibility range
- installable package folder
- screenshots or a short demo for UI-affecting plugins

## Acceptance bar

- clear user value
- limited and defensible permissions
- stable behavior under current Cerebr runtime
- no dependency on private host internals
- script plugins must be self-contained
- package passes `npm run check`

## Recommended starting point

Start from the separate `cerebr-plugin-template` repository, then prepare a reviewed package for this repository once the plugin is ready.
