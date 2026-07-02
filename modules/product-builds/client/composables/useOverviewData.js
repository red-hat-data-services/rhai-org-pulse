import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { getAcceleratorInfo } from '../utils/formatting'
import dagre from '@dagrejs/dagre'

const BASE = '/modules/product-builds'
const PRODUCTS = ['rhaiis', 'rhel-ai', 'base-images', 'builder-images']
const PRODUCT_COLORS = {
  'rhaiis': { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', label: 'RHAIIS' },
  'rhel-ai': { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9', label: 'RHEL AI' },
  'base-images': { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e', label: 'Base Images' },
  'builder-images': { bg: '#ffedd5', border: '#f97316', text: '#c2410c', label: 'Builder Images' },
  'vllm': { bg: '#fef3c7', border: '#d97706', text: '#92400e', label: 'vLLM' },
}

function shortenImageKey(key) {
  if (!key) return key
  const match = key.match(/([^/]+:[^:]+)$/)
  return match ? match[1] : key.split('/').pop()
}

function extractVllmVersion(wheels) {
  if (!Array.isArray(wheels) || wheels.length === 0) return null
  for (const w of wheels) {
    const bss = w.build_sequence_summary
    if (!bss) continue
    try {
      const entries = JSON.parse(bss)
      if (!Array.isArray(entries)) continue
      const vllm = entries.find(e => e.name && e.name.toLowerCase() === 'vllm')
      if (vllm) return vllm.version
    } catch { /* skip */ }
  }
  return null
}

export function useOverviewData() {
  const loading = ref(true)
  const error = ref(null)
  const productDrops = ref({})
  const dropMetrics = ref({})
  const graphArtifacts = ref([])

  const stats = computed(() => {
    const now = Date.now()
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000
    const recentDropsList = []
    const prodDropsList = []
    const daysEntries = []
    let totalArtifacts = 0
    const activeProducts = new Set()

    for (const [productKey, drops] of Object.entries(productDrops.value)) {
      for (const drop of drops) {
        const inWindow = new Date(drop.created_at).getTime() >= ninetyDaysAgo
        if (inWindow) recentDropsList.push({ productKey, name: drop.name, date: drop.created_at })

        const m = dropMetrics.value[drop.key]
        if (m?.timeline?.reached_production) {
          if (inWindow) {
            prodDropsList.push({ productKey, name: drop.name, days: m.timeline.days_to_production })
            activeProducts.add(productKey)
          }
          if (m.timeline.days_to_production != null) {
            daysEntries.push({ productKey, name: drop.name, days: m.timeline.days_to_production })
          }
        }
        if (m?.counts?.production_releases) {
          totalArtifacts += m.counts.production_releases
        }
      }
    }

    recentDropsList.sort((a, b) => new Date(b.date) - new Date(a.date))
    prodDropsList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    daysEntries.sort((a, b) => a.days - b.days)

    const totalDays = daysEntries.reduce((s, e) => s + e.days, 0)

    return {
      totalDrops: recentDropsList.length,
      recentDropsDetail: recentDropsList.slice(0, 5),
      reachedProduction: prodDropsList.length,
      prodDropsDetail: prodDropsList.slice(0, 5),
      avgDaysToProduction: daysEntries.length > 0 ? Math.round(totalDays / daysEntries.length) : null,
      daysDetail: daysEntries.slice(0, 5),
      activeProducts: activeProducts.size,
      activeProductsList: [...activeProducts],
      totalArtifactsShipped: totalArtifacts,
    }
  })

  const recentProductionDrops = computed(() => {
    const perProduct = []
    for (const [productKey, drops] of Object.entries(productDrops.value)) {
      if (!drops.length) continue
      perProduct.push({ productKey, drop: drops[0] })
    }
    perProduct.sort((a, b) => new Date(b.drop.created_at) - new Date(a.drop.created_at))
    return perProduct
  })

  const dependencyGraphData = computed(() => {
    const nodes = []
    const edges = []
    const nodeIds = new Set()
    const edgeIds = new Set()
    const baseColors = PRODUCT_COLORS['base-images']
    const rhaiisColors = PRODUCT_COLORS['rhaiis']
    const vllmColors = PRODUCT_COLORS['vllm']

    for (const entry of graphArtifacts.value) {
      const { artifact: art, wheels } = entry
      if (nodeIds.has(art.key)) continue
      nodeIds.add(art.key)

      const accelInfo = getAcceleratorInfo(art)
      const vllmVersion = extractVllmVersion(wheels)

      nodes.push({
        id: art.key,
        type: 'imageNode',
        data: {
          label: shortenImageKey(art.key),
          productKey: 'rhaiis',
          productLabel: rhaiisColors.label,
          variant: art.variant,
          accel: accelInfo.accel,
          runtime: accelInfo.runtime,
          python: accelInfo.python,
          colors: rhaiisColors,
        },
        position: { x: 0, y: 0 },
      })

      // Base image edge
      if (accelInfo.baseImage) {
        const baseKey = accelInfo.baseImage
        const edgeId = `${baseKey}->${art.key}`
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId)
          edges.push({
            id: edgeId,
            source: baseKey,
            target: art.key,
            type: 'default',
            animated: false,
            style: { stroke: '#6b7280', strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed', color: '#6b7280' },
          })

          if (!nodeIds.has(baseKey)) {
            nodeIds.add(baseKey)
            nodes.push({
              id: baseKey,
              type: 'imageNode',
              data: {
                label: shortenImageKey(baseKey),
                productKey: 'base-images',
                productLabel: baseColors.label,
                variant: null,
                colors: baseColors,
              },
              position: { x: 0, y: 0 },
            })
          }
        }
      }

      // vLLM node + edge
      if (vllmVersion) {
        const vllmNodeId = `vllm::${vllmVersion}`
        if (!nodeIds.has(vllmNodeId)) {
          nodeIds.add(vllmNodeId)
          nodes.push({
            id: vllmNodeId,
            type: 'imageNode',
            data: {
              label: `vLLM ${vllmVersion}`,
              productKey: 'vllm',
              productLabel: 'vLLM',
              variant: null,
              colors: vllmColors,
            },
            position: { x: 0, y: 0 },
          })
        }
        const vllmEdgeId = `${art.key}->vllm::${vllmVersion}`
        if (!edgeIds.has(vllmEdgeId)) {
          edgeIds.add(vllmEdgeId)
          edges.push({
            id: vllmEdgeId,
            source: art.key,
            target: vllmNodeId,
            type: 'default',
            animated: false,
            style: { stroke: '#d97706', strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed', color: '#d97706' },
          })
        }
      }
    }

    if (nodes.length === 0) return { nodes: [], edges: [] }

    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120, ranker: 'tight-tree' })
    g.setDefaultEdgeLabel(() => ({}))
    nodes.forEach(node => g.setNode(node.id, { width: 200, height: 80 }))
    edges.forEach(edge => g.setEdge(edge.source, edge.target))
    dagre.layout(g)

    const layoutedNodes = nodes.map(node => {
      const pos = g.node(node.id)
      return { ...node, position: { x: pos.x - 100, y: pos.y - 40 } }
    })

    return { nodes: layoutedNodes, edges }
  })

  async function loadAll() {
    loading.value = true
    error.value = null

    try {
      // Phase 1: fetch latest drops that reached production per product (API sorts newest-first)
      const dropResults = await Promise.all(
        PRODUCTS.map(async (key) => {
          const data = await apiRequest(`${BASE}/drops?product_key=${encodeURIComponent(key)}&reached_production=true&limit=5`)
          const arr = Array.isArray(data) ? data : []
          return { key, drops: arr }
        })
      )

      const dropsMap = {}
      for (const { key, drops } of dropResults) {
        dropsMap[key] = drops
      }
      productDrops.value = dropsMap

      // Phase 2: fetch metrics for latest drops + production RHAIIS artifacts for graph
      const allDrops = dropResults.flatMap(r => r.drops.map(d => ({ productKey: r.key, drop: d })))
      const metricsPromises = allDrops.map(async ({ drop }) => {
        try {
          const m = await apiRequest(`${BASE}/drops/${encodeURIComponent(drop.key)}/metrics`)
          return { key: drop.key, metrics: m }
        } catch {
          return { key: drop.key, metrics: null }
        }
      })

      const rhaiisArtifactsPromise = apiRequest(`${BASE}/artifacts?product_key=rhaiis&environment=production&limit=10`)
        .then(data => Array.isArray(data) ? data : [])
        .catch(() => [])

      const [metricsResults, rhaiisArtifactsList] = await Promise.all([
        Promise.all(metricsPromises),
        rhaiisArtifactsPromise,
      ])

      const metricsMap = {}
      for (const { key, metrics } of metricsResults) {
        if (metrics) metricsMap[key] = metrics
      }
      dropMetrics.value = metricsMap

      // Phase 3: fetch artifact details + wheels for RHAIIS production artifacts (for graph)
      const detailResults = await Promise.all(
        rhaiisArtifactsList.slice(0, 5).map(async (art) => {
          try {
            const [detail, wheels] = await Promise.all([
              apiRequest(`${BASE}/artifacts/${encodeURIComponent(art.key)}`),
              apiRequest(`${BASE}/artifacts/${encodeURIComponent(art.key)}/wheels`)
                .then(data => Array.isArray(data) ? data : [])
                .catch(() => []),
            ])
            return { artifact: detail, wheels }
          } catch {
            return null
          }
        })
      )

      graphArtifacts.value = detailResults.filter(Boolean)
    } catch (err) {
      error.value = err.message || 'Failed to load overview data'
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    stats,
    recentProductionDrops,
    dropMetrics,
    dependencyGraphData,
    productDrops,
    loadAll,
    PRODUCT_COLORS,
  }
}
