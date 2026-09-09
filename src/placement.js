import { snapSize } from './grid.js';
import { intersection, subtractRect, preservesVisibility } from './geometry.js';

export function admissible(a, b, g) {
  // Rounded cell boundaries can differ by one logical unit.
  const sx = Math.max(1, Math.floor(g.cellWidth)),
    sy = Math.max(1, Math.floor(g.cellHeight));
  if (!intersection(a, b)) {
    const dx = Math.max(b.x - a.x - a.width, a.x - b.x - b.width);
    const dy = Math.max(b.y - a.y - a.height, a.y - b.y - b.height);
    return dx >= sx * g.gapCells || dy >= sy * g.gapCells;
  }
  if (
    Math.abs(a.x - b.x) < sx ||
    Math.abs(a.x + a.width - b.x - b.width) < sx ||
    Math.abs(a.y - b.y) < sy ||
    Math.abs(a.y + a.height - b.y - b.height) < sy
  )
    return false;
  // Reject narrow pairwise exposed strips, independently of total visibility.
  return [...subtractRect(a, b), ...subtractRect(b, a)].every(
    (r) => r.width >= sx && r.height >= sy,
  );
}

export function anchorPosition(size, g, index, context = {}) {
  const slot = index % 6,
    b = g.bounds;
  const left = b.x,
    right = b.x + b.width - size.width;
  const top = b.y,
    bottom = b.y + b.height - size.height;
  const middle = Math.round((top + bottom) / 2);
  let y = slot < 2 ? top : slot < 4 ? middle : bottom;
  if (slot === 3) y = Math.min(bottom, (context.thirdY ?? middle) + g.cellHeight);
  return { x: slot % 2 ? right : left, y };
}

export function placeWindow(window, others, g, index, context = {}) {
  const fallback = {
    placed: false,
    rect: Object.assign({}, window.rect),
    reason: 'Нет допустимой позиции',
  };
  if (window.moveable === false)
    return Object.assign({}, fallback, { reason: 'Перемещение запрещено' });
  const size = snapSize(window.rect, g, window),
    b = g.bounds;
  if (size.width <= 0 || size.height <= 0 || size.width > b.width || size.height > b.height)
    return fallback;
  const anchor = anchorPosition(size, g, index, context);
  const xs = [],
    ys = [];
  for (let c = g.left; c <= g.right; c++) {
    const x = index % 2 ? g.x(c) - size.width : g.x(c);
    if (x >= b.x && x + size.width <= b.x + b.width) xs.push(x);
  }
  for (let r = g.top; r <= g.bottom; r++) {
    const y = index % 6 >= 4 ? g.y(r) - size.height : g.y(r);
    if (y >= b.y && y + size.height <= b.y + b.height) ys.push(y);
  }
  const candidates = [];
  for (const y of ys) for (const x of xs) candidates.push(Object.assign({ x, y }, size));
  candidates.sort((a, b) => {
    const ax = Math.abs(a.x - anchor.x) / g.cellWidth,
      ay = Math.abs(a.y - anchor.y) / g.cellHeight;
    const bx = Math.abs(b.x - anchor.x) / g.cellWidth,
      by = Math.abs(b.y - anchor.y) / g.cellHeight;
    return ax + ay - (bx + by) || ay - by || a.y - b.y || a.x - b.x;
  });
  // The second slot has an explicit right-anchored, one-row-down preference.
  if (
    index % 6 === 1 &&
    others.some((w) => intersection(Object.assign({}, anchor, size), w.rect))
  ) {
    const preferred = candidates.find((r) => r.x === anchor.x && r.y === g.y(g.top + 1));
    if (preferred) candidates.unshift(preferred);
  }
  for (const rect of candidates) {
    if (!others.every((w) => admissible(rect, w.rect, g))) continue;
    const after = [...others, Object.assign({}, window, { rect })];
    if (!preservesVisibility(context.baseline ?? others, after)) continue;
    return { placed: true, rect, reason: 'По сетке' };
  }
  return fallback;
}

export function orderScene(windows) {
  const edges = windows.map(() => []),
    indegree = windows.map(() => 0);
  for (let i = 0; i < windows.length; i++)
    for (let j = 0; j < windows.length; j++) {
      if (windows[i].z < windows[j].z && intersection(windows[i].rect, windows[j].rect)) {
        edges[i].push(j);
        indegree[j]++;
      }
    }
  const remaining = new Set(windows.map((_, i) => i)),
    result = [];
  while (remaining.size) {
    const ready = [...remaining].filter((i) => indegree[i] === 0);
    ready.sort(
      (a, b) =>
        windows[a].rect.y - windows[b].rect.y || windows[a].rect.x - windows[b].rect.x || a - b,
    );
    const i = ready[0];
    result.push(windows[i]);
    remaining.delete(i);
    for (const j of edges[i]) indegree[j]--;
  }
  return result;
}

export function formatScene(windows, g) {
  let scene = windows.map((w) => Object.assign({}, w, { rect: Object.assign({}, w.rect) }));
  let index = 0;
  const context = {},
    results = [];
  for (const original of orderScene(windows.filter((w) => w.eligible !== false))) {
    const current = scene.find((w) => w.id === original.id);
    const result = placeWindow(
      current,
      scene.filter((w) => w.id !== current.id),
      g,
      index,
      Object.assign({}, context, { baseline: scene }),
    );
    scene = scene.map((w) =>
      w.id === current.id ? Object.assign({}, w, { rect: result.rect }) : w,
    );
    if (index % 6 === 2) context.thirdY = result.rect.y;
    results.push(Object.assign({ id: current.id }, result));
    index++;
  }
  return { windows: scene, results, nextIndex: index, thirdY: context.thirdY };
}
