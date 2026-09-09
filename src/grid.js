// Coordinates are logical screen units. Build once, then reserve whole edge cells.
export function makeGrid(area, options = {}) {
  const desired = Number(options.desiredStep ?? 30),
    step = Number.isFinite(desired) && desired >= 8 ? desired : 30,
    columns = Math.max(1, Math.round(area.width / step)),
    rows = Math.max(1, Math.round(area.height / step)),
    cellWidth = area.width / columns,
    cellHeight = area.height / rows,
    x = (index) => Math.round(area.x + index * cellWidth),
    y = (index) => Math.round(area.y + index * cellHeight),
    margin = (name, fallback) => Math.max(0, Math.floor(Number(options[name] ?? fallback) || 0)),
    left = Math.min(columns, margin('left', 1)),
    right = Math.max(left, columns - margin('right', 1)),
    top = Math.min(rows, margin('top', 1)),
    bottom = Math.max(top, rows - margin('bottom', 2));

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
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sizeLimit(value, minimum, maximum) {
  const min = Math.max(1, Number(minimum) || 1),
    max = Number(maximum) > 0 ? Number(maximum) : Infinity;

  return clamp(value, min, Math.max(min, max));
}

function snapLength(value, cell, available, minimum, maximum) {
  const min = Math.max(1, Number(minimum) || 1),
    max = Number(maximum) > 0 ? Number(maximum) : Infinity,
    usableMax = Math.min(available, max),
    lowCells = Math.ceil(min / cell),
    highCells = Math.floor(usableMax / cell);

  if (lowCells <= highCells) {
    const cells = clamp(Math.round(value / cell), lowCells, highCells);
    return sizeLimit(Math.round(cells * cell), min, max);
  }

  return sizeLimit(value, min, max);
}

function nearestLine(value, origin, cell) {
  return Math.round(origin + Math.round((value - origin) / cell) * cell);
}

function snapCoordinate(value, size, start, end, cell) {
  if (size >= end - start) return start;
  const lowIndex = Math.ceil((start - start) / cell),
    highIndex = Math.floor((end - size - start) / cell),
    index = clamp(Math.round((value - start) / cell), lowIndex, highIndex);

  return Math.round(start + index * cell);
}

export function snapSize(size, grid, limits = {}) {
  if (limits.resizeable === false) return { width: size.width, height: size.height };

  return {
    width: snapLength(
      size.width,
      grid.cellWidth,
      grid.bounds.width,
      limits.minWidth,
      limits.maxWidth,
    ),
    height: snapLength(
      size.height,
      grid.cellHeight,
      grid.bounds.height,
      limits.minHeight,
      limits.maxHeight,
    ),
  };
}

export function snapPosition(rect, grid, limits = {}) {
  if (limits.moveable === false) return Object.assign({}, rect);
  const bounds = grid.bounds;

  return Object.assign({}, rect, {
    x: snapCoordinate(rect.x, rect.width, bounds.x, bounds.x + bounds.width, grid.cellWidth),
    y: snapCoordinate(rect.y, rect.height, bounds.y, bounds.y + bounds.height, grid.cellHeight),
  });
}

export function snapWindow(rect, grid, limits = {}) {
  const size = snapSize(rect, grid, limits);

  return snapPosition(Object.assign({}, rect, size), grid, limits);
}

function snapResizeAxis(
  beforeStart,
  beforeSize,
  afterStart,
  afterSize,
  origin,
  cell,
  boundStart,
  boundEnd,
  min,
  max,
) {
  const beforeEnd = beforeStart + beforeSize,
    afterEnd = afterStart + afterSize,
    startChanged = afterStart !== beforeStart,
    endChanged = afterEnd !== beforeEnd;

  if (!startChanged && !endChanged) return { start: afterStart, size: afterSize };

  let start = startChanged
      ? clamp(nearestLine(afterStart, origin, cell), boundStart, boundEnd)
      : beforeStart,
    end = endChanged ? clamp(nearestLine(afterEnd, origin, cell), boundStart, boundEnd) : beforeEnd;
  const size = sizeLimit(end - start, min, max);

  if (startChanged && !endChanged) start = end - size;
  else end = start + size;

  return { start, size: end - start };
}

export function snapResize(before, after, grid, limits = {}) {
  if (limits.resizeable === false) return Object.assign({}, after);
  const horizontal = snapResizeAxis(
      before.x,
      before.width,
      after.x,
      after.width,
      grid.area.x,
      grid.cellWidth,
      grid.bounds.x,
      grid.bounds.x + grid.bounds.width,
      limits.minWidth,
      limits.maxWidth,
    ),
    vertical = snapResizeAxis(
      before.y,
      before.height,
      after.y,
      after.height,
      grid.area.y,
      grid.cellHeight,
      grid.bounds.y,
      grid.bounds.y + grid.bounds.height,
      limits.minHeight,
      limits.maxHeight,
    );

  return { x: horizontal.start, y: vertical.start, width: horizontal.size, height: vertical.size };
}

export function snapAll(windows, grid) {
  return windows.map((window) =>
    Object.assign({}, window, { rect: snapWindow(window.rect, grid, window.limits ?? window) }),
  );
}
