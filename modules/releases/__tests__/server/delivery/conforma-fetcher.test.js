import { describe, it, expect, beforeEach, vi } from 'vitest'

const SAMPLE_YAML = `---
apiVersion: appstudio.redhat.com/v1alpha1
kind: EnterpriseContractPolicy
metadata:
  name: registry-ai-containers-prod
  namespace: rhtap-releng-tenant
spec:
  description: 'Rules for shipping RHAIIS images to registry.redhat.io'
  publicKey: 'k8s://openshift-pipelines/public-key'
  sources:
    - name: Release Policies
      ruleData:
        allowed_rpm_signature_keys:
          # https://issues.redhat.com/browse/AIPCC-12203
          - 910ea37ba2d18d0c
          - 9cd0a493d42d0685
        allowed_registry_prefixes:
          - registry.access.redhat.com/
          - registry.redhat.io/
        disallowed_platform_patterns: []
      config:
        include:
          - '@redhat'
        exclude:
          - cve.cve_blockers
          - hermetic_task
          # https://issues.redhat.com/browse/AIPCC-6247
          - rpm_packages.unique_version:ibm-deeptools
      volatileConfig:
        exclude: []
`

describe('conforma fetcher', () => {
  let mod

  beforeEach(() => {
    vi.resetModules()
    mod = require('../../../server/delivery/conforma-fetcher')
  })

  describe('deriveVersion', () => {
    it('maps known AIPCC ECP names to product versions', () => {
      expect(mod.deriveVersion('registry-ai-containers-prod')).toBe('rhaii')
      expect(mod.deriveVersion('registry-rhel-ai-containers-prod')).toBe('rhel-ai')
      expect(mod.deriveVersion('registry-rhel-ai-disk-images-prod')).toBe('rhel-ai-disk-images')
      expect(mod.deriveVersion('registry-rhel-ai-disk-image-containers-prod')).toBe('rhel-ai-container-disk-images')
      expect(mod.deriveVersion('registry-aipcc-base-images-prod')).toBe('base-images')
    })

    it('handles names without prefix/suffix gracefully', () => {
      expect(mod.deriveVersion('some-policy')).toBe('some-policy')
    })
  })

  describe('extractJiraReferences', () => {
    it('extracts Jira URLs from YAML comments', () => {
      const refs = mod.extractJiraReferences(SAMPLE_YAML)
      expect(refs).toContain('https://issues.redhat.com/browse/AIPCC-12203')
      expect(refs).toContain('https://issues.redhat.com/browse/AIPCC-6247')
      expect(refs).toHaveLength(2)
    })

    it('matches redhat.atlassian.net URLs too', () => {
      const text = '# https://redhat.atlassian.net/browse/AIPCC-999\n'
      const refs = mod.extractJiraReferences(text)
      expect(refs).toContain('https://redhat.atlassian.net/browse/AIPCC-999')
    })

    it('deduplicates references', () => {
      const text = '# https://issues.redhat.com/browse/AIPCC-1\n# https://issues.redhat.com/browse/AIPCC-1\n'
      expect(mod.extractJiraReferences(text)).toHaveLength(1)
    })

    it('returns empty array for no references', () => {
      expect(mod.extractJiraReferences('no refs here')).toEqual([])
    })
  })

  describe('transformEcpToRelease', () => {
    it('transforms parsed YAML to release object', () => {
      const yaml = require('js-yaml')
      const doc = yaml.load(SAMPLE_YAML)
      const result = mod.transformEcpToRelease(doc, SAMPLE_YAML)

      expect(result.version).toBe('rhaii')
      expect(result.gaDate).toBeNull()
      expect(result.productLayer).toBe(true)
      expect(result.displayName).toBe('RHAII')
      expect(result.exceptions.policy.configExcludes).toContain('cve.cve_blockers')
      expect(result.exceptions.policy.configExcludes).toContain('hermetic_task')
      expect(result.exceptions.policy.configExcludes).toContain('rpm_packages.unique_version:ibm-deeptools')
      expect(result.exceptions.policy.volatileExcludes).toEqual([])
      expect(result.ruleData.allowedRpmSignatureKeys).toContain('910ea37ba2d18d0c')
      expect(result.ruleData.allowedRegistryPrefixes).toContain('registry.redhat.io/')
      expect(result.jiraReferences).toContain('https://issues.redhat.com/browse/AIPCC-12203')
    })
  })

  describe('fetchAipccConforma', () => {
    const mockStorage = {
      readFromStorage: () => ({ conformaEcpBaseUrl: 'https://example.com/ecp' })
    }

    it('fetches and transforms all YAML files', async () => {
      mod._setFetch(async () => ({
        ok: true,
        text: async () => SAMPLE_YAML
      }))

      const result = await mod.fetchAipccConforma(mockStorage)
      expect(result.releases).toHaveLength(5)
      expect(result.errors).toHaveLength(0)
      expect(result.releases[0].productLayer).toBe(true)
    })

    it('handles fetch errors gracefully', async () => {
      let callCount = 0
      mod._setFetch(async () => {
        callCount++
        if (callCount === 1) return { ok: false, status: 404 }
        return { ok: true, text: async () => SAMPLE_YAML }
      })

      const result = await mod.fetchAipccConforma(mockStorage)
      expect(result.releases).toHaveLength(4)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toBe('HTTP 404')
    })

    it('handles network errors gracefully', async () => {
      mod._setFetch(async () => { throw new Error('Network error') })

      const result = await mod.fetchAipccConforma(mockStorage)
      expect(result.releases).toHaveLength(0)
      expect(result.errors).toHaveLength(5)
    })

    it('returns error when conformaEcpBaseUrl is not configured', async () => {
      const emptyStorage = { readFromStorage: () => null }
      const result = await mod.fetchAipccConforma(emptyStorage)
      expect(result.releases).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toMatch(/not configured/)
    })
  })
})
