import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, snapSize } from '../src/grid.js';
import { intersection, subtractRect, visibleArea, preservesVisibility } from '../src/geometry.js';
import { placeWindow, formatScene, orderScene, admissible } from '../src/placement.js';
const rect = (x, y, width, height) => ({ x, y, width, height });
const win = (id, r, z = 0, extra = {}) => ({ id, rect: r, z, ...extra });
const grid = () => makeGrid(rect(0, 0, 1200, 900));

test('grid reserves margins once and rounds boundaries without drift', () => {
  const g = makeGrid(rect(-3440, 20, 3440, 1390));
  assert.equal(g.columns, 115);
  assert.equal(g.rows, 46);
  assert.equal(g.x(g.columns), 0);
  assert.equal(g.y(g.rows), 1410);
  assert.equal(g.bounds.x, g.x(1));
  assert.equal(g.bounds.y, g.y(1));
  assert.equal(g.bounds.y + g.bounds.height, g.y(g.rows - 2));
});
test('tiny areas remain finite and impossible margins result in no placement', () => {
  const g = makeGrid(rect(0, 0, 20, 20));
  assert.ok(Number.isFinite(g.cellWidth));
  assert.equal(placeWindow(win('a', rect(0, 0, 15, 15)), [], g, 0).placed, false);
});
test('size snapping honours fixed sizes and min/max constraints', () => {
  assert.deepEqual(snapSize({ width: 317, height: 248 }, grid(), { resizeable: false }), {
    width: 317,
    height: 248,
  });
  assert.deepEqual(snapSize({ width: 317, height: 248 }, grid(), {}), { width: 330, height: 240 });
  assert.deepEqual(
    snapSize({ width: 317, height: 248 }, grid(), { minWidth: 305, maxWidth: 315 }),
    { width: 315, height: 240 },
  );
});
test('subtraction and union visibility do not double count overlaps', () => {
  const r = rect(0, 0, 100, 100);
  assert.equal(
    subtractRect(r, rect(20, 20, 60, 60)).reduce((a, b) => a + b.width * b.height, 0),
    6400,
  );
  assert.equal(visibleArea(r, [rect(0, 0, 70, 100), rect(30, 0, 70, 100)]), 0);
  assert.equal(intersection(r, rect(100, 0, 20, 20)), null);
});
test('aggregate coverage cannot erase a formerly visible lower window', () => {
  const before = [
    win('a', rect(0, 0, 100, 100), 0),
    win('b', rect(0, 0, 60, 100), 1),
    win('c', rect(150, 0, 60, 100), 2),
  ];
  const after = before.map((w) => (w.id === 'c' ? { ...w, rect: rect(40, 0, 60, 100) } : w));
  assert.equal(preservesVisibility(before, after), false);
});
test('nonoverlap permits alignment but requires a separating gap', () => {
  const g = grid();
  const a = rect(30, 30, 300, 300);
  assert.equal(admissible(rect(360, 30, 300, 300), a, g), true);
  assert.equal(admissible(rect(345, 30, 300, 300), a, g), false);
  assert.equal(admissible(rect(60, 30, 300, 300), a, g), false);
  assert.equal(admissible(rect(60, 60, 300, 300), a, g), true);
});
test('first top-left and disjoint second top-right share their top edge', () => {
  const g = grid();
  const a = win('a', rect(400, 400, 300, 300));
  const p = placeWindow(a, [], g, 0);
  assert.deepEqual(p.rect, rect(30, 30, 300, 300));
  const q = placeWindow(win('b', rect(0, 0, 300, 300), 1), [{ ...a, rect: p.rect }], g, 1);
  assert.deepEqual(q.rect, rect(870, 30, 300, 300));
});
test('overlapping second starts one row below the first', () => {
  const g = grid(),
    a = win('a', rect(30, 30, 690, 510));
  const p = placeWindow(win('b', rect(0, 0, 690, 510), 1), [a], g, 1);
  assert.deepEqual(p.rect, rect(480, 60, 690, 510));
});
test('topological ordering keeps overlap dependencies and spatial ties stable', () => {
  const a = win('a', rect(100, 100, 300, 300), 0),
    b = win('b', rect(50, 50, 300, 300), 1),
    c = win('c', rect(800, 0, 100, 100), 2);
  assert.deepEqual(
    orderScene([a, b, c]).map((w) => w.id),
    ['c', 'a', 'b'],
  );
});
test('impossible placement leaves original geometry and scene untouched', () => {
  const a = win('a', rect(55, 66, 1500, 1000), 0, { resizeable: false }),
    scene = [a];
  const saved = structuredClone(scene),
    p = placeWindow(a, [], grid(), 0);
  assert.equal(p.placed, false);
  assert.deepEqual(p.rect, a.rect);
  formatScene(scene, grid());
  assert.deepEqual(scene, saved);
});
test('format is deterministic and fallback geometry is retained in final scene', () => {
  const scene = [
    win('huge', rect(0, 0, 1500, 950), 0, { resizeable: false }),
    win('b', rect(400, 100, 330, 300), 1),
  ];
  const a = formatScene(scene, grid()),
    b = formatScene(scene, grid());
  assert.deepEqual(a, b);
  assert.deepEqual(a.windows.find((w) => w.id === 'huge').rect, scene[0].rect);
  assert.equal(a.nextIndex, 2);
});
test('cycle includes middle stagger, lower anchors and repeats at seven', () => {
  const g = grid(),
    w = win('a', rect(400, 400, 300, 300));
  const positions = Array.from(
    { length: 7 },
    (_, i) => placeWindow(w, [], g, i, { thirdY: 270 }).rect,
  );
  assert.deepEqual(
    positions.map((r) => [r.x, r.y]),
    [
      [30, 30],
      [870, 30],
      [30, 270],
      [870, 300],
      [30, 540],
      [870, 540],
      [30, 30],
    ],
  );
});
test('a small exposed strip is rejected even when corresponding edges differ', () => {
  const a = rect(30, 30, 300, 300),
    b = rect(315, 315, 300, 300);
  assert.equal(admissible(a, b, grid()), false);
});
test('fractional grid remains bounded and deterministic across aspect ratios', () => {
  for (const [width, height] of [
    [3440, 1440],
    [1920, 1080],
    [1080, 1920],
    [1600, 1200],
  ]) {
    const g = makeGrid(rect(-width, 17, width, height)),
      scene = [];
    for (let i = 0; i < 6; i++) {
      const w = win(
        String(i),
        rect(-width + 80, 97, Math.round(width * 0.37), Math.round(height * 0.57)),
        i,
      );
      const p = placeWindow(w, scene, g, i),
        q = placeWindow(w, scene, g, i);
      assert.deepEqual(p, q);
      if (p.placed) {
        assert.ok(p.rect.x >= g.bounds.x && p.rect.y >= g.bounds.y);
        assert.ok(p.rect.x + p.rect.width <= g.bounds.x + g.bounds.width);
        assert.ok(p.rect.y + p.rect.height <= g.bounds.y + g.bounds.height);
      }
      scene.push({ ...w, rect: p.rect });
    }
  }
});
