/**
 * Target version resolution for component onboarding.
 *
 * targetVersion must reflect Jira customfield_10855 (e.g. "3.6 GA RHOAI RELEASE").
 * ODH YAML build_type values ("CI", "Release") are not release versions — they are
 * ignored here and back-filled from Jira during sync when credentials are available.
 */

const ODH_BUILD_TYPE_VALUES = new Set(['ci', 'release']);

const TARGET_VERSION_FIELD = 'customfield_10855';

function isOdhBuildType(value) {
  if (value == null) return false;
  return ODH_BUILD_TYPE_VALUES.has(String(value).toLowerCase().trim());
}

/**
 * Pick the Jira Target Version string from a bulk-ingest body.
 * @param {object} body
 * @returns {string|null}
 */
function resolveTargetVersion(body) {
  const jiraTv = typeof body.jiraTargetVersion === 'string' ? body.jiraTargetVersion.trim() : '';
  if (jiraTv && !isOdhBuildType(jiraTv)) return jiraTv;

  const raw = typeof body.targetVersion === 'string' ? body.targetVersion.trim() : '';
  if (!raw) return null;
  if (isOdhBuildType(raw)) return null;

  return raw;
}

/**
 * ODH YAML build_type from explicit field or legacy targetVersion ingest.
 * Stored for ingest audit only — not projected to API clients.
 * @param {object} body
 * @returns {string|null}
 */
function resolveBuildType(body) {
  const explicit = typeof body.buildType === 'string' ? body.buildType.trim() : '';
  if (explicit) return explicit;

  const raw = typeof body.targetVersion === 'string' ? body.targetVersion.trim() : '';
  if (raw && isOdhBuildType(raw)) return raw;

  return null;
}

/**
 * @param {*} field - Raw Jira customfield_10855 value
 * @returns {string|null}
 */
function extractVersionNameFromJiraField(field) {
  if (field == null) return null;
  if (Array.isArray(field)) {
    for (const v of field) {
      if (v && v.name) return v.name;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }
  if (typeof field === 'object' && field.name) return field.name;
  if (typeof field === 'string' && field.trim()) return field.trim();
  return null;
}

/**
 * Whether a component should be included in a Jira Target Version enrichment batch.
 * Skips rows that already have a release version or were checked with no Jira value.
 * @param {object|null|undefined} component
 */
function needsTargetVersionEnrichment(component) {
  if (!component) return false;

  const tv = component.targetVersion;
  if (tv && !isOdhBuildType(tv)) return false;
  if (component.targetVersionCheckedAt) return false;

  return true;
}

function markTargetVersionChecked(component) {
  component.targetVersionCheckedAt = new Date().toISOString();
}

module.exports = {
  ODH_BUILD_TYPE_VALUES,
  TARGET_VERSION_FIELD,
  isOdhBuildType,
  resolveTargetVersion,
  resolveBuildType,
  extractVersionNameFromJiraField,
  needsTargetVersionEnrichment,
  markTargetVersionChecked
};
