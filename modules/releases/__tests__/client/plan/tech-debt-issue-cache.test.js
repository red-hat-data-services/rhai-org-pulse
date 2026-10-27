import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearTechDebtIssueCache,
  readTechDebtIssueCache,
  TECH_DEBT_CACHE_MAX_ENTRIES,
  TECH_DEBT_CACHE_TTL_MS,
  techDebtIssueCacheKey,
  writeTechDebtIssueCache
} from '../../../client/plan/services/techDebtIssueCache'

describe('Tech Debt issue response cache', function () {
  beforeEach(function () {
    clearTechDebtIssueCache()
  })

  it('uses a stable key regardless of component selection order', function () {
    expect(techDebtIssueCacheKey(['Model Serving', 'AI Gateway'], 'Bug', 'all')).toBe(
      techDebtIssueCacheKey(['AI Gateway', 'Model Serving'], 'Bug', 'all')
    )
  })

  it('reports freshness using the five-minute TTL while retaining stale data', function () {
    const key = techDebtIssueCacheKey(['AI Gateway'])
    writeTechDebtIssueCache(key, { counts: { total: 4 } }, 1000)

    expect(readTechDebtIssueCache(key, 1000 + TECH_DEBT_CACHE_TTL_MS - 1)).toMatchObject({
      data: { counts: { total: 4 } },
      fresh: true
    })
    expect(readTechDebtIssueCache(key, 1000 + TECH_DEBT_CACHE_TTL_MS)).toMatchObject({
      data: { counts: { total: 4 } },
      fresh: false
    })
  })

  it('bounds the cache and evicts the least recently used selection', function () {
    const firstKey = techDebtIssueCacheKey(['Component 0'])
    for (let index = 0; index < TECH_DEBT_CACHE_MAX_ENTRIES; index++) {
      writeTechDebtIssueCache(techDebtIssueCacheKey([`Component ${index}`]), { index }, index)
    }
    readTechDebtIssueCache(firstKey, 100)
    writeTechDebtIssueCache(techDebtIssueCacheKey(['Overflow']), { index: 'overflow' }, 101)

    expect(readTechDebtIssueCache(firstKey, 102)).not.toBeNull()
    expect(readTechDebtIssueCache(techDebtIssueCacheKey(['Component 1']), 102)).toBeNull()
  })
})
