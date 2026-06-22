import { extractProduct, extractVersion } from '../composables/release-utils'

// FIPS is first because it is matched by keyword, not by value prefix.
export const KNOWN_CATEGORIES = [
  'fips', 'hermetic_task', 'test', 'tasks', 'schedule',
  'sbom_spdx', 'rpm_signature', 'cve', 'other'
]

export const CATEGORY_BADGE = {
  fips:                  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  hermetic_task:         'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  test:                  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  tasks:                 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  schedule:              'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  sbom_spdx:             'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  rpm_signature:         'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  cve:                   'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  source_image:          'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  step_image_registries: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  other:                 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

export const CATEGORY_DOCS = {
  fips:                  'https://conforma.dev/docs/policy/packages/release_test.html',
  hermetic_task:         'https://conforma.dev/docs/policy/packages/release_hermetic_task.html',
  test:                  'https://conforma.dev/docs/policy/packages/release_test.html',
  tasks:                 'https://conforma.dev/docs/policy/packages/release_tasks.html',
  schedule:              'https://conforma.dev/docs/policy/packages/release_schedule.html',
  sbom_spdx:             'https://conforma.dev/docs/policy/packages/release_sbom_spdx.html',
  rpm_signature:         'https://conforma.dev/docs/policy/packages/release_rpm_signature.html',
  cve:                   'https://conforma.dev/docs/policy/packages/release_cve.html',
  source_image:          'https://conforma.dev/docs/policy/packages/release_source_image.html',
  step_image_registries: 'https://conforma.dev/docs/policy/packages/task_step_image_registries.html',
}

export const EXTENSION_JIRA_TEMPLATE_URL = 'https://redhat.atlassian.net/browse/RHOAIENG-62569'

export const ACTIONABLE_DAYS_THRESHOLD = 7

export const AI_CATEGORIES = {
  partner_permanent: {
    label: 'Partner Content',
    description: 'Binary content from hardware partners — no source available. Permanent exception with recurring ProdSec review.',
    badgeCls: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    color: 'rgba(100,116,139,0.8)',
    borderColor: 'rgb(100,116,139)'
  },
  platform_adoption: {
    label: 'Platform Adoption',
    description: 'Resolvable by migrating images to AIPCC base containers and packages.',
    badgeCls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    color: 'rgba(59,130,246,0.8)',
    borderColor: 'rgb(59,130,246)'
  },
  package_onboarding: {
    label: 'Package Build',
    description: 'Requires building new packages from source or resolving complex build dependencies.',
    badgeCls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    color: 'rgba(245,158,11,0.8)',
    borderColor: 'rgb(245,158,11)'
  },
  component_update: {
    label: 'Component Update',
    description: 'Component team needs to bump version pins or relax constraints to use AIPCC-provided versions.',
    badgeCls: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
    color: 'rgba(6,182,212,0.8)',
    borderColor: 'rgb(6,182,212)'
  },
  risk_accepted: {
    label: 'Risk Accepted',
    description: 'Formally accepted via PRODSECRM risk register with VP sign-off.',
    badgeCls: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    color: 'rgba(139,92,246,0.8)',
    borderColor: 'rgb(139,92,246)'
  },
  resolved: {
    label: 'Resolved',
    description: 'Root cause addressed or exception removable.',
    badgeCls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    color: 'rgba(16,185,129,0.8)',
    borderColor: 'rgb(16,185,129)'
  }
}

export const PERMANENT_TARGET = 'permanent'

// ─── Policy file display helpers ────────────────────────────────────────────

const POLICY_LABELS = {
  fbc: 'FBC',
  registry: 'Components',
}

const POLICY_COLORS = [
  { bg: 'rgba(59,130,246,0.75)', border: 'rgb(59,130,246)', badgeCls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { bg: 'rgba(16,185,129,0.75)', border: 'rgb(16,185,129)', badgeCls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
  { bg: 'rgba(245,158,11,0.75)', border: 'rgb(245,158,11)', badgeCls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  { bg: 'rgba(139,92,246,0.75)', border: 'rgb(139,92,246)', badgeCls: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' },
  { bg: 'rgba(236,72,153,0.75)', border: 'rgb(236,72,153)', badgeCls: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300' },
  { bg: 'rgba(100,116,139,0.75)', border: 'rgb(100,116,139)', badgeCls: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' }
]

export function policyLabel(key) {
  return POLICY_LABELS[key] || key.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function policyColor(key, orderedKeys) {
  const idx = orderedKeys.indexOf(key)
  return POLICY_COLORS[(idx >= 0 ? idx : 0) % POLICY_COLORS.length]
}

export function sortPolicyFiles(keys) {
  const order = ['fbc', 'registry']
  return [...keys].sort((a, b) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })
}

// ─── Target release helpers ──────────────────────────────────────────────────

export function targetReleaseBadgeCls(target) {
  if (!target) return ''
  if (target === PERMANENT_TARGET) return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
  if (/[.-]ea/i.test(target)) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
  return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
}

export function targetReleaseLabel(target) {
  if (!target) return ''
  if (target === PERMANENT_TARGET) return 'Permanent'
  return extractVersion(target) || target
}

export function normalizeTargetRelease(raw) {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().includes('permanent')) return PERMANENT_TARGET
  const product = extractProduct(trimmed)
  let v = product ? extractVersion(trimmed) : trimmed.replace(/^v/i, '')
  v = v.replace(/[\s.-]+[Ee][Aa][\s.-]*(\d+)/, '.EA$1')
  v = v.replace(/^[\s.-]+|[\s.-]+$/g, '')
  return product ? `${product}-${v}` : v
}

export function extractCategory(value) {
  if (!value) return 'other'
  if (value.toLowerCase().includes('fips')) return 'fips'
  const prefixKnown = ['hermetic_task', 'test', 'tasks', 'schedule', 'sbom_spdx', 'rpm_signature', 'cve', 'source_image', 'step_image_registries']
  const prefix = value.split('.')[0].split(':')[0]
  return prefixKnown.includes(prefix) ? prefix : 'other'
}
