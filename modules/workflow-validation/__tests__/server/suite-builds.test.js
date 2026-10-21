import { describe, expect, it } from 'vitest'
const { attachBuildTimestamps, suiteBuildId, compareRuns } = require('../../server/suite-builds')

const row = (i) => ({ suite: 'release-gate', invocationId: `run-${i}`, timestamp: '2026-10-19T12:00:00Z' })
const document = (run, start = '2026-10-19T10:30:00.000Z') => ({
  schema_version: '1.0', suite_build_id: suiteBuildId(run.suite, run.invocationId),
  telemetry_suite: run.suite, invocation_id: run.invocationId, ci_platform: 'gitlab',
  ci_job_id: '123', ci_job_name: 'release-gate', ci_job_url: 'https://gitlab.example/team/project/-/jobs/123',
  ci_job_started_at: start, metadata_source: 'runtime'
})

describe('original CI metadata join', () => {
  it('joins before the top-20 limit and uses deterministic missing/tie order', async () => {
    const rows = Array.from({ length: 27 }, (_, i) => row(i))
    const client = { mget: async (_, ids) => ({ docs: ids.map(id => {
      const source = rows.find(run => suiteBuildId(run.suite, run.invocationId) === id)
      return { _id: id, found: source.invocationId !== 'run-0',
        _source: document(source, source.invocationId === 'run-26' ? '2026-10-19T11:00:00.000Z' : undefined) }
    }).reverse() }) }
    const joined = (await attachBuildTimestamps(client, rows)).sort(compareRuns('buildTimestamp'))
    expect(joined.slice(0, 20)[0].invocationId).toBe('run-26')
    expect(joined.at(-1).invocationId).toBe('run-0')
    expect(joined[1].invocationId).toBe('run-1')
  })

  it('rejects mismatched, malformed, unsafe, and implausibly late metadata', async () => {
    for (const patch of [
      { invocation_id: 'other' }, { suite_build_id: 'wrong' }, { ci_job_started_at: '2026-02-31T10:30:00.000Z' },
      { ci_job_started_at: '2026-10-19T14:00:00.000Z' }, { ci_job_url: 'https://user:secret@example/-/jobs/123' },
      { ci_job_url: 'https://gitlab.example/team/project/-/jobs/456' }, { ci_platform: 'unknown' }
    ]) {
      const run = row(1)
      const client = { mget: async (_, ids) => ({ docs: [{ _id: ids[0], found: true, _source: { ...document(run), ...patch } }] }) }
      expect((await attachBuildTimestamps(client, [run]))[0].buildTimestamp).toBeNull()
    }
  })

  it('surfaces a backend error rather than calling every run unavailable', async () => {
    await expect(attachBuildTimestamps({ mget: async () => { throw new Error('403') } }, [row(1)])).rejects.toThrow('403')
    await expect(attachBuildTimestamps({ mget: async () => ({ docs: [] }) }, [row(1)])).rejects.toThrow('Incomplete')
  })

  it('returns only the verified original Jenkins or GitLab build fields', async () => {
    const rows = [row(1), row(2), row(3)]
    const sources = [
      { ...document(rows[0]), ci_platform: 'jenkins', ci_job_name: 'folder/release-gate',
        ci_job_url: 'https://jenkins.example/job/folder/job/release-gate/123', ci_build_number: '123' },
      { ...document(rows[1]), ci_pipeline_id: '789', unrelated_private_field: 'must not reach the browser' }
    ]
    const joined = await attachBuildTimestamps({ mget: async (_, ids) => ({ docs: ids.map((id, i) => ({
      _id: id, found: i < sources.length, _source: sources[i]
    })) }) }, rows)
    expect(joined[0].ciBuild).toEqual({ platform: 'jenkins', jobId: '123', jobName: 'folder/release-gate',
      jobUrl: 'https://jenkins.example/job/folder/job/release-gate/123', buildNumber: '123', pipelineId: null })
    expect(joined[1].ciBuild).toEqual({ platform: 'gitlab', jobId: '123', jobName: 'release-gate',
      jobUrl: 'https://gitlab.example/team/project/-/jobs/123', buildNumber: null, pipelineId: '789' })
    expect(joined[2].ciBuild).toBeNull()
    expect(JSON.stringify(joined)).not.toContain('private_field')
  })

  it('does not return a link for conflicting or invalid build associations', async () => {
    for (const patch of [{ invocation_id: 'other-run' }, { ci_pipeline_id: 'invalid' },
      { ci_job_url: 'javascript:alert(1)' }, { ci_job_url: 'https://gitlab.example/team/project/-/jobs/123?token=secret' }]) {
      const run = row(1)
      const joined = await attachBuildTimestamps({ mget: async (_, ids) => ({ docs: [
        { _id: ids[0], found: true, _source: { ...document(run), ...patch } }
      ] }) }, [run])
      expect(joined[0].ciBuild).toBeNull()
    }
  })
})
