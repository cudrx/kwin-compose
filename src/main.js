import { makeGrid, snapPosition, snapResize, snapWindow } from './grid.js';

export function createController(adapter) {
  const tracked = new Map();
  let disposed = false;

  function gridFor(window) {
    const area = adapter.area(window);
    return area ? makeGrid(area, adapter.config()) : null;
  }

  function apply(window, operation) {
    if (disposed || !adapter.eligible(window)) return;
    const grid = gridFor(window);
    if (!grid) return;
    operation(grid);
  }

  function track(window, snapOnReady) {
    if (!window || tracked.has(window)) return;
    const state = { before: null, applying: false, cancelReady: () => {}, offs: [] };
    tracked.set(window, state);

    function started(kind) {
      if (state.applying || !adapter.valid(window)) return;
      state.cancelReady();
      state.before = adapter.geometry(window);
      state.kind = kind;
    }

    function finished(kind) {
      if (state.applying || !state.before || !adapter.valid(window)) return;
      const before = state.before,
        after = adapter.geometry(window);
      state.before = null;
      apply(window, (grid) => {
        const result =
          (kind || state.kind) === 'resize'
            ? snapResize(before, after, grid, adapter.limits(window))
            : snapPosition(after, grid, adapter.limits(window));
        state.applying = true;
        adapter.apply(window, result);
        state.applying = false;
      });
      state.kind = null;
    }

    state.offs.push(adapter.onInteractive(window, started, finished));

    if (snapOnReady && adapter.ordinary(window)) {
      state.cancelReady = adapter.whenReady(window, (ready) => {
        state.cancelReady = () => {};
        if (!ready) return;
        apply(ready, (grid) => {
          state.applying = true;
          adapter.apply(ready, snapWindow(adapter.geometry(ready), grid, adapter.limits(ready)));
          state.applying = false;
        });
      });
    }
  }

  function untrack(window) {
    const state = tracked.get(window);
    if (!state) return;
    state.cancelReady();
    state.offs.forEach((off) => {
      off();
    });
    tracked.delete(window);
  }

  Array.from(adapter.workspace.stackingOrder).forEach((window) => {
    track(window, false);
  });
  const offAdded = adapter.connect(adapter.workspace.windowAdded, (window) => track(window, true)),
    offRemoved = adapter.connect(adapter.workspace.windowRemoved, untrack);

  return {
    dispose() {
      disposed = true;
      offAdded();
      offRemoved();
      Array.from(tracked.keys()).forEach(untrack);
      adapter.dispose();
    },
  };
}
