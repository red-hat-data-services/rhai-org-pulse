import { ref, shallowRef, computed, watch } from 'vue'
import {
  parseGraphJson,
  extractPackageList,
  extractGraphSubset,
  toVueFlowElements,
  filterBuildDeps,
  extractDirectDependencies,
} from '../utils/graphUtils.js'

export function useDependencyGraph(dependencyGraphJson) {
  let fullGraphData = null
  const packageList = ref([])
  const selectedPackage = ref(null)
  const showBuildDeps = ref(true)
  const nodes = shallowRef([])
  const edges = shallowRef([])
  const incomingDeps = ref([])
  const outgoingDeps = ref([])
  const error = ref(null)

  const stats = computed(() => ({
    shownNodes: nodes.value.length,
    totalPackages: packageList.value.length,
    shownEdges: edges.value.length,
  }))

  const isReady = computed(() => packageList.value.length > 0)

  function init(jsonString) {
    try {
      error.value = null
      fullGraphData = parseGraphJson(jsonString)
      packageList.value = extractPackageList(fullGraphData)
    } catch (err) {
      error.value = err.message || 'Failed to load dependency graph'
      fullGraphData = null
      packageList.value = []
    }
  }

  function selectPackage(key) {
    const graphKey = key === 'root' ? '' : key
    selectedPackage.value = graphKey
  }

  function clearSelection() {
    selectedPackage.value = null
  }

  watch([() => selectedPackage.value, () => showBuildDeps.value], () => {
    if (selectedPackage.value === null || !fullGraphData) {
      nodes.value = []
      edges.value = []
      incomingDeps.value = []
      outgoingDeps.value = []
      return
    }

    try {
      const subsetData = extractGraphSubset(fullGraphData, selectedPackage.value)
      if (!subsetData) {
        error.value = 'Invalid package selection'
        return
      }

      let { nodes: n, edges: e } = toVueFlowElements(subsetData, selectedPackage.value)

      if (!showBuildDeps.value) {
        const filtered = filterBuildDeps(n, e, selectedPackage.value)
        n = filtered.nodes
        e = filtered.edges
      }

      nodes.value = n
      edges.value = e

      const deps = extractDirectDependencies(
        fullGraphData,
        selectedPackage.value,
        showBuildDeps.value
      )
      incomingDeps.value = deps.incoming
      outgoingDeps.value = deps.outgoing
    } catch (err) {
      error.value = err.message || 'Failed to render graph subset'
    }
  })

  if (dependencyGraphJson) {
    init(dependencyGraphJson)
  }

  return {
    packageList,
    selectedPackage,
    showBuildDeps,
    nodes,
    edges,
    incomingDeps,
    outgoingDeps,
    stats,
    isReady,
    error,
    selectPackage,
    clearSelection,
  }
}
