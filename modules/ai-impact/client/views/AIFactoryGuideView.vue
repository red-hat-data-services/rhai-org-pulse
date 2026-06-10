<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { PHASES } from '../constants.js'
import { ArrowLeft, ChevronRight, Sparkles, User, Pencil, Eye, RefreshCw, AlertTriangle, Play, FileText, StickyNote, Code, MessageSquare, HelpCircle, BookOpen, ChevronDown, Search, Zap, ChevronsRight, Archive, Globe, Lightbulb, GitPullRequest, Timer, Terminal, Package } from 'lucide-vue-next'

const moduleNav = inject('moduleNav')

const selectedPhase = ref(null)
const labelsExpanded = ref(false)
const featureLabelsExpanded = ref(false)
const testPlanLabelsExpanded = ref(false)
const buildReleaseLabelsExpanded = ref(false)
const autofixLabelsExpanded = ref(false)

let updatingFromUrl = false

const initialSection = moduleNav.params.value?.section
if (initialSection) {
  const match = PHASES.find(p => p.id === initialSection)
  if (match) selectedPhase.value = match
}

watch(() => moduleNav.params.value?.section, (section) => {
  const target = section ? PHASES.find(p => p.id === section) : null
  if ((target?.id || null) !== (selectedPhase.value?.id || null)) {
    updatingFromUrl = true
    selectedPhase.value = target || null
    nextTick(() => { updatingFromUrl = false })
  }
})

// Phase metadata for the rich overview cards
const phaseInfo = {
  'rfe-review': {
    desc: 'Incoming feature requests are ingested from Jira, assessed for quality, and scored against the rubric.',
    color: 'blue',
  },
  'feature-review': {
    desc: 'Features are auto-generated from approved RFEs, refined by AI, and reviewed by SMEs.',
    color: 'indigo',
  },
  'implementation': {
    desc: 'Engineering teams implement approved features across sprints with AI-assisted code generation.',
    color: 'purple',
  },
  'test-plan-review': {
    desc: 'AI-generated test plans are scored against a 5-dimension rubric. Plans that pass proceed to test case generation.',
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
    desc: 'Agentic CI pipeline that onboards new components into the build system by raising PRs/MRs across 6+ repos, triggered by a Jira ticket.',
    color: 'rose',
  },
  'jira-autofix': {
    desc: 'AI agents that triage Jira bug tickets, generate code fixes, and create MRs/PRs with iterative review feedback.',
    color: 'emerald',
  },
}

// Color utility for phase accents
const phaseColorMap = {
  blue: { circle: 'bg-blue-50 dark:bg-blue-950 border-blue-500', text: 'text-blue-400', connector: 'from-blue-500 to-indigo-500' },
  indigo: { circle: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-500', text: 'text-indigo-400', connector: 'from-indigo-500 to-purple-500' },
  purple: { circle: 'bg-purple-50 dark:bg-purple-950 border-purple-500', text: 'text-purple-400', connector: 'from-purple-500 to-cyan-500' },
  cyan: { circle: 'bg-cyan-50 dark:bg-cyan-950 border-cyan-500', text: 'text-cyan-400', connector: 'from-cyan-500 to-amber-500' },
  amber: { circle: 'bg-amber-50 dark:bg-amber-950 border-amber-500', text: 'text-amber-400', connector: 'from-amber-500 to-teal-500' },
  teal: { circle: 'bg-teal-50 dark:bg-teal-950 border-teal-500', text: 'text-teal-400', connector: 'from-teal-500 to-rose-500' },
  rose: { circle: 'bg-rose-50 dark:bg-rose-950 border-rose-500', text: 'text-rose-400', connector: 'from-rose-500 to-emerald-500' },
  emerald: { circle: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500', text: 'text-emerald-400', connector: '' },
}

function getPhaseColors(phaseId) {
  const info = phaseInfo[phaseId]
  return info ? phaseColorMap[info.color] : phaseColorMap.blue
}

function selectPhase(phase) {
  selectedPhase.value = phase
  if (!updatingFromUrl) {
    moduleNav.updateParams({ section: phase?.id })
  }
}

function closeDetail() {
  selectedPhase.value = null
  if (!updatingFromUrl) {
    moduleNav.updateParams({ section: undefined })
  }
}

function goToPage(phaseId) {
  moduleNav.navigateTo(phaseId)
}

const fromForYou = computed(() => moduleNav.params.value?.from === 'state-of-the-union')

function goBackToForYou() {
  moduleNav.navigateTo('state-of-the-union')
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
  { name: 'rfe-creator-autofix-rubric-pass', color: 'green', desc: 'RFE passed quality scoring' },
  { name: 'rfe-creator-needs-attention', color: 'amber', desc: 'Automation couldn\'t resolve all issues — you need to act' },
  { name: 'rfe-creator-auto-revised', color: 'blue', desc: 'Content was improved by automation' },
  { name: 'rfe-creator-auto-created', color: 'blue', desc: 'RFE was created by the pipeline' },
  { name: 'rfe-creator-feasibility-pass', color: 'green', desc: 'Technically feasible' },
  { name: 'rfe-creator-feasibility-fail', color: 'red', desc: 'Technically infeasible — review and revise' },
  { name: 'rfe-creator-feasibility-unknown', color: 'gray', desc: 'Feasibility couldn\'t be determined' },
  { name: 'rfe-creator-split-original', color: 'purple', desc: 'This RFE was decomposed into smaller RFEs' },
  { name: 'rfe-creator-split-result', color: 'purple', desc: 'This RFE was produced by splitting another' },
  { name: 'rfe-creator-ignore', color: 'gray', desc: 'Permanently excludes this RFE from all pipeline processing' },
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
  { name: 'Feature Scoring', desc: 'AI scores across 4 dimensions using independent reviewer agents (one per dimension). Each dimension scored 0–2, total /8', ai: true },
  { name: 'Human Sign-off', desc: 'A staff engineer, architect, or SME for the relevant product space reviews and approves', ai: false },
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

// Test Plan Review data
const testPlanSteps = [
  { name: 'Strategy Input', desc: 'Developer provides a RHAISTRAT key — the skill pulls the feature strategy from Jira', ai: false },
  { name: 'Test Plan Generation', desc: 'AI analyzes the strategy and generates a structured test plan (TestPlan.md)', ai: true },
  { name: 'Quality Review', desc: 'AI scores the test plan across 5 dimensions (0-2 each, /10 total)', ai: true },
  { name: 'Auto-Revision', desc: 'Failing plans are automatically revised up to 2 cycles', ai: true },
  { name: 'Human Sign-off', desc: 'Test engineer reviews and approves via test-plan-human-sign-off label', ai: false },
]

const testPlanScoringCriteria = [
  { name: 'Specificity', range: '0-2', question: 'Is the plan concrete and feature-specific, not generic boilerplate?' },
  { name: 'Grounding', range: '0-2', question: 'Are all findings traceable to source documents?' },
  { name: 'Scope Fidelity', range: '0-2', question: 'Does the test scope align with the strategy boundaries?' },
  { name: 'Actionability', range: '0-2', question: 'Can QE start testing immediately from this plan?' },
  { name: 'Consistency', range: '0-2', question: 'Do all sections align internally (priorities, endpoints, coverage)?' },
]

const testPlanLabels = [
  { name: 'test-plan-auto-created', color: 'blue', desc: 'An AI-generated test plan exists for this feature' },
  { name: 'test-plan-rubric-pass', color: 'green', desc: 'Test plan passed quality scoring (all criteria = 2)' },
  { name: 'test-plan-rubric-fail', color: 'red', desc: 'Test plan failed scoring — needs rework' },
  { name: 'test-plan-auto-revised', color: 'purple', desc: 'Test plan was automatically improved by AI' },
  { name: 'test-plan-human-sign-off', color: 'indigo', desc: 'Human test engineer has approved the test plan' },
]

const testPlanToolLinks = [
  { label: 'odh-test-gen plugin', icon: Code, url: 'https://github.com/opendatahub-io/odh-test-gen' },
  { label: 'test-plans repo', icon: Archive, url: 'https://gitlab.com/redhat/rhel-ai/agentic-ci/test-plans-data' },
  { label: 'Skills Registry', icon: BookOpen, url: 'https://github.com/opendatahub-io/skills-registry' },
  { label: 'Test Plan Skills Docs', icon: BookOpen, url: 'https://opendatahub-io.github.io/skills-registry/plugins/test-plan/' },
]

const testPlanCommunityLinks = [
  { label: '#forum-rhai-ai-first', icon: HelpCircle, url: 'https://app.slack.com/client/E030G10V24F/C0APP9DDB2R' },
  { label: '#wg-rhai-quality-eng-builder', icon: MessageSquare, url: 'https://app.slack.com/client/E030G10V24F/C0ANMTUF5FW' },
]

const docLearnLinks = [
  { label: 'Enablement Recording', icon: Play, url: 'https://drive.google.com/file/d/1A0JARScdMm1mnoHBj7P9mOULtNumWmDM/view' },
  { label: 'Slides', icon: FileText, url: 'https://docs.google.com/presentation/d/1Nv8Pp7fNRSzgED8B7p7KaBg1OaPnI011iA41EY-tCzo/edit?slide=id.g3e334837aa4_0_0#slide=id.g3e334837aa4_0_0' },
  { label: 'Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1D6-LmPIYRqLAWL5adDN8iVCmuV1Dz_JYkN3w7P7TYXw/edit?tab=t.p8v68m1kpy1y' },
]

const docCommunityLinks = [
  { label: '#wg-rhai-document-builder', icon: MessageSquare, url: 'https://redhat.enterprise.slack.com/archives/C0APCEUR196' },
  { label: '#forum-rhai-ai-first', icon: HelpCircle, url: 'https://app.slack.com/client/E030G10V24F/C0APP9DDB2R' },
]

// Build & Release data
const buildReleaseSteps = [
  { name: 'Create Jira Ticket', desc: 'Component team runs /create-component-onboarding-jira in Claude Code to collect onboarding info and create a Jira ticket with structured YAML', ai: false },
  { name: 'CI Discovery', desc: 'GitLab CI runs every 2 hours, discovers new onboarding tickets via JQL, and triggers a child pipeline per ticket', ai: true },
  { name: 'YAML Validation', desc: 'Pipeline validates the attached YAML against a JSON Schema, ensuring all required fields and formats are correct', ai: true },
  { name: 'PR/MR Generation', desc: 'For each unblocked step, the pipeline raises PRs/MRs across the relevant repos (Quay, Konflux, delivery, bundle, etc.)', ai: true },
  { name: 'Human Review', desc: 'DevOps and component teams review and merge the raised PRs/MRs — 100% HITL mandate, no changes pushed unreviewed', ai: false },
  { name: 'Merge Detection & Advancement', desc: 'Next CI run detects merged PRs, advances pipeline state, and raises PRs for newly unblocked steps', ai: true },
  { name: 'Auto-Resolution', desc: 'When all steps complete, the Jira ticket is automatically resolved with component-onboarding-completed label', ai: true },
]

const onboardingPipelineSteps = [
  { name: 'Validate YAML', target: 'Jira ticket', scope: 'both' },
  { name: 'Create Quay Repo', target: 'Quay.io', scope: 'both' },
  { name: 'Create Delivery Repo', target: 'GitLab', scope: 'rhoai' },
  { name: 'Konflux Release Data', target: 'konflux-release-data', scope: 'both' },
  { name: 'Push Pipelines', target: 'odh-konflux-central', scope: 'both' },
  { name: 'Pull Pipelines', target: 'rhoai-konflux-central', scope: 'rhoai' },
  { name: 'ODH Onboarder Workflow', target: 'opendatahub-io/opendatahub-operator', scope: 'odh' },
  { name: 'Operator Integration', target: 'Component repo', scope: 'conditional' },
  { name: 'Bundle Integration', target: 'Bundle repo', scope: 'both' },
  { name: 'Product Listing', target: 'product-listing repo', scope: 'rhoai' },
  { name: 'Auto-Merge Setup', target: 'Component repo', scope: 'rhoai' },
  { name: 'Renovate Setup', target: 'Renovate config', scope: 'rhoai' },
]

const buildReleaseLabels = [
  { name: 'yaml-attached', color: 'green', desc: 'Structured YAML has been attached to the Jira ticket' },
  { name: 'onboarding-in-review', color: 'blue', desc: 'Pipeline has picked up the ticket and onboarding is in progress' },
  { name: 'quay-mr-raised', color: 'blue', desc: 'Quay repository creation MR raised' },
  { name: 'krd-mr-raised', color: 'blue', desc: 'Konflux release data MR raised' },
  { name: 'okc-pr-raised', color: 'blue', desc: 'ODH Konflux Central push pipeline PR raised' },
  { name: 'rkc-pr-raised', color: 'blue', desc: 'RHOAI Konflux Central push pipeline PR raised' },
  { name: 'delivery-repo-mr-raised', color: 'blue', desc: 'Delivery repository creation MR raised' },
  { name: 'delivery-repo-mr-merged', color: 'green', desc: 'Delivery repository MR has been merged' },
  { name: 'rkc-pull-pr-raised', color: 'blue', desc: 'RHOAI Konflux Central pull pipeline PR raised' },
  { name: 'onboarder-workflow-triggered', color: 'blue', desc: 'ODH onboarder GitHub workflow has been triggered' },
  { name: 'product-listing-mr-raised', color: 'blue', desc: 'Product listing MR raised' },
  { name: 'auto-merge-pr-raised', color: 'blue', desc: 'Auto-merge configuration PR raised' },
  { name: 'renovate-sync-triggered', color: 'blue', desc: 'Renovate sync has been triggered' },
  { name: 'component-onboarding-completed', color: 'green', desc: 'All onboarding steps completed successfully' },
]

const buildReleaseLearnLinks = [
  { label: 'Enablement Recording', icon: Play, url: 'javascript:void(0)' },
  { label: 'Enablement Slides', icon: FileText, url: 'javascript:void(0)' },
]

const buildReleaseToolLinks = [
  { label: 'aiops-skills plugin', icon: Code, url: 'https://github.com/opendatahub-io/skills-registry/blob/main/site/docs/plugins/aiops-skills/index.md' },
  { label: 'Skills Registry', icon: BookOpen, url: 'https://github.com/opendatahub-io/skills-registry' },
]

const buildReleaseCommunityLinks = [
  { label: '#forum-rhai-ai-first', icon: HelpCircle, url: 'https://app.slack.com/client/E030G10V24F/C0APP9DDB2R' },
]

// Jira Autofix data
const autofixSteps = [
  { name: 'Bug Filed', desc: 'A bug is filed in Jira with a repository URL and description of the issue', ai: false },
  { name: 'AI Triage', desc: 'Bot scans new tickets, evaluates if they have enough info for an AI agent to fix, and labels accordingly', ai: true },
  { name: 'Autofix', desc: 'Bot clones the repo, creates a branch, runs Claude Code to analyze and fix the issue, and creates an MR/PR', ai: true },
  { name: 'Review Iteration', desc: 'Bot addresses review feedback and CI failures on each scheduled cycle (~30 min), pushing fixes and resolving threads (up to 36 iterations)', ai: true },
  { name: 'Human Review', desc: 'Engineers review and merge the MR/PR, or leave feedback for the bot to address on its next iteration', ai: false },
]

const autofixTriageLabels = [
  { name: 'jira-triage-pending', color: 'blue', desc: 'Triage bot is processing the ticket' },
  { name: 'jira-triage-missing-info', color: 'amber', desc: 'Ticket needs more information from the reporter' },
  { name: 'jira-triage-not-fixable', color: 'gray', desc: 'Not suitable for automated fixing' },
  { name: 'jira-triage-external', color: 'amber', desc: 'External reporter, needs Red Hat engineer approval' },
  { name: 'jira-triage-stale', color: 'gray', desc: 'No response for 14 days' },
]

const autofixPipelineLabels = [
  { name: 'jira-autofix', color: 'green', desc: 'Ticket is ready for the bot to pick up' },
  { name: 'jira-autofix-pending', color: 'blue', desc: 'Bot is currently processing the ticket' },
  { name: 'jira-autofix-review', color: 'blue', desc: 'MR/PR created, bot is iterating on review feedback' },
  { name: 'jira-autofix-ci-failing', color: 'red', desc: 'Pipeline broken on the MR/PR, bot will retry' },
  { name: 'jira-autofix-merged', color: 'green', desc: 'MR/PR has been merged' },
  { name: 'jira-autofix-rejected', color: 'red', desc: 'MR/PR closed without merge' },
  { name: 'jira-autofix-max-retries', color: 'amber', desc: 'Bot hit its iteration limit, needs human takeover' },
  { name: 'jira-autofix-blocked', color: 'amber', desc: 'Bot needs more information (e.g. missing repo URL)' },
  { name: 'no-autofix', color: 'gray', desc: 'Permanently excludes this ticket from triage and autofix' },
]

const autofixToolLinks = [
  { label: 'Autofix repo', icon: Code, url: 'https://gitlab.com/redhat/rhel-ai/agentic-ci/autofix' },
]

const autofixCommunityLinks = [
  { label: '#forum-rhai-ai-first', icon: HelpCircle, url: 'https://app.slack.com/client/E030G10V24F/C0APP9DDB2R' },
]

function scopeBadgeClasses(scope) {
  const map = {
    both: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    odh: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    rhoai: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400',
    conditional: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  }
  return map[scope] || map.both
}

function scopeLabel(scope) {
  const map = { both: 'Both', odh: 'ODH', rhoai: 'RHOAI', conditional: 'Conditional' }
  return map[scope] || scope
}

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
  <div class="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <div v-if="fromForYou" class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <button
        @click="goBackToForYou"
        class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
      >
        &larr; Back to State of the Union
      </button>
    </div>
    <div class="flex flex-1 overflow-hidden">

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
          <div class="absolute left-[19px] top-0 bottom-14 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 via-cyan-500 via-amber-500 to-emerald-500 opacity-30 dark:opacity-30"></div>

          <template v-for="(phase, idx) in PHASES" :key="phase.id">
            <!-- Stage card -->
            <button
              @click="selectPhase(phase)"
              class="relative flex items-start gap-5 pl-0 w-full text-left group"
            >
              <!-- Circle on spine -->
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-[1] border-2"
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
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1]"
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

        <!-- Scoring quick reference -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Scoring quick reference</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">Pass: ≥ 7/10 total AND no zeros on any criterion</p>
          <div class="space-y-3">
            <div v-for="c in scoringCriteria" :key="c.name" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-20 text-right whitespace-nowrap flex-shrink-0">
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

        <!-- How to check your RFE's score -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">How to check your RFE's assessment score</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Search :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Check labels in Jira</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Look for the <code class="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-xs rounded font-mono">rfe-creator-autofix-rubric-pass</code> label (passing) or <code class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">rfe-creator-needs-attention</code> label (failing) on your RHAIRFE ticket</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Eye :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">View details in AI Impact</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Find your RFE on the <button @click="goToPage('rfe-review')" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">RFE Review</button> page to see the full score breakdown and per-criterion results</div>
              </div>
            </div>
          </div>
        </div>

        <!-- What you need to do -->
        <div class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3">What you need to do</h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Sparkles :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Use the <a href="https://github.com/opendatahub-io/skills-registry" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">rfe-creator</a> skill in Claude Code to draft, review, and improve RFEs before submitting</span>
            </li>
            <li class="flex items-start gap-3">
              <Pencil :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Write your business justification in the <strong class="text-gray-900 dark:text-white">Description</strong> field — that's what the AI reads</span>
            </li>
            <li class="flex items-start gap-3">
              <Eye :size="20" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Watch for the <code class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">rfe-creator-needs-attention</code> label on your Jira tickets</span>
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

        <!-- What's Next -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">What's next</h3>
          <button
            @click="selectPhase(PHASES.find(p => p.id === 'feature-review'))"
            class="w-full flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 rounded-lg text-left group hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
          >
            <ChevronsRight :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Feature Review</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Once an RFE is approved, the pipeline creates a Feature ticket in Jira, refines it with architecture context, and scores it across 4 dimensions.</div>
            </div>
          </button>
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
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1]"
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
                  {{ step.desc }}<template v-if="step.hint">. Uses architecture context docs from <a :href="'https://github.com/' + step.hint" target="_blank" rel="noopener" class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 hover:underline rounded text-xs font-mono">{{ step.hint }}</a></template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scoring quick reference -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Scoring quick reference</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">4 dimensions · 0–2 each · /8 total</p>
          <div class="space-y-3">
            <div v-for="c in featureScoringCriteria" :key="c.name" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-32 text-right whitespace-nowrap flex-shrink-0">
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
                <span class="text-base mt-px">✅</span>
                <div>
                  <span class="text-sm font-semibold text-green-600 dark:text-green-400">APPROVE</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">≥6, no zeros</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Feature is solid — proceeds to human sign-off</div>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                <span class="text-base mt-px">⚠️</span>
                <div>
                  <span class="text-sm font-semibold text-amber-600 dark:text-amber-400">REVISE</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">≥3, at most 1 zero</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Needs targeted improvements before re-review</div>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg">
                <span class="text-base mt-px">❌</span>
                <div>
                  <span class="text-sm font-semibold text-red-600 dark:text-red-400">REJECT</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">&lt;3 or 2+ zeros</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fundamental issues — likely needs RFE rework AND architecture context improvements</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- How to check your verdict -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">How to check your feature's AI verdict</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Search :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Check labels in Jira</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Look for the <code class="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-xs rounded font-mono">strat-creator-rubric-pass</code> label (approve) or <code class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">strat-creator-needs-attention</code> label (revise/reject) on your RHAISTRAT ticket</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Eye :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">View details in AI Impact</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Find your feature on the <button @click="goToPage('feature-review')" class="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Feature Review</button> page to see the full AI verdict, per-dimension scores, and reviewer comments</div>
              </div>
            </div>
          </div>
        </div>

        <!-- If APPROVED -->
        <div class="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3">
            <span class="mr-1.5">✅</span> If your feature's AI verdict was: APPROVE
          </h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <User :size="20" class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">A staff engineer, architect, or SME for the feature's component/product space should review it in Jira and provide sign-off by adding the <code class="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 text-xs rounded font-mono">strat-creator-human-sign-off</code> label</span>
            </li>
          </ul>
        </div>

        <!-- If REVISE -->
        <div class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3">
            <span class="mr-1.5">⚠️</span> If your feature's AI verdict was: REVISE
          </h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Search :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Check which dimensions scored low — the review comments explain what's missing</span>
            </li>
            <li class="flex items-start gap-3">
              <Pencil :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">The responsible staff engineer, architect, or SME should add guidance via the <strong class="text-gray-900 dark:text-white">"Staff Engineer / SME Input"</strong> field in Jira</span>
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
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Never edit the AI-generated feature text directly — the pipeline regenerates it on each run and your edits will be overwritten. Instead, add SME input or improve architecture context.</div>
            </div>
          </div>
        </div>

        <!-- If REJECT -->
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-3">
            <span class="mr-1.5">❌</span> If your feature's AI verdict was: REJECT
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
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add overlays or update base content in <a href="https://github.com/opendatahub-io/architecture-context" target="_blank" rel="noopener" class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 hover:underline rounded text-xs font-mono">opendatahub-io/architecture-context</a> so the AI has better information</div>
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 mt-3">After improvements, the feature will be re-processed automatically.</p>
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
              <span class="text-sm text-gray-700 dark:text-gray-300">The <a href="https://github.com/opendatahub-io/architecture-context" target="_blank" rel="noopener" class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 hover:underline rounded text-xs font-mono">opendatahub-io/architecture-context</a> repo contains AI-generated architecture docs for every RHOAI component</span>
            </li>
            <li class="flex items-start gap-3">
              <FileText :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Overlays</strong> let you add corrections between regeneration cycles — SDK version bumps, component renames, maturity changes</span>
            </li>
            <li class="flex items-start gap-3">
              <Globe :size="20" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Improving this repo directly improves feature quality across the board — not just for your feature</span>
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
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">After human sign-off, the next step is Epic Creation — but this stage of the pipeline hasn't been implemented yet. Coming soon.</div>
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

    <!-- ─── Test Plan Review Detail ─── -->
    <div v-else-if="selectedPhase.id === 'test-plan-review'" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-cyan-500/10 border-2 border-cyan-500 flex items-center justify-center">
              <span class="text-cyan-600 dark:text-cyan-400 text-sm font-bold">4</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Test Plan Review</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">AI generates structured test plans from approved feature strategies, then scores them across 5 quality dimensions. Plans that pass can proceed directly to test case generation.</p>
            </div>
          </div>
          <button
            @click="goToPage('test-plan-review')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to Test Plan Review
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- How it works -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">How it works</h3>
          <div class="relative ml-1">
            <div class="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div v-for="(step, i) in testPlanSteps" :key="step.name" class="flex items-start gap-4 relative" :class="i < testPlanSteps.length - 1 ? 'pb-5' : ''">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                :class="step.ai
                  ? 'bg-cyan-500/10 border-2 border-cyan-500'
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'"
              >
                <Sparkles v-if="step.ai" :size="16" class="text-cyan-600 dark:text-cyan-400" />
                <User v-else :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ step.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ step.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scoring quick reference -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Scoring quick reference</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">5 dimensions · 0-2 each · /10 total · All five must score 2 to pass</p>
          <div class="space-y-3">
            <div v-for="c in testPlanScoringCriteria" :key="c.name" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-32 text-right whitespace-nowrap flex-shrink-0">
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
                <span class="text-base mt-px">&#x2705;</span>
                <div>
                  <span class="text-sm font-semibold text-green-600 dark:text-green-400">READY</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">all criteria = 2</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Test plan is solid — proceed to test case generation</div>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                <span class="text-base mt-px">&#x26A0;&#xFE0F;</span>
                <div>
                  <span class="text-sm font-semibold text-amber-600 dark:text-amber-400">REVISE</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">some criteria &lt; 2</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-revision will attempt to fix — up to 2 cycles</div>
                </div>
              </div>
              <div class="flex items-start gap-3 p-3 bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg">
                <span class="text-base mt-px">&#x274C;</span>
                <div>
                  <span class="text-sm font-semibold text-red-600 dark:text-red-400">REWORK</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">fundamental gaps</span>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Provide additional source documents (ADR, API spec, design doc) and re-run</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- How to check your test plan's score -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">How to check your test plan's score</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Search :size="20" class="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Check labels in Jira</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Look for <code class="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-xs rounded font-mono">test-plan-rubric-pass</code> (passing) or <code class="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 text-xs rounded font-mono">test-plan-rubric-fail</code> (failing) on your RHAISTRAT ticket</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Eye :size="20" class="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">View details in AI Impact</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Find your test plan on the <button @click="goToPage('test-plan-review')" class="text-cyan-600 dark:text-cyan-400 hover:underline font-medium">Test Plan Review</button> page to see the full score breakdown, gap analysis, and per-criterion results</div>
              </div>
            </div>
          </div>
        </div>

        <!-- What you need to do -->
        <div class="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wide mb-3">What you need to do</h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Sparkles :size="20" class="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Run <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-cyan-700 dark:text-cyan-400 text-xs rounded font-mono">/test-plan-create RHAISTRAT-XXX</code> in Claude Code to generate a test plan from a feature strategy</span>
            </li>
            <li class="flex items-start gap-3">
              <Eye :size="20" class="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Check the verdict — <strong class="text-gray-900 dark:text-white">Ready</strong> means proceed to test cases, <strong class="text-gray-900 dark:text-white">Revise</strong> triggers auto-fix</span>
            </li>
            <li class="flex items-start gap-3">
              <AlertTriangle :size="20" class="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">If <strong class="text-gray-900 dark:text-white">Rework</strong>, provide additional source documents (ADR, API spec, design doc) and re-run</span>
            </li>
            <li class="flex items-start gap-3">
              <User :size="20" class="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">After review, a test engineer should sign off by adding <code class="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 text-xs rounded font-mono">test-plan-human-sign-off</code> in Jira</span>
            </li>
          </ul>
        </div>

        <!-- Jira labels (collapsible) -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-6">
          <button
            @click="testPlanLabelsExpanded = !testPlanLabelsExpanded"
            class="flex items-center justify-between w-full p-5"
          >
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jira Labels Reference</h3>
            <ChevronDown
              :size="16"
              class="text-gray-400 dark:text-gray-500 transition-transform"
              :class="testPlanLabelsExpanded ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="testPlanLabelsExpanded" class="px-5 pb-5 -mt-1">
            <div class="space-y-2">
              <div v-for="l in testPlanLabels" :key="l.name" class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono" :class="labelColorClasses(l.color)">{{ l.name }}</code>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ l.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- What's Next -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">What's next</h3>
          <div class="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg">
            <ChevronsRight :size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Security Review</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">After the test plan is approved, the next step is Security Review — but this stage of the pipeline hasn't been implemented yet. Coming soon.</div>
            </div>
          </div>
        </div>

        <!-- Links -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Tools &amp; Resources</h4>
          <div class="flex gap-2 flex-wrap mb-5">
            <a
              v-for="link in testPlanToolLinks"
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
              v-for="link in testPlanCommunityLinks"
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

    <!-- ─── Documentation Detail ─── -->
    <div v-else-if="selectedPhase.id === 'documentation'" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-teal-500/10 border-2 border-teal-500 flex items-center justify-center">
              <span class="text-teal-600 dark:text-teal-400 text-sm font-bold">6</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Documentation</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">AI-First-driven documentation for dev-complete features. The tool automatically generates documentation MRs for (preferably) RHAISTRAT issues that require product documentation.</p>
            </div>
          </div>
          <button
            @click="goToPage('documentation')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to Documentation
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- How it works -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">How it works</h3>
          <div class="relative ml-1">
            <div class="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div class="flex items-start gap-4 relative pb-5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1] bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                <User :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">Trigger</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add the <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-teal-600 dark:text-teal-400 text-xs rounded font-mono">ai1st-doc-start</code> label to the Jira issue needing documentation (preferably RHAISTRAT)</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This <i>at the moment</i> for AI-First is the signal that dev work is completed and documentation can begin</div>
              </div>
            </div>
            <div class="flex items-start gap-4 relative pb-5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1] bg-teal-500/10 border-2 border-teal-500">
                <Sparkles :size="16" class="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Generation of Documentation</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pipeline generates documentation and raises an MR against the docs repo. Issue is labeled <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-teal-600 dark:text-teal-400 text-xs rounded font-mono">ai1st-doc-invoked</code></div>
              </div>
            </div>
            <div class="flex items-start gap-4 relative pb-5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1] bg-teal-500/10 border-2 border-teal-500">
                <Sparkles :size="16" class="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">MR Contributed</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">When the MR is raised, the issue, its parent RHAISTRAT, and CCS Epic is labeled <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-teal-600 dark:text-teal-400 text-xs rounded font-mono">ai1st-doc-contributed</code></div>
              </div>
            </div>
            <div class="flex items-start gap-4 relative">
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1] bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                <User :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">Human Review</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">CCS/Docs team, SME (Eng, QE, ...) reviews and merges the contributed MR to the docs repo</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Jira labels reference -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Jira Labels Reference</h3>
          <div class="space-y-2">
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono bg-green-500/15 text-green-600 dark:text-green-400">ai1st-doc-start</code>
              <span class="text-xs text-gray-500 dark:text-gray-400">Add this label to trigger AI documentation generation</span>
            </div>
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono bg-blue-500/15 text-blue-600 dark:text-blue-400">ai1st-doc-invoked</code>
              <span class="text-xs text-gray-500 dark:text-gray-400">Pipeline was triggered for this issue</span>
            </div>
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">ai1st-doc-contributed</code>
              <span class="text-xs text-gray-500 dark:text-gray-400">Documentation MR was raised</span>
            </div>
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono bg-gray-500/15 text-gray-600 dark:text-gray-400">ai1st-doc-skip</code>
              <span class="text-xs text-gray-500 dark:text-gray-400">Issue already has documentation or release notes, no need to be actioned by AI-First</span>
            </div>
          </div>
        </div>

        <!-- What you need to do -->
        <div class="bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide mb-3">What you need to do</h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Pencil :size="20" class="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Add the <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-teal-700 dark:text-teal-400 text-xs rounded font-mono">ai1st-doc-start</code> label to (preferably) RHAISTRAT issues that need documentation.
                <br><span class="text-xs text-gray-500 dark:text-gray-400">This <i>at the moment</i> is the signal for AI-First that dev work is completed and documentation can begin</span>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <Eye :size="20" class="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Monitor the <button @click="goToPage('documentation')" class="text-teal-600 dark:text-teal-400 hover:underline font-medium">Documentation dashboard</button> for coverage rate and contributed MRs</span>
            </li>
            <li class="flex items-start gap-3">
              <User :size="20" class="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Review and merge the <a href="https://gitlab.cee.redhat.com/documentation-red-hat-openshift-data-science-documentation/openshift-ai-documentation/-/merge_requests/?sort=created_date&state=opened&author_username=project_82936_bot_de8f25c2e1ca1c33b2b507874163e1c7&first_page_size=20" target="_blank" rel="noopener noreferrer" class="text-teal-600 dark:text-teal-400 hover:underline font-medium">contributed MRs in the docs repo</a>: <i>specific</i> comments about the content of the MR should be addressed and resolved between the Technical Writer and SMEs (Sw Eng, QE, etc) directly in the Merge Request</span>
            </li>
            <li class="flex items-start gap-3">
              <MessageSquare :size="20" class="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Report <i>general</i> comments on the quality of the MRs generated by the AI Agent (leveraging CCS' "RHDAT" tool) in the Slack channel <a href="https://redhat.enterprise.slack.com/archives/C0APCEUR196" target="_blank" rel="noopener noreferrer" class="text-teal-600 dark:text-teal-400 hover:underline font-medium">#wg-rhai-document-builder</a> to benefit future and other scopes of work</span>
            </li>
            <li class="flex items-start gap-3">
              <AlertTriangle :size="20" class="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">If a feature appears in the demand pool but already has documentation or release notes, add the <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs rounded font-mono">ai1st-doc-skip</code> label to the Jira issue. Preferably add a comment explaining why (e.g. "Docs already published in 3.x release notes")</span>
            </li>
          </ul>
        </div>

        <!-- Links -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Learn</h4>
          <div class="flex gap-2 flex-wrap mb-5">
            <a
              v-for="link in docLearnLinks"
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
              v-for="link in docCommunityLinks"
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

    <!-- ─── Build & Release Detail ─── -->
    <div v-else-if="selectedPhase.id === 'build-release'" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-rose-500/10 border-2 border-rose-500 flex items-center justify-center">
              <span class="text-rose-600 dark:text-rose-400 text-sm font-bold">7</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Build & Release</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Agentic CI pipeline that onboards new components into the build system by raising PRs/MRs across 6+ repos, triggered by a Jira ticket.</p>
            </div>
          </div>
          <button
            @click="goToPage('build-release')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to Build & Release
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- How it works -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">How it works</h3>
          <div class="relative ml-1">
            <div class="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div
              v-for="(step, idx) in buildReleaseSteps"
              :key="step.name"
              class="flex items-start gap-4 relative"
              :class="idx < buildReleaseSteps.length - 1 ? 'pb-5' : ''"
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1]"
                :class="step.ai
                  ? 'bg-rose-500/10 border-2 border-rose-500'
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'"
              >
                <Sparkles v-if="step.ai" :size="16" class="text-rose-600 dark:text-rose-400" />
                <User v-else :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ step.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ step.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- CI Cadence callout -->
        <div class="bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-xl p-5 mb-6">
          <div class="flex items-start gap-3">
            <Timer :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Async 2-Hour CI Loop</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Fully idempotent — re-running is always safe. Each CI run discovers new tickets, checks for merged PRs, and advances to unblocked steps. No waiting, no duplicate PRs.</div>
            </div>
          </div>
        </div>

        <!-- Pipeline Steps Overview -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pipeline Steps Overview</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">12 steps · dependencies determine execution order · idempotent</p>
          <div class="space-y-2">
            <div
              v-for="(step, idx) in onboardingPipelineSteps"
              :key="step.name"
              class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
            >
              <span class="w-6 h-6 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <span class="text-xs font-bold text-rose-600 dark:text-rose-400">{{ idx + 1 }}</span>
              </span>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ step.name }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 ml-2">→ {{ step.target }}</span>
              </div>
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                :class="scopeBadgeClasses(step.scope)"
              >{{ scopeLabel(step.scope) }}</span>
            </div>
          </div>
        </div>

        <!-- How to check your onboarding status -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">How to check your onboarding status</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Search :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Check labels in Jira</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Look for <code class="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-xs rounded font-mono">component-onboarding-completed</code> (done) or <code class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs rounded font-mono">onboarding-in-review</code> (in progress) on your onboarding ticket</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Eye :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">View details in AI Impact</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Find your component on the <button @click="goToPage('build-release')" class="text-rose-600 dark:text-rose-400 hover:underline font-medium">Build & Release</button> page to see the full onboarding progress, step status, and PR links</div>
              </div>
            </div>
          </div>
        </div>

        <!-- What you need to do (dual-audience) -->
        <div class="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide mb-4">What you need to do</h3>

          <!-- For Component Teams -->
          <div class="mb-5">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">For Component Teams</h4>
            <ul class="space-y-3">
              <li class="flex items-start gap-3">
                <Terminal :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Run <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-rose-700 dark:text-rose-400 text-xs rounded font-mono">/create-component-onboarding-jira</code> in Claude Code to create your onboarding ticket</span>
              </li>
              <li class="flex items-start gap-3">
                <Package :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Ensure your Dockerfile uses <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-rose-700 dark:text-rose-400 text-xs rounded font-mono">@sha256</code> pinned base images for RHOAI components</span>
              </li>
              <li class="flex items-start gap-3">
                <GitPullRequest :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Review and merge PRs raised against your component repo by the onboarding pipeline</span>
              </li>
              <li class="flex items-start gap-3">
                <Eye :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Monitor your Jira ticket for progress updates — labels are added as each step completes</span>
              </li>
            </ul>
          </div>

          <div class="border-t border-rose-200 dark:border-rose-500/20 my-4"></div>

          <!-- For DevOps -->
          <div>
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">For DevOps</h4>
            <ul class="space-y-3">
              <li class="flex items-start gap-3">
                <GitPullRequest :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Review and merge PRs/MRs raised by the onboarding pipeline across Quay, Konflux, delivery, and bundle repos</span>
              </li>
              <li class="flex items-start gap-3">
                <AlertTriangle :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Monitor the GitLab CI pipeline for failures — each onboarding ticket runs in an isolated child pipeline</span>
              </li>
              <li class="flex items-start gap-3">
                <Eye :size="20" class="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Check the <button @click="goToPage('build-release')" class="text-rose-600 dark:text-rose-400 hover:underline font-medium">Build & Release dashboard</button> for overall onboarding progress across all components</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Jira labels (collapsible) -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-6">
          <button
            @click="buildReleaseLabelsExpanded = !buildReleaseLabelsExpanded"
            class="flex items-center justify-between w-full p-5"
          >
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jira Labels Reference</h3>
            <ChevronDown
              :size="16"
              class="text-gray-400 dark:text-gray-500 transition-transform"
              :class="buildReleaseLabelsExpanded ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="buildReleaseLabelsExpanded" class="px-5 pb-5 -mt-1">
            <div class="space-y-2">
              <div v-for="l in buildReleaseLabels" :key="l.name" class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
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
              v-for="link in buildReleaseLearnLinks"
              :key="link.label"
              :href="link.url"
              :target="link.url.startsWith('http') ? '_blank' : undefined"
              :rel="link.url.startsWith('http') ? 'noopener' : undefined"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <component :is="link.icon" :size="14" class="text-gray-400 dark:text-gray-500" />
              {{ link.label }}
            </a>
          </div>

          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Tools &amp; Resources</h4>
          <div class="flex gap-2 flex-wrap mb-5">
            <a
              v-for="link in buildReleaseToolLinks"
              :key="link.label"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <component :is="link.icon" :size="14" class="text-gray-400 dark:text-gray-500" />
              {{ link.label }}
            </a>
            <button
              @click="goToPage('build-release')"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Eye :size="14" class="text-gray-400 dark:text-gray-500" />
              Build & Release Dashboard
            </button>
          </div>

          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Community</h4>
          <div class="flex gap-2 flex-wrap">
            <a
              v-for="link in buildReleaseCommunityLinks"
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

    <!-- ─── Jira Autofix Detail ─── -->
    <div v-else-if="selectedPhase.id === 'jira-autofix'" class="flex-1 overflow-auto p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <!-- Back -->
        <button
          @click="closeDetail"
          class="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mb-4 cursor-pointer"
        >
          <ArrowLeft :size="16" />
          Back to Pipeline Overview
        </button>

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center">
              <span class="text-emerald-600 dark:text-emerald-400 text-sm font-bold">8</span>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Jira Autofix</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">AI agents running in GitLab CI that triage bug tickets, generate fixes, and create MRs/PRs, iterating on review feedback until merged or escalated.</p>
            </div>
          </div>
          <button
            @click="goToPage('autofix')"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            Go to Jira AutoFix
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- How it works -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">How it works</h3>
          <div class="relative ml-1">
            <div class="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div v-for="(step, i) in autofixSteps" :key="step.name" class="flex items-start gap-4 relative" :class="i < autofixSteps.length - 1 ? 'pb-5' : ''">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-[1]"
                :class="step.ai
                  ? 'bg-emerald-500/10 border-2 border-emerald-500'
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'"
              >
                <Sparkles v-if="step.ai" :size="16" class="text-emerald-600 dark:text-emerald-400" />
                <User v-else :size="16" class="text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ step.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ step.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Triage verdicts -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Triage verdicts</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">The triage bot evaluates three questions: Can the agent start? Can the agent find and fix it? Should an agent fix this?</p>
          <div class="space-y-2">
            <div class="flex items-start gap-3 p-3 bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-lg">
              <span class="text-base mt-px">&#x2705;</span>
              <div>
                <span class="text-sm font-semibold text-green-600 dark:text-green-400">READY</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ticket gets the <code class="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-xs rounded font-mono">jira-autofix</code> label and enters the autofix pipeline</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg">
              <span class="text-base mt-px">&#x26A0;&#xFE0F;</span>
              <div>
                <span class="text-sm font-semibold text-amber-600 dark:text-amber-400">NEEDS INFO</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bot comments with specific questions. Add the info and remove <code class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">jira-triage-missing-info</code> to retry</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg">
              <span class="text-base mt-px">&#x274C;</span>
              <div>
                <span class="text-sm font-semibold text-red-600 dark:text-red-400">NOT FIXABLE</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ticket requires design decisions, infrastructure changes, or runtime investigation. Labeled and skipped, still needs human attention</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ticket types -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Ticket types</h3>
          <div class="space-y-2">
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-20 text-right flex-shrink-0">
                <span class="text-sm font-bold text-gray-900 dark:text-white">Bug</span>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-600"></div>
              <div class="text-sm text-gray-700 dark:text-gray-300">Fix the bug and add a reproducing test</div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div class="w-20 text-right flex-shrink-0">
                <span class="text-sm font-bold text-gray-900 dark:text-white">Story</span>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-600"></div>
              <div class="text-sm text-gray-700 dark:text-gray-300">Implement the feature as described</div>
            </div>
          </div>
        </div>

        <!-- Iteration loop callout -->
        <div class="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-5 mb-6">
          <div class="flex items-start gap-3">
            <RefreshCw :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Iteration Loop (~30 min cycles)</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">After creating an MR/PR, the bot checks for unresolved review threads and CI failures on each scheduled cycle. It re-runs Claude Code with the feedback as context, pushes fixes, and resolves addressed threads. Up to 36 iterations, then escalates to human.</div>
            </div>
          </div>
        </div>

        <!-- What you need to do (writing a good ticket) -->
        <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-3">Writing a good ticket</h3>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <Code :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Include the repository URL</strong>: a direct link to the GitHub or GitLab repo. This is required</span>
            </li>
            <li class="flex items-start gap-3">
              <FileText :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Describe the incorrect behavior</strong>: include error messages, stack traces, or steps to reproduce</span>
            </li>
            <li class="flex items-start gap-3">
              <Eye :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">State the expected behavior</strong>: the more specific, the better</span>
            </li>
            <li class="flex items-start gap-3">
              <Search :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Point to the relevant code</strong>: if you know the file, function, or module, mention it</span>
            </li>
            <li class="flex items-start gap-3">
              <AlertTriangle :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Keep it focused</strong>: one bug per ticket. Multi-issue tickets are harder for the bot</span>
            </li>
          </ul>
        </div>

        <!-- If the bot is stuck -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">If the bot is stuck</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <Code :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Missing repo URL</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ticket gets <code class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">jira-autofix-blocked</code>. Add a repository URL and remove the label to retry</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <RefreshCw :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Max iterations reached</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">The bot has done its best. Review the MR/PR and either merge, leave more comments, or take over manually</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <AlertTriangle :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">CI keeps failing</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Check whether the failure is in the bot's changes or a pre-existing issue. The bot can only fix failures caused by its own code</div>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <GitPullRequest :size="20" class="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white">Bad fix quality</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Leave review comments on the MR/PR. The bot reads unresolved threads on its next iteration and attempts to address them</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Security callout -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Security</h3>
          <div class="space-y-2">
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <AlertTriangle :size="18" class="text-amber-500 flex-shrink-0 mt-0.5" />
              <span class="text-xs text-gray-600 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">External reporter gate</strong>: tickets from non-<code class="text-xs">@redhat.com</code> reporters are blocked until a Red Hat engineer adds <code class="px-1 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">jira-triage-external-ok</code></span>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <AlertTriangle :size="18" class="text-amber-500 flex-shrink-0 mt-0.5" />
              <span class="text-xs text-gray-600 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Secret scanning</strong>: gitleaks runs before every push. If secrets are detected, the push is blocked and the ticket transitions to <code class="px-1 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs rounded font-mono">jira-autofix-blocked</code></span>
            </div>
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <AlertTriangle :size="18" class="text-amber-500 flex-shrink-0 mt-0.5" />
              <span class="text-xs text-gray-600 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Comment filtering</strong>: only comments from <code class="text-xs">@redhat.com</code> email addresses are fed to the AI agent. All bot comments are restricted to "Red Hat Employee" visibility</span>
            </div>
          </div>
        </div>

        <!-- Opting out -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Opting out</h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Add the <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs rounded font-mono">no-autofix</code> label to any ticket to exclude it from both triage and autofix. The bot will never scan, assess, or attempt to fix tickets with this label.
          </p>
        </div>

        <!-- Jira labels (collapsible) -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-6">
          <button
            @click="autofixLabelsExpanded = !autofixLabelsExpanded"
            class="flex items-center justify-between w-full p-5"
          >
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jira Labels Reference</h3>
            <ChevronDown
              :size="16"
              class="text-gray-400 dark:text-gray-500 transition-transform"
              :class="autofixLabelsExpanded ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="autofixLabelsExpanded" class="px-5 pb-5 -mt-1">
            <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Triage</h4>
            <div class="space-y-2 mb-4">
              <div v-for="l in autofixTriageLabels" :key="l.name" class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono" :class="labelColorClasses(l.color)">{{ l.name }}</code>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ l.desc }}</span>
              </div>
            </div>
            <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Autofix</h4>
            <div class="space-y-2">
              <div v-for="l in autofixPipelineLabels" :key="l.name" class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <code class="text-xs px-2 py-0.5 rounded whitespace-nowrap font-mono" :class="labelColorClasses(l.color)">{{ l.name }}</code>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ l.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Links -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Tools &amp; Resources</h4>
          <div class="flex gap-2 flex-wrap mb-5">
            <a
              v-for="link in autofixToolLinks"
              :key="link.label"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <component :is="link.icon" :size="14" class="text-gray-400 dark:text-gray-500" />
              {{ link.label }}
            </a>
            <button
              @click="goToPage('autofix')"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Eye :size="14" class="text-gray-400 dark:text-gray-500" />
              Jira AutoFix Dashboard
            </button>
          </div>

          <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Community</h4>
          <div class="flex gap-2 flex-wrap">
            <a
              v-for="link in autofixCommunityLinks"
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
  </div>
</template>
