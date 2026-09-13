import { describe, it, expect } from 'vitest'
import {
  acceleratorMeta,
  buildChannelMatrix,
  channelNameSegments,
  collectFilterOptions,
  compareVersions,
  filterChannels,
  filterWheels,
  osLabel,
  releaseSummary,
  sortChannels,
  stackLabel,
  torchLabel,
} from '../../client/utils/channels'

function ch(overrides) {
  const c = {
    accelerator: 'cuda',
    accelerator_version: '13.0',
    torch_version: '2.11',
    rhel_version: 'ubi9',
    maturity: 'stable',
    compatible_releases: ['rhoai-3.6'],
    description: '',
    ...overrides,
  }
  const torch = c.torch_version ? `torch${c.torch_version}` : 'notorch'
  c.name = overrides.name || `${c.accelerator}${c.accelerator_version}-${torch}-${c.rhel_version}`
  return c
}

const CHANNELS = [
  ch({ accelerator: 'cpu', accelerator_version: '', torch_version: null }),
  ch({ torch_version: '2.9', maturity: 'rolling', compatible_releases: [] }),
  ch({ torch_version: '2.13', maturity: 'rolling', compatible_releases: ['rhoai-3.7'] }),
  ch({ accelerator_version: '12.9' }),
  ch({ accelerator: 'rocm', accelerator_version: '7.14', torch_version: '2.12', maturity: 'rolling', compatible_releases: ['rhoai-3.7'] }),
  ch({}),
  ch({ rhel_version: 'ubi10', maturity: 'rolling', compatible_releases: [] }),
]

describe('compareVersions', () => {
  it('compares numerically rather than lexically', () => {
    expect(compareVersions('2.10', '2.9')).toBeGreaterThan(0)
    expect(compareVersions('13.0', '12.9')).toBeGreaterThan(0)
    expect(compareVersions('1.24.1', '1.24')).toBeGreaterThan(0)
    expect(compareVersions('2.11', '2.11.0')).toBe(0)
  })
})

describe('labels', () => {
  it('formats stack, torch and OS labels', () => {
    expect(stackLabel(ch({}))).toBe('CUDA 13.0')
    expect(stackLabel(ch({ accelerator: 'spyre', accelerator_version: '' }))).toBe('Spyre')
    expect(torchLabel(ch({}))).toBe('Torch 2.11')
    expect(torchLabel(ch({ torch_version: null }))).toBe('No torch')
    expect(osLabel('ubi9')).toBe('UBI 9')
    expect(osLabel('rhel9')).toBe('rhel9')
  })

  it('falls back gracefully for unknown accelerators', () => {
    expect(acceleratorMeta('fpga').label).toBe('fpga')
    expect(stackLabel(ch({ accelerator: 'fpga', accelerator_version: '2' }))).toBe('fpga 2')
  })

  it('splits a published channel name into identity segments', () => {
    expect(channelNameSegments('cuda13.0-torch2.11-ubi9')).toEqual(['cuda13.0', 'torch2.11', 'ubi9'])
    expect(channelNameSegments('cpu-notorch-ubi9')).toEqual(['cpu', 'notorch', 'ubi9'])
  })

  it('keeps names that do not follow the three-part shape verbatim', () => {
    expect(channelNameSegments('cuda13.0-torch2.11')).toEqual(['cuda13.0-torch2.11'])
    expect(channelNameSegments('rhoai-cuda-torch2.11-ubi9')).toEqual(['rhoai-cuda-torch2.11-ubi9'])
    expect(channelNameSegments('cuda--ubi9')).toEqual(['cuda--ubi9'])
    expect(channelNameSegments(undefined)).toEqual([''])
  })

  it('summarizes compatible releases per product', () => {
    expect(releaseSummary(['rhoai-3.5', 'rhoai-3.6', 'rhaiis-3.6'])).toBe('RHOAI 3.5, 3.6 / RHAIIS 3.6')
    expect(releaseSummary(['rhel-ai-1.5'])).toBe('RHEL-AI 1.5')
    expect(releaseSummary(['nightly'])).toBe('NIGHTLY')
    expect(releaseSummary([])).toBe('Not adopted yet')
    expect(releaseSummary(undefined)).toBe('Not adopted yet')
  })
})

describe('buildChannelMatrix', () => {
  const { columns, rows } = buildChannelMatrix(CHANNELS)

  it('orders torch columns newest first with no torch last', () => {
    expect(columns.map(c => c.id)).toEqual(['2.13', '2.12', '2.11', '2.9', 'notorch'])
  })

  it('orders rows by accelerator family then newest SDK first', () => {
    expect(rows.map(r => r.label)).toEqual(['CUDA 13.0', 'CUDA 12.9', 'ROCm 7.14', 'CPU'])
  })

  it('groups channels for the same stack and torch in one cell', () => {
    const cuda13 = rows.find(r => r.label === 'CUDA 13.0')
    expect(cuda13.cells['2.11'].map(c => c.rhel_version)).toEqual(['ubi9', 'ubi10'])
    expect(cuda13.cells['2.12']).toBeUndefined()
  })
})

describe('sortChannels', () => {
  it('puts stable first, then accelerator order, newest SDK and torch first', () => {
    const names = sortChannels(CHANNELS).map(c => c.name)
    expect(names).toEqual([
      'cuda13.0-torch2.11-ubi9',
      'cuda12.9-torch2.11-ubi9',
      'cpu-notorch-ubi9',
      'cuda13.0-torch2.13-ubi9',
      'cuda13.0-torch2.11-ubi10',
      'cuda13.0-torch2.9-ubi9',
      'rocm7.14-torch2.12-ubi9',
    ])
  })
})

describe('filterChannels', () => {
  it('returns everything without filters', () => {
    expect(filterChannels(CHANNELS)).toHaveLength(CHANNELS.length)
  })

  it('filters by maturity, release and OS together', () => {
    const result = filterChannels(CHANNELS, { maturity: 'rolling', release: 'rhoai-3.7' })
    expect(result.map(c => c.name)).toEqual(['cuda13.0-torch2.13-ubi9', 'rocm7.14-torch2.12-ubi9'])
    expect(filterChannels(CHANNELS, { os: 'ubi10' }).map(c => c.name)).toEqual(['cuda13.0-torch2.11-ubi10'])
  })

  it('matches free text against name, labels and releases', () => {
    expect(filterChannels(CHANNELS, { query: 'ROCm' })).toHaveLength(1)
    expect(filterChannels(CHANNELS, { query: 'torch2.13' })).toHaveLength(1)
    expect(filterChannels(CHANNELS, { query: 'no torch' })).toHaveLength(1)
    expect(filterChannels(CHANNELS, { query: '  rhoai-3.7 ' })).toHaveLength(2)
  })
})

describe('collectFilterOptions', () => {
  it('collects sorted unique releases and OS versions', () => {
    expect(collectFilterOptions(CHANNELS)).toEqual({
      releases: ['rhoai-3.6', 'rhoai-3.7'],
      osVersions: ['ubi10', 'ubi9'],
    })
  })
})

describe('filterWheels', () => {
  const wheels = [
    { name: 'torch', version: '2.11.0', kind: 'accelerated' },
    { name: 'numpy', version: '2.3.2', kind: 'native' },
    { name: 'torchvision', version: '0.26.0', kind: 'accelerated' },
  ]

  it('filters by name and kind', () => {
    expect(filterWheels(wheels, { query: 'TORCH' })).toHaveLength(2)
    expect(filterWheels(wheels, { kind: 'native' })).toEqual([wheels[1]])
    expect(filterWheels(wheels, { query: 'vision', kind: 'accelerated' })).toEqual([wheels[2]])
    expect(filterWheels(wheels)).toHaveLength(3)
  })

  it('lists accelerator builds first, then by name', () => {
    const mixed = [
      { name: 'aaa', version: '1', kind: 'pure' },
      { name: 'numpy', version: '2', kind: 'native' },
      { name: 'vllm', version: '0.26.1', kind: 'accelerated' },
      { name: 'torch', version: '2.11.0', kind: 'accelerated' },
    ]
    expect(filterWheels(mixed).map(w => w.name)).toEqual(['torch', 'vllm', 'numpy', 'aaa'])
  })
})
