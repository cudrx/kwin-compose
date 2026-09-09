export function createKwinAdapter(workspace, host) {
  const disconnectors = new Set();

  function connect(signal, callback) {
    if (!signal?.connect) return () => {};
    signal.connect(callback);
    let connected = true;
    const disconnect = () => {
      if (!connected) return;
      connected = false;
      disconnectors.delete(disconnect);
      try {
        signal.disconnect(callback);
      } catch (_) {
        // The QObject may already have been destroyed.
      }
    };
    disconnectors.add(disconnect);
    return disconnect;
  }

  function geometry(window) {
    const rect = window.frameGeometry;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function valid(window) {
    if (!window || window.deleted) return false;
    const rect = geometry(window);

    return (
      ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])) &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function ordinary(window) {
    return Boolean(
      window.normalWindow &&
        !window.dialog &&
        !window.modal &&
        !window.popupWindow &&
        !window.specialWindow &&
        !window.deleted,
    );
  }

  function eligible(window) {
    return Boolean(
      ordinary(window) &&
        valid(window) &&
        !window.fullScreen &&
        Number(window.maximizeMode) === 0 &&
        !window.minimized &&
        !window.hidden,
    );
  }

  function area(window) {
    const output = window.output,
      desktop =
        output && typeof workspace.currentDesktopForScreen === 'function'
          ? workspace.currentDesktopForScreen(output)
          : workspace.currentDesktop;
    if (!output || !desktop) return null;

    return Object.assign({}, workspace.clientArea(host.areaOption, output, desktop));
  }

  function limits(window) {
    const frame = geometry(window),
      client = window.clientGeometry || frame,
      borderX = Math.max(0, frame.width - client.width),
      borderY = Math.max(0, frame.height - client.height),
      bound = (size, key, border) =>
        size && Number(size[key]) > 0 ? Number(size[key]) + border : undefined;

    return {
      moveable: window.moveable,
      resizeable: window.resizeable,
      minWidth: bound(window.minSize, 'width', borderX),
      minHeight: bound(window.minSize, 'height', borderY),
      maxWidth: bound(window.maxSize, 'width', borderX),
      maxHeight: bound(window.maxSize, 'height', borderY),
    };
  }

  function whenReady(window, callback) {
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
      callback(deliver && valid(window) ? window : null);
    }
    function changed() {
      cancelQuiet();
      if (valid(window)) cancelQuiet = host.schedule(() => finish(true), 80);
    }
    offs.push(connect(window.frameGeometryChanged, changed));
    offs.push(connect(window.interactiveMoveResizeStarted, () => finish(false)));
    offs.push(
      connect(window.moveResizedChanged, () => {
        if (window.move || window.resize) finish(false);
      }),
    );
    offs.push(connect(workspace.windowRemoved, (removed) => removed === window && finish(false)));
    cancelDeadline = host.schedule(() => finish(true), 1500);
    changed();

    return () => finish(false);
  }

  function apply(window, rect) {
    if (!valid(window)) return false;
    try {
      window.frameGeometry = host.makeRect ? host.makeRect(rect) : Object.assign({}, rect);
      return true;
    } catch (error) {
      host.log(String(error));
      return false;
    }
  }

  return {
    workspace,
    connect,
    geometry,
    valid,
    ordinary,
    eligible,
    area,
    limits,
    whenReady,
    apply,
    config: host.config,
    log: host.log,
    dispose: () => Array.from(disconnectors).forEach((disconnect) => disconnect()),
  };
}
