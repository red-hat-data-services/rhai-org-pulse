import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HygieneViolations from '../../client/components/HygieneViolations.vue'

function mountViolations(props = {}) {
  return mount(HygieneViolations, { props })
}

describe('HygieneViolations', () => {
  describe('all clear state', () => {
    it('shows "All checks passing" when violations is empty', () => {
      const wrapper = mountViolations({ violations: [] })
      expect(wrapper.text()).toContain('All checks passing')
    })

    it('shows "All checks passing" when violations is default (empty)', () => {
      const wrapper = mountViolations()
      expect(wrapper.text()).toContain('All checks passing')
    })
  })

  describe('violation rendering', () => {
    const violations = [
      { id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee set' },
      { id: 'stale-status', name: 'Stale Status', category: 'timeliness', message: 'Status unchanged for 30+ days' }
    ]

    it('renders violation names', () => {
      const wrapper = mountViolations({ violations })
      expect(wrapper.text()).toContain('Missing Assignee')
      expect(wrapper.text()).toContain('Stale Status')
    })

    it('renders violation messages', () => {
      const wrapper = mountViolations({ violations })
      expect(wrapper.text()).toContain('No assignee set')
      expect(wrapper.text()).toContain('Status unchanged for 30+ days')
    })

    it('groups violations by category', () => {
      const wrapper = mountViolations({ violations })
      expect(wrapper.text()).toContain('Ownership')
      expect(wrapper.text()).toContain('Timeliness')
    })
  })

  describe('remediation text', () => {
    it('shows remediation text when present', () => {
      const violations = [
        { id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee', remediation: 'Set the Assignee field in Jira' }
      ]
      const wrapper = mountViolations({ violations })
      expect(wrapper.text()).toContain('Set the Assignee field in Jira')
    })

    it('does not render remediation paragraph when remediation is absent', () => {
      const violations = [
        { id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee' }
      ]
      const wrapper = mountViolations({ violations })
      const italicPs = wrapper.findAll('p').filter(p => p.classes().includes('italic'))
      expect(italicPs.length).toBe(0)
    })
  })

  describe('Fix in Jira link', () => {
    const violations = [
      { id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee' }
    ]

    it('renders "Fix in Jira" link when featureKey is provided', () => {
      const wrapper = mountViolations({ violations, featureKey: 'RHAISTRAT-100' })
      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.text()).toContain('Fix in Jira')
      expect(link.attributes('href')).toBe('https://issues.redhat.com/browse/RHAISTRAT-100')
      expect(link.attributes('target')).toBe('_blank')
    })

    it('uses custom jiraBaseUrl when provided', () => {
      const wrapper = mountViolations({
        violations,
        featureKey: 'RHAISTRAT-100',
        jiraBaseUrl: 'https://custom.jira.com/browse'
      })
      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('https://custom.jira.com/browse/RHAISTRAT-100')
    })

    it('does not render "Fix in Jira" link when featureKey is null', () => {
      const wrapper = mountViolations({ violations, featureKey: null })
      const links = wrapper.findAll('a')
      expect(links.length).toBe(0)
    })

    it('does not render "Fix in Jira" link when featureKey is not provided', () => {
      const wrapper = mountViolations({ violations })
      const links = wrapper.findAll('a')
      expect(links.length).toBe(0)
    })

    it('sets accessible aria-label on Fix in Jira link', () => {
      const wrapper = mountViolations({ violations, featureKey: 'RHAISTRAT-100' })
      const link = wrapper.find('a')
      expect(link.attributes('aria-label')).toBe('Fix Missing Assignee in Jira')
    })
  })
})
