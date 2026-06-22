import { describe, it, expect } from 'vitest'
import { ICON_MAP, resolveIcon } from '../utils/icon-map'
import { BookOpen, BarChart3, Rocket } from 'lucide-vue-next'

describe('icon-map', () => {
  it('ICON_MAP contains expected PascalCase keys', () => {
    expect(ICON_MAP.BarChart3).toBe(BarChart3)
    expect(ICON_MAP.BookOpen).toBe(BookOpen)
    expect(ICON_MAP.Rocket).toBe(Rocket)
  })

  it('ICON_MAP contains kebab-case aliases', () => {
    expect(ICON_MAP['bar-chart']).toBe(BarChart3)
    expect(ICON_MAP['rocket']).toBe(Rocket)
  })

  it('resolveIcon returns the matching component', () => {
    expect(resolveIcon('BookOpen')).toBe(BookOpen)
    expect(resolveIcon('Rocket')).toBe(Rocket)
  })

  it('resolveIcon returns BarChart3 as fallback for unknown names', () => {
    expect(resolveIcon('NonExistentIcon')).toBe(BarChart3)
    expect(resolveIcon('')).toBe(BarChart3)
  })
})
