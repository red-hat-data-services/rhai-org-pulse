import { computed } from 'vue'

const ROCK_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20' },
  { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-100 dark:border-emerald-500/20' },
  { bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-100 dark:border-violet-500/20' },
  { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-100 dark:border-amber-500/20' },
  { bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-100 dark:border-rose-500/20' },
  { bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-100 dark:border-cyan-500/20' },
  { bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-100 dark:border-orange-500/20' },
  { bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-100 dark:border-teal-500/20' },
  { bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-100 dark:border-indigo-500/20' },
  { bg: 'bg-lime-50 dark:bg-lime-500/10', border: 'border-lime-100 dark:border-lime-500/20' },
  { bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', border: 'border-fuchsia-100 dark:border-fuchsia-500/20' },
  { bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-100 dark:border-sky-500/20' },
  { bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-100 dark:border-pink-500/20' },
  { bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-100 dark:border-yellow-500/20' },
]

const NO_ROCK = { bg: '', border: '' }

export function useRockColors(bigRocks) {
  const colorMap = computed(() => {
    const map = {}
    const rocks = bigRocks.value || []
    for (let i = 0; i < rocks.length; i++) {
      map[rocks[i].name] = ROCK_COLORS[i % ROCK_COLORS.length]
    }
    return map
  })

  function rockRowClass(rockName) {
    if (!rockName) return NO_ROCK
    const firstName = rockName.split(', ')[0]
    return colorMap.value[firstName] || NO_ROCK
  }

  return { colorMap, rockRowClass }
}
