/**
 * ESLint rule: no-module-process-env
 *
 * Prevents modules from accessing process.env for secrets.
 * Module code should use context.secrets or context.resolveSecret() instead.
 *
 * Non-secret configuration variables (DEMO_MODE, NODE_ENV, etc.) are allowed.
 * Test files are excluded via the ESLint config (ignores pattern).
 */

const ALLOWED = new Set([
  'DEMO_MODE',
  'NODE_ENV',
  'API_PORT',
  'HTTPS_PROXY',
  'https_proxy',
  'JIRA_HOST',
  'JIRA_STORY_POINTS_FIELD',
  'GITLAB_BASE_URL',
  'PRODUCT_PAGES_BASE_URL',
  'PRODUCT_PAGES_RELEASES_URL',
  'PRODUCT_PAGES_PRODUCT_SHORTNAMES',
  'PRODUCT_PAGES_TOKEN_URL',
  'PRODUCT_BUILDS_API_URL',
  'UPSTREAM_PULSE_API_URL',
  'UPSTREAM_SYNC_SERVICE_USER',
  'RELEASE_ANALYSIS_PROJECT_KEYS',
  'RELEASE_ANALYSIS_WEIGHT_FIELD',
  'RELEASE_ANALYSIS_BASELINE_DAYS',
  'RELEASE_ANALYSIS_BASELINE_MODE',
  'RELEASE_ANALYSIS_RISK_ISSUES_PER_DAY_GREEN',
  'RELEASE_ANALYSIS_RISK_ISSUES_PER_DAY_YELLOW',
  'RELEASE_ANALYSIS_JIRA_ALL_PROJECTS',
  'RELEASE_ANALYSIS_TARGET_VERSION_FIELD',
  'RELEASE_ANALYSIS_TARGET_VERSION_JQL_FRAGMENT',
  'RELEASE_ANALYSIS_VELOCITY_EXTRA_JQL_BY_PROJECT',
  'SMARTSHEET_SHEET_ID'
])

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow process.env access for secrets in module code'
    },
    messages: {
      forbidden: 'Use context.secrets or context.resolveSecret() instead of process.env.{{name}} in module code.',
      forbiddenComputed: 'Use context.resolveSecret(varName) instead of process.env[varName] in module code.'
    }
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.type === 'MemberExpression' &&
            node.object.object.name === 'process' &&
            node.object.property.name === 'env') {
          // Static access: process.env.SOME_VAR
          if (!node.computed && node.property.type === 'Identifier' && !ALLOWED.has(node.property.name)) {
            context.report({ node, messageId: 'forbidden', data: { name: node.property.name } })
          }
          // Computed access: process.env[varName]
          if (node.computed) {
            context.report({ node, messageId: 'forbiddenComputed' })
          }
        }
      }
    }
  }
}
