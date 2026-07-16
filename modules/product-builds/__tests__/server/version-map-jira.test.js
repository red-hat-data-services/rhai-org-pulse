import { describe, it, expect } from 'vitest'

const { _testExports } = require('../../server/version-map')
const { parseFeatureSummary, extractVariantBase, extractPackageFromEpic } = _testExports

describe('version-map JIRA helpers', () => {
  describe('parseFeatureSummary', () => {
    it('parses standard variant feature', () => {
      expect(parseFeatureSummary('cuda12.9-ubi9 for 3.5 GA')).toEqual({ variant: 'cuda12.9', release: '3.5 GA' })
    })

    it('parses EA release with hyphen', () => {
      expect(parseFeatureSummary('cuda12.9-ubi9 for 3.5-EA2')).toEqual({ variant: 'cuda12.9', release: '3.5-EA2' })
    })

    it('parses EA release stuck to version', () => {
      expect(parseFeatureSummary('cuda12.9-ubi9 for 3.5EA1')).toEqual({ variant: 'cuda12.9', release: '3.5EA1' })
    })

    it('parses Google TPU variant', () => {
      expect(parseFeatureSummary('Google TPU-ubi9 for 3.5-EA2')).toEqual({ variant: 'google tpu', release: '3.5-EA2' })
    })

    it('parses cpu variant', () => {
      expect(parseFeatureSummary('cpu-ubi9 for 3.5 GA')).toEqual({ variant: 'cpu', release: '3.5 GA' })
    })

    it('parses ROCm variant', () => {
      expect(parseFeatureSummary('rocm7.23-ubi9 for 3.5 GA')).toEqual({ variant: 'rocm7.23', release: '3.5 GA' })
    })

    it('parses with RHAI prefix in release', () => {
      expect(parseFeatureSummary('cpu-ubi9 for RHAI 3.5 EA1')).toEqual({ variant: 'cpu', release: 'RHAI 3.5 EA1' })
    })

    it('returns null for non-variant features', () => {
      expect(parseFeatureSummary('Delivery Squad work for 3.5 GA')).toBeNull()
      expect(parseFeatureSummary('Some random feature')).toBeNull()
    })
  })

  describe('extractVariantBase', () => {
    it('extracts alpha prefix', () => {
      expect(extractVariantBase('cuda12.9')).toBe('cuda')
      expect(extractVariantBase('rocm7.23')).toBe('rocm')
    })

    it('handles pure alpha variants', () => {
      expect(extractVariantBase('cpu')).toBe('cpu')
      expect(extractVariantBase('gaudi')).toBe('gaudi')
      expect(extractVariantBase('spyre')).toBe('spyre')
    })

    it('handles google tpu', () => {
      expect(extractVariantBase('google tpu')).toBe('google')
    })
  })

  describe('extractPackageFromEpic', () => {
    it('extracts from "Update X to Y" pattern', () => {
      expect(extractPackageFromEpic('Update vllm to 0.24.0')).toBe('vllm')
      expect(extractPackageFromEpic('Update torch to 2.11')).toBe('torch')
    })

    it('extracts from "Upgrade X to Y" pattern', () => {
      expect(extractPackageFromEpic('Upgrade LLM-D to 0.8 along with its dependencies')).toBe('llm-d')
    })

    it('extracts from "wheels for X" pattern', () => {
      expect(extractPackageFromEpic('Deliver cpu-ubi9 wheels for vLLM TBD for 3.5 GA')).toBe('vllm')
    })

    it('strips -ubi9 suffix from variant names', () => {
      expect(extractPackageFromEpic('Update cuda12.9-ubi9 base images to 3.5')).toBe('cuda12.9')
    })

    it('returns null for non-package epics', () => {
      expect(extractPackageFromEpic('QE: Validate CUDA 12.9 packages for 3.5 GA')).toBeNull()
      expect(extractPackageFromEpic('SPIKE: ADR & Breakdown of stories')).toBeNull()
    })
  })
})
