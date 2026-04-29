const DEFAULT_CONFIG = {
  projectKeys: ['AIPCC', 'INFERENG', 'RHAIENG', 'RHOAIENG'],
  storyPointsField: 'customfield_10028',
  featureWeightField: '',
  baselineDays: 180,
  baselineMode: 'p90',
  riskIssuesPerDayGreen: 1,
  riskIssuesPerDayYellow: 10,
  productPagesReleasesUrl: '',
  productPagesProductShortnames: [],
  productPagesBaseUrl: 'https://productpages.redhat.com',
  productPagesTokenUrl: 'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token',
  jiraAllProjects: false,
  targetVersionJqlFragment: '',
  velocityDiscountFactor: 0.5,
  velocityExtraJqlByProject: {
    AIPCC: 'issuetype = Epic AND labels = package'
  }
};

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]+$/;
const CUSTOM_FIELD_PATTERN = /^customfield_\d+$/;
const OPTIONAL_CUSTOM_FIELD_PATTERN = /^(customfield_\d+)?$/;

function applyEnvOverrides(config) {
  const env = process.env;

  if (env.RELEASE_ANALYSIS_PROJECT_KEYS) {
    config.projectKeys = env.RELEASE_ANALYSIS_PROJECT_KEYS.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (env.JIRA_STORY_POINTS_FIELD) {
    config.storyPointsField = env.JIRA_STORY_POINTS_FIELD;
  }
  if (env.RELEASE_ANALYSIS_WEIGHT_FIELD) {
    config.featureWeightField = env.RELEASE_ANALYSIS_WEIGHT_FIELD;
  }
  if (env.RELEASE_ANALYSIS_BASELINE_DAYS) {
    const parsed = parseInt(env.RELEASE_ANALYSIS_BASELINE_DAYS, 10);
    if (Number.isFinite(parsed) && parsed > 0) config.baselineDays = parsed;
  }
  if (env.RELEASE_ANALYSIS_BASELINE_MODE) {
    const val = env.RELEASE_ANALYSIS_BASELINE_MODE.toLowerCase();
    if (['avg', 'p90'].includes(val)) config.baselineMode = val;
  }
  if (env.RELEASE_ANALYSIS_RISK_ISSUES_PER_DAY_GREEN) {
    const parsed = parseFloat(env.RELEASE_ANALYSIS_RISK_ISSUES_PER_DAY_GREEN);
    if (Number.isFinite(parsed) && parsed > 0) config.riskIssuesPerDayGreen = parsed;
  }
  if (env.RELEASE_ANALYSIS_RISK_ISSUES_PER_DAY_YELLOW) {
    const parsed = parseFloat(env.RELEASE_ANALYSIS_RISK_ISSUES_PER_DAY_YELLOW);
    if (Number.isFinite(parsed) && parsed > 0) config.riskIssuesPerDayYellow = parsed;
  }
  if (env.PRODUCT_PAGES_RELEASES_URL) {
    config.productPagesReleasesUrl = env.PRODUCT_PAGES_RELEASES_URL;
  }
  if (env.PRODUCT_PAGES_PRODUCT_SHORTNAMES) {
    config.productPagesProductShortnames = env.PRODUCT_PAGES_PRODUCT_SHORTNAMES.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (env.PRODUCT_PAGES_BASE_URL) {
    config.productPagesBaseUrl = env.PRODUCT_PAGES_BASE_URL;
  }
  if (env.PRODUCT_PAGES_TOKEN_URL) {
    config.productPagesTokenUrl = env.PRODUCT_PAGES_TOKEN_URL;
  }
  if (env.RELEASE_ANALYSIS_JIRA_ALL_PROJECTS) {
    config.jiraAllProjects = ['1', 'true', 'yes'].includes(
      String(env.RELEASE_ANALYSIS_JIRA_ALL_PROJECTS).toLowerCase()
    );
  }
  if (env.RELEASE_ANALYSIS_VELOCITY_DISCOUNT_FACTOR) {
    const parsed = parseFloat(env.RELEASE_ANALYSIS_VELOCITY_DISCOUNT_FACTOR);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) config.velocityDiscountFactor = parsed;
  }
  if (env.RELEASE_ANALYSIS_VELOCITY_EXTRA_JQL_BY_PROJECT) {
    try {
      const parsed = JSON.parse(env.RELEASE_ANALYSIS_VELOCITY_EXTRA_JQL_BY_PROJECT);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config.velocityExtraJqlByProject = parsed;
      }
    } catch {
      console.warn('[release-analysis] Invalid RELEASE_ANALYSIS_VELOCITY_EXTRA_JQL_BY_PROJECT JSON; ignoring');
    }
  }
  if (env.RELEASE_ANALYSIS_TARGET_VERSION_JQL_FRAGMENT) {
    config.targetVersionJqlFragment = String(env.RELEASE_ANALYSIS_TARGET_VERSION_JQL_FRAGMENT).trim();
  }

  return config;
}

function getConfig(readFromStorage) {
  const saved = readFromStorage('release-analysis/config.json');
  let config;

  // saved is null when file doesn't exist or was cleared by deleteConfig
  if (saved && typeof saved === 'object' && !saved._deleted) {
    config = { ...DEFAULT_CONFIG, ...saved };
  } else {
    config = applyEnvOverrides({ ...DEFAULT_CONFIG });
  }

  // featureWeightField fallback: if empty, use storyPointsField
  if (!config.featureWeightField) {
    config.featureWeightField = config.storyPointsField;
  }

  return config;
}

function saveConfig(writeToStorage, config) {
  const merged = { ...DEFAULT_CONFIG };

  const knownKeys = new Set(Object.keys(DEFAULT_CONFIG));
  for (const key of Object.keys(config)) {
    if (!knownKeys.has(key)) {
      console.warn(`[release-analysis] Unknown config field ignored: "${key}"`);
    }
  }

  // projectKeys — array of Jira project key strings
  if (config.projectKeys !== undefined) {
    let keys = config.projectKeys;
    if (typeof keys === 'string') {
      keys = keys.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('projectKeys must be a non-empty array of Jira project keys');
    }
    for (const k of keys) {
      if (typeof k !== 'string' || !PROJECT_KEY_PATTERN.test(k)) {
        throw new Error(`Invalid project key "${k}": must match ${PROJECT_KEY_PATTERN}`);
      }
    }
    merged.projectKeys = keys;
  }

  // storyPointsField — required, must be a customfield
  if (config.storyPointsField !== undefined) {
    if (typeof config.storyPointsField !== 'string' || !CUSTOM_FIELD_PATTERN.test(config.storyPointsField)) {
      throw new Error('storyPointsField must be a non-empty string matching customfield_NNNNN');
    }
    merged.storyPointsField = config.storyPointsField;
  }

  // featureWeightField — optional customfield (empty allowed)
  if (config.featureWeightField !== undefined) {
    if (typeof config.featureWeightField !== 'string' || !OPTIONAL_CUSTOM_FIELD_PATTERN.test(config.featureWeightField)) {
      throw new Error('featureWeightField must be empty or match customfield_NNNNN');
    }
    merged.featureWeightField = config.featureWeightField;
  }

  // baselineDays — integer 1–730
  if (config.baselineDays !== undefined) {
    const val = Number(config.baselineDays);
    if (!Number.isInteger(val) || val < 1 || val > 730) {
      throw new Error('baselineDays must be an integer between 1 and 730');
    }
    merged.baselineDays = val;
  }

  // baselineMode — one of avg, p90
  if (config.baselineMode !== undefined) {
    const val = String(config.baselineMode).toLowerCase();
    if (!['avg', 'p90'].includes(val)) {
      throw new Error('baselineMode must be one of: avg, p90');
    }
    merged.baselineMode = val;
  }

  // riskIssuesPerDayGreen — number > 0
  if (config.riskIssuesPerDayGreen !== undefined) {
    const val = Number(config.riskIssuesPerDayGreen);
    if (isNaN(val) || val <= 0) {
      throw new Error('riskIssuesPerDayGreen must be a number greater than 0');
    }
    merged.riskIssuesPerDayGreen = val;
  }

  // riskIssuesPerDayYellow — number > green value
  if (config.riskIssuesPerDayYellow !== undefined) {
    const val = Number(config.riskIssuesPerDayYellow);
    if (isNaN(val) || val <= merged.riskIssuesPerDayGreen) {
      throw new Error('riskIssuesPerDayYellow must be a number greater than riskIssuesPerDayGreen');
    }
    merged.riskIssuesPerDayYellow = val;
  }

  // productPagesReleasesUrl — must be empty or a valid HTTP(S) URL
  if (config.productPagesReleasesUrl !== undefined) {
    if (typeof config.productPagesReleasesUrl !== 'string') {
      throw new Error('productPagesReleasesUrl must be a string');
    }
    const url = config.productPagesReleasesUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      throw new Error('productPagesReleasesUrl must be an HTTP or HTTPS URL');
    }
    merged.productPagesReleasesUrl = url;
  }

  // productPagesProductShortnames — array of shortname strings (empty allowed)
  if (config.productPagesProductShortnames !== undefined) {
    let items = config.productPagesProductShortnames;
    if (typeof items === 'string') {
      items = items.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(items)) {
      throw new Error('productPagesProductShortnames must be an array');
    }
    const SHORTNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
    for (const s of items) {
      if (typeof s !== 'string' || !SHORTNAME_PATTERN.test(s)) {
        throw new Error(`Invalid product shortname "${s}": must match ${SHORTNAME_PATTERN}`);
      }
    }
    merged.productPagesProductShortnames = items;
  }

  // productPagesBaseUrl — empty or valid HTTP(S) URL
  if (config.productPagesBaseUrl !== undefined) {
    if (typeof config.productPagesBaseUrl !== 'string') {
      throw new Error('productPagesBaseUrl must be a string');
    }
    const url = config.productPagesBaseUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      throw new Error('productPagesBaseUrl must be an HTTP or HTTPS URL');
    }
    merged.productPagesBaseUrl = url;
  }

  // productPagesTokenUrl — empty or valid HTTP(S) URL
  if (config.productPagesTokenUrl !== undefined) {
    if (typeof config.productPagesTokenUrl !== 'string') {
      throw new Error('productPagesTokenUrl must be a string');
    }
    const url = config.productPagesTokenUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      throw new Error('productPagesTokenUrl must be an HTTP or HTTPS URL');
    }
    merged.productPagesTokenUrl = url;
  }

  // jiraAllProjects — boolean
  if (config.jiraAllProjects !== undefined) {
    merged.jiraAllProjects = Boolean(config.jiraAllProjects);
  }

  // velocityDiscountFactor — number > 0 and <= 1
  if (config.velocityDiscountFactor !== undefined) {
    const val = Number(config.velocityDiscountFactor);
    if (isNaN(val) || val <= 0 || val > 1) {
      throw new Error('velocityDiscountFactor must be a number between 0 (exclusive) and 1 (inclusive)');
    }
    merged.velocityDiscountFactor = val;
  }

  // velocityExtraJqlByProject — map of project key → extra JQL filter for velocity queries
  if (config.velocityExtraJqlByProject !== undefined) {
    const val = config.velocityExtraJqlByProject;
    if (typeof val !== 'object' || val === null || Array.isArray(val)) {
      throw new Error('velocityExtraJqlByProject must be a plain object');
    }
    for (const [key, jql] of Object.entries(val)) {
      if (!PROJECT_KEY_PATTERN.test(key)) {
        throw new Error(`Invalid project key "${key}" in velocityExtraJqlByProject`);
      }
      if (typeof jql !== 'string' || !jql.trim()) {
        throw new Error(`velocityExtraJqlByProject["${key}"] must be a non-empty string`);
      }
      if (jql.length > 500) {
        throw new Error(`velocityExtraJqlByProject["${key}"] must be 500 characters or fewer`);
      }
      if (/ORDER\s+BY/i.test(jql)) {
        throw new Error(`velocityExtraJqlByProject["${key}"] must not contain ORDER BY`);
      }
      if (jql.includes(';') || jql.includes('--')) {
        throw new Error(`velocityExtraJqlByProject["${key}"] contains invalid characters`);
      }
    }
    merged.velocityExtraJqlByProject = val;
  }

  // targetVersionJqlFragment — string, security-checked
  if (config.targetVersionJqlFragment !== undefined) {
    if (typeof config.targetVersionJqlFragment !== 'string') {
      throw new Error('targetVersionJqlFragment must be a string');
    }
    const fragment = config.targetVersionJqlFragment.trim();
    if (fragment.length > 500) {
      throw new Error('targetVersionJqlFragment must be 500 characters or fewer');
    }
    if (/ORDER\s+BY/i.test(fragment)) {
      throw new Error('targetVersionJqlFragment must not contain ORDER BY');
    }
    if (fragment.includes(';') || fragment.includes('--')) {
      throw new Error('targetVersionJqlFragment contains invalid characters');
    }
    merged.targetVersionJqlFragment = fragment;
  }

  writeToStorage('release-analysis/config.json', merged);
}

function deleteConfig(writeToStorage) {
  // Storage API has no delete-file function. Write a tombstone marker that
  // getConfig recognises as "no stored config" so it falls back to env vars.
  writeToStorage('release-analysis/config.json', { _deleted: true });
}

module.exports = { DEFAULT_CONFIG, getConfig, saveConfig, deleteConfig };
