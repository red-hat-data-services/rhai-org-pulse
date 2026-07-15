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
  const latestProdDrops = ref({})
  const dropMetrics = ref({})
  const graphArtifacts = ref([])

  const stats = computed(() => {
    const now = Date.now()
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000
    const recentDropsList = []
    const prodDropsList = []
    const daysEntries = []
    let totalArtifacts = 0
    const activeProducts = new Set()

    for (const [productKey, drops] of Object.entries(productDrops.value)) {
      for (const drop of drops) {
        const inWindow = new Date(drop.created_at).getTime() >= tenDaysAgo
        if (inWindow) recentDropsList.push({ productKey, name: drop.name, date: drop.created_at })

        const m = dropMetrics.value[drop.key]
        if (m?.timeline?.reached_production) {
          if (inWindow) {
            prodDropsList.push({ productKey, name: drop.name, days: m.timeline.days_to_production, date: drop.created_at })
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
    for (const [productKey, drop] of Object.entries(latestProdDrops.value)) {
      if (drop) perProduct.push({ productKey, drop })
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
        const vllmEdgeId = `vllm::${vllmVersion}->${art.key}`
        if (!edgeIds.has(vllmEdgeId)) {
          edgeIds.add(vllmEdgeId)
          edges.push({
            id: vllmEdgeId,
            source: vllmNodeId,
            target: art.key,
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
      // Phase 1: fetch all recent drops + latest production drop per product
      const [dropResults, prodResults] = await Promise.all([
        Promise.all(
          PRODUCTS.map(async (key) => {
            const data = await apiRequest(`${BASE}/drops?product_key=${encodeURIComponent(key)}&limit=200`)
            const arr = Array.isArray(data) ? data : []
            return { key, drops: arr }
          })
        ),
        Promise.all(
          PRODUCTS.map(async (key) => {
            const data = await apiRequest(`${BASE}/drops?product_key=${encodeURIComponent(key)}&reached_production=true&limit=1`)
            const arr = Array.isArray(data) ? data : []
            return { key, drop: arr[0] || null }
          })
        ),
      ])

      const dropsMap = {}
      for (const { key, drops } of dropResults) {
        dropsMap[key] = drops
      }
      productDrops.value = dropsMap

      const prodMap = {}
      for (const { key, drop } of prodResults) {
        if (drop) prodMap[key] = drop
      }
      latestProdDrops.value = prodMap

      // Phase 2: fetch metrics for most recent drops + latest production drops per product
      const METRICS_PER_PRODUCT = 5
      const metricsKeys = new Set()
      const metricsDrops = []
      for (const r of dropResults) {
        for (const d of r.drops.slice(0, METRICS_PER_PRODUCT)) {
          if (!metricsKeys.has(d.key)) {
            metricsKeys.add(d.key)
            metricsDrops.push(d)
          }
        }
      }
      for (const { drop } of prodResults) {
        if (drop && !metricsKeys.has(drop.key)) {
          metricsKeys.add(drop.key)
          metricsDrops.push(drop)
        }
      }
      const metricsPromises = metricsDrops.map(async (drop) => {
        try {
          const m = await apiRequest(`${BASE}/drops/${encodeURIComponent(drop.key)}/metrics`)
          return { key: drop.key, metrics: m }
        } catch {
          return { key: drop.key, metrics: null }
        }
      })

      const rhaiisArtifactsPromise = apiRequest(`${BASE}/artifacts?product_key=rhaiis&environment=production&type=containers&limit=30`)
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
      // Group by release version, deduplicate by image name, take the latest release
      const latestReleaseArtifacts = (() => {
        if (rhaiisArtifactsList.length === 0) return []
        const byVersion = {}
        for (const art of rhaiisArtifactsList) {
          const tag = art.key.split(':').pop() || ''
          const version = tag.replace(/-\d{8,}$/, '') || tag
          if (!/^\d+\.\d+/.test(version)) continue
          if (!byVersion[version]) byVersion[version] = []
          byVersion[version].push(art)
        }
        const groups = Object.entries(byVersion)
          .map(([v, arts]) => ({ version: v, artifacts: arts, newest: new Date(arts[0].created_at) }))
          .sort((a, b) => b.newest - a.newest)
        const latest = groups[0]?.artifacts || []
        // Deduplicate by image name (keep newest build of each variant)
        const seen = new Map()
        for (const art of latest) {
          const imageName = art.key.split(':')[0]
          if (!seen.has(imageName)) seen.set(imageName, art)
        }
        return [...seen.values()]
      })()

      const detailResults = await Promise.all(
        latestReleaseArtifacts.map(async (art) => {
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
