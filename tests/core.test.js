import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_LIMITS,
  DEFAULT_CONFIG,
  normalizeConfig,
} from '../src/config.js';
import {
  insetArea,
  makeGrid,
  snapAll,
  snapPosition,
  snapResize,
  snapWindow,
} from '../src/grid.js';

const rect = (x, y, width, height) => ({ x, y, width, height });
const padding = { left: 30, right: 30, top: 30, bottom: 60 };
const context = (area = rect(0, 0, 1200, 900)) => {
  const bounds = insetArea(area, padding);

  return {
    grid: makeGrid(bounds, { desiredStep: 30 }),
    bounds,
  };
};

test('configuration defaults and limits have one normalized source', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(
    normalizeConfig({ desiredStep: 2, paddingLeft: -1, paddingBottom: 90 }),
    { ...DEFAULT_CONFIG, paddingBottom: 90 },
  );
  assert.equal(CONFIG_LIMITS.minimumStep, 8);
  assert.equal(CONFIG_LIMITS.maximumPadding, 2000);
  assert.equal(DEFAULT_CONFIG.paddingBottom, 20);
  assert.equal(DEFAULT_CONFIG.floatingPanelInset, 8);
  assert.equal('panelGap' in DEFAULT_CONFIG, false);
});

test('grid lines are relative to negative and non-zero work-area origins', () => {
  const g = makeGrid(rect(-3440, 20, 3440, 1390));
  assert.equal(g.x(0), -3440);
  assert.equal(g.x(g.columns), 0);
  assert.equal(g.y(0), 20);
  assert.equal(g.y(g.rows), 1410);
});

test('padding creates independent bounds in logical units', () => {
  const area = rect(-1200, 20, 1200, 900),
    bounds = insetArea(area, { left: 24, right: 48, top: 12, bottom: 36 });

  assert.deepEqual(bounds, rect(-1176, 32, 1128, 852));
  assert.equal(makeGrid(area, { desiredStep: 40 }).x(1), -1160);
});

test('whole-window snapping rounds size and position near the current geometry', () => {
  assert.deepEqual(
    snapWindow(rect(47, 52, 317, 248), context()),
    rect(60, 60, 330, 240),
  );
});

test('position snapping preserves the actual size', () => {
  assert.deepEqual(
    snapPosition(rect(47, 52, 317, 248), context()),
    rect(60, 60, 317, 248),
  );
});

test('position snapping allows parking a window beyond the work area', () => {
  assert.deepEqual(
    snapPosition(rect(77, 947, 317, 248), context()),
    rect(90, 960, 317, 248),
  );
});

test('position snapping uses an actual line on a fractional grid', () => {
  const snapContext = context(rect(0, 0, 3440, 1440)),
    g = snapContext.grid,
    actual = snapPosition(rect(165, 90, 317, 248), snapContext);
  assert.equal(actual.x, 180);
  assert.ok(
    Array.from({ length: g.columns + 1 }, (_, index) => g.x(index)).includes(
      actual.x,
    ),
  );
});

test('whole-window snapping puts both horizontal edges on fractional-grid lines', () => {
  const snapContext = context(rect(0, 0, 3440, 1440)),
    g = snapContext.grid,
    actual = snapWindow(rect(30, 90, 135, 248), snapContext),
    lines = Array.from({ length: g.columns + 1 }, (_, index) => g.x(index));
  assert.ok(lines.includes(actual.x));
  assert.ok(lines.includes(actual.x + actual.width));
});

test('position snapping does not pull an oversized window back inside', () => {
  assert.deepEqual(
    snapPosition(rect(200, 200, 1500, 1000), context()),
    rect(210, 210, 1500, 1000),
  );
});

test('whole-window snapping honours fixed and min/max sizes', () => {
  assert.deepEqual(
    snapWindow(rect(47, 52, 317, 248), context(), { resizeable: false }),
    rect(60, 60, 317, 248),
  );
  assert.deepEqual(
    snapWindow(rect(47, 52, 317, 248), context(), {
      minWidth: 305,
      maxWidth: 315,
    }),
    rect(60, 60, 315, 240),
  );
});

test('whole-window snapping stays within the effective bounds when possible', () => {
  assert.deepEqual(
    snapWindow(rect(1102, 805, 317, 248), context()),
    rect(840, 600, 330, 240),
  );
});

test('right-bottom resize preserves the opposite edges', () => {
  assert.deepEqual(
    snapResize(rect(60, 60, 300, 240), rect(60, 60, 317, 257), context()),
    rect(60, 60, 330, 270),
  );
});

test('left-top resize preserves the opposite edges', () => {
  assert.deepEqual(
    snapResize(rect(90, 90, 300, 240), rect(73, 68, 317, 262), context()),
    rect(60, 60, 330, 270),
  );
});

test('resize constraints take priority over exact grid alignment', () => {
  assert.deepEqual(
    snapResize(rect(60, 60, 300, 240), rect(60, 60, 317, 248), context(), {
      minWidth: 305,
      maxWidth: 315,
    }),
    rect(60, 60, 315, 240),
  );
});

test('resize chooses the nearest grid line allowed by size constraints', () => {
  assert.deepEqual(
    snapResize(rect(60, 60, 330, 240), rect(60, 60, 310, 240), context(), {
      minWidth: 305,
    }),
    rect(60, 60, 330, 240),
  );
});

test('resize snapping keeps changed edges inside effective bounds when possible', () => {
  assert.deepEqual(
    snapResize(rect(840, 600, 300, 240), rect(840, 600, 352, 292), context()),
    rect(840, 600, 330, 240),
  );
});

test('snapping is idempotent', () => {
  const snapContext = context(rect(-1200, 17, 1200, 900)),
    once = snapWindow(rect(-1112, 83, 317, 248), snapContext);
  assert.deepEqual(snapWindow(once, snapContext), once);
  assert.deepEqual(snapPosition(once, snapContext), once);
  assert.deepEqual(snapResize(once, once, snapContext), once);
});

test('a completed resize result stays stable on a fractional grid', () => {
  const snapContext = context(rect(-3440, 17, 3440, 1390)),
    g = snapContext.grid,
    before = rect(-3201, 77, 299, 239),
    after = rect(-3201, 77, 348, 268),
    once = snapResize(before, after, snapContext);
  assert.deepEqual(snapResize(once, once, snapContext), once);
  assert.ok(
    Array.from({ length: g.columns + 1 }, (_, index) => g.x(index)).includes(
      once.x + once.width,
    ),
  );
});

test('snap all treats windows independently and does not mutate the scene', () => {
  const windows = [
    { id: 'a', rect: rect(47, 52, 317, 248) },
    { id: 'b', rect: rect(47, 52, 317, 248) },
  ];
  const saved = structuredClone(windows);
  const actual = snapAll(windows, context());
  assert.deepEqual(windows, saved);
  assert.deepEqual(actual[0].rect, rect(60, 60, 330, 240));
  assert.deepEqual(actual[1].rect, actual[0].rect);
});
