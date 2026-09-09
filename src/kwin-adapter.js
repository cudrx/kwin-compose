import { sameRect } from './geometry.js';

export function createKwinAdapter(workspace, host) {
  const disconnectors = new Set();
  function connect(signal, fn) {
    if (!signal || !signal.connect) return () => {};
    signal.connect(fn);
    let connected = true;
    const off = () => {
      if (connected) {
        connected = false;
        disconnectors.delete(off);
        try {
          signal.disconnect(fn);
        } catch (_) {
          /* QObject was destroyed. */
        }
      }
    };
    disconnectors.add(off);
    return off;
  }
  function geometry(w) {
    const r = w.frameGeometry;
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  function valid(w) {
    if (!w || w.deleted) return false;
    const r = geometry(w);
    return (
      ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k])) &&
      r.width > 0 &&
      r.height > 0
    );
  }
  function ordinary(w) {
    return (
      w.normalWindow && !w.dialog && !w.modal && !w.popupWindow && !w.specialWindow && !w.deleted
    );
  }
  function eligible(w) {
    // Fail closed on old APIs rather than mistaking maximized windows for normal ones.
    return (
      ordinary(w) &&
      !w.fullScreen &&
      Number(w.maximizeMode) === 0 &&
      !w.minimized &&
      !w.hidden &&
      !w.move &&
      !w.resize
    );
  }
  function area(w) {
    const output = w ? w.output : workspace.activeScreen;
    const desktop =
      output && typeof workspace.currentDesktopForScreen === 'function'
        ? workspace.currentDesktopForScreen(output)
        : workspace.currentDesktop;
    if (!output || !desktop) return null;
    return {
      output,
      desktop,
      key: JSON.stringify([output.name, String(desktop.id)]),
      rect: Object.assign({}, workspace.clientArea(host.areaOption, output, desktop)),
    };
  }
  function belongs(w, a) {
    if (!a || w.output !== a.output) return false;
    const desktops = Array.from(w.desktops || []),
      activities = Array.from(w.activities || []);
    return (
      (w.onAllDesktops ||
        desktops.length === 0 ||
        desktops.some((d) => String(d.id) === String(a.desktop.id))) &&
      (activities.length === 0 || activities.includes(workspace.currentActivity))
    );
  }
  function record(w) {
    const rect = geometry(w),
      client = w.clientGeometry || rect;
    const borderX = Math.max(0, rect.width - client.width),
      borderY = Math.max(0, rect.height - client.height);
    const bound = (size, key, border) =>
      size && Number(size[key]) > 0 ? Number(size[key]) + border : undefined;
    return {
      id: String(w.internalId),
      rect,
      z: Array.from(workspace.stackingOrder).indexOf(w),
      eligible: eligible(w),
      resizeable: w.resizeable,
      moveable: w.moveable,
      minWidth: bound(w.minSize, 'width', borderX),
      minHeight: bound(w.minSize, 'height', borderY),
      maxWidth: bound(w.maxSize, 'width', borderX),
      maxHeight: bound(w.maxSize, 'height', borderY),
    };
  }
  function list(a) {
    return Array.from(workspace.stackingOrder)
      .filter(
        (w) => belongs(w, a) && valid(w) && !w.minimized && !w.hidden && (ordinary(w) || w.dialog),
      )
      .map(record);
  }
  function resolve(id) {
    return Array.from(workspace.stackingOrder).find((w) => String(w.internalId) === id);
  }
  function restoreMinimized(a) {
    for (const w of Array.from(workspace.stackingOrder))
      if (belongs(w, a) && ordinary(w) && w.minimized) w.minimized = false;
  }
  function whenReady(w, callback) {
    let finished = false,
      cancelQuiet = () => {},
      cancelDeadline = () => {};
    const offs = [];
    function finish(deliver) {
      if (finished) return;
      finished = true;
      cancelQuiet();
      cancelDeadline();
      offs.forEach((off) => off());
      callback(deliver && valid(w) ? w : null);
    }
    function changed() {
      cancelQuiet();
      if (valid(w)) cancelQuiet = host.schedule(() => finish(true), 80);
    }
    offs.push(connect(w.frameGeometryChanged, changed));
    offs.push(
      connect(w.moveResizedChanged, () => {
        if (w.move || w.resize) finish(false);
      }),
    );
    offs.push(
      connect(workspace.windowRemoved, (removed) => {
        if (removed === w) finish(false);
      }),
    );
    cancelDeadline = host.schedule(() => finish(true), 1500);
    changed();
    return () => finish(false);
  }
  function apply(w, rect, callback) {
    let finished = false,
      cancelQuiet = () => {},
      cancelDeadline = () => {};
    const offs = [];
    function finish(cancelled = false) {
      if (finished) return;
      finished = true;
      cancelQuiet();
      cancelDeadline();
      offs.forEach((off) => off());
      callback({ cancelled, rect: valid(w) ? geometry(w) : null });
    }
    function changed() {
      cancelQuiet();
      cancelQuiet = host.schedule(() => finish(), 80);
    }
    offs.push(connect(w.frameGeometryChanged, changed));
    offs.push(
      connect(w.moveResizedChanged, () => {
        if (w.move || w.resize) finish(true);
      }),
    );
    offs.push(
      connect(workspace.windowRemoved, (removed) => {
        if (removed === w) finish(true);
      }),
    );
    cancelDeadline = host.schedule(() => finish(), 500);
    try {
      w.frameGeometry = host.makeRect ? host.makeRect(rect) : Object.assign({}, rect);
      changed();
    } catch (error) {
      host.log(String(error));
      finish(true);
    }
    return () => finish(true);
  }
  return {
    workspace,
    connect,
    geometry,
    valid,
    ordinary,
    eligible,
    area,
    belongs,
    record,
    list,
    resolve,
    restoreMinimized,
    whenReady,
    apply,
    config: host.config,
    shortcut: host.shortcut,
    schedule: host.schedule,
    log: host.log,
    dispose: () => Array.from(disconnectors).forEach((off) => off()),
    matches: (w, rect) => valid(w) && sameRect(geometry(w), rect, 1),
  };
}
