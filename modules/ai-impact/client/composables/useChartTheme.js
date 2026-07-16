import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export function useChartTheme() {
  const isDark = ref(false)

  onMounted(() => {
    isDark.value = document.documentElement.classList.contains('dark') ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const observer = new MutationObserver(() => {
      isDark.value = document.documentElement.classList.contains('dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    onBeforeUnmount(() => observer.disconnect())
  })

  const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
  const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

  return { isDark, textColor, gridColor }
}
