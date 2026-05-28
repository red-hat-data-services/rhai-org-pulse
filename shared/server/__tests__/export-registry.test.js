import { describe, it, expect, vi } from 'vitest'

const { createExportRegistry } = require('../export-registry')

describe('export-registry', () => {
  it('registers and retrieves export handlers', () => {
    const registry = createExportRegistry()
    const fn = vi.fn()
    registry.register('my-mod', fn)
    expect(registry.getAll()).toEqual({ 'my-mod': fn })
  })

  it('skips non-function handlers with warning', () => {
    const registry = createExportRegistry()
    registry.register('bad', 'not-a-function')
    expect(registry.getAll()).toEqual({})
  })

  it('run calls all handlers with addFile, storage, and mapping', async () => {
    const registry = createExportRegistry()
    const handler = vi.fn()
    registry.register('mod-a', handler)

    const addFile = vi.fn()
    const storage = {}
    const mapping = {}
    const errors = await registry.run(addFile, storage, mapping)

    expect(handler).toHaveBeenCalledWith(addFile, storage, mapping)
    expect(errors).toEqual([])
  })

  it('run isolates errors per module', async () => {
    const registry = createExportRegistry()
    registry.register('good', vi.fn())
    registry.register('bad', vi.fn().mockRejectedValue(new Error('export failed')))
    registry.register('also-good', vi.fn())

    const errors = await registry.run(vi.fn(), {}, {})

    expect(errors).toHaveLength(1)
    expect(errors[0]).toEqual({ module: 'bad', error: 'export failed' })
  })
})
