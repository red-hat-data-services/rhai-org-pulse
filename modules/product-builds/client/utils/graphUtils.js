import dagre from '@dagrejs/dagre'

export function parseGraphJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('Invalid graph JSON: must be a non-empty string')
  }
  const graphData = JSON.parse(jsonString)

  // Pre-build reverse adjacency map (child → parents) for fast ancestor lookups
  const reverseAdj = new Map()
  Object.entries(graphData).forEach(([sourceKey, nodeData]) => {
    if (!nodeData.edges) return
    nodeData.edges.forEach(edge => {
      if (!reverseAdj.has(edge.key)) reverseAdj.set(edge.key, [])
      reverseAdj.get(edge.key).push(sourceKey)
    })
  })
  Object.defineProperty(graphData, '_reverseAdj', { value: reverseAdj, enumerable: false })

  return graphData
}

export function extractPackageList(graphData) {
  if (!graphData || typeof graphData !== 'object') return []

  return Object.keys(graphData)
    .filter(key => key !== '')
    .sort()
    .map(key => {
      const [packageName, version] = key.split('==')
      return {
        key,
        packageName,
        version,
        displayLabel: key,
        preBuilt: graphData[key]?.pre_built || false,
      }
    })
}

export function extractGraphSubset(graphData, selectedPackageKey) {
  if (!graphData || typeof graphData !== 'object') return null
  if (!selectedPackageKey || !graphData[selectedPackageKey]) return null

  const reverseAdj = graphData._reverseAdj || new Map()

  // BFS backwards to find all ancestors
  const ancestors = new Set([selectedPackageKey])
  const ancestorQueue = [selectedPackageKey]
  while (ancestorQueue.length > 0) {
    const key = ancestorQueue.shift()
    const parents = reverseAdj.get(key)
    if (!parents) continue
    for (const parent of parents) {
      if (!ancestors.has(parent)) {
        ancestors.add(parent)
        ancestorQueue.push(parent)
      }
    }
  }

  const descendants = new Set([selectedPackageKey])
  const queue = [selectedPackageKey]

  while (queue.length > 0) {
    const currentKey = queue.shift()
    const nodeData = graphData[currentKey]
    if (!nodeData?.edges) continue

    nodeData.edges.forEach(edge => {
      if (!descendants.has(edge.key)) {
        descendants.add(edge.key)
        queue.push(edge.key)
      }
    })
  }

  const allNodes = new Set([...ancestors, ...descendants])
  const subset = {}

  allNodes.forEach(nodeKey => {
    const nodeData = graphData[nodeKey]
    if (!nodeData) return
    subset[nodeKey] = {
      ...nodeData,
      edges: nodeData.edges ? nodeData.edges.filter(edge => allNodes.has(edge.key)) : [],
    }
  })

  return subset
}

function buildRequirementIndex(graphData) {
  const index = {}
  Object.entries(graphData).forEach(([sourceKey, nodeData]) => {
    if (!nodeData.edges) return
    nodeData.edges.forEach(edge => {
      if (!index[edge.key]) index[edge.key] = []
      index[edge.key].push({
        source: sourceKey === '' ? 'Top level' : sourceKey,
        req: edge.req,
        reqType: edge.req_type,
      })
    })
  })
  return index
}

function getEdgeStyle(reqType) {
  if (reqType === 'install' || reqType === 'toplevel') {
    return { stroke: '#0066cc', strokeWidth: 2 }
  }
  return { stroke: '#6a6e73', strokeWidth: 2, strokeDasharray: '5,5' }
}

function applyDagreLayout(nodes, edges, options = {}) {
  const { rankdir = 'TB', nodesep = 50, ranksep = 80 } = options

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir, nodesep, ranksep, ranker: 'tight-tree' })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach(node => g.setNode(node.id, { width: 150, height: 40 }))
  edges.forEach(edge => g.setEdge(edge.source, edge.target))

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - 75, y: pos.y - 20 } }
  })
}

export function toVueFlowElements(graphData, selectedPackageKey) {
  if (!graphData || typeof graphData !== 'object') {
    throw new Error('Invalid graph data: must be an object')
  }

  const requirementIndex = buildRequirementIndex(graphData)

  const hasInstallEdge = new Set()
  Object.entries(graphData).forEach(([, nodeData]) => {
    if (!nodeData.edges) return
    nodeData.edges.forEach(edge => {
      if (edge.req_type === 'install' || edge.req_type === 'toplevel') {
        hasInstallEdge.add(edge.key)
      }
    })
  })

  const buildOnlyNodes = new Set()
  Object.keys(graphData).forEach(packageKey => {
    if (packageKey === '') return
    const hasIncoming = requirementIndex[packageKey]?.length > 0
    if (hasIncoming && !hasInstallEdge.has(packageKey)) {
      buildOnlyNodes.add(packageKey)
    }
  })

  const nodes = Object.entries(graphData).map(([packageKey, nodeData]) => {
    const isRoot = packageKey === ''
    const nodeId = isRoot ? 'root' : packageKey
    let packageName, version

    if (isRoot) {
      packageName = 'Top level'
      version = null
    } else {
      const parts = packageKey.split('==')
      packageName = parts[0]
      version = parts[1] || null
    }

    return {
      id: nodeId,
      type: 'package',
      data: {
        label: isRoot ? 'Top level' : packageKey,
        packageName,
        version,
        preBuilt: nodeData.pre_built || false,
        isRoot,
        isBuildOnly: buildOnlyNodes.has(packageKey),
        isSelected: nodeId === selectedPackageKey ||
          (nodeId === 'root' && selectedPackageKey === ''),
      },
      position: { x: 0, y: 0 },
    }
  })

  const edges = []
  const nodeIdSet = new Set(nodes.map(n => n.id))
  const edgeSet = new Set()

  Object.entries(graphData).forEach(([sourceKey, nodeData]) => {
    const sourceId = sourceKey === '' ? 'root' : sourceKey
    if (!nodeData.edges) return

    nodeData.edges.forEach(edge => {
      const targetId = edge.key === '' ? 'root' : edge.key
      const edgeId = `${sourceId}->${targetId}`

      if (edgeSet.has(edgeId)) return
      if (!nodeIdSet.has(sourceId) || !nodeIdSet.has(targetId)) return

      edgeSet.add(edgeId)
      edges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: 'default',
        animated: false,
        style: getEdgeStyle(edge.req_type),
        markerEnd: {
          type: 'arrowclosed',
          color: (edge.req_type === 'install' || edge.req_type === 'toplevel') ? '#0066cc' : '#6a6e73',
        },
        data: { reqType: edge.req_type, req: edge.req },
      })
    })
  })

  const layoutedNodes = applyDagreLayout(nodes, edges)
  return { nodes: layoutedNodes, edges }
}

export function filterBuildDeps(nodes, edges, selectedPackageKey) {
  const selectedNodeId = selectedPackageKey === '' ? 'root' : selectedPackageKey

  let filteredEdges = edges.filter(edge => {
    const reqType = edge.data?.reqType
    return reqType === 'install' || reqType === 'toplevel'
  })

  let filteredNodes = nodes.filter(node => !node.data.isBuildOnly)

  const forwardAdj = new Map()
  const reverseAdj = new Map()
  filteredEdges.forEach(edge => {
    if (!forwardAdj.has(edge.source)) forwardAdj.set(edge.source, new Set())
    forwardAdj.get(edge.source).add(edge.target)
    if (!reverseAdj.has(edge.target)) reverseAdj.set(edge.target, new Set())
    reverseAdj.get(edge.target).add(edge.source)
  })

  const reachableForward = new Set([selectedNodeId])
  let queue = [selectedNodeId]
  while (queue.length > 0) {
    const id = queue.shift()
    const neighbors = forwardAdj.get(id)
    if (neighbors) {
      neighbors.forEach(n => {
        if (!reachableForward.has(n)) {
          reachableForward.add(n)
          queue.push(n)
        }
      })
    }
  }

  const reachableBackward = new Set([selectedNodeId])
  queue = [selectedNodeId]
  while (queue.length > 0) {
    const id = queue.shift()
    const preds = reverseAdj.get(id)
    if (preds) {
      preds.forEach(p => {
        if (!reachableBackward.has(p)) {
          reachableBackward.add(p)
          queue.push(p)
        }
      })
    }
  }

  const reachable = new Set([...reachableForward, ...reachableBackward])
  filteredNodes = filteredNodes.filter(node => reachable.has(node.id))
  filteredEdges = filteredEdges.filter(
    edge => reachable.has(edge.source) && reachable.has(edge.target)
  )

  filteredNodes = applyDagreLayout(filteredNodes, filteredEdges)
  return { nodes: filteredNodes, edges: filteredEdges }
}

export function extractDirectDependencies(fullGraphData, selectedPackageKey, showBuildDeps) {
  const selectedNodeData = fullGraphData[selectedPackageKey]

  let outgoing = selectedNodeData?.edges?.map(edge => ({
    key: edge.key,
    req: edge.req,
    reqType: edge.req_type,
  })) || []

  if (!showBuildDeps) {
    outgoing = outgoing.filter(dep =>
      dep.reqType === 'install' || dep.reqType === 'toplevel'
    )
  }

  // Use reverse adjacency map to find incoming deps without scanning full graph
  const incoming = []
  const reverseAdj = fullGraphData._reverseAdj || new Map()
  const parents = reverseAdj.get(selectedPackageKey) || []
  for (const parentKey of parents) {
    const parentData = fullGraphData[parentKey]
    if (!parentData?.edges) continue
    for (const edge of parentData.edges) {
      if (edge.key !== selectedPackageKey) continue
      if (!showBuildDeps && edge.req_type !== 'install' && edge.req_type !== 'toplevel') continue
      incoming.push({ key: parentKey, req: edge.req, reqType: edge.req_type })
    }
  }

  return { incoming, outgoing }
}
