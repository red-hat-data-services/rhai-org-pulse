import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAllocationRefresh } from '../../../client/composables/useAllocationRefresh'

vi.mock('../../../client/services/allocation-api', () => ({
  refreshAllocation: vi.fn(),
  getRefreshStatus: vi.fn()
}))

const { refreshAllocation, getRefreshStatus } = await import('../../../client/services/allocation-api')

describe('useAllocationRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles a "skipped" response without polling or calling onComplete', async () => {
    getRefreshStatus.mockResolvedValue({ completedAt: 'T0', running: false })
    refreshAllocation.mockResolvedValue({ status: 'skipped', message: 'Refresh disabled in demo mode' })
    const onComplete = vi.fn()

    const { triggerRefresh, phase, message, refreshing } = useAllocationRefresh()
    await triggerRefresh({ teamId: 't1', onComplete })

    expect(phase.value).toBe('unavailable')
    expect(message.value).toContain('demo mode')
    expect(onComplete).not.toHaveBeenCalled()
    expect(refreshing.value).toBe(false)
  })

  it('reloads immediately on "cooldown"', async () => {
    getRefreshStatus.mockResolvedValue({ completedAt: 'T0', running: false })
    refreshAllocation.mockResolvedValue({ status: 'cooldown', retryAfter: 30 })
    const onComplete = vi.fn()

    const { triggerRefresh, phase } = useAllocationRefresh()
    await triggerRefresh({ teamId: 't1', onComplete })

    expect(phase.value).toBe('done')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('polls until the run completes, then calls onComplete', async () => {
    let call = 0
    getRefreshStatus.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve({ running: false, completedAt: 'T0' }) // before trigger
      if (call === 2) return Promise.resolve({ running: true, completedAt: 'T0' })  // still running
      return Promise.resolve({ running: false, completedAt: 'T1', lastResult: { status: 'success' } })
    })
    refreshAllocation.mockResolvedValue({ status: 'started', scope: 'team' })
    const onComplete = vi.fn()

    const { triggerRefresh, phase } = useAllocationRefresh({ pollIntervalMs: 1, maxPolls: 5 })
    await triggerRefresh({ teamId: 't1', onComplete })

    expect(refreshAllocation).toHaveBeenCalledWith('t1', false)
    expect(phase.value).toBe('done')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('sets an error phase when the trigger throws', async () => {
    getRefreshStatus.mockResolvedValue({ completedAt: 'T0', running: false })
    refreshAllocation.mockRejectedValue(new Error('boom'))

    const { triggerRefresh, phase, refreshing } = useAllocationRefresh()
    const res = await triggerRefresh({ teamId: 't1' })

    expect(res.status).toBe('error')
    expect(phase.value).toBe('error')
    expect(refreshing.value).toBe(false)
  })

  it('ignores re-entrant triggers while already refreshing', async () => {
    getRefreshStatus.mockResolvedValue({ running: false, completedAt: 'T0' })
    // Never-resolving trigger keeps refreshing=true
    refreshAllocation.mockReturnValue(new Promise(() => {}))

    const { triggerRefresh } = useAllocationRefresh()
    triggerRefresh({ teamId: 't1' })
    // allow the first trigger to flip refreshing on
    await Promise.resolve()
    await Promise.resolve()
    const second = await triggerRefresh({ teamId: 't1' })

    expect(second).toEqual({ status: 'busy' })
    expect(refreshAllocation).toHaveBeenCalledTimes(1)
  })
})
