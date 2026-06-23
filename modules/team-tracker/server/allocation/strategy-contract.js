/**
 * JSDoc type definitions for the allocation strategy contract.
 *
 * Strategies are platform extensions at platform/allocation-strategy/
 * that provide classification logic for the team-tracker allocation system.
 */

/**
 * @typedef {Object} AllocationCategory
 * @property {string} key       - Machine key (e.g., 'tech-debt-quality')
 * @property {string} name      - Display name (e.g., 'Tech Debt & Quality')
 * @property {string} color     - Tailwind color name (e.g., 'amber', 'blue')
 * @property {number} target    - Target percentage (e.g., 40). All targets should sum to 100.
 */

/**
 * @typedef {Object} AllocationStrategy
 * @property {string} id                   - Unique strategy identifier
 * @property {string} name                 - Human-readable name
 * @property {string} description          - Short description
 * @property {AllocationCategory[]} categories - Ordered list of allocation categories
 * @property {function(Object): string} classifyIssue
 *   Given a fetched issue object (with base fields + any extra fields from
 *   getJiraFields), returns the category key it belongs to. Must return one
 *   of the category keys or 'uncategorized'.
 * @property {function(): {fieldIds: string[], extract: function(Object, Object): Object}} [getJiraFields]
 *   Optional. Declares additional Jira custom field IDs to fetch AND an
 *   extract function that pulls strategy-specific values from the raw Jira
 *   issue fields into the issue object that classifyIssue receives.
 */

module.exports = {}
