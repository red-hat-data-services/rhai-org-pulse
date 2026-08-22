import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FeatureReadinessRow from '../../../client/plan/components/FeatureReadinessRow.vue'

function mountRow(feature) {
  return mount(FeatureReadinessRow, {
    props: { feature: feature, index: 1 },
    global: {
      stubs: {
        FPDoRPopover: {
          name: 'FPDoRPopover',
          template: '<span class="fpdor-popover-stub">{{ fpdor && fpdor.passedCount }}/{{ fpdor && fpdor.applicableCount }}</span>',
          props: ['fpdor', 'confidence', 'title']
        },
        RubricScoreBadge: true
      }
    }
  })
}

describe('FeatureReadinessRow fail chips', function() {
  it('renders Confluence-named chips for failed FPDoR items', function() {
    var wrapper = mountRow({
      key: 'RHAISTRAT-1',
      title: 'Example',
      confidence: 'not-ready',
      fpdor: {
        passedCount: 15,
        applicableCount: 17,
        items: [
          { name: 'Target Version', pass: false, group: 'mandatory' },
          { name: 'Release Type', pass: true, group: 'mandatory' },
          { name: 'Child epics', pass: false, group: 'criteria' }
        ]
      }
    })

    expect(wrapper.text()).toContain('Target Version')
    expect(wrapper.text()).toContain('Child epics')
    expect(wrapper.text()).not.toContain('Release Type')
  })

  it('does not render fail chips when all applicable items pass', function() {
    var wrapper = mountRow({
      key: 'RHAISTRAT-2',
      title: 'Ready feature',
      confidence: 'ready',
      fpdor: {
        passedCount: 17,
        applicableCount: 17,
        items: [
          { name: 'Target Version', pass: true, group: 'mandatory' },
          { name: 'Child epics', pass: null, group: 'criteria' }
        ]
      }
    })

    expect(wrapper.text()).not.toContain('Target Version')
    expect(wrapper.text()).not.toContain('Child epics')
    expect(wrapper.findAll('[title^="Failed FPDoR"]').length).toBe(0)
  })

  it('caps visible chips and shows overflow count', function() {
    var wrapper = mountRow({
      key: 'RHAISTRAT-3',
      title: 'Many fails',
      confidence: 'not-ready',
      fpdor: {
        passedCount: 13,
        applicableCount: 17,
        items: [
          { name: 'Target Version', pass: false },
          { name: 'Release Type', pass: false },
          { name: 'Components', pass: false },
          { name: 'Child epics', pass: false }
        ]
      }
    })

    expect(wrapper.text()).toContain('Target Version')
    expect(wrapper.text()).toContain('Release Type')
    expect(wrapper.text()).toContain('Components')
    expect(wrapper.text()).toContain('+1')
    expect(wrapper.find('[title="Child epics"]').exists()).toBe(true)
  })

  it('styles fail chips by severity', function() {
    var wrapper = mountRow({
      key: 'RHAISTRAT-4',
      title: 'Severity chips',
      confidence: 'committed',
      fpdor: {
        passedCount: 15,
        applicableCount: 17,
        items: [
          { name: 'Target Version', pass: false },
          { name: 'UXD', pass: false }
        ]
      }
    })

    var chips = wrapper.findAll('[title^="Failed FPDoR"]')
    expect(chips.length).toBe(2)
    expect(chips[0].attributes('title')).toContain('Critical')
    expect(chips[0].classes().join(' ')).toContain('border-red-200')
    expect(chips[1].attributes('title')).toContain('Soft')
    expect(chips[1].classes().join(' ')).toContain('border-yellow-200')
  })

  it('renders AI First / Legacy path chip', function() {
    var ai = mountRow({
      key: 'RHAISTRAT-5',
      title: 'AI path',
      isAiFirst: true,
      fpdor: { passedCount: 17, applicableCount: 17, items: [] }
    })
    expect(ai.text()).toContain('AI First')

    var legacy = mountRow({
      key: 'RHAISTRAT-6',
      title: 'Legacy path',
      isAiFirst: false,
      labels: ['rp-qg1-pass'],
      fpdor: { passedCount: 17, applicableCount: 17, items: [] }
    })
    expect(legacy.text()).toContain('Legacy')
    expect(legacy.text()).not.toContain('AI First')
  })

  it('renders TV/FV Align chip from alignmentCategory', function() {
    var wrapper = mountRow({
      key: 'RHAISTRAT-7',
      title: 'Aligned feature',
      alignmentCategory: 'aligned_on_time',
      targetVersions: ['3.6 EA2 RHOAI RELEASE'],
      fixVersions: ['3.6 EA2 RHOAI RELEASE'],
      fpdor: { passedCount: 17, applicableCount: 17, items: [] }
    })
    expect(wrapper.text()).toContain('Early or as requested')
    expect(wrapper.find('[aria-label="TV/FV alignment: Early or as requested"]').exists()).toBe(true)
  })

  it('opens Align popup with requested vs committed summary', async function() {
    var wrapper = mountRow({
      key: 'RHAISTRAT-8',
      title: 'Slipped feature',
      alignmentCategory: 'aligned_late',
      targetVersions: ['3.6 EA1 RHOAI RELEASE'],
      fixVersions: ['3.6 EA2 RHOAI RELEASE'],
      fpdor: { passedCount: 17, applicableCount: 17, items: [] }
    })
    await wrapper.find('[aria-label="TV/FV alignment: After requested"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Requested for EA1, committed for EA2.')
  })
})
