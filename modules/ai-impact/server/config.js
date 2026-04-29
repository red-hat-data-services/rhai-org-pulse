const DEFAULT_CONFIG = {
  jiraProject: 'RHAIRFE',
  linkedProject: 'RHAISTRAT',
  createdLabel: 'rfe-creator-auto-created',
  revisedLabel: 'rfe-creator-auto-revised',
  testExclusionLabel: 'rfe-creator-skill-testing',
  linkTypeName: 'Cloners',
  excludedStatuses: ['Closed'],
  lookbackMonths: 12,
  trendThresholdPp: 2,
  autofixProjects: ['AIPCC', 'RHOAIENG'],
  autofixCreatedAfter: null
};

// Characters that could enable JQL injection when interpolated into queries
const JQL_UNSAFE_PATTERN = /["'();\\]/;

function validateJqlSafeString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  if (JQL_UNSAFE_PATTERN.test(value)) {
    throw new Error(`${fieldName} contains unsafe characters (quotes, parens, semicolons not allowed)`);
  }
}

function getConfig(readFromStorage) {
  const saved = readFromStorage('ai-impact/config.json');
  return { ...DEFAULT_CONFIG, ...saved };
}

/**
 * Validate and save config. Throws on invalid input.
 * All string fields are checked for JQL-unsafe characters since they are
 * interpolated into JQL queries in rfe-fetcher.js.
 */
function saveConfig(writeToStorage, config) {
  const merged = { ...DEFAULT_CONFIG };

  // Warn about unknown fields (helps catch frontend/backend key mismatches)
  const knownKeys = new Set(Object.keys(DEFAULT_CONFIG));
  for (const key of Object.keys(config)) {
    if (!knownKeys.has(key)) {
      console.warn(`[ai-impact] Unknown config field ignored: "${key}"`);
    }
  }

  // String fields — validate type and JQL safety
  const stringFields = ['jiraProject', 'linkedProject', 'createdLabel',
    'revisedLabel', 'testExclusionLabel', 'linkTypeName'];
  for (const key of stringFields) {
    if (config[key] !== undefined) {
      validateJqlSafeString(config[key], key);
      merged[key] = config[key];
    }
  }

  // autofixCreatedAfter — nullable string, validated only when non-empty
  if (config.autofixCreatedAfter !== undefined) {
    if (config.autofixCreatedAfter === null || config.autofixCreatedAfter === '') {
      merged.autofixCreatedAfter = null;
    } else {
      validateJqlSafeString(config.autofixCreatedAfter, 'autofixCreatedAfter');
      merged.autofixCreatedAfter = config.autofixCreatedAfter;
    }
  }

  // excludedStatuses — must be array of JQL-safe strings
  if (config.excludedStatuses !== undefined) {
    if (!Array.isArray(config.excludedStatuses)) {
      throw new Error('excludedStatuses must be an array');
    }
    for (const s of config.excludedStatuses) {
      validateJqlSafeString(s, 'excludedStatuses entry');
    }
    merged.excludedStatuses = config.excludedStatuses;
  }

  // lookbackMonths — must be a positive integer
  if (config.lookbackMonths !== undefined) {
    const val = Number(config.lookbackMonths);
    if (!Number.isInteger(val) || val < 1 || val > 120) {
      throw new Error('lookbackMonths must be an integer between 1 and 120');
    }
    merged.lookbackMonths = val;
  }

  // trendThresholdPp — must be a non-negative number
  if (config.trendThresholdPp !== undefined) {
    const val = Number(config.trendThresholdPp);
    if (isNaN(val) || val < 0 || val > 50) {
      throw new Error('trendThresholdPp must be a number between 0 and 50');
    }
    merged.trendThresholdPp = val;
  }

  // autofixProjects — must be array of JQL-safe strings
  if (config.autofixProjects !== undefined) {
    if (!Array.isArray(config.autofixProjects)) {
      throw new Error('autofixProjects must be an array');
    }
    for (const p of config.autofixProjects) {
      validateJqlSafeString(p, 'autofixProjects entry');
    }
    merged.autofixProjects = config.autofixProjects;
  }

  writeToStorage('ai-impact/config.json', merged);
}

module.exports = { DEFAULT_CONFIG, getConfig, saveConfig, validateJqlSafeString };
