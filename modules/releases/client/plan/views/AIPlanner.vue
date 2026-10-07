<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import Toast from '@shared/client/components/Toast.vue'
import { useDraftPlans } from '../composables/useDraftPlans'

const iframeRef = ref(null)
const containerRef = ref(null)
const containerHeight = ref('600px')
const DEMO_URL = '/ai-first-scheduler/index.html'
// The planner reads ?user= and preselects that person in its PM filter, so a PM
// lands on their own features instead of All PMs.
const plannerUrl = ref('')

async function resolvePlannerUrl() {
  let uid = ''
  try {
    const access = await apiRequest('/modules/releases/draft-plans/access')
    uid = (access && access.session && access.session.uid) || ''
  } catch {
    // Signed-in identity is unavailable; fall back to the unfiltered planner.
  }
  plannerUrl.value = uid ? DEMO_URL + '?user=' + encodeURIComponent(uid) : DEMO_URL
}

// The Plan tab wraps its content in a height-less div, so h-full collapses and the iframe is
// left at whatever min-height we give it — half a screen on a 1080p display. Measure the space
// actually remaining below the container instead. TAB_GUTTER matches that wrapper's p-6 padding.
const TAB_GUTTER = 24
let layoutObserver = null

function syncContainerHeight() {
  // offsetParent is null while another Plan tab is showing; measuring then would
  // read a top of 0 and leave an oversized frame behind when the tab returns.
  if (!containerRef.value || containerRef.value.offsetParent === null) return
  const top = containerRef.value.getBoundingClientRect().top
  containerHeight.value = Math.max(400, window.innerHeight - top - TAB_GUTTER) + 'px'
}

const {
  selectedVersion,
  approveFeature,
  addCandidate,
  markSessionAdded,
  selectedTargetVersion,
  loadCycles,
  loadEditor,
  persist
} = useDraftPlans()

const toastMessage = ref('')
const toastType = ref('success')
const showToast = ref(false)

function notify(message, type) {
  toastMessage.value = message
  toastType.value = type || 'success'
  showToast.value = true
}

// Features carry a target version ("3.6 EA1 RHOAI RELEASE"); Plan Approval is keyed by the
// release cycle ("3.6"), with EA1/EA2/GA being placements inside it.
/**
 * The planner speaks in display rows; Plan Approval speaks in candidates. Only the
 * fields the approval table actually renders are carried across.
 */
function candidateFromPlannerRow(feature) {
  const version = String(feature.version || '').trim()
  const components = String(feature.components || '')
  return {
    key: feature.key,
    summary: feature.summary || '',
    basePlacement: feature.placement && feature.placement !== 'No' ? feature.placement : '',
    priority: feature.priority || '',
    component: components.split(';')[0].trim(),
    engComponents: components,
    currentTV: version,
    targetVersions: version ? [version] : [],
    productFamily: /RHAII/i.test(version) ? 'RHAII' : 'RHOAI',
    status: feature.status || '',
    featureSize: feature.size || '',
    bigRock: feature.outcome || '',
    ready: ''
  }
}

function cycleForTargetVersion(targetVersion) {
  const match = String(targetVersion || '').match(/\d+\.\d+/)
  return match ? match[0] : ''
}

async function addFeaturesToPlan(features) {
  try {
    await loadCycles('RHOAI')
  } catch {
    notify('Plan Approval is unavailable right now, so nothing was added.', 'error')
    return
  }

  // A cycle no longer has to exist up front: a feature carries its own release, and
  // injecting it is what brings that cycle into being.
  const byCycle = new Map()
  const noCycle = []

  for (const feature of features) {
    const cycle = cycleForTargetVersion(feature.version) || selectedVersion.value
    if (!cycle) {
      noCycle.push(feature)
      continue
    }
    if (!byCycle.has(cycle)) byCycle.set(cycle, [])
    byCycle.get(cycle).push(feature)
  }

  const added = []
  const notCandidates = []
  const notOwned = []
  let saveFailed = false
  let lastPopulatedCycle = ''

  for (const [cycle, cycleFeatures] of byCycle) {
    try {
      await loadEditor(cycle)
    } catch {
      saveFailed = true
      continue
    }
    const approvedHere = []
    for (const feature of cycleFeatures) {
      // Only the pipeline's own candidates can be approved directly; anything else
      // has to be put into the plan first.
      addCandidate(candidateFromPlannerRow(feature))
      const result = approveFeature(feature.key, true)
      if (result && result.ok) approvedHere.push(feature.key)
      // A missing candidate and a refused edit both return ok:false; only the
      // latter carries a reason, and they need different wording to be actionable.
      else if (result && result.reason === 'forbidden') notOwned.push(feature.key)
      else notCandidates.push(feature.key)
    }
    if (!approvedHere.length) continue
    try {
      await persist()
      added.push(...approvedHere)
      lastPopulatedCycle = cycle
    } catch {
      saveFailed = true
    }
  }

  if (added.length) {
    markSessionAdded(added)
    // Leave Plan Approval pointing at the cycle we just populated, narrowed to the
    // feature's own target version when the batch shares one.
    if (lastPopulatedCycle && selectedVersion.value !== lastPopulatedCycle) {
      await loadEditor(lastPopulatedCycle)
    }
    const addedVersions = [...new Set(
      features.filter(f => added.indexOf(f.key) !== -1).map(f => String(f.version || '').trim())
    )].filter(Boolean)
    selectedTargetVersion.value = addedVersions.length === 1 ? addedVersions[0] : ''
  }

  const problems = []
  if (noCycle.length) {
    problems.push(`${noCycle.length} have no target version, so there is no cycle to put them in`)
  }
  if (notCandidates.length) problems.push(`${notCandidates.length} not in this cycle's candidates`)
  if (notOwned.length) {
    problems.push(
      `${notOwned.length} you cannot approve — only the feature's PM or Delivery Owner can, or a plan admin (${notOwned.slice(0, 3).join(', ')})`
    )
  }
  if (saveFailed) problems.push('saving failed')

  if (added.length && !problems.length) {
    notify(`${added.length} feature${added.length === 1 ? '' : 's'} added to Plan Approval (${lastPopulatedCycle}).`)
  } else if (added.length) {
    notify(`${added.length} added to Plan Approval; ${problems.join('; ')}.`, 'error')
  } else {
    notify(`Nothing was added to Plan Approval — ${problems.join('; ') || 'no features selected'}.`, 'error')
  }
}

const handleIframeMessage = async (event) => {
  if (event.origin !== window.location.origin) return

  if (event.data.type === 'add-to-draft-plan') {
    const features = event.data.features || []
    if (!features.length) return
    await addFeaturesToPlan(features)
  }
}

// Send data to iframe via postMessage
const sendDataToIframe = async () => {
  if (!iframeRef.value) return
  try {
    const snapshot = await apiRequest('/modules/releases/planning/ai-planner')
    iframeRef.value.contentWindow.postMessage({
      type: 'ai-planner-data',
      features: snapshot.features || [],
      bugQueue: snapshot.bugQueue || [],
      capacity: snapshot.capacity || {},
      cveReserve: snapshot.cveReserve || {},
      lastSyncedAt: snapshot.lastSyncedAt || new Date().toISOString()
    }, window.location.origin)
  } catch (e) {
    console.error('Failed to load AI Planner data:', e)
  }
}

onMounted(() => {
  // Listen for messages from the iframe
  window.addEventListener('message', handleIframeMessage)
  resolvePlannerUrl()
  syncContainerHeight()
  window.addEventListener('resize', syncContainerHeight)
  // Banners above the tab can be dismissed at runtime, which shifts the container upwards.
  // Resize on the next frame so the write lands outside the observer's delivery cycle,
  // which is what otherwise surfaces as a ResizeObserver loop error.
  layoutObserver = new ResizeObserver(() => requestAnimationFrame(syncContainerHeight))
  layoutObserver.observe(document.body)
  // Also watch the container itself, so returning to the tab re-measures once it
  // is laid out again.
  if (containerRef.value) layoutObserver.observe(containerRef.value)
})

onUnmounted(() => {
  // Clean up message listener
  window.removeEventListener('message', handleIframeMessage)
  window.removeEventListener('resize', syncContainerHeight)
  if (layoutObserver) layoutObserver.disconnect()
})
</script>

<template>
  <div ref="containerRef" class="w-full flex flex-col bg-gray-50 dark:bg-gray-900" :style="{ height: containerHeight }">
    <iframe
      v-if="plannerUrl"
      ref="iframeRef"
      :src="plannerUrl"
      class="flex-1 w-full border-none"
      title="AI-First Release Planner"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      @load="sendDataToIframe"
    />
    <Toast
      v-if="showToast"
      :message="toastMessage"
      :type="toastType"
      @close="showToast = false"
    />
  </div>
</template>
