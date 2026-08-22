import { ref, computed } from 'vue'

export function usePipelineFilters(items) {
  const stageFilter = ref([])
  const priorityFilter = ref([])
  const typeFilter = ref('')
  const search = ref('')

  const stageOptions = computed(() => {
    const map = new Map()
    for (const item of items.value) {
      if (!map.has(item.stage.id)) {
        map.set(item.stage.id, item.stage.label)
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  const priorityOptions = computed(() => {
    const set = new Set(items.value.map(i => i.priority).filter(Boolean))
    return [...set].sort()
  })

  const filteredItems = computed(() => {
    let list = items.value
    if (stageFilter.value.length) {
      const set = new Set(stageFilter.value)
      list = list.filter(i => set.has(i.stage.id))
    }
    if (priorityFilter.value.length) {
      const set = new Set(priorityFilter.value)
      list = list.filter(i => set.has(i.priority))
    }
    if (typeFilter.value) {
      list = list.filter(i => i.type === typeFilter.value)
    }
    if (search.value.trim()) {
      const q = search.value.trim().toLowerCase()
      list = list.filter(i =>
        i.id.toLowerCase().includes(q) ||
        (i.summary || '').toLowerCase().includes(q)
      )
    }
    return list
  })

  const itemsByPhase = computed(() => {
    const columns = [
      { id: 1, label: 'Phase 1 — RFE', items: [] },
      { id: 2, label: 'Phase 2 — Strategy', items: [] },
      { id: 3, label: 'Phase 3 — Release', items: [] },
      { id: 4, label: 'Phase 4 — Epics', items: [] },
      { id: 5, label: 'Complete', items: [] }
    ]
    for (const item of filteredItems.value) {
      const phase = item.stage.id === 'epics-complete' || item.stage.id === 'complete'
        ? 5
        : Math.min(item.stage.phase, 4)
      const col = columns.find(c => c.id === phase) || columns[1]
      col.items.push(item)
    }
    return columns
  })

  function clearFilters() {
    stageFilter.value = []
    priorityFilter.value = []
    typeFilter.value = ''
    search.value = ''
  }

  return {
    stageFilter,
    priorityFilter,
    typeFilter,
    search,
    stageOptions,
    priorityOptions,
    filteredItems,
    itemsByPhase,
    clearFilters
  }
}
