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

function needsTargetVersionEnrichment(component) {
  const tv = component?.targetVersion;
  return !tv || isOdhBuildType(tv);
}

module.exports = {
  ODH_BUILD_TYPE_VALUES,
  TARGET_VERSION_FIELD,
  isOdhBuildType,
  resolveTargetVersion,
  extractVersionNameFromJiraField,
  needsTargetVersionEnrichment
};
