// Display order and styling for accelerator families. Colors echo each
// vendor's brand so a stack is recognizable at a glance in the matrix.
export const ACCELERATORS = {
  cuda:   { label: 'CUDA',   order: 0, rule: 'bg-lime-500',    text: 'text-lime-700 dark:text-lime-400' },
  rocm:   { label: 'ROCm',   order: 1, rule: 'bg-red-500',     text: 'text-red-700 dark:text-red-400' },
  gaudi:  { label: 'Gaudi',  order: 2, rule: 'bg-sky-600',     text: 'text-sky-700 dark:text-sky-400' },
  spyre:  { label: 'Spyre',  order: 3, rule: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-400' },
  tpu:    { label: 'TPU',    order: 4, rule: 'bg-teal-500',    text: 'text-teal-700 dark:text-teal-400' },
  neuron: { label: 'Neuron', order: 5, rule: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400' },
  cpu:    { label: 'CPU',    order: 6, rule: 'bg-slate-400',   text: 'text-slate-600 dark:text-slate-300' },
}

const UNKNOWN_ACCELERATOR = { label: '', order: 99, rule: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-300' }

export const NO_TORCH = 'notorch'

export const WHEEL_KINDS = {
  accelerated: { label: 'Accelerator builds', hint: 'Built against this torch and accelerator stack', bar: 'bg-primary-600 dark:bg-blue-500' },
  native: { label: 'Compiled', hint: 'Compiled per OS, shared across accelerators', bar: 'bg-primary-300 dark:bg-blue-300' },
  pure: { label: 'Pure Python', hint: 'Identical in every channel', bar: 'bg-gray-300 dark:bg-gray-500' },
}

export function acceleratorMeta(accelerator) {
  const meta = ACCELERATORS[accelerator]
  return meta || { ...UNKNOWN_ACCELERATOR, label: accelerator || 'Unknown' }
}

export function stackLabel(channel) {
  return [acceleratorMeta(channel.accelerator).label, channel.accelerator_version].filter(Boolean).join(' ')
}

export function torchLabel(channel) {
  return channel.torch_version ? `Torch ${channel.torch_version}` : 'No torch'
}

export function osLabel(rhelVersion) {
  const match = /^ubi(\d+)$/i.exec(rhelVersion || '')
  return match ? `UBI ${match[1]}` : (rhelVersion || '')
}

// Split the published channel name into its identity segments (accelerator
// stack, torch, OS) for display. Names that do not follow that three-part
// shape come back as a single segment so they render verbatim.
export function channelNameSegments(name) {
  const parts = (name || '').split('-')
  return parts.length === 3 && parts.every(Boolean) ? parts : [name || '']
}

// "rhoai-3.5, rhoai-3.6, rhaiis-3.6" -> "RHOAI 3.5, 3.6 / RHAIIS 3.6"
export function releaseSummary(releases) {
  if (!releases?.length) return 'Not adopted yet'
  const byProduct = new Map()
  for (const release of releases) {
    const idx = release.lastIndexOf('-')
    const product = (idx > 0 ? release.slice(0, idx) : release).toUpperCase()
    const version = idx > 0 ? release.slice(idx + 1) : ''
    if (!byProduct.has(product)) byProduct.set(product, [])
    if (version) byProduct.get(product).push(version)
  }
  return [...byProduct.entries()]
    .map(([product, versions]) => [product, versions.join(', ')].filter(Boolean).join(' '))
    .join(' / ')
}

export function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function stackId(channel) {
  return `${channel.accelerator}|${channel.accelerator_version || ''}`
}

export function torchColumnId(channel) {
  return channel.torch_version || NO_TORCH
}

export function sortChannels(channels) {
  return [...channels].sort((a, b) => {
    if (a.maturity !== b.maturity) return a.maturity === 'stable' ? -1 : 1
    const order = acceleratorMeta(a.accelerator).order - acceleratorMeta(b.accelerator).order
    if (order !== 0) return order
    const accel = compareVersions(b.accelerator_version || 0, a.accelerator_version || 0)
    if (accel !== 0) return accel
    if (!a.torch_version || !b.torch_version) return a.torch_version ? -1 : (b.torch_version ? 1 : 0)
    return compareVersions(b.torch_version, a.torch_version)
  })
}

/**
 * Lay channels out as accelerator stacks (rows) by torch version (columns).
 * Columns run newest torch first with "no torch" last. A cell can hold
 * several channels when the same stack ships for more than one OS.
 */
export function buildChannelMatrix(channels) {
  const rowsById = new Map()
  const torchVersions = new Set()
  let hasNoTorch = false

  for (const channel of channels) {
    const id = stackId(channel)
    if (!rowsById.has(id)) {
      rowsById.set(id, {
        id,
        accelerator: channel.accelerator,
        accelerator_version: channel.accelerator_version || '',
        label: stackLabel(channel),
        cells: {},
      })
    }
    const column = torchColumnId(channel)
    if (column === NO_TORCH) hasNoTorch = true
    else torchVersions.add(column)
    const row = rowsById.get(id)
    if (!row.cells[column]) row.cells[column] = []
    row.cells[column].push(channel)
  }

  const columns = [...torchVersions]
    .sort((a, b) => compareVersions(b, a))
    .map(v => ({ id: v, label: v }))
  if (hasNoTorch) columns.push({ id: NO_TORCH, label: 'No torch' })

  const rows = [...rowsById.values()].sort((a, b) => {
    const order = acceleratorMeta(a.accelerator).order - acceleratorMeta(b.accelerator).order
    if (order !== 0) return order
    return compareVersions(b.accelerator_version || 0, a.accelerator_version || 0)
  })

  return { columns, rows }
}

export function collectFilterOptions(channels) {
  const releases = new Set()
  const osVersions = new Set()
  for (const channel of channels) {
    for (const release of channel.compatible_releases || []) releases.add(release)
    if (channel.rhel_version) osVersions.add(channel.rhel_version)
  }
  return {
    releases: [...releases].sort(),
    osVersions: [...osVersions].sort(),
  }
}

/**
 * Filter channels by free text (matched against name, description and
 * compatible releases), maturity, compatible release and OS.
 * Empty filter values match everything.
 */
export function filterChannels(channels, filters = {}) {
  const query = (filters.query || '').trim().toLowerCase()
  return channels.filter(channel => {
    if (filters.maturity && channel.maturity !== filters.maturity) return false
    if (filters.release && !(channel.compatible_releases || []).includes(filters.release)) return false
    if (filters.os && channel.rhel_version !== filters.os) return false
    if (!query) return true
    const haystack = [
      channel.name,
      channel.description,
      stackLabel(channel),
      torchLabel(channel),
      ...(channel.compatible_releases || []),
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })
}

const WHEEL_KIND_ORDER = Object.keys(WHEEL_KINDS)

// Filter wheels by name and kind, listing accelerator builds first since
// they are what sets one channel apart from another.
export function filterWheels(wheels, { query = '', kind = '' } = {}) {
  const q = query.trim().toLowerCase()
  const rank = w => {
    const idx = WHEEL_KIND_ORDER.indexOf(w.kind)
    return idx === -1 ? WHEEL_KIND_ORDER.length : idx
  }
  return wheels
    .filter(w => (!kind || w.kind === kind) && (!q || w.name.toLowerCase().includes(q)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
