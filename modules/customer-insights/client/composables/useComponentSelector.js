import { ref, computed } from 'vue'

const COMPONENTS = [
  { id: 'all', label: 'Portfolio (All)', readOnly: true },
  { id: 'navigator', label: 'Project Navigator' },
  { id: 'autox', label: 'AutoX' },
  { id: 'platform', label: 'AI Platform' },
  { id: 'd2ma', label: 'D2MA' },
  { id: 'agentic', label: 'Agentic' },
  { id: 'inferencing', label: 'Inferencing' },
]

// Shared state across all views
const selectedComponent = ref('all')

export function useComponentSelector() {
  const isReadOnly = computed(() => {
    const component = COMPONENTS.find(c => c.id === selectedComponent.value)
    return component?.readOnly || false
  })

  return {
    components: COMPONENTS,
    selectedComponent,
    isReadOnly,
  }
}
