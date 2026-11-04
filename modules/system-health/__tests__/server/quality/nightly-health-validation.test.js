import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { validateNightlyHealthPayload } = require('../../../server/quality/validation')

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../fixtures/system-health/test-execution/nightly_health.json'
)

function validDay(overrides = {}) {
  return {
    date: '2026-11-01',
    latest_run_id: 'run-a',
    runs: [
      {
        run_id: 'run-a',
        components: [
          { id: 'platform', name: 'Platform', state: 'ready', reason_code: 'ok' }
        ]
      }
    ],
    ...overrides
  }
}

describe('validateNightlyHealthPayload', () => {
  it('accepts the checked-in fixture', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    expect(validateNightlyHealthPayload(fixture)).toBeNull()
  })

  it('rejects non-objects', () => {
    expect(validateNightlyHealthPayload(null)).toMatch(/must be an object/)
    expect(validateNightlyHealthPayload([])).toMatch(/must be an object/)
  })

  it('rejects invalid schema_version (exactly 1 supported)', () => {
    expect(validateNightlyHealthPayload({ schema_version: 0, days: [] })).toMatch(/schema_version/)
    expect(validateNightlyHealthPayload({ schema_version: 2, days: [] })).toMatch(/schema_version/)
    expect(validateNightlyHealthPayload({ schema_version: 1.5, days: [] })).toMatch(/schema_version/)
    expect(validateNightlyHealthPayload({ days: [] })).toMatch(/schema_version/)
  })

  it('rejects malformed runs and components', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{ date: '2026-11-01', runs: [null] }]
    })).toMatch(/must be an object/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{ date: '2026-11-01', latest_run_id: 'r1', runs: [{ run_id: 'r1', components: {} }] }]
    })).toMatch(/components must be an array/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'r1',
        runs: [{ run_id: 'r1', components: [null] }]
      }]
    })).toMatch(/components\[0\] must be an object/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'r1',
        runs: [{ run_id: 'r1', components: [{ id: 'x', state: 99 }] }]
      }]
    })).toMatch(/state must be one of/)
  })

  it('requires run_id and latest_run_id referential integrity', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{ date: '2026-11-01', runs: [{ run_id: '', components: [] }] }]
    })).toMatch(/run_id/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [validDay({ latest_run_id: 'missing' })]
    })).toMatch(/latest_run_id must reference/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [validDay({ latest_run_id: undefined })]
    })).toMatch(/latest_run_id when runs is non-empty/)
  })

  it('rejects duplicate run_id within a day', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'run-a',
        runs: [
          { run_id: 'run-a', components: [] },
          { run_id: 'run-a', components: [] }
        ]
      }]
    })).toMatch(/duplicate run_id/)
  })

  it('rejects duplicate day dates', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [
        validDay({ date: '2026-11-01' }),
        validDay({ date: '2026-11-01', latest_run_id: 'run-b', runs: [{ run_id: 'run-b', components: [] }] })
      ]
    })).toMatch(/duplicate stream_key default and date/)
  })

  it('allows duplicate calendar dates when stream_key differs', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'job-a', label: 'a', jenkins_job: 'folder/a' },
        { stream_key: 'job-b', label: 'b', jenkins_job: 'folder/b' }
      ],
      days: [
        validDay({ date: '2026-11-01', stream_key: 'job-a' }),
        validDay({
          date: '2026-11-01',
          stream_key: 'job-b',
          latest_run_id: 'run-b',
          runs: [{ run_id: 'run-b', components: [{ id: 'x', name: 'X', state: 'ready', reason_code: 'ok' }] }]
        })
      ]
    })).toBeNull()
  })

  it('rejects malformed jenkins_jobs entries', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      jenkins_jobs: [{}],
      days: []
    })).toMatch(/stream_key/)
  })

  it('rejects malformed days', () => {
    expect(validateNightlyHealthPayload({ schema_version: 1, days: 'x' })).toMatch(/days must be an array/)
    expect(validateNightlyHealthPayload({ schema_version: 1, days: [{}] })).toMatch(/date string/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{ date: '2026-11-01' }]
    })).toMatch(/runs array/)
  })

  it('rejects duplicate day when stream_key omitted on one row and default on another', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [
        { date: '2026-11-01', latest_run_id: 'a', runs: [{ run_id: 'a', components: [] }] },
        { date: '2026-11-01', stream_key: 'default', latest_run_id: 'b', runs: [{ run_id: 'b', components: [] }] }
      ]
    })).toMatch(/duplicate stream_key default/)
  })

  it('rejects malformed optional gates on runs', () => {
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'run-a',
        runs: [{ run_id: 'run-a', gates: {}, components: [] }]
      }]
    })).toMatch(/gates must be an array/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'run-a',
        runs: [{ run_id: 'run-a', gates: [null], components: [] }]
      }]
    })).toMatch(/gates\[0\] must be an object/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'run-a',
        runs: [{ run_id: 'run-a', gates: [{ id: '' }], components: [] }]
      }]
    })).toMatch(/non-empty id/)
    expect(validateNightlyHealthPayload({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'run-a',
        runs: [{
          run_id: 'run-a',
          gates: [{ id: 'cluster-health', state: 'not_a_state' }],
          components: []
        }]
      }]
    })).toMatch(/state must be one of/)
  })
})

describe('test-execution bulk nightly guard', () => {
  it('does not replace stored snapshot when validation fails', () => {
    const prior = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const invalid = {
      schema_version: 1,
      days: [{ date: '2026-11-01', latest_run_id: 'x', runs: [{ run_id: 'y', components: [] }] }]
    }
    expect(validateNightlyHealthPayload(invalid)).toMatch(/latest_run_id/)

    let stored = prior
    const body = { nightly_health: invalid }
    if (body.nightly_health !== undefined) {
      const err = validateNightlyHealthPayload(body.nightly_health)
      if (!err) stored = body.nightly_health
    }
    expect(stored).toEqual(prior)
  })
})
