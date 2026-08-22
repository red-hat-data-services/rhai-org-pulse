import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FPDoRPopover from '../../../client/plan/components/FPDoRPopover.vue'

describe('FPDoRPopover severity badge', function() {
  function mountPopover(fpdor, confidence) {
    return mount(FPDoRPopover, {
      props: { fpdor: fpdor, confidence: confidence || '' }
    })
  }

  it('uses green when all applicable items pass, even if committed', function() {
    var wrapper = mountPopover({
      passedCount: 17,
      applicableCount: 17,
      allApplicablePassed: true,
      items: [
        { name: 'Target Version', pass: true, group: 'mandatory' },
        { name: 'UXD', pass: null, group: 'criteria' }
      ]
    }, 'committed')

    var badge = wrapper.find('span.cursor-pointer')
    expect(badge.classes().join(' ')).toContain('bg-green-100')
    expect(badge.classes().join(' ')).not.toContain('bg-yellow-100')
  })

  it('uses red for critical fails regardless of Fix Version / committed', function() {
    var wrapper = mountPopover({
      passedCount: 16,
      applicableCount: 17,
      allApplicablePassed: false,
      items: [
        { name: 'Target Version', pass: false, group: 'mandatory' },
        { name: 'UXD', pass: true, group: 'criteria' }
      ]
    }, 'committed')

    var badge = wrapper.find('span.cursor-pointer')
    expect(badge.classes().join(' ')).toContain('bg-red-100')
  })

  it('uses orange for high severity worst fail', function() {
    var wrapper = mountPopover({
      passedCount: 16,
      applicableCount: 17,
      allApplicablePassed: false,
      items: [
        { name: 'Docs impact', pass: false, group: 'mandatory' },
        { name: 'UXD', pass: false, group: 'criteria' }
      ]
    }, 'not-ready')

    var badge = wrapper.find('span.cursor-pointer')
    expect(badge.classes().join(' ')).toContain('bg-orange-100')
  })
})
