export const CONFIG_LIMITS = Object.freeze({
  minimumStep: 8,
  maximumStep: 150,
  maximumPadding: 2000,
});

export const DEFAULT_CONFIG = Object.freeze({
  desiredStep: 40,
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 20,
  paddingBottom: 20,
  floatingPanelInset: 8,
});

export const READINESS_TIMING = Object.freeze({
  deadlineMs: 1500,
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
    floatingPanelInset: valueInRange(
      config.floatingPanelInset,
      0,
      CONFIG_LIMITS.maximumPadding,
      DEFAULT_CONFIG.floatingPanelInset,
    ),
  };
}
