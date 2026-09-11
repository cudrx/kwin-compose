import {
  insetArea,
  makeGrid,
  snapPosition,
  snapResize,
  snapWindow,
} from './grid.js';
import { normalizeConfig } from './config.js';

export function createController(adapter) {
  const tracked = new Map();
  let disposed = false;

  function snappingContext(window) {
    const config = normalizeConfig(adapter.config()),
      area = adapter.area(window, config.floatingPanelInset);

    if (!area) return null;

    const bounds = insetArea(area, {
      left: config.paddingLeft,
      right: config.paddingRight,
      top: config.paddingTop,
      bottom: config.paddingBottom,
    });

    return {
      grid: makeGrid(bounds, config),
      bounds,
    };
  }

  function apply(window, operation) {
    if (disposed || !adapter.eligible(window)) return;

    const context = snappingContext(window);

    if (!context) return;

    operation(context);
  }

  function track(window, snapOnReady) {
    if (!window || tracked.has(window)) return;

    const state = {
      before: null,
      applying: false,
      cancelReady: () => {},
      cancelFinish: () => {},
      offs: [],
    };
    tracked.set(window, state);

    function started(kind) {
      if (state.applying || !adapter.valid(window)) return;
      state.cancelReady();
      state.cancelFinish();
      state.before = adapter.geometry(window);
      state.kind = kind;
    }

    function finished(kind) {
      if (state.applying || !state.before || !adapter.valid(window)) return;
      const before = state.before,
        after = adapter.geometry(window),
        operationKind = kind || state.kind;
      state.before = null;
      state.kind = null;
      state.cancelFinish();
      state.cancelFinish = adapter.afterKwin(() => {
        state.cancelFinish = () => {};
        apply(window, (context) => {
          const result =
            operationKind === 'resize'
              ? snapResize(before, after, context, adapter.limits(window))
              : snapPosition(after, context, adapter.limits(window));
          state.applying = true;
          adapter.apply(window, result);
          state.applying = false;
        });
      });
    }

    state.offs.push(adapter.onInteractive(window, started, finished));

    if (snapOnReady && adapter.ordinary(window)) {
      state.cancelReady = adapter.whenReady(window, (ready) => {
        state.cancelReady = () => {};

        if (!ready) return;

        apply(ready, (context) => {
          state.applying = true;
          adapter.apply(
            ready,
            snapWindow(adapter.geometry(ready), context, adapter.limits(ready)),
          );
          state.applying = false;
        });
      });
    }
  }

  function untrack(window) {
    const state = tracked.get(window);

    if (!state) return;

    state.cancelReady();
    state.cancelFinish();
    state.offs.forEach((off) => void off());
    tracked.delete(window);
  }

  Array.from(adapter.workspace.stackingOrder).forEach(
    (window) => void track(window, false),
  );
  const offAdded = adapter.connect(adapter.workspace.windowAdded, (window) =>
      track(window, true),
    ),
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
