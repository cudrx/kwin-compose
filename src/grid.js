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
    margin = (name, fallback) =>
      Math.max(0, Math.floor(Number(options[name] ?? fallback) || 0)),
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
    bounds: {
      x: x(left),
      y: y(top),
      width: x(right) - x(left),
      height: y(bottom) - y(top),
    },
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizedLimits(minimum, maximum) {
  const min = Math.max(1, Number(minimum) || 1),
    max = Number(maximum) > 0 ? Number(maximum) : Infinity;

  return { min, max: Math.max(min, max) };
}

function sizeLimit(value, minimum, maximum) {
  const limits = normalizedLimits(minimum, maximum);
  return clamp(value, limits.min, limits.max);
}

function axis(grid, horizontal) {
  return horizontal
    ? { line: grid.x, first: grid.left, last: grid.right }
    : { line: grid.y, first: grid.top, last: grid.bottom };
}

function nearestIndex(value, spec, last = spec.last) {
  let best = spec.first;
  for (let index = spec.first + 1; index <= last; index++)
    if (Math.abs(spec.line(index) - value) < Math.abs(spec.line(best) - value))
      best = index;
  return best;
}

function snappedSize(value, spec, minimum, maximum) {
  const limits = normalizedLimits(minimum, maximum);
  let best;
  for (let start = spec.first; start < spec.last; start++) {
    for (let end = start + 1; end <= spec.last; end++) {
      const size = spec.line(end) - spec.line(start);
      if (size < limits.min || size > limits.max) continue;
      if (best === undefined || Math.abs(size - value) < Math.abs(best - value))
        best = size;
    }
  }

  return best ?? sizeLimit(value, limits.min, limits.max);
}

function snapWindowAxis(position, length, spec, minimum, maximum) {
  const limits = normalizedLimits(minimum, maximum);
  let best = null;
  for (let start = spec.first; start < spec.last; start++) {
    for (let end = start + 1; end <= spec.last; end++) {
      const size = spec.line(end) - spec.line(start);
      if (size < limits.min || size > limits.max) continue;
      const candidate = {
        position: spec.line(start),
        length: size,
        sizeDistance: Math.abs(size - length),
        positionDistance: Math.abs(spec.line(start) - position),
      };
      if (
        !best ||
        candidate.sizeDistance < best.sizeDistance ||
        (candidate.sizeDistance === best.sizeDistance &&
          candidate.positionDistance < best.positionDistance)
      )
        best = candidate;
    }
  }

  if (best) return best;
  const constrained = sizeLimit(length, limits.min, limits.max);
  let last = spec.first;
  for (let index = spec.first; index <= spec.last; index++)
    if (spec.line(index) + constrained <= spec.line(spec.last)) last = index;
  const index = nearestIndex(position, spec, last);
  return { position: spec.line(index), length: constrained };
}

function snapCoordinate(value, size, spec) {
  let last = spec.first;
  for (let index = spec.first; index <= spec.last; index++)
    if (spec.line(index) + size <= spec.line(spec.last)) last = index;
  return spec.line(nearestIndex(value, spec, last));
}

export function snapSize(size, grid, limits = {}) {
  if (limits.resizeable === false)
    return { width: size.width, height: size.height };

  return {
    width: snappedSize(
      size.width,
      axis(grid, true),
      limits.minWidth,
      limits.maxWidth,
    ),
    height: snappedSize(
      size.height,
      axis(grid, false),
      limits.minHeight,
      limits.maxHeight,
    ),
  };
}

export function snapPosition(rect, grid, limits = {}) {
  if (limits.moveable === false) return Object.assign({}, rect);
  return Object.assign({}, rect, {
    x: snapCoordinate(rect.x, rect.width, axis(grid, true)),
    y: snapCoordinate(rect.y, rect.height, axis(grid, false)),
  });
}

export function snapWindow(rect, grid, limits = {}) {
  if (limits.resizeable === false) return snapPosition(rect, grid, limits);
  const horizontal = snapWindowAxis(
      rect.x,
      rect.width,
      axis(grid, true),
      limits.minWidth,
      limits.maxWidth,
    ),
    vertical = snapWindowAxis(
      rect.y,
      rect.height,
      axis(grid, false),
      limits.minHeight,
      limits.maxHeight,
    );

  return {
    x: horizontal.position,
    y: vertical.position,
    width: horizontal.length,
    height: vertical.length,
  };
}

function snapResizeAxis(
  beforeStart,
  beforeSize,
  afterStart,
  afterSize,
  spec,
  minimum,
  maximum,
) {
  const beforeEnd = beforeStart + beforeSize,
    afterEnd = afterStart + afterSize,
    startChanged = afterStart !== beforeStart,
    endChanged = afterEnd !== beforeEnd,
    limits = normalizedLimits(minimum, maximum);

  if (!startChanged && !endChanged)
    return { start: afterStart, size: afterSize };

  let best = null;
  for (let startIndex = spec.first; startIndex <= spec.last; startIndex++) {
    for (let endIndex = startIndex + 1; endIndex <= spec.last; endIndex++) {
      const start = startChanged ? spec.line(startIndex) : beforeStart,
        end = endChanged ? spec.line(endIndex) : beforeEnd,
        size = end - start;
      if (size < limits.min || size > limits.max) continue;
      const distance =
        (startChanged ? Math.abs(start - afterStart) : 0) +
        (endChanged ? Math.abs(end - afterEnd) : 0);
      if (!best || distance < best.distance) best = { start, size, distance };
    }
  }
  if (best) return { start: best.start, size: best.size };

  const size = sizeLimit(afterSize, limits.min, limits.max),
    start = startChanged && !endChanged ? beforeEnd - size : afterStart;

  return { start, size };
}

export function snapResize(before, after, grid, limits = {}) {
  if (limits.resizeable === false) return Object.assign({}, after);
  const horizontal = snapResizeAxis(
      before.x,
      before.width,
      after.x,
      after.width,
      axis(grid, true),
      limits.minWidth,
      limits.maxWidth,
    ),
    vertical = snapResizeAxis(
      before.y,
      before.height,
      after.y,
      after.height,
      axis(grid, false),
      limits.minHeight,
      limits.maxHeight,
    );

  return {
    x: horizontal.start,
    y: vertical.start,
    width: horizontal.size,
    height: vertical.size,
  };
}

export function snapAll(windows, grid) {
  return windows.map((window) =>
    Object.assign({}, window, {
      rect: snapWindow(window.rect, grid, window.limits ?? window),
    }),
  );
}
