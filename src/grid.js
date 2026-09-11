import { DEFAULT_CONFIG, normalizeConfig } from './config.js';

// Coordinates are logical screen units. The grid covers the entire work area.
export function makeGrid(area, options = {}) {
  const step = normalizeConfig(options).desiredStep,
    columns = Math.max(1, Math.round(area.width / step)),
    rows = Math.max(1, Math.round(area.height / step)),
    cellWidth = area.width / columns,
    cellHeight = area.height / rows,
    x = (index) => Math.round(area.x + index * cellWidth),
    y = (index) => Math.round(area.y + index * cellHeight);

  return {
    area: Object.assign({}, area),
    columns,
    rows,
    cellWidth,
    cellHeight,
    x,
    y,
  };
}

export function insetArea(area, padding = {}) {
  const value = (side, fallback) =>
      Math.max(0, Number(padding[side] ?? fallback) || 0),
    left = Math.min(area.width, value('left', DEFAULT_CONFIG.paddingLeft)),
    right = Math.min(
      area.width - left,
      value('right', DEFAULT_CONFIG.paddingRight),
    ),
    top = Math.min(area.height, value('top', DEFAULT_CONFIG.paddingTop)),
    bottom = Math.min(
      area.height - top,
      value('bottom', DEFAULT_CONFIG.paddingBottom),
    );

  return {
    x: area.x + left,
    y: area.y + top,
    width: area.width - left - right,
    height: area.height - top - bottom,
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

function axis(context, horizontal) {
  const grid = context.grid,
    bounds = context.bounds,
    line = horizontal ? grid.x : grid.y,
    count = horizontal ? grid.columns : grid.rows,
    start = horizontal ? bounds.x : bounds.y,
    end = start + (horizontal ? bounds.width : bounds.height),
    origin = horizontal ? grid.area.x : grid.area.y,
    cell = horizontal ? grid.cellWidth : grid.cellHeight;
  let first = 0,
    last = count;
  while (first < count && line(first) < start) first++;
  while (last > first && line(last) > end) last--;

  return { line, first, last, origin, cell };
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

function snapUnboundedCoordinate(value, spec) {
  const estimated = Math.round((value - spec.origin) / spec.cell);
  let best = estimated;
  for (let index = estimated - 2; index <= estimated + 2; index++)
    if (Math.abs(spec.line(index) - value) < Math.abs(spec.line(best) - value))
      best = index;

  return spec.line(best);
}

function snapContainedPosition(rect, context, limits) {
  if (limits.moveable === false) return Object.assign({}, rect);

  return Object.assign({}, rect, {
    x: snapCoordinate(rect.x, rect.width, axis(context, true)),
    y: snapCoordinate(rect.y, rect.height, axis(context, false)),
  });
}

export function snapSize(size, context, limits = {}) {
  if (limits.resizeable === false)
    return { width: size.width, height: size.height };

  return {
    width: snappedSize(
      size.width,
      axis(context, true),
      limits.minWidth,
      limits.maxWidth,
    ),
    height: snappedSize(
      size.height,
      axis(context, false),
      limits.minHeight,
      limits.maxHeight,
    ),
  };
}

export function snapPosition(rect, context, limits = {}) {
  if (limits.moveable === false) return Object.assign({}, rect);

  return Object.assign({}, rect, {
    x: snapUnboundedCoordinate(rect.x, axis(context, true)),
    y: snapUnboundedCoordinate(rect.y, axis(context, false)),
  });
}

export function snapWindow(rect, context, limits = {}) {
  if (limits.resizeable === false)
    return snapContainedPosition(rect, context, limits);
  const horizontal = snapWindowAxis(
      rect.x,
      rect.width,
      axis(context, true),
      limits.minWidth,
      limits.maxWidth,
    ),
    vertical = snapWindowAxis(
      rect.y,
      rect.height,
      axis(context, false),
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

export function snapResize(before, after, context, limits = {}) {
  if (limits.resizeable === false) return Object.assign({}, after);
  const horizontal = snapResizeAxis(
      before.x,
      before.width,
      after.x,
      after.width,
      axis(context, true),
      limits.minWidth,
      limits.maxWidth,
    ),
    vertical = snapResizeAxis(
      before.y,
      before.height,
      after.y,
      after.height,
      axis(context, false),
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
