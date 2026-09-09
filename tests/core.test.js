import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, snapAll, snapPosition, snapResize, snapWindow } from '../src/grid.js';

const rect = (x, y, width, height) => ({ x, y, width, height });
const grid = (area = rect(0, 0, 1200, 900)) => makeGrid(area);

test('grid lines are relative to negative and non-zero work-area origins', () => {
  const g = grid(rect(-3440, 20, 3440, 1390));
  assert.equal(g.x(0), -3440);
  assert.equal(g.x(g.columns), 0);
  assert.equal(g.y(0), 20);
  assert.equal(g.y(g.rows), 1410);
  assert.equal(g.bounds.x, g.x(1));
  assert.equal(g.bounds.y, g.y(1));
});

test('whole-window snapping rounds size and position near the current geometry', () => {
  assert.deepEqual(snapWindow(rect(47, 52, 317, 248), grid()), rect(60, 60, 330, 240));
});

test('position snapping preserves the actual size', () => {
  assert.deepEqual(snapPosition(rect(47, 52, 317, 248), grid()), rect(60, 60, 317, 248));
});

test('position snapping uses an actual line on a fractional grid', () => {
  const g = grid(rect(0, 0, 3440, 1440)),
    actual = snapPosition(rect(165, 90, 317, 248), g);
  assert.equal(actual.x, 179);
  assert.ok(Array.from({ length: g.columns + 1 }, (_, index) => g.x(index)).includes(actual.x));
});

test('whole-window snapping puts both horizontal edges on fractional-grid lines', () => {
  const g = grid(rect(0, 0, 3440, 1440)),
    actual = snapWindow(rect(30, 90, 135, 248), g),
    lines = Array.from({ length: g.columns + 1 }, (_, index) => g.x(index));
  assert.ok(lines.includes(actual.x));
  assert.ok(lines.includes(actual.x + actual.width));
});

test('position snapping keeps a movable oversized window predictable', () => {
  assert.deepEqual(snapPosition(rect(200, 200, 1500, 1000), grid()), rect(30, 30, 1500, 1000));
});

test('whole-window snapping honours fixed and min/max sizes', () => {
  assert.deepEqual(
    snapWindow(rect(47, 52, 317, 248), grid(), { resizeable: false }),
    rect(60, 60, 317, 248),
  );
  assert.deepEqual(
    snapWindow(rect(47, 52, 317, 248), grid(), { minWidth: 305, maxWidth: 315 }),
    rect(60, 60, 315, 240),
  );
});

test('whole-window snapping stays within the effective bounds when possible', () => {
  assert.deepEqual(snapWindow(rect(1102, 805, 317, 248), grid()), rect(840, 600, 330, 240));
});

test('right-bottom resize preserves the opposite edges', () => {
  assert.deepEqual(
    snapResize(rect(60, 60, 300, 240), rect(60, 60, 317, 257), grid()),
    rect(60, 60, 330, 270),
  );
});

test('left-top resize preserves the opposite edges', () => {
  assert.deepEqual(
    snapResize(rect(90, 90, 300, 240), rect(73, 68, 317, 262), grid()),
    rect(60, 60, 330, 270),
  );
});

test('resize constraints take priority over exact grid alignment', () => {
  assert.deepEqual(
    snapResize(rect(60, 60, 300, 240), rect(60, 60, 317, 248), grid(), {
      minWidth: 305,
      maxWidth: 315,
    }),
    rect(60, 60, 315, 240),
  );
});

test('resize chooses the nearest grid line allowed by size constraints', () => {
  assert.deepEqual(
    snapResize(rect(60, 60, 330, 240), rect(60, 60, 310, 240), grid(), { minWidth: 305 }),
    rect(60, 60, 330, 240),
  );
});

test('resize snapping keeps changed edges inside effective bounds when possible', () => {
  assert.deepEqual(
    snapResize(rect(840, 600, 300, 240), rect(840, 600, 352, 292), grid()),
    rect(840, 600, 330, 240),
  );
});

test('snapping is idempotent', () => {
  const g = grid(rect(-1200, 17, 1200, 900));
  const once = snapWindow(rect(-1112, 83, 317, 248), g);
  assert.deepEqual(snapWindow(once, g), once);
  assert.deepEqual(snapPosition(once, g), once);
  assert.deepEqual(snapResize(once, once, g), once);
});

test('a completed resize result stays stable on a fractional grid', () => {
  const g = grid(rect(-3440, 17, 3440, 1390)),
    before = rect(-3201, 77, 299, 239),
    after = rect(-3201, 77, 348, 268),
    once = snapResize(before, after, g);
  assert.deepEqual(snapResize(once, once, g), once);
  assert.equal(once.x + once.width, g.x(20));
});

test('snap all treats windows independently and does not mutate the scene', () => {
  const windows = [
    { id: 'a', rect: rect(47, 52, 317, 248) },
    { id: 'b', rect: rect(47, 52, 317, 248) },
  ];
  const saved = structuredClone(windows);
  const actual = snapAll(windows, grid());
  assert.deepEqual(windows, saved);
  assert.deepEqual(actual[0].rect, rect(60, 60, 330, 240));
  assert.deepEqual(actual[1].rect, actual[0].rect);
});
