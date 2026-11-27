import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { _testExports: prowExports } = require('../../server/odh-e2e-health/prow-ci-fetch')
const { _testExports: routesExports } = require('../../server/odh-e2e-health/routes')

const { parseJunitXmlForComponents, MAX_TEST_NAME_LENGTH } = prowExports
const { parseRealJunitXml, readTextWithLimit } = routesExports

// JUnit XML is fetched from PR-controlled CI artifacts. These inputs used to
// trigger catastrophic regex backtracking (ReDoS) and block the event loop.
const TIME_BUDGET_MS = 500

function timed(fn) {
  const start = performance.now()
  const result = fn()
  return { result, elapsed: performance.now() - start }
}

function junitWithFailure(testName) {
  return `<?xml version="1.0"?>
<testsuites>
  <testsuite name="E2E-Kserve" tests="2" failures="1" errors="0" time="12">
    <testcase name="${testName}" time="3"><failure message="boom">stack</failure></testcase>
    <testcase name="passing" time="1"></testcase>
  </testsuite>
</testsuites>`
}

describe('odh-e2e-health JUnit XML parsing', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseJunitXmlForComponents (scheduled refresh path)', () => {
    it('maps failed test cases to components for valid XML', () => {
      const components = parseJunitXmlForComponents(junitWithFailure('TestOdhOperator/components/kserve/validate'))
      expect(components).toContain('kserve')
    })

    it('returns no components for malformed XML instead of regex re-parsing it', () => {
      const xml = '<testsuite name="a&b">' + '<testcase name="t">'.repeat(13000)
      const { result, elapsed } = timed(() => parseJunitXmlForComponents(xml))
      expect(result).toEqual([])
      expect(elapsed).toBeLessThan(TIME_BUDGET_MS)
    })

    it('bounds test name length before pattern matching', () => {
      const longName = 'run multi stage test post '.repeat(80)
      expect(longName.length).toBeGreaterThan(MAX_TEST_NAME_LENGTH)
      const { elapsed } = timed(() => parseJunitXmlForComponents(junitWithFailure(longName)))
      expect(elapsed).toBeLessThan(TIME_BUDGET_MS)
    })
  })

  describe('parseRealJunitXml (run details path)', () => {
    const runDetails = { buildId: '123' }

    it('parses suites and failed test cases from valid XML', () => {
      const suites = parseRealJunitXml(junitWithFailure('TestOdhOperator/components/kserve/validate'), runDetails)
      expect(suites).toHaveLength(1)
      expect(suites[0]).toMatchObject({ name: 'E2E-Kserve', total: 2, failed: 1, status: 'failed' })
      expect(suites[0].failedTestCases[0].failure.message).toBe('boom')
    })

    it('returns no suites for malformed XML instead of regex re-parsing it', () => {
      const xml = '<testsuites>&' + '<testsuite name="a" tests="1" failures="1" errors="1" '.repeat(100)
      const { result, elapsed } = timed(() => parseRealJunitXml(xml, runDetails))
      expect(result).toEqual([])
      expect(elapsed).toBeLessThan(TIME_BUDGET_MS)
    })
  })

  describe('readTextWithLimit', () => {
    it('returns the body when it is within the limit', async () => {
      const text = await readTextWithLimit(new Response('<testsuites/>'), 1024, new AbortController())
      expect(text).toBe('<testsuites/>')
    })

    it('rejects bodies larger than the limit', async () => {
      const controller = new AbortController()
      await expect(readTextWithLimit(new Response('x'.repeat(2048)), 1024, controller)).rejects.toThrow('exceeds')
      expect(controller.signal.aborted).toBe(true)
    })

    it('rejects early when content-length exceeds the limit', async () => {
      const controller = new AbortController()
      const response = new Response('x', { headers: { 'content-length': '999999' } })
      await expect(readTextWithLimit(response, 1024, controller)).rejects.toThrow('exceeds')
      expect(controller.signal.aborted).toBe(true)
    })
  })
})
