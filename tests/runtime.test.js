import test from 'node:test';
import assert from 'node:assert/strict';
import { createKwinAdapter } from '../src/kwin-adapter.js';
import { createController } from '../src/main.js';

function signal() {
  const slots = new Set();
  return {
    connect: (fn) => slots.add(fn),
    disconnect: (fn) => slots.delete(fn),
    emit: (...args) =>
      [...slots].forEach((fn) => {
        fn(...args);
      }),
    slots,
  };
}
function rect(x, y, width, height) {
  return { x, y, width, height };
}
function makeWindow(id, output, desktop, extra = {}) {
  return {
    internalId: id,
    normalWindow: true,
    output,
    desktops: [desktop],
    activities: [],
    maximizeMode: 0,
    moveable: true,
    resizeable: true,
    minimized: false,
    hidden: false,
    move: false,
    resize: false,
    frameGeometry: rect(47, 52, 317, 248),
    frameGeometryChanged: signal(),
    hiddenChanged: signal(),
    minimizedChanged: signal(),
    interactiveMoveResizeStarted: signal(),
    interactiveMoveResizeFinished: signal(),
    moveResizedChanged: signal(),
    ...extra,
  };
}
function fixture(initial = []) {
  const desktop = initial[0]?.desktops?.[0] ?? { id: 'd1' },
    output = initial[0]?.output ?? { name: 'DP-1' },
    timers = [];
  let now = 0;
  const workspace = {
    currentDesktop: desktop,
    currentActivity: 'work',
    stackingOrder: initial,
    windowAdded: signal(),
    windowRemoved: signal(),
    clientArea: () => rect(0, 0, 1200, 900),
  };
  const host = {
    areaOption: 0,
    log: () => {},
    schedule: (fn, delay) => {
      const timer = { at: now + delay, fn };
      timers.push(timer);
      timers.sort((a, b) => a.at - b.at);
      return () => (timer.cancelled = true);
    },
    config: () => ({}),
  };
  const adapter = createKwinAdapter(workspace, host),
    controller = createController(adapter);
  function flush() {
    let count = 0;
    while (timers.length) {
      assert.ok(count++ < 100, 'bounded timers');
      const timer = timers.shift();
      now = timer.at;
      if (!timer.cancelled) timer.fn();
    }
  }
  function add(id, extra = {}) {
    const window = makeWindow(id, output, desktop, extra);
    workspace.stackingOrder.push(window);
    workspace.windowAdded.emit(window);
    return window;
  }
  return { workspace, adapter, controller, add, flush };
}

test('startup tracks existing windows without changing them', () => {
  const output = { name: 'DP-1' },
    desktop = { id: 'd1' },
    existing = makeWindow('existing', output, desktop);
  const f = fixture([existing]);
  f.flush();
  assert.deepEqual(existing.frameGeometry, rect(47, 52, 317, 248));
});

test('a new ready window snaps size and position', () => {
  const f = fixture(),
    window = f.add('new');
  f.flush();
  assert.deepEqual(window.frameGeometry, rect(60, 60, 330, 240));
});

test('finishing a move snaps only position', () => {
  const f = fixture(),
    window = f.add('moved');
  f.flush();
  window.frameGeometry = rect(60, 60, 317, 248);
  window.move = true;
  window.interactiveMoveResizeStarted.emit();
  window.frameGeometry = rect(77, 83, 317, 248);
  window.move = false;
  window.interactiveMoveResizeFinished.emit();
  assert.deepEqual(window.frameGeometry, rect(90, 90, 317, 248));
});

test('finishing a resize snaps changed edges', () => {
  const f = fixture(),
    window = f.add('resized');
  f.flush();
  window.frameGeometry = rect(60, 60, 300, 240);
  window.resize = true;
  window.interactiveMoveResizeStarted.emit();
  window.frameGeometry = rect(60, 60, 317, 257);
  window.resize = false;
  window.interactiveMoveResizeFinished.emit();
  assert.deepEqual(window.frameGeometry, rect(60, 60, 330, 270));
});

test('resize returning to the original size does not become a move', () => {
  const f = fixture(),
    window = f.add('resized');
  f.flush();
  window.frameGeometry = rect(47, 52, 317, 248);
  window.resize = true;
  window.interactiveMoveResizeStarted.emit();
  window.resize = false;
  window.interactiveMoveResizeFinished.emit();
  assert.deepEqual(window.frameGeometry, rect(47, 52, 317, 248));
});

test('fallback move-resize state signal handles existing windows', () => {
  const output = { name: 'DP-1' },
    desktop = { id: 'd1' },
    existing = makeWindow('existing', output, desktop, {
      interactiveMoveResizeStarted: undefined,
      interactiveMoveResizeFinished: undefined,
    });
  fixture([existing]);
  existing.move = true;
  existing.moveResizedChanged.emit();
  existing.frameGeometry = rect(77, 83, 317, 248);
  existing.move = false;
  existing.moveResizedChanged.emit();
  assert.deepEqual(existing.frameGeometry, rect(90, 90, 317, 248));
});

test('ineligible windows are ignored', () => {
  const f = fixture(),
    window = f.add('dialog', { normalWindow: false, dialog: true });
  f.flush();
  assert.deepEqual(window.frameGeometry, rect(47, 52, 317, 248));
});

test('a hidden new window snaps after becoming eligible within the readiness deadline', () => {
  const f = fixture(),
    window = f.add('hidden', { hidden: true });
  assert.deepEqual(window.frameGeometry, rect(47, 52, 317, 248));
  window.hidden = false;
  window.hiddenChanged.emit();
  f.flush();
  assert.deepEqual(window.frameGeometry, rect(60, 60, 330, 240));
});

test('work area uses the window desktop rather than the current desktop', () => {
  const f = fixture(),
    windowDesktop = { id: 'window-desktop' },
    window = f.add('other-desktop', { desktops: [windowDesktop] });
  f.workspace.clientArea = (_option, _output, desktop) =>
    desktop === windowDesktop ? rect(-1200, 0, 1200, 900) : rect(0, 0, 1200, 900);
  assert.equal(f.adapter.area(window).x, -1200);
});

test('adapter converts client size limits to frame size limits', () => {
  const f = fixture(),
    window = f.add('limited', {
      frameGeometry: rect(0, 0, 320, 340),
      clientGeometry: { width: 300, height: 300 },
      minSize: { width: 100, height: 100 },
      maxSize: { width: 500, height: 500 },
    });
  assert.deepEqual(f.adapter.limits(window), {
    moveable: true,
    resizeable: true,
    minWidth: 120,
    minHeight: 140,
    maxWidth: 520,
    maxHeight: 540,
  });
});

test('removing a window disconnects its handlers', () => {
  const f = fixture(),
    window = f.add('removed');
  f.flush();
  f.workspace.stackingOrder = [];
  f.workspace.windowRemoved.emit(window);
  assert.equal(window.interactiveMoveResizeStarted.slots.size, 0);
  assert.equal(window.interactiveMoveResizeFinished.slots.size, 0);
});

test('removing a new window cancels readiness timers and subscriptions', () => {
  const f = fixture(),
    window = f.add('pending', { frameGeometry: rect(0, 0, 0, 0) });
  f.workspace.stackingOrder = [];
  f.workspace.windowRemoved.emit(window);
  f.flush();
  assert.equal(window.frameGeometryChanged.slots.size, 0);
  assert.equal(window.moveResizedChanged.slots.size, 0);
});
