import { describe, it, expect } from 'vitest'
import {
  normalizeDraft,
  effectivePlacement,
  applyMove,
  applyDescope,
  clearDescope,
  freezeEvent,
  unfreezeEvent,
  unfreezePlan,
  finalGaFreeze,
  capacityCheckForMove,
  emptyEditorState,
  fvTemplate,
  viewRow,
  canEditRow,
  isAdmin,
  setApproved,
  summaryCounts,
  formatAuditDetail
} from '../../../client/plan/utils/draft-plan-model.js'

function sampleDraft() {
  return normalizeDraft({
    version: '3.6',
    generatedAt: '2026-07-15T00:00:00Z',
    candidates: [
      {
        key: 'A-1',
        summary: 'One',
        basePlacement: 'EA1',
        component: 'KubeRay',
        assignee: 'Alice',
        productFamily: 'RHOAI',
        cycleBudget: 2
      },
      {
        key: 'A-2',
        summary: 'Two',
        basePlacement: 'Below cut',
        component: 'KubeRay',
        assignee: 'Bob',
        productFamily: 'RHOAI',
        cycleBudget: 2
      },
      {
        key: 'B-1',
        summary: 'Floor eng',
        basePlacement: 'Below cut',
        component: 'New Eng Comp',
        assignee: 'Carol',
        productFamily: 'RHOAI',
        cycleBudget: 1,
        capacitySource: 'cycle_floor'
      }
    ],
    ceilingsByComponent: {
      KubeRay: { EA1: 1, EA2: 0, GA: 1 },
      'New Eng Comp': { EA1: 0, EA2: 0, GA: 0 }
    }
  })
}

describe('draft-plan-model', function() {
  it('normalizes scheduled/belowCut into candidates', function() {
    var draft = normalizeDraft({
      version: '3.6',
      scheduled: [{ key: 'S-1', proposed: 'EA2', primaryComponent: 'X', ready: true }],
      belowCut: [{ key: 'B-1', proposed: 'Below cut', primaryComponent: 'X', ready: false }]
    })
    expect(draft.candidates).toHaveLength(2)
    expect(draft.candidates[0].basePlacement).toBe('EA2')
    expect(draft.candidates[0].component).toBe('X')
    expect(draft.candidates[0].ready).toBe('Plan-ready')
    expect(draft.candidates[1].basePlacement).toBe('Below cut')
  })

  it('uses implicit keep when no edit', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    expect(effectivePlacement(draft.candidates[0], state.edits)).toBe('EA1')
  })

  it('moves and restores base as unset', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    var row = draft.candidates[1]
    var moved = applyMove(state, draft.candidates, draft.ceilingsByComponent, row, 'EA2', {
      skipCapacity: true,
      capacityOverride: true
    })
    expect(moved.ok).toBe(true)
    expect(effectivePlacement(row, state.edits)).toBe('EA2')

    var restored = applyMove(state, draft.candidates, draft.ceilingsByComponent, row, 'Below cut', {})
    expect(restored.ok).toBe(true)
    expect(state.edits[row.key].decision).toBe(null)
    expect(effectivePlacement(row, state.edits)).toBe('Below cut')
  })

  it('warns on over ceiling and allows override', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    // EA1 already has A-1; ceiling 1
    var check = capacityCheckForMove(
      draft.candidates,
      state.edits,
      draft.ceilingsByComponent,
      draft.candidates[1],
      'EA1'
    )
    expect(check.over).toBe(true)
    expect(check.mode).toBe('ceiling')

    var blocked = applyMove(state, draft.candidates, draft.ceilingsByComponent, draft.candidates[1], 'EA1', {})
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toBe('capacity')

    var forced = applyMove(state, draft.candidates, draft.ceilingsByComponent, draft.candidates[1], 'EA1', {
      capacityOverride: true,
      skipCapacity: true
    })
    expect(forced.ok).toBe(true)
  })

  it('uses cycle floor budget for zero-history eng', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    var row = draft.candidates[2]
    var first = applyMove(state, draft.candidates, draft.ceilingsByComponent, row, 'EA1', {})
    expect(first.ok).toBe(true)

    // invent second feature same component via clone move of another - use descope path differently
    // Move A-2 into New Eng Comp isn't possible; instead check capacity after first slot filled
    var fake = {
      key: 'B-2',
      summary: 'Second floor',
      basePlacement: 'Below cut',
      component: 'New Eng Comp',
      assignee: 'Dan',
      productFamily: 'RHOAI'
    }
    draft.candidates.push(fake)
    var second = applyMove(state, draft.candidates, draft.ceilingsByComponent, fake, 'EA2', {})
    expect(second.ok).toBe(false)
    expect(second.check.mode).toBe('cycle_floor')
    expect(second.check.message).toMatch(/cycle budget 1 \(floor\)/)
  })

  it('descopes and freezes EA1 with RHOAI FV template', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    applyDescope(state, draft.candidates[1])
    expect(effectivePlacement(draft.candidates[1], state.edits)).toBe('Descope')

    var fr = freezeEvent(state, draft.candidates, 'EA1')
    expect(fr.ok).toBe(true)
    expect(state.meta.frozenEvents.EA1.featureCount).toBe(1)
    expect(state.edits['A-1'].proposedFixVersion).toBe(fvTemplate('3.6', 'RHOAI', 'EA1'))
    expect(viewRow(draft.candidates[0], state.edits, state.meta).frozen).toBe(true)
  })

  it('final GA freeze auto-descopes below cut', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    // place one on GA
    applyMove(state, draft.candidates, draft.ceilingsByComponent, draft.candidates[0], 'GA', {
      skipCapacity: true,
      capacityOverride: true
    })
    var result = finalGaFreeze(state, draft.candidates)
    expect(result.ok).toBe(true)
    expect(state.meta.finalGaFrozen).toBe(true)
    expect(effectivePlacement(draft.candidates[1], state.edits)).toBe('Descope')
    expect(effectivePlacement(draft.candidates[2], state.edits)).toBe('Descope')
  })

  it('unfreezes event and clears simulated FVs', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    freezeEvent(state, draft.candidates, 'EA1')
    expect(state.edits['A-1'].proposedFixVersion).toBeTruthy()

    var u = unfreezeEvent(state, draft.candidates, 'EA1')
    expect(u.ok).toBe(true)
    expect(state.meta.frozenEvents.EA1).toBeUndefined()
    expect(state.edits['A-1'].proposedFixVersion).toBe(null)
    expect(viewRow(draft.candidates[0], state.edits, state.meta).frozen).toBe(false)
  })

  it('unfreeze plan clears final GA lock but keeps descopes', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    applyMove(state, draft.candidates, draft.ceilingsByComponent, draft.candidates[0], 'GA', {
      skipCapacity: true,
      capacityOverride: true
    })
    finalGaFreeze(state, draft.candidates)
    var u = unfreezePlan(state, draft.candidates)
    expect(u.ok).toBe(true)
    expect(state.meta.finalGaFrozen).toBe(false)
    expect(state.meta.locked).toBe(false)
    expect(effectivePlacement(draft.candidates[1], state.edits)).toBe('Descope')
  })

  it('descope is reversible until Final GA freeze', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)
    var below = draft.candidates[1]
    applyDescope(state, below)
    expect(viewRow(below, state.edits, state.meta).canUndescope).toBe(true)

    var undone = clearDescope(state, below)
    expect(undone.ok).toBe(true)
    expect(effectivePlacement(below, state.edits)).toBe(below.basePlacement)

    applyDescope(state, below)
    applyMove(state, draft.candidates, draft.ceilingsByComponent, draft.candidates[0], 'GA', {
      skipCapacity: true,
      capacityOverride: true
    })
    finalGaFreeze(state, draft.candidates)
    expect(viewRow(below, state.edits, state.meta).canUndescope).toBe(false)
    expect(clearDescope(state, below).ok).toBe(false)

    unfreezePlan(state, draft.candidates)
    expect(viewRow(below, state.edits, state.meta).canUndescope).toBe(true)
    expect(clearDescope(state, below).ok).toBe(true)
    expect(effectivePlacement(below, state.edits)).toBe(below.basePlacement)
  })

  it('binds row edit rights to assignee or PM unless isPlanAdmin', function() {
    var draft = sampleDraft()
    draft.candidates[0].pm = 'Pat Manager'
    var meta = {
      currentUser: 'Alice',
      isPlanAdmin: false,
      frozenEvents: {},
      finalGaFrozen: false
    }
    expect(isAdmin(meta)).toBe(false)
    expect(canEditRow(draft.candidates[0], {}, meta)).toBe(true)
    expect(canEditRow(draft.candidates[1], {}, meta)).toBe(false)

    meta.currentUser = 'alice'
    expect(canEditRow(draft.candidates[0], {}, meta)).toBe(true)

    meta.currentUser = 'Pat Manager'
    expect(canEditRow(draft.candidates[0], {}, meta)).toBe(true)
    expect(canEditRow(draft.candidates[1], {}, meta)).toBe(false)

    meta.isPlanAdmin = true
    meta.currentUser = 'Adam Bellusci'
    expect(isAdmin(meta)).toBe(true)
    expect(canEditRow(draft.candidates[1], {}, meta)).toBe(true)
  })

  it('summaryCounts mirrors the red-pen editor stat bar', function() {
    var draft = sampleDraft()
    var state = emptyEditorState('3.6', draft.generatedAt)

    // A-1 EA1 (base), A-2 Below cut -> move to GA (override), B-1 Below cut -> descope + approve A-1
    applyMove(state, draft.candidates, draft.ceilingsByComponent, draft.candidates[1], 'GA', {
      skipCapacity: true,
      capacityOverride: true
    })
    applyDescope(state, draft.candidates[2])
    setApproved(state, draft.candidates[0], true)

    var rows = draft.candidates.map(function(row) {
      return viewRow(row, state.edits, state.meta)
    })
    var stats = summaryCounts(rows)

    expect(stats.candidates).toBe(3)
    expect(stats.scheduled).toBe(2) // A-1 EA1 + A-2 GA
    expect(stats.ea1).toBe(1)
    expect(stats.ea2).toBe(0)
    expect(stats.ga).toBe(1)
    expect(stats.belowCut).toBe(0)
    expect(stats.descoped).toBe(1)
    expect(stats.approved).toBe(1)
  })

  it('formatAuditDetail prefers detail and falls back to key/from/to/action', function() {
    expect(formatAuditDetail({ detail: 'Freeze EA1 (admin)' })).toBe('Freeze EA1 (admin)')
    expect(formatAuditDetail({
      key: 'A-1',
      from: 'Below cut',
      to: 'EA1',
      action: 'decision'
    })).toBe('A-1 · Below cut → EA1 · decision')
    expect(formatAuditDetail({ action: 'reset' })).toBe('reset')
  })
})
