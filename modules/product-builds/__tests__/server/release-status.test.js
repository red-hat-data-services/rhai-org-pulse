import { describe, it, expect } from 'vitest'

const {
  SCAN_JQL,
  ALL_CHILD_TASKS_JQL,
  productGroup,
  groupEpics,
  buildReleaseStatus,
  transformEpic,
} = require('../../server/release-status')._testExports

const epic = (key, product, summary = 'Release epic') => ({
  key,
  fields: {
    summary,
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    labels: ['release-automation'],
    description: {
      type: 'doc',
      content: [{
        type: 'codeBlock',
        attrs: { language: 'yaml' },
        content: [{ type: 'text', text: `product: ${product}\nversion: 3.5` }],
      }],
    },
  },
})

const child = (key, status, labels) => ({
  key,
  fields: {
    summary: `${key} summary`,
    status: { name: status, statusCategory: { key: 'indeterminate' } },
    labels,
    issuetype: { name: 'Task' },
  },
})

describe('release status', () => {
  it('maps supported Jira product values to display groups', () => {
    expect(productGroup('rhaiis')).toBe('rhaiis')
    expect(productGroup('rhelai')).toBe('rhel-ai')
    expect(productGroup('base-images')).toBe('base-images')
  })

  it('keeps the three product groups and their epic children', () => {
    const epics = [
      transformEpic(epic('AIPCC-1', 'rhaiis'), [child('AIPCC-2', 'To Do', ['planned'])]),
      transformEpic(epic('AIPCC-3', 'rhelai'), []),
      transformEpic(epic('AIPCC-4', 'base-images'), []),
    ]

    const groups = groupEpics(epics)
    expect(groups.map(group => group.label)).toEqual(['RHAII', 'RHEL AI', 'Base Images'])
    expect(groups.map(group => group.epics.length)).toEqual([1, 1, 1])
    expect(groups[0].epics[0].children[0]).toMatchObject({
      key: 'AIPCC-2',
      status: { name: 'To Do' },
      labels: ['planned'],
    })
  })

  it('uses the readiness detector queries and Jira issue shape', async () => {
    const jira = {
      fetchAllJqlResults: async (jql) => jql === SCAN_JQL
        ? [epic('AIPCC-1', 'rhaiis'), epic('AIPCC-9', 'other')]
        : [child('AIPCC-2', 'Ready', ['ready'])],
    }

    const result = await buildReleaseStatus(jira)
    expect(result.total).toBe(1)
    expect(result.groups[0].epics[0]).toMatchObject({
      key: 'AIPCC-1',
      status: { name: 'In Progress' },
      labels: ['release-automation'],
      children: [{ key: 'AIPCC-2', labels: ['ready'] }],
    })
    expect(ALL_CHILD_TASKS_JQL('AIPCC-1')).toBe(
      'project = AIPCC AND issuetype = Task AND (parent = AIPCC-1 OR "Epic Link" = AIPCC-1)'
    )
  })
})
