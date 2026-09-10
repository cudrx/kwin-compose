export const CONFIG_LIMITS = Object.freeze({
  minimumStep: 8,
  maximumStep: 150,
  maximumPadding: 2000,
  minimumWindowSize: 60,
  maximumWindowSize: 6000,
});

export const DEFAULT_CONFIG = Object.freeze({
  desiredStep: 30,
  paddingLeft: 30,
  paddingRight: 30,
  paddingTop: 30,
  paddingBottom: 60,
});

export const READINESS_TIMING = Object.freeze({
  quietMs: 80,
  deadlineMs: 1500,
});

export const WINDOW_PRESETS = Object.freeze({
  browser: Object.freeze({ width: 1260, height: 960 }),
  terminal: Object.freeze({ width: 900, height: 690 }),
  notes: Object.freeze({ width: 660, height: 1050 }),
});

function valueInRange(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

export function normalizeConfig(config = {}) {
  return {
    desiredStep: valueInRange(
      config.desiredStep,
      CONFIG_LIMITS.minimumStep,
      CONFIG_LIMITS.maximumStep,
      DEFAULT_CONFIG.desiredStep,
    ),
    paddingLeft: valueInRange(
      config.paddingLeft,
      0,
      CONFIG_LIMITS.maximumPadding,
      DEFAULT_CONFIG.paddingLeft,
    ),
    paddingRight: valueInRange(
      config.paddingRight,
      0,
      CONFIG_LIMITS.maximumPadding,
      DEFAULT_CONFIG.paddingRight,
    ),
    paddingTop: valueInRange(
      config.paddingTop,
      0,
      CONFIG_LIMITS.maximumPadding,
      DEFAULT_CONFIG.paddingTop,
    ),
    paddingBottom: valueInRange(
      config.paddingBottom,
      0,
      CONFIG_LIMITS.maximumPadding,
      DEFAULT_CONFIG.paddingBottom,
    ),
  };
}
