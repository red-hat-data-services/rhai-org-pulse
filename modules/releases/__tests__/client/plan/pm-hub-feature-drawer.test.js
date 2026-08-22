import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ComponentReleaseLoadTable from '../../../client/plan/components/ComponentReleaseLoadTable.vue'
import FeatureReadinessDrawer from '../../../client/plan/components/FeatureReadinessDrawer.vue'

function sampleGroups() {
  var feature = {
    key: 'RHAISTRAT-1748',
    summary: 'Model-prompt pairing',
    title: 'Model-prompt pairing',
    status: 'In Progress',
    priority: 'Major',
    releaseType: 'TP',
    isBlocked: false,
    pmDoAligned: false,
    confidence: 'ready',
    isAiFirst: false,
    labels: [],
    components: ['GenAI Studio'],
    fixVersions: [],
    targetVersions: ['3.6 EA2 RHOAI RELEASE'],
    assignee: 'Alice',
    pmOwner: 'Bob',
    fpdor: {
      passedCount: 17,
      applicableCount: 17,
      allApplicablePassed: true,
      items: [
        { name: 'Target Version', pass: true, group: 'mandatory' },
        { name: 'RICE', pass: true, group: 'mandatory' }
      ]
    }
  }
  return [{
    version: '3.6 EA2 RHOAI RELEASE',
    components: [{
      component: 'GenAI Studio',
      requestedFeatures: [feature],
      committedFeatures: [],
      requestedCount: 1,
      committedCount: 0,
      blockedCount: 0,
      notAlignedCount: 1
    }]
  }]
}

describe('PM Hub feature slide tray', function() {
  it('emits select when a feature row is clicked', async function() {
    var wrapper = mount(ComponentReleaseLoadTable, {
      props: { groups: sampleGroups() },
      global: {
        stubs: {
          FPDoRPopover: true
        }
      }
    })

    // Expand component so feature rows render
    var header = wrapper.find('tr.cursor-pointer')
    expect(header.exists()).toBe(true)
    await header.trigger('click')
    await nextTick()

    var featureRows = wrapper.findAll('tr[role="button"]')
    expect(featureRows.length).toBeGreaterThan(0)
    await featureRows[0].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0][0].key).toBe('RHAISTRAT-1748')
  })

  it('opens FeatureReadinessDrawer with FPDoR for a PM Hub-shaped feature', async function() {
    var feature = sampleGroups()[0].components[0].requestedFeatures[0]
    var drawerFeature = Object.assign({}, feature, {
      fixVersion: null,
      deliveryOwner: feature.assignee,
      alignmentCategory: 'tv_only',
      dataSource: 'pm-hub'
    })

    var wrapper = mount(FeatureReadinessDrawer, {
      props: {
        feature: drawerFeature,
        jiraBaseUrl: 'https://issues.redhat.com/browse'
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    expect(wrapper.text()).toContain('RHAISTRAT-1748')
    expect(wrapper.text()).toContain('Model-prompt pairing')
    expect(wrapper.text()).toContain('FPDoR Readiness')
    expect(wrapper.text()).toContain('Target Version')
    expect(wrapper.text()).toContain('RICE')
    expect(wrapper.text()).toContain('TV only')
    expect(wrapper.text()).toContain('TV/FV Align')
    expect(wrapper.find('[aria-label="TV/FV alignment: TV only"]').exists()).toBe(true)
    // No empty AI review chrome for PM Hub rows without review meta
    expect(wrapper.text()).not.toContain('Awaiting Sign-off')
    expect(wrapper.text()).toContain('Jira')
  })

  it('does not emit select when the Jira key link is clicked', async function() {
    var wrapper = mount(ComponentReleaseLoadTable, {
      props: { groups: sampleGroups() },
      global: { stubs: { FPDoRPopover: true } }
    })

    await wrapper.find('tr.cursor-pointer').trigger('click')
    await nextTick()

    var link = wrapper.find('a[href*="RHAISTRAT-1748"]')
    expect(link.exists()).toBe(true)
    await link.trigger('click')
    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('does not emit select when Align popup is opened', async function() {
    var groups = sampleGroups()
    groups[0].components[0].requestedFeatures[0].alignmentCategory = 'tv_only'
    var wrapper = mount(ComponentReleaseLoadTable, {
      props: { groups: groups },
      global: { stubs: { FPDoRPopover: true } }
    })

    await wrapper.find('tr.cursor-pointer').trigger('click')
    await nextTick()

    var align = wrapper.find('[aria-label="TV/FV alignment: TV only"]')
    expect(align.exists()).toBe(true)
    await align.trigger('click')
    await nextTick()

    expect(wrapper.emitted('select')).toBeFalsy()
    expect(wrapper.text()).toContain('Requested for EA2, not committed.')
  })
})
