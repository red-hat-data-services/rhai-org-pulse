<script setup>
import { ref, inject } from 'vue'
import { PHASES } from '../constants.js'
import { ArrowLeft, ChevronRight, Sparkles, User, Pencil, Eye, RefreshCw, AlertTriangle, Play, FileText, StickyNote, Code, MessageSquare, HelpCircle, BookOpen, ChevronDown, Search, Zap, ChevronsRight, Archive, Globe, Lightbulb } from 'lucide-vue-next'

const moduleNav = inject('moduleNav')

const selectedPhase = ref(null)
const labelsExpanded = ref(false)
const featureLabelsExpanded = ref(false)

// Phase metadata for the rich overview cards
const phaseInfo = {
  'rfe-review': {
    desc: 'Incoming requirements are ingested from Jira, assessed for quality, and scored against the rubric.',
    color: 'blue',
  },
  'feature-review': {
    desc: 'Features are auto-generated from approved RFEs, refined by AI, and reviewed by staff engineers.',
    color: 'indigo',
  },
  'implementation': {
    desc: 'Engineering teams implement approved features across sprints with AI-assisted code generation.',
    color: 'purple',
  },
  'qe-validation': {
    desc: 'Automated and manual testing validates feature quality before release.',
    color: 'cyan',
  },
  'security': {
    desc: 'Security review and compliance checks before features ship.',
    color: 'amber',
  },
  'documentation': {
    desc: 'User-facing documentation is generated and reviewed for each feature.',
    color: 'teal',
  },
  'build-release': {
    desc: 'Final build, integration testing, and release to production.',
    color: 'rose',
  },
}

// Color utility for phase accents
const phaseColorMap = {
  blue: { circle: 'bg-blue-500/20 border-blue-500', text: 'text-blue-400', connector: 'from-blue-500 to-indigo-500' },
  indigo: { circle: 'bg-indigo-500/20 border-indigo-500', text: 'text-indigo-400', connector: 'from-indigo-500 to-purple-500' },
  purple: { circle: 'bg-purple-500/20 border-purple-500', text: 'text-purple-400', connector: 'from-purple-500 to-cyan-500' },
  cyan: { circle: 'bg-cyan-500/20 border-cyan-500', text: 'text-cyan-400', connector: 'from-cyan-500 to-amber-500' },
  amber: { circle: 'bg-amber-500/20 border-amber-500', text: 'text-amber-400', connector: 'from-amber-500 to-teal-500' },
  teal: { circle: 'bg-teal-500/20 border-teal-500', text: 'text-teal-400', connector: 'from-teal-500 to-rose-500' },
  rose: { circle: 'bg-rose-500/20 border-rose-500', text: 'text-rose-400', connector: '' },
}

function getPhaseColors(phaseId) {
  const info = phaseInfo[phaseId]
  return info ? phaseColorMap[info.color] : phaseColorMap.blue
}

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

// Feature Review timeline steps
const featureSteps = [
  { name: 'Feature Creation', desc: 'Pipeline clones approved RFEs into RHAISTRAT Jira tickets and captures the business need', ai: true },
  { name: 'Feature Refinement', desc: 'AI adds the "how": technical approach, components, dependencies, acceptance criteria, effort estimates', ai: true, hint: 'opendatahub-io/architecture-context' },
  { name: 'Feature Scoring', desc: 'AI scores across 4 dimensions using independent reviewer agents (one per dimension). Each dimension scored 0\u20132, total /8', ai: true },
  { name: 'Human Sign-off', desc: 'Staff engineer or architect for the relevant product space reviews and approves. Required for all features \u2014 AI scoring alone is never sufficient', ai: false },
]

// Feature Review scoring dimensions
const featureScoringCriteria = [
  { name: 'Feasibility', range: '0-2', question: 'Can this realistically be built with current tech and resources?' },
  { name: 'Testability', range: '0-2', question: 'Are acceptance criteria concrete and verifiable?' },
  { name: 'Scope', range: '0-2', question: 'Is the work bounded with clear deliverables?' },
  { name: 'Architecture', range: '0-2', question: 'Does the approach align with platform architecture and patterns?' },
]

const featureLabels = [
  { name: 'strat-creator-rubric-pass', color: 'green', desc: 'Feature passed automated scoring' },
  { name: 'strat-creator-needs-attention', color: 'amber', desc: 'Feature needs human review/intervention' },
  { name: 'strat-creator-human-sign-off', color: 'indigo', desc: 'Feature has been approved by a human reviewer' },
  { name: 'strat-creator-processing', color: 'blue', desc: 'Feature is currently being processed by the pipeline (temporary lock)' },
]

const featureToolLinks = [
  { label: 'architecture-context repo', icon: Archive, url: 'https://github.com/opendatahub-io/architecture-context' },
  { label: 'Skills Registry', icon: BookOpen, url: 'https://github.com/opendatahub-io/skills-registry' },
]

const featureCommunityLinks = [
  { label: '#forum-rhai-ai-first', icon: HelpCircle, url: 'https://app.slack.com/client/E030G10V24F/forum-rhai-ai-first' },
]

function labelColorClasses(color) {
  const map = {
    green: 'bg-green-500/15 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
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
      <div class="max-w-3xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">AI Factory Guide</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Understand the end-to-end AI-augmented delivery pipeline.
            <span class="text-blue-600 dark:text-blue-400">Click any stage below to explore its details.</span>
          </p>
        </div>

        <!-- Pipeline stages — vertical spine -->
        <div class="relative">
          <!-- Gradient spine -->
          <div class="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 via-cyan-500 via-amber-500 to-rose-500 opacity-30 dark:opacity-30"></div>

          <template v-for="(phase, idx) in PHASES" :key="phase.id">
            <!-- Stage card -->
            <button
              @click="selectPhase(phase)"
              class="relative flex items-start gap-5 pl-0 w-full text-left group"
            >
              <!-- Circle on spine -->
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2"
                :class="getPhaseColors(phase.id).circle"
              >
                <span class="text-sm font-bold" :class="getPhaseColors(phase.id).text">{{ phase.order }}</span>
              </div>

              <!-- Card -->
              <div
                class="flex-1 rounded-xl p-5 mb-1 border transition-all duration-200 flex items-start gap-3"
                :class="phase.status === 'active'
                  ? 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-600/60 group-hover:shadow-md dark:group-hover:shadow-blue-500/5'
                  : 'bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/50 group-hover:border-gray-200 dark:group-hover:border-gray-600'"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1.5">
                    <h3
                      class="text-base font-semibold"
                      :class="phase.status === 'active' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
                    >{{ phase.name }}</h3>
                    <span
                      class="px-2 py-0.5 text-xs rounded-full font-medium"
                      :class="phase.status === 'active'
                        ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-500/20 text-gray-400 dark:text-gray-500'"
                    >{{ phase.status === 'active' ? 'Active' : 'Coming Soon' }}</span>
                  </div>
                  <p
                    v-if="phaseInfo[phase.id]"
                    class="text-sm"
                    :class="phase.status === 'active' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'"
                  >{{ phaseInfo[phase.id].desc }}</p>
                </div>
                <ChevronRight
                  :size="18"
                  class="flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  :class="phase.status === 'active' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-300 dark:text-gray-600'"
                />
              </div>
            </button>

            <!-- Connector between cards -->
            <div
              v-if="idx < PHASES.length - 1"
              class="w-0.5 h-5 mx-auto opacity-40 bg-gradient-to-b"
              :class="getPhaseColors(phase.id).connector"
              style="margin-left: 19px;"
            ></div>
          </template>
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

    <!-- ─── Feature Review Detail ─── -->
    <div v-else-if="selectedPhase.id === 'feature-review'" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-indigo-500/10 border-2 border-indigo-500 flex items-center justify-center">
              <span class="text-indigo-600 dark:text-indigo-400 text-sm font-bold">2</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Feature Review</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">The pipeline creates features from approved RFEs, refines them using architecture context, scores them across 4 dimensions, and requires human sign-off before proceeding.</p>
            </div>
          </div>
          <button
            @click="goToPage('feature-review')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to Feature Review
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- How it works -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">How it works</h3>
          <div class="relative ml-1">
            <div class="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div v-for="(step, i) in featureSteps" :key="step.name" class="flex items-start gap-4 relative" :class="i < featureSteps.length - 1 ? 'pb-5' : ''">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                :class="step.ai
                  ? 'bg-indigo-500/10 border-2 border-indigo-500'
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'"
              >
                <Sparkles v-if="step.ai" :size="16" class="text-indigo-600 dark:text-indigo-400" />
                <User v-else :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ step.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ step.desc }}<template v-if="step.hint">. Uses architecture context docs from <code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded text-xs">{{ step.hint }}</code></template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scoring quick reference -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Scoring quick reference</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">4 dimensions \u00B7 0\u20132 each \u00B7 /8 total</p>
          <div class="space-y-3">
            <div v-for="c in featureScoringCriteria" :key="c.name" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-24 text-right">
                <span class="text-sm font-bold text-gray-900 dark:text-white">{{ c.name }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 ml-1">{{ c.range }}</span>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-600"></div>
              <div class="flex-1">
                <div class="text-sm text-gray-700 dark:text-gray-300">{{ c.question }}</div>
              </div>
            </div>
          </div>

          <!-- Verdicts -->
          <div class="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
            <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Verdicts</h4>
            <div class="space-y-2">
              <div class="flex items-start gap-3 p-3 bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-lg">
                <span class="text-base mt-px">\u2705</span>
                <div>
                  <span class="text-sm font-semibold text-green-600 dark:text-green-400">APPROVE</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">\u22656, no zeros</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Feature is solid \u2014 proceeds to human sign-off</div>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                <span class="text-base mt-px">\u26A0\uFE0F</span>
                <div>
                  <span class="text-sm font-semibold text-amber-600 dark:text-amber-400">REVISE</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">\u22653, at most 1 zero</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Needs targeted improvements before re-review</div>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg">
                <span class="text-base mt-px">\u274C</span>
                <div>
                  <span class="text-sm font-semibold text-red-600 dark:text-red-400">REJECT</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">&lt;3 or 2+ zeros</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fundamental issues \u2014 likely needs RFE rework AND architecture context improvements</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- If APPROVED -->
        <div class="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3">
            <span class="mr-1.5">\u2705</span> If your feature was approved
          </h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <User :size="20" class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">A staff engineer or architect for your component/product space will review and sign off</span>
            </li>
            <li class="flex items-start gap-3">
              <Eye :size="20" class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">No SLA on sign-off \u2014 it's best-effort, but monitor the <code class="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 text-xs rounded font-mono">strat-creator-human-sign-off</code> label in Jira</span>
            </li>
          </ul>
        </div>

        <!-- If REVISE -->
        <div class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3">
            <span class="mr-1.5">\u26A0\uFE0F</span> If your feature got REVISE
          </h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Search :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Check which dimensions scored low \u2014 the review comments explain what's missing</span>
            </li>
            <li class="flex items-start gap-3">
              <Pencil :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">The responsible staff engineer/architect should add guidance via the <strong class="text-gray-900 dark:text-white">"Staff Engineer / SME Input"</strong> field in Jira</span>
            </li>
            <li class="flex items-start gap-3">
              <RefreshCw :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">The pipeline will automatically re-process on its next run</span>
            </li>
          </ul>

          <!-- Warning box -->
          <div class="mt-4 p-3 bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex items-start gap-3">
            <AlertTriangle :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div class="text-sm font-semibold text-amber-700 dark:text-amber-400">Edit inputs, not outputs</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Never edit the AI-generated feature text directly \u2014 the pipeline regenerates it on each run and your edits will be overwritten. Instead, add SME input or improve architecture context.</div>
            </div>
          </div>
        </div>

        <!-- If REJECT -->
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-3">
            <span class="mr-1.5">\u274C</span> If your feature got REJECT
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">This usually signals issues with both the source RFE and the architecture context. Two remediation paths:</p>
          <div class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-white/50 dark:bg-gray-800/40 rounded-lg">
              <div class="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-bold text-red-600 dark:text-red-400">1</span>
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Rework the source RFE</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Improve clarity, scope, and acceptance criteria in the original RFE ticket</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-white/50 dark:bg-gray-800/40 rounded-lg">
              <div class="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-bold text-red-600 dark:text-red-400">2</span>
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Improve the architecture context</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add overlays or update base content in <code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded text-xs">opendatahub-io/architecture-context</code> so the AI has better information</div>
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-3">After improvements, the feature will be re-processed automatically.</p>
        </div>

        <!-- Improving Architecture Context -->
        <div class="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide mb-3">
            <Zap :size="16" class="inline-block mr-1 -mt-0.5" />
            Improving Architecture Context
          </h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Archive :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">The <code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded text-xs">opendatahub-io/architecture-context</code> repo contains AI-generated architecture docs for every RHOAI component</span>
            </li>
            <li class="flex items-start gap-3">
              <FileText :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Overlays</strong> let you add corrections between regeneration cycles \u2014 SDK version bumps, component renames, maturity changes</span>
            </li>
            <li class="flex items-start gap-3">
              <Globe :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Improving this repo directly improves feature quality across the board \u2014 not just for your feature</span>
            </li>
            <li class="flex items-start gap-3">
              <Lightbulb :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">If you see systemic issues in features for your component, consider adding an overlay or updating the base architecture content</span>
            </li>
          </ul>
        </div>

        <!-- Jira labels (collapsible) -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-6">
          <button
            @click="featureLabelsExpanded = !featureLabelsExpanded"
            class="flex items-center justify-between w-full p-5"
          >
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jira Labels Reference</h3>
            <ChevronDown
              :size="16"
              class="text-gray-400 dark:text-gray-500 transition-transform"
              :class="featureLabelsExpanded ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="featureLabelsExpanded" class="px-5 pb-5 -mt-1">
            <div class="space-y-2">
              <div v-for="l in featureLabels" :key="l.name" class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono" :class="labelColorClasses(l.color)">{{ l.name }}</code>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ l.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- What's Next -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">What's next</h3>
          <div class="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 rounded-lg">
            <ChevronsRight :size="20" class="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Epic Creation</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">After human sign-off, the next step is Epic Creation \u2014 but this stage of the pipeline hasn't been implemented yet. Coming soon.</div>
            </div>
          </div>
        </div>

        <!-- Links -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Tools &amp; Resources</h4>
          <div class="flex gap-2 flex-wrap mb-5">
            <a
              v-for="link in featureToolLinks"
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

          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Community</h4>
          <div class="flex gap-2 flex-wrap">
            <a
              v-for="link in featureCommunityLinks"
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
