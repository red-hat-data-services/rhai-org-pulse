<script setup>
import { ref, inject } from 'vue'
import { PHASES } from '../constants.js'
import { ArrowLeft, ChevronRight, Sparkles, User, Pencil, Eye, RefreshCw, AlertTriangle, Play, FileText, StickyNote, Code, MessageSquare, HelpCircle, BookOpen, ChevronDown } from 'lucide-vue-next'

const moduleNav = inject('moduleNav')

const selectedPhase = ref(null)
const labelsExpanded = ref(false)

function selectPhase(phase) {
  selectedPhase.value = phase
}

function closeDetail() {
  selectedPhase.value = null
}

function goToPage(phaseId) {
  moduleNav.navigateTo(phaseId)
}

// RFE Review scoring criteria
const scoringCriteria = [
  { name: 'WHAT', range: '0-2', question: 'Is the customer need clearly described?', zero: 'Unclear Outcome' },
  { name: 'WHY', range: '0-2', question: 'Is there business justification?', hint: 'Named customers/revenue → 2 · Generic segments → 1 · Nothing → 0', zero: 'WHY Void' },
  { name: 'HOW', range: '0-2', question: 'Does it leave architecture to engineering?', hint: 'Referencing platform technologies is fine', zero: 'Architecture Prescription' },
  { name: 'TASK', range: '0-2', question: 'Is this a business need, not a chore?', zero: 'Task Masquerade' },
  { name: 'SIZE', range: '0-2', question: 'Does it map to roughly one strategy feature?', zero: 'Kitchen-Sink Scope' },
]

const rfeLabels = [
  { name: 'autofix-rubric-pass', color: 'green', desc: 'RFE passed quality scoring' },
  { name: 'needs-attention', color: 'amber', desc: 'Automation couldn\'t resolve all issues — you need to act' },
  { name: 'auto-revised', color: 'blue', desc: 'Content was improved by automation' },
  { name: 'auto-created', color: 'blue', desc: 'RFE was created by the pipeline' },
  { name: 'feasibility-pass', color: 'green', desc: 'Technically feasible' },
  { name: 'feasibility-fail', color: 'red', desc: 'Technically infeasible — review and revise' },
  { name: 'feasibility-unknown', color: 'gray', desc: 'Feasibility couldn\'t be determined' },
  { name: 'split-original', color: 'purple', desc: 'This RFE was decomposed into smaller RFEs' },
  { name: 'split-result', color: 'purple', desc: 'This RFE was produced by splitting another' },
]

const rfeLearnLinks = [
  { label: 'Enablement Recording', icon: Play, url: 'https://drive.google.com/file/d/1qZomlB-TK2FODtmvjzpMeH_g5qpuAOh-/view?usp=sharing' },
  { label: 'Slides', icon: FileText, url: 'https://docs.google.com/presentation/d/1O-F8naJxAfYtcXjTJHySYjeLtrKfb1OHhtyhoItya0s/edit?usp=sharing' },
  { label: 'Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1pTpIvKkYns2aG5g0ueOxy6P8j1m_yNnD13XBB35NgWQ/edit?usp=sharing' },
  { label: 'Demo', icon: Play, url: 'https://drive.google.com/file/d/1ANaZOeUorSMqlFm3WzfK1xRPvld2TGM-/view' },
]

const rfeToolLinks = [
  { label: 'assess-rfe plugin', icon: Code, url: 'https://github.com/n1hility/assess-rfe' },
  { label: 'rfe-creator plugin', icon: Code, url: 'https://github.com/jwforres/rfe-creator' },
  { label: 'Skills Registry', icon: BookOpen, url: 'https://github.com/opendatahub-io/skills-registry' },
  { label: '#wg-rhai-rfe-builder', icon: MessageSquare, url: 'https://app.slack.com/client/E030G10V24F/C0AMPLH0Y9G' },
  { label: '#forum-rhai-ai-first', icon: HelpCircle, url: 'https://app.slack.com/client/E030G10V24F/forum-rhai-ai-first' },
]

const rfeSteps = [
  { name: 'RFE Ingestion', desc: 'Pipeline fetches all RFEs from Jira for assessment', ai: true },
  { name: 'AI Assessment', desc: 'Each RFE is scored independently against the quality rubric', ai: true },
  { name: 'Auto-Revision', desc: 'Failing RFEs are automatically improved where possible', ai: true },
  { name: 'Feasibility Check', desc: 'Technical feasibility is evaluated and labeled on the Jira ticket', ai: true },
  { name: 'Human Review', desc: 'RFEs that can\'t be auto-fixed are flagged for PM action', ai: false },
]

function labelColorClasses(color) {
  const map = {
    green: 'bg-green-500/15 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    red: 'bg-red-500/15 text-red-600 dark:text-red-400',
    gray: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
    purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  }
  return map[color] || map.gray
}
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">

    <!-- ─── Pipeline Overview ─── -->
    <div v-if="!selectedPhase" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">AI Factory Guide</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            How the RHAI delivery pipeline works — from RFE to release. Click any stage to learn what happens, what you need to do, and how to use the tools.
          </p>
        </div>

        <!-- Pipeline stages -->
        <div class="space-y-3">
          <button
            v-for="phase in PHASES"
            :key="phase.id"
            @click="selectPhase(phase)"
            class="w-full group"
          >
            <div
              class="flex items-center gap-4 p-5 rounded-xl border transition-all duration-200"
              :class="phase.status === 'active'
                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600'"
            >
              <!-- Phase number -->
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                :class="phase.status === 'active'
                  ? 'bg-blue-500/10 border-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'"
              >
                {{ phase.order }}
              </div>

              <!-- Phase info -->
              <div class="flex-1 text-left">
                <div class="flex items-center gap-2">
                  <span
                    class="text-sm font-semibold"
                    :class="phase.status === 'active' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
                  >{{ phase.name }}</span>
                  <span
                    v-if="phase.status === 'coming-soon'"
                    class="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                  >Coming soon</span>
                </div>
              </div>

              <!-- Arrow -->
              <ChevronRight
                :size="18"
                class="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                :class="phase.status === 'active' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-300 dark:text-gray-600'"
              />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- ─── RFE Review Detail ─── -->
    <div v-else-if="selectedPhase.id === 'rfe-review'" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center">
              <span class="text-blue-600 dark:text-blue-400 text-sm font-bold">1</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">RFE Review</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Every RFE is automatically assessed daily at 4:00 AM UTC. A failing score blocks the RFE from progressing.</p>
            </div>
          </div>
          <button
            @click="goToPage('rfe-review')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to RFE Review
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- How it works -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">How it works</h3>
          <div class="relative ml-1">
            <div class="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div v-for="(step, i) in rfeSteps" :key="step.name" class="flex items-start gap-4 relative" :class="i < rfeSteps.length - 1 ? 'pb-5' : ''">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                :class="step.ai
                  ? 'bg-blue-500/10 border-2 border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'"
              >
                <Sparkles v-if="step.ai" :size="16" class="text-blue-600 dark:text-blue-400" />
                <User v-else :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ step.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ step.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- What you need to do -->
        <div class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3">What you need to do</h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Pencil :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Write your business justification in the <strong class="text-gray-900 dark:text-white">Description</strong> field — that's what the AI reads</span>
            </li>
            <li class="flex items-start gap-3">
              <Eye :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Watch for the <code class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">needs-attention</code> label on your Jira tickets</span>
            </li>
            <li class="flex items-start gap-3">
              <RefreshCw :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">If your RFE fails, edit the ticket — it'll be re-assessed on the next daily run</span>
            </li>
            <li class="flex items-start gap-3">
              <AlertTriangle :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Focus on avoiding <strong class="text-gray-900 dark:text-white">zero scores</strong> — any zero is an automatic fail regardless of total</span>
            </li>
          </ul>
        </div>

        <!-- Scoring quick reference -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Scoring quick reference</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">Pass: ≥ 7/10 total AND no zeros on any criterion</p>
          <div class="space-y-3">
            <div v-for="c in scoringCriteria" :key="c.name" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-16 text-right">
                <span class="text-sm font-bold text-gray-900 dark:text-white">{{ c.name }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 ml-1">{{ c.range }}</span>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-600"></div>
              <div class="flex-1">
                <div class="text-sm text-gray-700 dark:text-gray-300">{{ c.question }}</div>
                <div v-if="c.hint" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ c.hint }}</div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Zero = "{{ c.zero }}"</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Jira labels (collapsible) -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-6">
          <button
            @click="labelsExpanded = !labelsExpanded"
            class="flex items-center justify-between w-full p-5"
          >
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jira Labels Reference</h3>
            <ChevronDown
              :size="16"
              class="text-gray-400 dark:text-gray-500 transition-transform"
              :class="labelsExpanded ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="labelsExpanded" class="px-5 pb-5 -mt-1">
            <div class="space-y-2">
              <div v-for="l in rfeLabels" :key="l.name" class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono" :class="labelColorClasses(l.color)">{{ l.name }}</code>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ l.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Links -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Learn</h4>
          <div class="flex gap-2 flex-wrap mb-5">
            <a
              v-for="link in rfeLearnLinks"
              :key="link.label"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <component :is="link.icon" :size="14" class="text-gray-400 dark:text-gray-500" />
              {{ link.label }}
            </a>
          </div>

          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Tools &amp; Community</h4>
          <div class="flex gap-2 flex-wrap">
            <a
              v-for="link in rfeToolLinks"
              :key="link.label"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <component :is="link.icon" :size="14" class="text-gray-400 dark:text-gray-500" />
              {{ link.label }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Coming Soon Detail ─── -->
    <div v-else class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center"
              :class="selectedPhase.status === 'active'
                ? 'bg-blue-500/10 border-2 border-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'"
            >
              <span
                class="text-sm font-bold"
                :class="selectedPhase.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
              >{{ selectedPhase.order }}</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ selectedPhase.name }}</h2>
            </div>
          </div>
          <button
            v-if="selectedPhase.status === 'active'"
            @click="goToPage(selectedPhase.id)"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to {{ selectedPhase.name }}
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- Coming soon card -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <Sparkles :size="28" class="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Details coming soon</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            The detailed guide for this stage is being written. Check back soon for step-by-step instructions, scoring criteria, and links to resources.
          </p>
        </div>
      </div>
    </div>

  </div>
</template>
