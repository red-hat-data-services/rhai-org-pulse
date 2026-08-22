import { ref, computed, watch } from 'vue'
import { fetchPipeline } from '../services/api.js'
import { groupActionItems, pickHeroItem } from '../utils/action-groups.js'

const loading = ref(false)
const error = ref(null)
const data = ref(null)

export function usePipeline(pmDisplayName, release) {
  const items = computed(() => data.value?.items || [])
  const stats = computed(() => data.value?.stats || {
    needAction: 0,
    inProgress: 0,
    ready: 0,
    complete: 0,
    total: 0
  })

  const actionItems = computed(() =>
    items.value.filter(i => i.pmActionable)
  )

  const heroItem = computed(() => pickHeroItem(actionItems.value))

  const actionGroups = computed(() => groupActionItems(actionItems.value))

  const waitingItems = computed(() =>
    items.value.filter(i => !i.pmActionable && i.stage.phase < 4)
  )

  async function load() {
    const name = typeof pmDisplayName === 'function' || pmDisplayName?.value !== undefined
      ? pmDisplayName.value?.trim()
      : String(pmDisplayName || '').trim()
    const rel = typeof release === 'function' || release?.value !== undefined
      ? release.value
      : release

    if (!name) {
      error.value = 'Set your Jira display name, or use View as to load another PM.'
      data.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      data.value = await fetchPipeline(name, rel)
    } catch (e) {
      error.value = e.message
      data.value = null
    } finally {
      loading.value = false
    }
  }

  if (pmDisplayName && release) {
    watch([pmDisplayName, release], () => {
      if (pmDisplayName.value?.trim()) load()
    })
  }

  return {
    loading,
    error,
    data,
    items,
    stats,
    actionItems,
    heroItem,
    actionGroups,
    waitingItems,
    load
  }
}
