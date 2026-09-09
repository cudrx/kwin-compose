export function intersection(a, b) {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

export function subtractRect(a, b) {
  const i = intersection(a, b);
  if (!i) return [a];
  return [
    { x: a.x, y: a.y, width: a.width, height: i.y - a.y },
    { x: a.x, y: i.y + i.height, width: a.width, height: a.y + a.height - i.y - i.height },
    { x: a.x, y: i.y, width: i.x - a.x, height: i.height },
    { x: i.x + i.width, y: i.y, width: a.x + a.width - i.x - i.width, height: i.height },
  ].filter((r) => r.width > 0 && r.height > 0);
}

export function visibleArea(rect, covers) {
  let pieces = [rect];
  for (const cover of covers) {
    pieces = pieces.reduce((next, piece) => next.concat(subtractRect(piece, cover)), []);
    if (!pieces.length) return 0;
  }
  return pieces.reduce((sum, r) => sum + r.width * r.height, 0);
}

export function preservesVisibility(before, after) {
  const area = (w, scene) =>
    visibleArea(
      w.rect,
      scene.filter((o) => o.id !== w.id && o.z > w.z).map((o) => o.rect),
    );
  return before.every((w) => {
    const next = after.find((o) => o.id === w.id);
    return !next || area(w, before) <= 0 || area(next, after) > 0;
  });
}

export function sameRect(a, b, tolerance = 0.01) {
  return ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= tolerance);
}
