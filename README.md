# Vultus has moved to Warp

The shared agent UI is now part of [Warp](https://github.com/urmzd/warp), alongside the platform, console and Slack app. Active development belongs there. This repository preserves the original source and release history.

| Source | New location |
|--------|--------------|
| UI model, primitives and components | [Warp packages](https://github.com/urmzd/warp/tree/main/packages) |
| Web and Slack renderers and hosts | [Warp packages](https://github.com/urmzd/warp/tree/main/packages) |
| Storybook and Slack fixture bench | [Warp apps](https://github.com/urmzd/warp/tree/main/apps) |
| GitHub Markdown presentation | [Warp presentation](https://github.com/urmzd/warp/tree/main/internal/presentation/github) |

Imports use `@warp/*` instead of `@vultus/*`. Clone Warp and run `pnpm install` at its root; no sibling UI checkout is required.

Read the [migration guide](https://github.com/urmzd/warp/blob/main/docs/renaming.md), [surface guide](https://github.com/urmzd/warp/blob/main/docs/surfaces.md), or [historical Vultus README](https://github.com/urmzd/vultus/blob/b5b333fc9d708d10c0490ca69e6c20152d8d7de6/README.md).
