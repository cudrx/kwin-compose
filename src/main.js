import { makeGrid } from './grid.js';
import { sameRect, preservesVisibility } from './geometry.js';
import { placeWindow, orderScene, admissible } from './placement.js';

export function createController(adapter) {
  const states = new Map(),
    pending = new Map(),
    processed = new Set(),
    queue = [];
  let busy = false,
    disposed = false;
  function state(a) {
    return states.get(a.key);
  }
  function enqueue(job) {
    queue.push(job);
    drain();
  }
  function drain() {
    if (busy || disposed || !queue.length) return;
    busy = true;
    const job = queue.shift();
    try {
      job(() => {
        busy = false;
        drain();
      });
    } catch (error) {
      adapter.log(String(error));
      busy = false;
      drain();
    }
  }
  function contextAlive(a) {
    const now = adapter.area({ output: a.output });
    return (
      !disposed &&
      now &&
      now.key === a.key &&
      Array.from(adapter.workspace.screens).includes(a.output) &&
      Array.from(adapter.workspace.desktops).some((d) => String(d.id) === String(a.desktop.id))
    );
  }
  function attempt(id, a, s, index, baseline, done) {
    const w = adapter.resolve(id);
    if (!w || !contextAlive(a) || !adapter.belongs(w, a) || !adapter.eligible(w))
      return done(false);
    const original = adapter.geometry(w),
      g = makeGrid(a.rect, adapter.config());
    const others = () => adapter.list(a).filter((o) => o.id !== id);
    const result = placeWindow(adapter.record(w), others(), g, index, {
      thirdY: s.thirdY,
      baseline,
    });
    const complete = () => {
      processed.add(id);
      if (index % 6 === 2 && adapter.valid(w)) s.thirdY = adapter.geometry(w).y;
      done(true);
    };
    if (!result.placed) return complete();
    function stillOwned() {
      return (
        contextAlive(a) && adapter.resolve(id) === w && adapter.belongs(w, a) && adapter.eligible(w)
      );
    }
    function accepted(actual) {
      const b = g.bounds;
      return (
        actual &&
        actual.x >= b.x &&
        actual.y >= b.y &&
        actual.x + actual.width <= b.x + b.width &&
        actual.y + actual.height <= b.y + b.height &&
        others().every((o) => admissible(actual, o.rect, g)) &&
        preservesVisibility(baseline, [
          ...others(),
          Object.assign({}, adapter.record(w), { rect: actual }),
        ])
      );
    }
    function restore() {
      adapter.log('Оставляем исходную геометрию: ' + id);
      if (!stillOwned()) return complete();
      adapter.apply(w, original, () => complete());
    }
    adapter.apply(w, result.rect, (applied) => {
      if (applied.cancelled || !stillOwned()) return complete();
      if (adapter.matches(w, result.rect) && accepted(applied.rect)) return complete();
      // One position-only attempt using the application's actual accepted size.
      const actual = adapter.record(w);
      const fixed = placeWindow(
        Object.assign({}, actual, { resizeable: false }),
        others(),
        g,
        index,
        { thirdY: s.thirdY, baseline },
      );
      if (!fixed.placed) return restore();
      if (sameRect(fixed.rect, actual.rect) && accepted(actual.rect)) return complete();
      adapter.apply(w, fixed.rect, (second) => {
        if (second.cancelled || !stillOwned()) return complete();
        if (accepted(second.rect)) complete();
        else restore();
      });
    });
  }
  function format() {
    const a = adapter.area();
    if (!a) return;
    enqueue((done) => {
      if (!contextAlive(a)) return done();
      // This snapshot determines ordering; subsequent steps read actual geometry.
      const active = adapter.workspace.activeWindow;
      const s = { nextIndex: 0, thirdY: undefined };
      states.set(a.key, s);
      adapter.restoreMinimized(a);
      adapter.schedule(() => {
        const initial = adapter.list(a),
          order = orderScene(initial.filter((w) => w.eligible));
        function next() {
          if (!contextAlive(a)) return done();
          if (!order.length) {
            // Geometry changes never deliberately activate/raise windows. Restoring
            // a minimized window may still affect KWin's stack; do not fight focus.
            if (adapter.workspace.activeWindow !== active)
              adapter.log(
                'Активное окно изменилось во время форматирования; фокус не перехватываем.',
              );
            return done();
          }
          const item = order.shift();
          const current = adapter.resolve(item.id);
          if (!current || !sameRect(adapter.geometry(current), item.rect)) {
            next();
            return;
          }
          const cancellation = pending.get(item.id);
          if (cancellation) {
            cancellation();
            pending.delete(item.id);
          }
          attempt(item.id, a, s, s.nextIndex, adapter.list(a), (consumed) => {
            if (consumed) s.nextIndex++;
            next();
          });
        }
        next();
      }, 80);
    });
  }
  function added(w) {
    const a = adapter.area(w);
    if (!a || !state(a) || !adapter.belongs(w, a) || !adapter.ordinary(w)) return;
    const id = String(w.internalId);
    if (pending.has(id)) return;
    pending.set(
      id,
      adapter.whenReady(w, (ready) => {
        pending.delete(id);
        if (!ready) return;
        enqueue((done) => {
          const s = state(a);
          if (processed.has(id) || !s || !contextAlive(a)) return done();
          attempt(
            id,
            a,
            s,
            s.nextIndex,
            adapter.list(a).filter((o) => o.id !== id),
            (consumed) => {
              if (consumed) s.nextIndex++;
              done();
            },
          );
        });
      }),
    );
  }
  adapter.shortcut(format);
  adapter.connect(adapter.workspace.windowAdded, added);
  adapter.connect(adapter.workspace.windowRemoved, (w) => {
    const id = String(w.internalId),
      cancel = pending.get(id);
    if (cancel) cancel();
    pending.delete(id);
    processed.delete(id);
  });
  function prune() {
    const outputs = Array.from(adapter.workspace.screens).map((o) => o.name),
      desktops = Array.from(adapter.workspace.desktops).map((d) => String(d.id));
    for (const key of states.keys()) {
      const pair = JSON.parse(key);
      if (!outputs.includes(pair[0]) || !desktops.includes(pair[1])) states.delete(key);
    }
  }
  adapter.connect(adapter.workspace.screensChanged, prune);
  adapter.connect(adapter.workspace.desktopsChanged, prune);
  return {
    format,
    states,
    dispose() {
      disposed = true;
      queue.length = 0;
      pending.forEach((cancel) => cancel());
      pending.clear();
      adapter.dispose();
    },
  };
}
