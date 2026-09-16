import { readonly, ref } from 'vue'

const CHEAT_CODE = 'iddqd'
const costsVisible = ref(false)
let typed = ''
let listening = false
function handleKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const key = String(event.key || '').toLowerCase()
  if (key.length !== 1) return
  typed = (typed + key).slice(-CHEAT_CODE.length)
  if (typed === CHEAT_CODE) {
    costsVisible.value = !costsVisible.value
    typed = ''
  }
}

export function useCostVisibility() {
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKey, { capture: true })
    listening = true
  }
  return readonly(costsVisible)
}

export function resetCostVisibility() {
  costsVisible.value = false
  typed = ''
}
