# KWin Compose

KDE Plasma 6 KWin script for snapping individual windows to a shared grid.

## Runtime behavior

| Event | Operation |
| --- | --- |
| New window | Snap position and size |
| Move finished | Snap position only |
| Resize finished | Snap changed edges |
| Script enabled | Track existing windows without modifying them |

KWin maximization and edge tiling override grid snapping. Moving a window
outside the work area is allowed. The script does not modify other windows,
focus, stacking order, output, or virtual desktop.

Dialogs, popups, special windows, panels, notifications, hidden, minimized,
maximized, full-screen, deleted, and invalid windows are excluded.

## Geometry

- Base area: `KWin.MaximizeArea` for the window output and desktop.
- Default grid step: 40 logical units.
- Default padding: 20 logical units on each side.
- Floating Breeze panel inset: 8 logical units before bottom padding.
- Window constraints: `moveable`, `resizeable`, `minSize`, and `maxSize`.

Application constraints override exact grid alignment and work-area
containment. The grid is deterministic and idempotent.

## Modules

- `src/config.js`: defaults, limits, timing.
- `src/grid.js`: KWin-independent geometry and snapping.
- `src/kwin-adapter.js`: KWin API, signals, geometry, constraints, readiness.
- `src/main.js`: event controller and window lifecycle.
- `scripts/kwin-entry.js`: KWin bootstrap, Qt timers, configuration.
- `scripts/build.mjs`: bundle and `.kwinscript` package generation.

The runtime is signal-driven and uses bounded readiness timers. Generated files
under `package/contents/` and `dist/` must not be edited.

## Build and test

Requires Node.js 20 or newer.

```sh
npm install
npm run format
npm run check
npm test
npm run build
```

Build outputs:

- `package/contents/code/main.js`
- `dist/kwin-compose.kwinscript`

Node tests cover geometry, the controller, and the KWin adapter.
`tests/qt-smoke.qml` checks Qt JavaScript compatibility. Plasma integration
requires manual Wayland and XWayland testing.

## Install

```sh
kpackagetool6 --type KWin/Script --install dist/kwin-compose.kwinscript
```

Upgrade an installed package:

```sh
kpackagetool6 --type KWin/Script --upgrade dist/kwin-compose.kwinscript
```

Enable **Compose** under **System Settings → Window Management → KWin Scripts**.
Disable and re-enable the script after changing configuration.

Remove the package:

```sh
kpackagetool6 --type KWin/Script --remove kwin-compose
```

## Configuration

KWin reads values from `[Script-kwin-compose]` in `kwinrc`.

| Key | Default |
| --- | ---: |
| `DesiredStep` | `40` |
| `PaddingLeft` | `20` |
| `PaddingRight` | `20` |
| `PaddingTop` | `20` |
| `PaddingBottom` | `20` |
| `FloatingPanelInset` | `8` |

```sh
kwriteconfig6 --file kwinrc --group Script-kwin-compose --key DesiredStep 40
```

- [KWin Scripting API](https://develop.kde.org/docs/plasma/kwin/api/)
- [KWin Window API](https://api.kde.org/qml-org-kde-kwin-window.html)
