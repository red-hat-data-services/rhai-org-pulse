import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CandidateDetail from '../../client/views/CandidateDetail.vue'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@shared/client/services/api'

const nav = {
  navigateTo: vi.fn(),
  goBack: vi.fn(),
  params: { value: { id: 'org/project' } },
}

function mountWith(candidate) {
  apiRequest.mockResolvedValue(candidate)
  return mount(CandidateDetail, { global: { provide: { moduleNav: nav } } })
}

describe('CandidateDetail feed-field rendering', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('does not claim a GPU or Dockerfile stance when the feed says unknown or blank', async () => {
    const wrapper = mountWith({
      title: 'HN item',
      itemType: 'trend',
      source: 'hackernews',
      link: 'https://news.ycombinator.com/item?id=1',
      gpuRequired: null,
      hasDockerfile: null,
      contributors: 0,
      openIssues: 0,
    })
    await flushPromises()

    const paragraphs = wrapper.findAll('p').map(p => p.text())
    expect(paragraphs.filter(t => t === '—')).toHaveLength(2)
    expect(paragraphs).toContain('0')
    // Both contributors and open issues are 0, not missing.
    expect(paragraphs.filter(t => t === '0')).toHaveLength(2)
    expect(wrapper.text()).toContain('Hacker News')
    expect(wrapper.text()).toContain('Hacker News Post')
  })

  it('renders run outcomes as text and only real http(s) values as links', async () => {
    const wrapper = mountWith({
      title: 'Project',
      source: 'github',
      link: 'https://github.com/org/project',
      pocRepo: 'FAILED: Requires PostgreSQL',
      pocImage: 'quay.io/aicatalyst/deepcloak:latest',
      pocReport: 'n/a',
      pocBlog: 'https://example.com/post',
    })
    await flushPromises()

    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('https://github.com/org/project')
    expect(hrefs).toContain('https://example.com/post')
    expect(hrefs.some(h => h.includes('FAILED'))).toBe(false)
    expect(hrefs.some(h => h.includes('quay.io'))).toBe(false)

    expect(wrapper.text()).toContain('POC Repo: FAILED: Requires PostgreSQL')
    expect(wrapper.text()).toContain('POC Image: quay.io/aicatalyst/deepcloak:latest')
    expect(wrapper.text()).not.toContain('POC Report')
  })

  it('styles review history decisions that arrive as verbs', async () => {
    const wrapper = mountWith({
      title: 'Project',
      source: 'github',
      pmReviewHistory: [
        { reviewer: 'reviewer', decision: 'Approve', timestamp: '2026-11-01' },
      ],
    })
    await flushPromises()

    const badge = wrapper.findAll('span').find(s => s.text() === 'Approve')
    expect(badge.classes().join(' ')).toContain('bg-green-100')
  })
})
