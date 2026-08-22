import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BigRockExpandedRow from '../../../client/plan/components/BigRockExpandedRow.vue'

describe('BigRockExpandedRow', function() {
  var sampleFeatures = [
    {
      key: 'RHOAI-101', level: 'green', flagCount: 0, flagCategories: [],
      summary: 'Enable model serving', deliveryOwner: 'Smith', jiraUrl: 'https://issues.redhat.com/browse/RHOAI-101',
      override: null, dorPassed: true, dodPassed: true, planningStatus: 'ready-for-execution', status: 'In Progress'
    },
    {
      key: 'RHOAI-102', level: 'yellow', flagCount: 1, flagCategories: ['VELOCITY_LAG'],
      summary: 'Add KServe support', deliveryOwner: 'Jones', jiraUrl: 'https://issues.redhat.com/browse/RHOAI-102',
      override: null, dorPassed: true, dodPassed: false, planningStatus: 'in-planning', status: 'In Progress'
    },
    {
      key: 'RHOAI-103', level: 'red', flagCount: 2, flagCategories: ['BLOCKED', 'MILESTONE_MISS'],
      summary: 'Batch inference pipeline with really long summary text that should be truncated when displayed',
      deliveryOwner: 'Chen', jiraUrl: 'https://issues.redhat.com/browse/RHOAI-103',
      override: { riskOverride: 'yellow', reason: 'PM override' }, dorPassed: false, dodPassed: false,
      planningStatus: 'not-ready', status: 'New'
    }
  ]

  function mountExpanded(props) {
    return mount(BigRockExpandedRow, {
      props: Object.assign({ colspan: 6, rockName: 'MaaS' }, props)
    })
  }

  it('renders feature rows with keys, summaries, and owners', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    expect(wrapper.text()).toContain('RHOAI-101')
    expect(wrapper.text()).toContain('RHOAI-102')
    expect(wrapper.text()).toContain('RHOAI-103')
    expect(wrapper.text()).toContain('Enable model serving')
    expect(wrapper.text()).toContain('Smith')
    expect(wrapper.text()).toContain('Jones')
    expect(wrapper.text()).toContain('Chen')
  })

  it('shows empty state when features array is empty', function() {
    var wrapper = mountExpanded({ features: [] })
    expect(wrapper.text()).toContain('No Features targeting this release under this Big Rock\'s Outcomes')
  })

  it('shows Not in index badge for hybrid Jira-only children', function() {
    var wrapper = mountExpanded({
      features: [{
        key: 'RHAISTRAT-900',
        level: 'green',
        flagCount: 0,
        flagCategories: [],
        summary: 'Jira-only child',
        deliveryOwner: '',
        jiraUrl: 'https://issues.redhat.com/browse/RHAISTRAT-900',
        override: null,
        status: 'New',
        inIndex: false
      }]
    })
    expect(wrapper.text()).toContain('Not in index')
    expect(wrapper.text()).toContain('RHAISTRAT-900')
  })

  it('shows loading state when loading is true', function() {
    var wrapper = mountExpanded({ features: [], loading: true })
    expect(wrapper.text()).toContain('Loading feature health...')
  })

  it('renders feature keys as links when jiraUrl is provided', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var links = wrapper.findAll('a')
    var featureLinks = links.filter(function(a) { return a.text() === 'RHOAI-101' })
    expect(featureLinks.length).toBe(1)
    expect(featureLinks[0].attributes('href')).toBe('https://issues.redhat.com/browse/RHOAI-101')
    expect(featureLinks[0].attributes('target')).toBe('_blank')
  })

  it('shows risk-colored dots but not risk flag text (risk column removed)', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    expect(wrapper.text()).not.toContain('VELOCITY_LAG')
    expect(wrapper.text()).not.toContain('BLOCKED, MILESTONE_MISS')
  })

  it('shows override indicator (M) when feature has override', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var overrideIndicators = wrapper.findAll('span').filter(function(s) { return s.text() === 'M' })
    expect(overrideIndicators.length).toBe(1)
  })

  it('renders colored health dots for each feature', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var dots = wrapper.findAll('[role="img"]')
    expect(dots.length).toBe(3)
    expect(dots[0].classes().join(' ')).toContain('bg-green-500')
    expect(dots[1].classes().join(' ')).toContain('bg-yellow-500')
    expect(dots[2].classes().join(' ')).toContain('bg-red-500')
  })

  it('sets correct colspan on the wrapping td', function() {
    var wrapper = mountExpanded({ features: sampleFeatures, colspan: 8 })
    var td = wrapper.find('td')
    expect(td.attributes('colspan')).toBe('8')
  })

  it('has 7 column headers in the inner table', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var headers = wrapper.findAll('th')
    expect(headers.length).toBe(7)
  })
})
