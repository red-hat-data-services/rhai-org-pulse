import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useReleasePicker } from '../../../client/composables/useReleasePicker'

describe('useReleasePicker — case-insensitive dedup', function () {
  it('deduplicates fix versions that differ only by case', function () {
    const data = ref(null)
    const registryReleases = ref([
      {
        id: 'rhai-3.5-ea1',
        displayName: 'RHAI 3.5 EA1',
        fixVersions: ['RHAI-3.5-EA1', 'rhai-3.5-ea1'],
        milestones: {}
      }
    ])
    const jiraVersions = ref([])

    const { availableVersions } = useReleasePicker(data, registryReleases, jiraVersions)
    expect(availableVersions.value).toHaveLength(1)
    expect(availableVersions.value[0].name).toBe('RHAI-3.5-EA1')
  })

  it('deduplicates Jira versions against registry fix versions case-insensitively', function () {
    const data = ref(null)
    const registryReleases = ref([
      {
        id: 'rhai-3.6-ea1',
        displayName: 'RHAI 3.6 EA1',
        fixVersions: ['RHAI-3.6-EA1'],
        milestones: {}
      }
    ])
    const jiraVersions = ref([
      { name: 'rhai-3.6-ea1', released: false }
    ])

    const { availableVersions } = useReleasePicker(data, registryReleases, jiraVersions)
    expect(availableVersions.value).toHaveLength(1)
    expect(availableVersions.value[0].source).toBe('registry')
  })

  it('keeps distinct versions that differ beyond case', function () {
    const data = ref(null)
    const registryReleases = ref([
      {
        id: 'rhai-3.5-ea1',
        displayName: 'RHAI 3.5 EA1',
        fixVersions: ['RHAI-3.5-EA1'],
        milestones: {}
      },
      {
        id: 'rhai-3.5-ea2',
        displayName: 'RHAI 3.5 EA2',
        fixVersions: ['RHAI-3.5-EA2'],
        milestones: {}
      }
    ])
    const jiraVersions = ref([])

    const { availableVersions } = useReleasePicker(data, registryReleases, jiraVersions)
    expect(availableVersions.value).toHaveLength(2)
  })
})
