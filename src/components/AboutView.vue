<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex gap-1 -mb-px">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors duration-200"
          :class="activeTab === tab.id
            ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          <component :is="tab.icon" :size="16" :stroke-width="1.7" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- About tab -->
    <template v-if="activeTab === 'about'">
      <!-- Hero -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Org Pulse</h2>
        <p class="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          A modular engineering dashboard that connects Jira, GitHub, and GitLab data with your team roster to surface delivery insights.
        </p>
      </div>

      <!-- Questions it answers -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">What You Can Track</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="item in valueProps" :key="item.title" class="flex items-start gap-3">
            <component :is="item.icon" :size="20" :stroke-width="1.7" class="flex-shrink-0 text-primary-600 dark:text-primary-400 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.title }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Data sources -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Sources</h3>
        <div class="flex flex-wrap gap-3">
          <span
            v-for="src in dataSources"
            :key="src"
            class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-full"
          >
            {{ src }}
          </span>
        </div>
        <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Functionality is organized into modules that can be independently enabled or disabled.
        </p>
      </div>

      <!-- How it works -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">How It Works</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div v-for="(step, i) in pipelineSteps" :key="step.label" class="text-center">
            <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-bold mb-2">
              {{ i + 1 }}
            </div>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ step.label }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ step.desc }}</p>
          </div>
        </div>
      </div>

      <!-- Resources -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Resources</h3>
        <div class="flex flex-wrap gap-3">
          <a
            v-for="link in resourceLinks"
            :key="link.label"
            :href="link.url"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200"
          >
            <component :is="link.icon" :size="18" :stroke-width="1.7" class="flex-shrink-0 text-gray-500 dark:text-gray-400" />
            {{ link.label }}
            <ExternalLink :size="14" class="flex-shrink-0 text-gray-400 dark:text-gray-500" />
          </a>
        </div>
      </div>

      <!-- Help & Feedback -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Help & Feedback</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Report an Issue</h4>
            <div class="space-y-2">
              <a
                v-for="tpl in issueTemplates"
                :key="tpl.label"
                :href="tpl.url"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                <component :is="tpl.icon" :size="16" :stroke-width="1.7" />
                {{ tpl.label }}
              </a>
            </div>
          </div>
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Get Help</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              If something doesn't look right, try refreshing data from the header. For persistent issues, download diagnostics from the Help & Debug tab and attach them to a GitHub issue.
            </p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center text-xs text-gray-400 dark:text-gray-500 py-4 space-y-1">
        <p v-if="buildInfo.version">
          Version {{ buildInfo.version }}
          <span v-if="buildInfo.gitSha" class="font-mono">({{ buildInfo.gitSha.slice(0, 7) }})</span>
        </p>
        <p>Apache License 2.0</p>
      </div>
    </template>

    <!-- Docs tab -->
    <template v-if="activeTab === 'docs'">
      <template v-for="(section, sIdx) in docsSections" :key="section.id">
        <h2
          class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3"
          :class="{ 'mt-8': sIdx > 0 }"
        >
          {{ section.label }}
        </h2>

        <div
          v-for="cat in section.categories"
          :key="cat.id"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {{ cat.title }}
            <a
              v-if="cat.slackChannel"
              :href="cat.slackChannel.url"
              target="_blank"
              rel="noopener"
              class="ml-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {{ cat.slackChannel.name }}
            </a>
          </h3>
          <div class="flex flex-wrap gap-4">
            <a
              v-for="link in cat.resolvedLinks"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200"
            >
              <component :is="link.icon" :size="18" :stroke-width="1.7" class="flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span>{{ link.label }}</span>
              <ExternalLink :size="14" class="flex-shrink-0 text-gray-400 dark:text-gray-500" />
            </a>
          </div>
        </div>
      </template>
    </template>

    <!-- Site Usage tab -->
    <template v-if="activeTab === 'usage' && canViewMetrics">
      <SiteUsageTab />
    </template>

    <!-- Backups tab -->
    <template v-if="activeTab === 'backups' && isAdmin">
      <!-- Status card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Backup Status</h3>
          <button
            @click="triggerBackup"
            :disabled="backupInProgress"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DatabaseBackup :size="16" />
            {{ backupInProgress ? 'Backing up...' : 'Back Up Now' }}
          </button>
        </div>

        <div v-if="backupsLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading backup status...</div>
        <div v-else-if="backupsError" class="text-sm text-red-600 dark:text-red-400">{{ backupsError }}</div>
        <div v-else-if="backupsList.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
          No backups found. Trigger a backup to protect against data loss.
        </div>
        <div v-else>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-700 dark:text-gray-300">
              Last backup: <span class="font-medium">{{ formatBackupDate(backupsList[0].lastModified) }}</span>
              <span class="text-gray-500 dark:text-gray-400">({{ formatBackupSize(backupsList[0].sizeBytes) }})</span>
            </span>
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="backupStatusClasses"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="backupDotClass"></span>
              {{ backupStatusLabel }}
            </span>
          </div>
        </div>

        <p v-if="backupSuccess" class="mt-3 text-sm text-green-600 dark:text-green-400">{{ backupSuccess }}</p>
      </div>

      <!-- Backup list -->
      <div v-if="backupsList.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Available Backups</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                <th class="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Size</th>
                <th class="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Key</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in backupsList"
                :key="b.key"
                class="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
              >
                <td class="py-2 pr-4 text-gray-900 dark:text-gray-100">{{ formatBackupDate(b.lastModified) }}</td>
                <td class="py-2 pr-4 text-gray-600 dark:text-gray-400">{{ formatBackupSize(b.sizeBytes) }}</td>
                <td class="py-2 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-xs" :title="b.key">{{ b.key }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Help & Debug tab -->
    <template v-if="activeTab === 'help'">
      <!-- Build Info -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">App Info</h3>
        <div class="grid grid-cols-2 gap-6">
          <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt class="text-gray-500 dark:text-gray-400">Version</dt>
            <dd class="text-gray-900 dark:text-gray-100 font-mono">{{ buildInfo.version || 'unknown' }}</dd>
            <dt class="text-gray-500 dark:text-gray-400">Git SHA</dt>
            <dd class="text-gray-900 dark:text-gray-100 font-mono truncate" :title="buildInfo.gitSha || 'dev'">{{ buildInfo.gitSha || 'dev' }}</dd>
            <dt class="text-gray-500 dark:text-gray-400">Build Date</dt>
            <dd class="text-gray-900 dark:text-gray-100">{{ buildInfo.buildDate || 'N/A' }}</dd>
            <dt class="text-gray-500 dark:text-gray-400">Node.js</dt>
            <dd class="text-gray-900 dark:text-gray-100 font-mono">{{ buildInfo.nodeVersion || 'unknown' }}</dd>
          </dl>
          <div class="flex items-center justify-center">
            <a
              href="https://github.com/red-hat-data-services/rhai-org-pulse"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <GithubIcon :size="32" />
              <span class="text-sm">Source Code</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Diagnostics Download -->
      <div
        v-if="isAdmin"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Download Diagnostics</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Collect a diagnostic bundle with system info, configuration, data health, and module diagnostics.
          Attach it to a GitHub issue to help with debugging.
        </p>

        <!-- Redaction level selector -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Redaction Level</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                v-model="redactLevel"
                value="minimal"
                class="text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Minimal</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">Redacts secrets/tokens. Keeps names and emails for internal debugging.</p>
              </div>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                v-model="redactLevel"
                value="aggressive"
                class="text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Aggressive</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">Anonymizes all PII (names, emails, UIDs). Safe for public sharing.</p>
              </div>
            </label>
          </div>
        </div>

        <!-- PII Warning for aggressive mode -->
        <div
          v-if="redactLevel === 'aggressive'"
          class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg"
        >
          <p class="text-sm text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> Error messages and log entries may still contain partial personal information
            despite best-effort scrubbing. Review the downloaded file before sharing publicly.
          </p>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <button
            @click="downloadDiagnostics"
            :disabled="downloading"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon :size="16" />
            {{ downloading ? 'Collecting...' : 'Download' }}
          </button>
          <button
            @click="copyDiagnostics"
            :disabled="copying"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CopyIcon :size="16" />
            {{ copyLabel }}
          </button>
        </div>

        <p v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

        <!-- What's collected -->
        <div class="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">What's Collected</h4>
          <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
            <li>App version, build info, and Node.js version</li>
            <li>System info: platform, memory usage, uptime</li>
            <li>Environment variable presence (not values)</li>
            <li>Storage directory structure and file counts</li>
            <li>Module configuration and enabled state</li>
            <li>Data health checks: stale files, missing mappings, integrity issues</li>
            <li>Recent API request statistics (response times, error rates)</li>
            <li>Recent console errors and warnings</li>
            <li>Module-specific diagnostics (refresh state, sync status, cache stats)</li>
          </ul>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No full data files are included. This is metadata only, focused on diagnosing problems.
          </p>
        </div>
      </div>

      <!-- Export Test Data -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Export Test Data</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Download a <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">.tgz</code> archive of all production data with personal information (names, emails, usernames) replaced by fake values. Use it for local development and testing.
        </p>

        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3 mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">After downloading</p>
          <ol class="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
            <li>Extract the archive into your project root:
              <code class="block mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200">tar xzf org-pulse-test-data.tgz -C .</code>
            </li>
            <li>This creates a <code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">data/</code> directory matching the production layout.</li>
            <li>Start the dev server — it will use the extracted data automatically:
              <code class="block mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200">npm run dev:full</code>
            </li>
          </ol>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          The archive is deterministic — the same source data always produces the same anonymized output. All names, emails, UIDs, and usernames are consistently mapped across files.
        </p>

        <button
          @click="downloadTestData"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          <DownloadIcon :size="16" />
          Download Test Data
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  Info,
  BookOpen,
  Wrench,
  BarChart3 as BarChart3Icon,
  ExternalLink,
  Download as DownloadIcon,
  Copy as CopyIcon,
  Github as GithubIcon,
  Video,
  Presentation,
  StickyNote,
  Play,
  TrendingUp,
  BarChart3,
  PieChart,
  Milestone,
  Bug,
  MessageSquarePlus,
  FileCode2,
  DatabaseBackup
} from 'lucide-vue-next'
import { useAuth } from '@shared/client'
import SiteUsageTab from './health-metrics/SiteUsageTab.vue'
import { enablementCategories, enablementSections } from '@shared/client/enablement-links.js'

const { isAdmin: authIsAdmin, roles } = useAuth()

const props = defineProps({
  isAdmin: Boolean,
  initialTab: { type: String, default: null }
})

const canViewMetrics = computed(() =>
  props.isAdmin || authIsAdmin.value || roles.value.includes('usage-metrics-viewer')
)

const tabs = computed(() => {
  const base = [
    { id: 'about', label: 'About', icon: Info },
    { id: 'docs', label: 'Docs', icon: BookOpen },
  ]
  if (canViewMetrics.value) {
    base.push({ id: 'usage', label: 'Site Usage', icon: BarChart3Icon })
  }
  if (props.isAdmin || authIsAdmin.value) {
    base.push({ id: 'backups', label: 'Backups', icon: DatabaseBackup })
  }
  base.push({ id: 'help', label: 'Help & Debug', icon: Wrench })
  return base
})

const activeTab = ref(props.initialTab || 'about')

watch(() => props.initialTab, (val) => {
  if (val && tabs.value.some(t => t.id === val)) {
    activeTab.value = val
  }
})

watch(activeTab, (tab) => {
  const hash = tab === 'about' ? '#/about' : `#/about?tab=${tab}`
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash)
  }
})

const valueProps = [
  { title: 'Delivery Velocity', desc: 'Track issue throughput and story points across teams', icon: TrendingUp },
  { title: 'Trends Over Time', desc: 'Spot patterns in monthly resolution and contribution data', icon: BarChart3 },
  { title: 'Work Allocation', desc: 'See how effort is distributed across priorities and initiatives', icon: PieChart },
  { title: 'Release Tracking', desc: 'Monitor sprint commitments and delivery against plans', icon: Milestone }
]

const dataSources = ['Jira Cloud', 'GitHub', 'GitLab', 'Team Roster (LDAP)', 'Google Sheets']

const pipelineSteps = [
  { label: 'Collect', desc: 'Pull data from Jira, GitHub, GitLab, and LDAP' },
  { label: 'Organize', desc: 'Map people to teams using roster sync' },
  { label: 'Analyze', desc: 'Compute velocity, trends, and allocations' },
  { label: 'Report', desc: 'Render dashboards and charts per module' }
]

const repoBase = 'https://github.com/red-hat-data-services/rhai-org-pulse'

const resourceLinks = [
  { label: 'Source Code', icon: GithubIcon, url: repoBase },
  { label: 'Contributing Guide', icon: FileCode2, url: repoBase + '/blob/main/CONTRIBUTING.md' },
  { label: 'API Docs', icon: FileCode2, url: '/api/docs' }
]

const issueTemplates = [
  { label: 'Feature Request / Feedback', icon: MessageSquarePlus, url: repoBase + '/issues/new?template=general-feedback.yml' },
  { label: 'Bug Report', icon: Bug, url: repoBase + '/issues/new?template=bug-report.yml' }
]

const iconMap = { Video, Presentation, StickyNote, Play }

function resolveIcon(name) {
  return iconMap[name] || Video
}

const docsSections = enablementSections.map(s => ({
  ...s,
  categories: enablementCategories
    .filter(c => c.section === s.id)
    .map(c => ({
      ...c,
      resolvedLinks: c.links.map(l => ({ ...l, icon: resolveIcon(l.icon) })),
    })),
}))

// --- Backups state ---
const backupsList = ref([])
const backupsLoading = ref(false)
const backupsError = ref(null)
const backupInProgress = ref(false)
const backupSuccess = ref(null)

const isAdmin = computed(() => props.isAdmin || authIsAdmin.value)

async function fetchBackups() {
  backupsLoading.value = true
  backupsError.value = null
  try {
    const res = await fetch('/api/admin/backup')
    if (!res.ok) throw new Error('Failed to load backups')
    const data = await res.json()
    backupsList.value = data.backups || []
  } catch (err) {
    backupsError.value = err.message
  } finally {
    backupsLoading.value = false
  }
}

async function triggerBackup() {
  backupInProgress.value = true
  backupSuccess.value = null
  backupsError.value = null
  try {
    const res = await fetch('/api/admin/backup', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Backup failed')
    }
    backupSuccess.value = 'Backup completed successfully.'
    await fetchBackups()
    setTimeout(() => { backupSuccess.value = null }, 5000)
  } catch (err) {
    backupsError.value = err.message
  } finally {
    backupInProgress.value = false
  }
}

function formatBackupDate(dateStr) {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleString()
}

function formatBackupSize(bytes) {
  if (!bytes) return 'Unknown'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const backupAgeHours = computed(() => {
  if (backupsList.value.length === 0) return null
  const latest = backupsList.value[0]
  return (Date.now() - new Date(latest.lastModified).getTime()) / (1000 * 60 * 60)
})

const backupStatusLabel = computed(() => {
  const h = backupAgeHours.value
  if (h === null) return ''
  if (h < 24) return 'Healthy'
  if (h < 48) return 'Aging'
  return 'Overdue'
})

const backupStatusClasses = computed(() => {
  const h = backupAgeHours.value
  if (h === null) return ''
  if (h < 24) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
  if (h < 48) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
  return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
})

const backupDotClass = computed(() => {
  const h = backupAgeHours.value
  if (h === null) return ''
  if (h < 24) return 'bg-green-500'
  if (h < 48) return 'bg-yellow-500'
  return 'bg-red-500'
})

watch(activeTab, (val) => {
  if (val === 'backups' && isAdmin.value && backupsList.value.length === 0 && !backupsLoading.value) {
    fetchBackups()
  }
})

// --- Help & Debug state ---
const buildInfo = ref({})
const redactLevel = ref('minimal')
const downloading = ref(false)
const copying = ref(false)
const copyLabel = ref('Copy to Clipboard')
const error = ref(null)

onMounted(async function () {
  try {
    const res = await fetch('/api/must-gather?redact=minimal')
    if (res.ok) {
      const data = await res.json()
      buildInfo.value = data.buildInfo || {}
    }
  } catch {
    // Build info will show defaults
  }
  if (activeTab.value === 'backups' && isAdmin.value) {
    fetchBackups()
  }
})

async function downloadTestData() {
  const res = await fetch('/api/export/test-data')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'org-pulse-test-data.tgz'
  a.click()
  URL.revokeObjectURL(url)
}

async function fetchBundle() {
  const res = await fetch('/api/must-gather?redact=' + redactLevel.value)
  if (!res.ok) {
    const body = await res.json().catch(function () { return {} })
    throw new Error(body.error || 'Failed to collect diagnostics (HTTP ' + res.status + ')')
  }
  return res.json()
}

async function downloadDiagnostics() {
  downloading.value = true
  error.value = null
  try {
    const bundle = await fetchBundle()
    const json = JSON.stringify(bundle, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = 'must-gather-' + ts + '.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err.message
  } finally {
    downloading.value = false
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function copyDiagnostics() {
  copying.value = true
  error.value = null
  try {
    const bundle = await fetchBundle()
    const json = JSON.stringify(bundle, null, 2)
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      fallbackCopyText(json)
    }
    copyLabel.value = 'Copied!'
    setTimeout(function () { copyLabel.value = 'Copy to Clipboard' }, 2000)
  } catch (err) {
    error.value = err.message
  } finally {
    copying.value = false
  }
}
</script>
