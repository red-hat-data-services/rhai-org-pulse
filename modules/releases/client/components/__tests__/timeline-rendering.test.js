import { describe, expect, it } from 'vitest'
import { hoverDaysLabel, clampBadgePosition, buildDimensionRowMap } from '../timeline-rendering.js'

describe('timeline-rendering helpers', function () {
  it('formats hover day labels for every date state', function () {
    expect(hoverDaysLabel(null)).toBe(null)
    expect(hoverDaysLabel(0)).toBe('today')
    expect(hoverDaysLabel(3)).toBe('in 3d')
    expect(hoverDaysLabel(-2)).toBe('2d ago')
  })

  it('keeps hover badges inside the chart area', function () {
    var area = { left: 10, right: 110, top: 20, bottom: 100 }
    expect(clampBadgePosition(30, 40, 20, 10, area)).toEqual({ x: 30, y: 40 })
    expect(clampBadgePosition(0, 10, 20, 10, area)).toEqual({ x: 10, y: 20 })
    expect(clampBadgePosition(105, 40, 20, 10, area)).toEqual({ x: 90, y: 40 })
  })

  it('allocates separate rows for same-cycle product groups', function () {
    var groups = {
      '3.6 GA|a|rhoai': { groupLabel: '3.6 GA', above: true },
      '3.6 GA|a|rhelai': { groupLabel: '3.6 GA', above: true },
      '3.7 GA|a|rhoai': { groupLabel: '3.7 GA', above: true }
    }
    var rows = buildDimensionRowMap(groups, {
      '3.6 GA-a': 0,
      '3.7 GA-a': 1
    }, function (label, above) { return label + (above ? '-a' : '-b') })

    expect(new Set(Object.values(rows)).size).toBe(3)
    expect(rows['3.6 GA|a|rhoai']).not.toBe(rows['3.6 GA|a|rhelai'])
  })
})
