/**
 * Platform-level shared secret group definitions.
 *
 * These represent secrets consumed by multiple modules (e.g. Jira credentials
 * used by both team-tracker and releases). Modules reference them by group ID
 * in their module.json `secrets.platform` array.
 *
 * @module shared/server/platform-secrets
 */

module.exports = [
  {
    id: 'jira',
    label: 'Jira Cloud',
    description: 'Jira Cloud API credentials for issue tracking and metrics',
    secrets: [
      { key: 'JIRA_EMAIL', description: 'Jira account email (@redhat.com)', required: true },
      { key: 'JIRA_TOKEN', description: 'Jira Cloud API token', required: true },
    ]
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'GitHub API access for contribution stats',
    secrets: [
      { key: 'GITHUB_TOKEN', description: 'Classic PAT with read:user scope', required: false }
    ]
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    description: 'GitLab API access for contribution stats',
    secrets: [
      { key: 'GITLAB_TOKEN', description: 'GitLab PAT with read_api scope', required: false }
    ]
  },
  {
    id: 'ipa',
    label: 'IPA LDAP',
    description: 'LDAP credentials for roster sync (requires VPN)',
    secrets: [
      { key: 'IPA_BIND_DN', description: 'LDAP bind DN (service account)', required: false },
      { key: 'IPA_BIND_PASSWORD', description: 'LDAP bind password', required: false }
    ]
  },
  {
    id: 'google',
    label: 'Google Service Account',
    description: 'Google Sheets access for roster enrichment',
    secrets: [
      { key: 'GOOGLE_SERVICE_ACCOUNT_KEY_FILE', description: 'Path to SA JSON key file', required: false, default: '/etc/secrets/google-sa-key.json' }
    ]
  }
]
