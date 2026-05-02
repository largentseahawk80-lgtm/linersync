import { DEFAULT_PROJECT_SPECS } from './runFieldAudit.js';

export const LINERSYNC_DEFAULT_PROJECT_SPECS = Object.freeze({
  ...DEFAULT_PROJECT_SPECS,
  airTest: Object.freeze({
    ...DEFAULT_PROJECT_SPECS.airTest,
    minDurationMin: 5,
    allowedDropPSI: 2,
    allowedDropPercent: null
  }),
  destruct: Object.freeze({
    ...DEFAULT_PROJECT_SPECS.destruct,
    frequencyFT: 500,
    minPeelLB: 60,
    minShearLB: 80
  }),
  trialWeld: Object.freeze({
    ...DEFAULT_PROJECT_SPECS.trialWeld,
    minPeelLB: 60,
    minShearLB: 80,
    validityHours: 12
  }),
  weather: Object.freeze({
    ...DEFAULT_PROJECT_SPECS.weather,
    minTempF: null,
    maxTempF: null
  }),
  material: Object.freeze({
    ...DEFAULT_PROJECT_SPECS.material,
    yieldTolerancePercent: 0.05
  }),
  exportReadiness: Object.freeze({
    ...DEFAULT_PROJECT_SPECS.exportReadiness,
    requireAllTests: true,
    requirePassOnly: true
  })
});

function mergeSection(defaultSection = {}, overrideSection = {}) {
  return {
    ...defaultSection,
    ...(overrideSection || {})
  };
}

export function getDefaultProjectSpecs(overrides = {}) {
  return {
    airTest: mergeSection(LINERSYNC_DEFAULT_PROJECT_SPECS.airTest, overrides.airTest),
    destruct: mergeSection(LINERSYNC_DEFAULT_PROJECT_SPECS.destruct, overrides.destruct),
    trialWeld: mergeSection(LINERSYNC_DEFAULT_PROJECT_SPECS.trialWeld, overrides.trialWeld),
    weather: mergeSection(LINERSYNC_DEFAULT_PROJECT_SPECS.weather, overrides.weather),
    material: mergeSection(LINERSYNC_DEFAULT_PROJECT_SPECS.material, overrides.material),
    exportReadiness: mergeSection(LINERSYNC_DEFAULT_PROJECT_SPECS.exportReadiness, overrides.exportReadiness)
  };
}

export function resolveProjectSpecs(project = {}, constants = {}) {
  return getDefaultProjectSpecs({
    ...(project.projectSpecs || {}),
    ...(constants.projectSpecs || {})
  });
}

export default getDefaultProjectSpecs;
