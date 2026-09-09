// Coordinates are logical screen units. Build once, then reserve whole edge cells.
export function makeGrid(area, options = {}) {
  const desired = Number(options.desiredStep ?? 30);
  const step = Number.isFinite(desired) && desired >= 8 ? desired : 30;
  const columns = Math.max(1, Math.round(area.width / step));
  const rows = Math.max(1, Math.round(area.height / step));
  const cellWidth = area.width / columns,
    cellHeight = area.height / rows;
  const x = (i) => Math.round(area.x + i * cellWidth);
  const y = (i) => Math.round(area.y + i * cellHeight);
  const margin = (name, fallback) =>
    Math.max(0, Math.floor(Number(options[name] ?? fallback) || 0));
  const left = Math.min(columns, margin('left', 1));
  const right = Math.max(left, columns - margin('right', 1));
  const top = Math.min(rows, margin('top', 1));
  const bottom = Math.max(top, rows - margin('bottom', 2));
  return {
    area: Object.assign({}, area),
    columns,
    rows,
    cellWidth,
    cellHeight,
    x,
    y,
    left,
    right,
    top,
    bottom,
    bounds: { x: x(left), y: y(top), width: x(right) - x(left), height: y(bottom) - y(top) },
    gapCells: Math.max(0, Number(options.gapCells ?? 1)),
  };
}

export function snapSize(size, grid, limits = {}) {
  if (limits.resizeable === false) return { width: size.width, height: size.height };
  function axis(value, cell, available, minimum, maximum) {
    const min = Math.max(1, Number(minimum) || 1);
    const max = Math.min(available, Number(maximum) > 0 ? Number(maximum) : Infinity);
    if (min > max) return value; // Impossible constraints: placement will fall back.
    const lo = Math.ceil(min / cell),
      hi = Math.floor(max / cell);
    if (lo <= hi)
      return Math.min(
        max,
        Math.max(min, Math.round(Math.max(lo, Math.min(hi, Math.round(value / cell))) * cell)),
      );
    return Math.min(max, Math.max(min, value));
  }
  return {
    width: axis(size.width, grid.cellWidth, grid.bounds.width, limits.minWidth, limits.maxWidth),
    height: axis(
      size.height,
      grid.cellHeight,
      grid.bounds.height,
      limits.minHeight,
      limits.maxHeight,
    ),
  };
}
