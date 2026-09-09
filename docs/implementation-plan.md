# KWin Compose implementation plan

Goal: implement the supplied requirements in requirements.ru.txt as a local prototype.
Architecture: grid, geometry and placement are pure ES modules shared by the browser and KWin. The adapter owns KWin objects; main owns per-output/desktop activation and sequencing. No runtime dependencies beyond KDE. Node builds the package; Biome formats development files; Prettier configuration is provided for IDE use only.

- [x] Test then implement grid boundaries, constrained snapping, rectangle subtraction and visibility.
- [x] Test then implement six anchors, deterministic candidate search, topological scene ordering and conservative sequential fallback.
- [x] Test then implement adapter and controller using fake KWin signals, including asynchronous resize settlement and user cancellation.
- [x] Build a JavaScript KWin package with the native QTimer bridge; generate its JavaScript from the same modules.
- [x] Build an opaque-window HTML sandbox with dragging, sizes, grid toggle and aspect selection.
- [x] Run tests, bundle syntax checks and browser checks; document API sources, installation and session-only verification limits.

Decisions: full formatting keeps unprocessed originals as obstacles. The visibility baseline is the snapshot before each move; a previously visible rectangle must retain positive visible area. Thin-strip checks are pairwise exposed strips, separately from aggregate visibility. Candidate ties use Manhattan grid distance, vertical distance, then y, then x. A failed eligible attempt consumes its cycle position. All-desktop windows belong to every desktop; activity filtering uses the current activity, without adding activity to the activation key. Partial maximization is excluded. No session installation.
