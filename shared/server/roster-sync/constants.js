/**
 * Shared constants for roster sync.
 */

const DEFAULT_EXCLUDED_TITLES = ['Intern', 'Collaborative Partner', 'Independent Contractor'];

/**
 * Build effective column mapping from user-configured custom fields.
 * The "name" column is always required for person matching.
 *
 * @param {Array} customFields - Array of { key, columnName } objects from config
 * @returns {Object} Map of field key -> column label
 */
function getEffectiveColumns(customFields) {
  const columns = {};
  if (!customFields || !Array.isArray(customFields) || customFields.length === 0) {
    return columns;
  }
  for (const field of customFields) {
    if (field.key && field.columnName && field.columnName.trim()) {
      columns[field.key] = field.columnName.trim();
    }
  }
  return columns;
}

/**
 * Migrate legacy fieldMapping config (object of key->label) to new customFields format.
 * Returns null if no migration needed.
 */
function migrateLegacyFieldMapping(fieldMapping) {
  if (!fieldMapping || typeof fieldMapping !== 'object') return null;
  // Already new format
  if (Array.isArray(fieldMapping)) return null;

  const customFields = [];
  for (const [key, label] of Object.entries(fieldMapping)) {
    if (label && label.trim()) {
      customFields.push({ key, columnName: label.trim() });
    }
  }
  return customFields.length > 0 ? customFields : null;
}

const RESERVED_KEYS = ['_teamGrouping', 'name', 'originalName', 'sourceSheet'];

/**
 * Build effective column mapping from teamStructure config.
 * Maps nameColumn -> 'name', teamGroupingColumn -> '_teamGrouping',
 * and each custom field key -> its columnLabel.
 *
 * @param {Object} teamStructure - The teamStructure config object
 * @returns {Object|null} Map of field key -> column label, or null if invalid
 */
function getEffectiveColumnsFromTeamStructure(teamStructure) {
  if (!teamStructure) return null;
  if (!teamStructure.nameColumn || !teamStructure.teamGroupingColumn) return null;

  const columns = {
    name: teamStructure.nameColumn,
    _teamGrouping: teamStructure.teamGroupingColumn
  };

  if (Array.isArray(teamStructure.customFields)) {
    for (const field of teamStructure.customFields) {
      if (field.key && field.columnLabel && field.columnLabel.trim()) {
        columns[field.key] = field.columnLabel.trim();
      }
    }
  }

  return columns;
}

module.exports = {
  DEFAULT_EXCLUDED_TITLES,
  RESERVED_KEYS,
  getEffectiveColumns,
  getEffectiveColumnsFromTeamStructure,
  migrateLegacyFieldMapping
};
