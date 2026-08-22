var PILLAR_COLOR_MAP = {
  'agents': { bg: 'rgba(59, 130, 246, 0.75)', border: 'rgb(59, 130, 246)' },
  'data': { bg: 'rgba(168, 85, 247, 0.75)', border: 'rgb(168, 85, 247)' },
  'inference': { bg: 'rgba(251, 146, 60, 0.75)', border: 'rgb(251, 146, 60)' },
  'platform': { bg: 'rgba(244, 114, 182, 0.75)', border: 'rgb(244, 114, 182)' },
  'other components': { bg: 'rgba(100, 116, 139, 0.75)', border: 'rgb(100, 116, 139)' }
}

var FALLBACK_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.75)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(139, 92, 246, 0.75)', border: 'rgb(139, 92, 246)' },
  { bg: 'rgba(14, 165, 233, 0.75)', border: 'rgb(14, 165, 233)' },
  { bg: 'rgba(234, 179, 8, 0.75)', border: 'rgb(234, 179, 8)' },
  { bg: 'rgba(56, 189, 248, 0.75)', border: 'rgb(56, 189, 248)' },
  { bg: 'rgba(236, 72, 153, 0.75)', border: 'rgb(236, 72, 153)' }
]

var dynamicAssignments = {}
var nextFallback = 0

export function getPillarColor(name) {
  var key = String(name || '').toLowerCase()
  if (PILLAR_COLOR_MAP[key]) return PILLAR_COLOR_MAP[key]
  if (dynamicAssignments[key]) return dynamicAssignments[key]
  var color = FALLBACK_COLORS[nextFallback % FALLBACK_COLORS.length]
  nextFallback++
  dynamicAssignments[key] = color
  return color
}
