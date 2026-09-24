/**
 * TvFvDeltaPanel — collapsible wrapper that embeds the full TV vs FV Delta
 * report inside PM Hub. Collapsed by default; toggles via v-model:collapsed;
 * passes syncedVersions straight through to the embedded report.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TvFvDeltaPanel from '../../../client/plan/components/TvFvDeltaPanel.vue'

var TvFvDeltaViewStub = {
  name: 'TvFvDeltaView',
  props: ['syncedVersions'],
  template: '<div class="tv-fv-delta-view-stub">stub</div>',
}

describe('TvFvDeltaPanel', function () {
  it('is collapsed by default and does not render the report body', function () {
    var wrapper = mount(TvFvDeltaPanel, {
      global: { stubs: { TvFvDeltaView: TvFvDeltaViewStub } },
    })
    expect(wrapper.text()).toContain('TV vs FV Delta')
    expect(wrapper.findComponent(TvFvDeltaViewStub).exists()).toBe(false)
  })

  it('expands to render the embedded report when the header is clicked', async function () {
    var wrapper = mount(TvFvDeltaPanel, {
      global: { stubs: { TvFvDeltaView: TvFvDeltaViewStub } },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toBeTruthy()
    expect(wrapper.emitted('update:collapsed')[0]).toEqual([false])
  })

  it('renders the report body when collapsed is explicitly false', function () {
    var wrapper = mount(TvFvDeltaPanel, {
      props: { collapsed: false },
      global: { stubs: { TvFvDeltaView: TvFvDeltaViewStub } },
    })
    expect(wrapper.findComponent(TvFvDeltaViewStub).exists()).toBe(true)
  })

  it('passes syncedVersions through to the embedded report unchanged', function () {
    var synced = ['3.6 GA RHOAI RELEASE', '3.6 GA RHAII RELEASE']
    var wrapper = mount(TvFvDeltaPanel, {
      props: { collapsed: false, syncedVersions: synced },
      global: { stubs: { TvFvDeltaView: TvFvDeltaViewStub } },
    })
    var report = wrapper.findComponent(TvFvDeltaViewStub)
    expect(report.props('syncedVersions')).toEqual(synced)
  })

  it('toggles the chevron rotation class based on collapsed state', function () {
    var collapsedWrapper = mount(TvFvDeltaPanel, {
      global: { stubs: { TvFvDeltaView: TvFvDeltaViewStub } },
    })
    expect(collapsedWrapper.find('svg').classes()).toContain('-rotate-90')

    var expandedWrapper = mount(TvFvDeltaPanel, {
      props: { collapsed: false },
      global: { stubs: { TvFvDeltaView: TvFvDeltaViewStub } },
    })
    expect(expandedWrapper.find('svg').classes()).not.toContain('-rotate-90')
  })
})
