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
      <!-- AI SDLC Materials -->
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">AI SDLC Materials</h2>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">RFE Builder</h3>
        <div class="flex flex-wrap gap-4">
          <a
            v-for="link in rfeLinks"
            :key="link.label"
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

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">AI Quality</h3>
        <div class="flex flex-wrap gap-4">
          <a
            v-for="link in aiQualityLinks"
            :key="link.label"
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

      <!-- AI Workflows Enablement -->
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3">AI Workflows Enablement</h2>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Jira Autofix</h3>
        <div class="flex flex-wrap gap-4">
          <a
            v-for="link in jiraAutofixLinks"
            :key="link.label"
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

      <!-- Other Enablement -->
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3">Other Enablement</h2>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Agent Eval Harness</h3>
        <div class="flex flex-wrap gap-4">
          <a
            v-for="link in agentEvalHarnessLinks"
            :key="link.label"
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
import { ref, onMounted, watch } from 'vue'
import {
  Info,
  BookOpen,
  Wrench,
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
  FileCode2
} from 'lucide-vue-next'

const props = defineProps({
  isAdmin: Boolean,
  initialTab: { type: String, default: null }
})

const tabs = [
  { id: 'about', label: 'About', icon: Info },
  { id: 'docs', label: 'Docs', icon: BookOpen },
  { id: 'help', label: 'Help & Debug', icon: Wrench }
]

const activeTab = ref(props.initialTab || 'about')

watch(() => props.initialTab, (val) => {
  if (val && tabs.some(t => t.id === val)) {
    activeTab.value = val
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

const rfeLinks = [
  { label: 'Enablement Recording', icon: Video, url: 'https://drive.google.com/file/d/1qZomlB-TK2FODtmvjzpMeH_g5qpuAOh-/view?usp=sharing' },
  { label: 'Enablement Slides', icon: Presentation, url: 'https://docs.google.com/presentation/d/1O-F8naJxAfYtcXjTJHySYjeLtrKfb1OHhtyhoItya0s/edit?usp=sharing' },
  { label: 'Enablement Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1pTpIvKkYns2aG5g0ueOxy6P8j1m_yNnD13XBB35NgWQ/edit?usp=sharing' },
  { label: 'Demo', icon: Play, url: 'https://drive.google.com/file/d/1ANaZOeUorSMqlFm3WzfK1xRPvld2TGM-/view' }
]

const aiQualityLinks = [
  { label: 'Enablement Recording', icon: Video, url: 'https://drive.google.com/file/d/1jlsw8rVpRRo1Y1kkKhJ7LHDy3N6C_Uxp/view' },
  { label: 'Enablement Slides', icon: Presentation, url: 'https://docs.google.com/presentation/d/1XuLna0_2DHX7EzepJHk03PpQF1urFoF39xaq9N-G6rY/edit?slide=id.g3d48d3b5671_0_5160#slide=id.g3d48d3b5671_0_5160' },
  { label: 'Enablement Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1B006LrfEAUf_wb6Hr7PZJnpg2oW2bAQdxNmYcbLJo30/edit?tab=t.iqa6kux2ki3f' }
]

const jiraAutofixLinks = [
  { label: 'Enablement Recording', icon: Video, url: 'https://drive.google.com/file/d/1b-PZD3OiPAA8LOZ8lWmfcNZBByUa0Nel/view?ts=69e8ff07' },
  { label: 'Enablement Slides', icon: Presentation, url: 'https://docs.google.com/presentation/d/1_UaHAI65K1P5Y2pAhZ4ie2KY-tHiSrqbnWN0UUqvsYs/edit?slide=id.g3d84ce2c2ca_1_0#slide=id.g3d84ce2c2ca_1_0' },
  { label: 'Enablement Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1O3i5Ijoo3fi-gPHG0e9ON70Nfij2EUdfU18KOrVQADY/edit?tab=t.4ih80ylpl5y1' }
]

const agentEvalHarnessLinks = [
  { label: 'Enablement Recording', icon: Video, url: 'https://drive.google.com/file/d/1SVPwRZzo2U1ohnlTtgjlyOvXHrJB1Jxu/view' },
  { label: 'Enablement Slides', icon: Presentation, url: 'https://docs.google.com/presentation/d/15vhrPqtu-uzxQC4v3whN8YQL1NK46kqNULhZff3uC8E/edit?slide=id.g3d8e714406d_0_0#slide=id.g3d8e714406d_0_0' },
  { label: 'Enablement Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1HJJBt2Psnqy7JWx26UUP0fENJqDPAZBDhFcHpHt6sjM/edit?tab=t.tcc7ue9usok7' }
]

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
