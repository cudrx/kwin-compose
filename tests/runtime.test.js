import test from 'node:test';
import assert from 'node:assert/strict';
import { createKwinAdapter } from '../src/kwin-adapter.js';
import { createController } from '../src/main.js';
function signal() {
  const slots = new Set();
  return {
    connect: (f) => slots.add(f),
    disconnect: (f) => slots.delete(f),
    emit: (...args) => [...slots].forEach((f) => f(...args)),
    slots,
  };
}
function fixture() {
  const desktop = { id: 'd1' },
    output = { name: 'DP-1' },
    timers = [];
  let shortcut,
    now = 0;
  const ws = {
    currentDesktop: desktop,
    activeScreen: output,
    currentActivity: 'work',
    screens: [output],
    desktops: [desktop],
    stackingOrder: [],
    windowAdded: signal(),
    windowRemoved: signal(),
    screensChanged: signal(),
    desktopsChanged: signal(),
    clientArea: () => ({ x: 0, y: 0, width: 1200, height: 900 }),
  };
  const host = {
    areaOption: 0,
    shortcut: (f) => (shortcut = f),
    log: () => {},
    schedule: (fn, delay) => {
      const at = now + delay,
        t = {
          fn: () => {
            now = at;
            fn();
          },
          at,
        };
      timers.push(t);
      timers.sort((a, b) => a.at - b.at);
      return () => (t.cancelled = true);
    },
    config: () => ({}),
  };
  const adapter = createKwinAdapter(ws, host),
    controller = createController(adapter);
  function add(id, extra = {}) {
    const w = {
      internalId: id,
      normalWindow: true,
      output,
      desktops: [desktop],
      activities: [],
      maximizeMode: 0,
      moveable: true,
      resizeable: true,
      minimized: false,
      frameGeometry: { x: 400, y: 300, width: 300, height: 300 },
      frameGeometryChanged: signal(),
      moveResizedChanged: signal(),
      ...extra,
    };
    ws.stackingOrder.push(w);
    ws.windowAdded.emit(w);
    return w;
  }
  function flush() {
    let n = 0;
    while (timers.length) {
      assert.ok(n++ < 100, 'bounded timers');
      const t = timers.shift();
      if (!t.cancelled) t.fn();
    }
  }
  return {
    ws,
    host,
    adapter,
    controller,
    add,
    flush,
    timers,
    format: () => shortcut(),
    output,
    desktop,
  };
}
test('inert before shortcut; afterwards only new windows move', () => {
  const f = fixture(),
    a = f.add('a');
  f.flush();
  assert.equal(a.frameGeometry.x, 400);
  f.format();
  f.flush();
  assert.equal(a.frameGeometry.x, 30);
  a.frameGeometry = { x: 60, y: 150, width: 300, height: 300 };
  const saved = { ...a.frameGeometry };
  const b = f.add('b');
  f.flush();
  assert.deepEqual(a.frameGeometry, saved);
  assert.equal(b.frameGeometry.x, 870);
});
test('activation is scoped to output and desktop; sticky windows belong to current area', () => {
  const f = fixture();
  f.format();
  f.flush();
  const other = f.add('other', { output: { name: 'HDMI-1' } }),
    desk = f.add('desk', { desktops: [{ id: 'd2' }] });
  const sticky = f.add('sticky', { desktops: [], onAllDesktops: true });
  f.flush();
  assert.equal(other.frameGeometry.x, 400);
  assert.equal(desk.frameGeometry.x, 400);
  assert.equal(sticky.frameGeometry.x, 30);
});
test('restore minimized ordinary windows but never change fullscreen/maximized/dialog geometry', () => {
  const f = fixture(),
    a = f.add('max', { minimized: true, maximizeMode: 3 }),
    b = f.add('full', { minimized: true, fullScreen: true }),
    c = f.add('dialog', { normalWindow: false, dialog: true, minimized: true });
  f.format();
  f.flush();
  assert.equal(a.minimized, false);
  assert.equal(b.minimized, false);
  assert.equal(c.minimized, true);
  assert.equal(a.frameGeometry.x, 400);
  assert.equal(b.frameGeometry.x, 400);
  assert.equal(c.frameGeometry.x, 400);
});
test('new window waits for usable geometry and is processed only once', () => {
  const f = fixture();
  f.format();
  f.flush();
  const a = f.add('a', { frameGeometry: { x: 0, y: 0, width: 0, height: 0 } });
  a.frameGeometry = { x: 400, y: 300, width: 300, height: 300 };
  a.frameGeometryChanged.emit();
  f.flush();
  assert.equal(a.frameGeometry.x, 30);
  a.frameGeometry = { x: 123, y: 234, width: 300, height: 300 };
  a.frameGeometryChanged.emit();
  f.flush();
  assert.equal(a.frameGeometry.x, 123);
});
test('closing a window does not rewind index; repeated formatting resets it', () => {
  const f = fixture();
  f.format();
  f.flush();
  const a = f.add('a');
  f.flush();
  f.ws.stackingOrder = [];
  f.ws.windowRemoved.emit(a);
  const b = f.add('b');
  f.flush();
  assert.equal(b.frameGeometry.x, 870);
  f.format();
  f.flush();
  assert.equal(b.frameGeometry.x, 30);
});
test('manual interaction while an apply is pending stops corrective writes', () => {
  const f = fixture();
  f.format();
  f.flush();
  const a = f.add('a');
  // Run readiness, leaving geometry settlement pending.
  f.timers.shift().fn();
  a.move = true;
  a.moveResizedChanged.emit();
  a.frameGeometry = { x: 123, y: 234, width: 300, height: 300 };
  f.flush();
  assert.equal(a.frameGeometry.x, 123);
});
test('adapter converts client size limits to frame size limits', () => {
  const f = fixture(),
    a = f.add('a', {
      frameGeometry: { x: 0, y: 0, width: 320, height: 340 },
      clientGeometry: { width: 300, height: 300 },
      minSize: { width: 100, height: 100 },
      maxSize: { width: 500, height: 500 },
    });
  const record = f.adapter.record(a);
  assert.equal(record.minWidth, 120);
  assert.equal(record.minHeight, 140);
  assert.equal(record.maxHeight, 540);
});
test('unknown maximization state is excluded, not guessed from rectangle size', () => {
  const f = fixture(),
    a = f.add('a', { maximizeMode: undefined });
  f.format();
  f.flush();
  assert.equal(a.frameGeometry.x, 400);
});
test('a ready new window queued behind formatting is not placed twice', () => {
  const f = fixture();
  f.format();
  f.flush();
  const a = f.add('a');
  f.format();
  f.flush();
  assert.equal(f.controller.states.values().next().value.nextIndex, 1);
});
test('manual change of an unprocessed window during format is preserved', () => {
  const f = fixture(),
    a = f.add('a'),
    b = f.add('b', { frameGeometry: { x: 700, y: 400, width: 300, height: 300 } });
  f.format();
  f.timers.shift().fn();
  b.frameGeometry = { x: 711, y: 412, width: 310, height: 320 };
  f.flush();
  assert.deepEqual(b.frameGeometry, { x: 711, y: 412, width: 310, height: 320 });
});
test('activated secondary output accepts new windows while another output is active', () => {
  const f = fixture();
  f.format();
  f.flush();
  const otherOutput = { name: 'HDMI-1' };
  f.ws.screens.push(otherOutput);
  f.ws.activeScreen = otherOutput;
  const a = f.add('a');
  f.flush();
  assert.equal(a.frameGeometry.x, 30);
});
test('temporary signal subscriptions are released after a completed new window', () => {
  const f = fixture();
  f.format();
  f.flush();
  const a = f.add('a');
  f.flush();
  assert.equal(a.frameGeometryChanged.slots.size, 0);
  assert.equal(a.moveResizedChanged.slots.size, 0);
});
test('application refusing resize gets one fixed-size placement and no endless retries', () => {
  const f = fixture();
  f.format();
  f.flush();
  let r = { x: 400, y: 300, width: 317, height: 248 },
    writes = 0;
  const a = f.add('fixed-app');
  Object.defineProperty(a, 'frameGeometry', {
    get: () => r,
    set: (next) => {
      writes++;
      r = { ...next, width: 317, height: 248 };
      a.frameGeometryChanged.emit();
    },
  });
  f.flush();
  assert.equal(r.width, 317);
  assert.equal(r.height, 248);
  assert.ok(writes <= 2);
  assert.equal(r.x, 30);
});
test('a failed placement leaves old windows unchanged and consumes one slot', () => {
  const f = fixture();
  f.format();
  f.flush();
  const a = f.add('huge', {
    resizeable: false,
    frameGeometry: { x: 7, y: 8, width: 2000, height: 1600 },
  });
  f.flush();
  assert.deepEqual(a.frameGeometry, { x: 7, y: 8, width: 2000, height: 1600 });
  assert.equal(f.controller.states.values().next().value.nextIndex, 1);
});
