import { ref, computed } from 'vue'

const PILLARS = [
  {
    name: 'Inference',
    components: [
      { id: 'vLLM', label: 'vLLM' },
      { id: 'llm-d', label: 'llm-d' },
      { id: 'Model Serving', label: 'Model Serving' },
      { id: 'Model Runtimes', label: 'Model Runtimes' },
    ],
  },
  {
    name: 'Data',
    components: [
      { id: 'RAG + Vector DB', label: 'RAG + Vector DB' },
      { id: 'AutoRAG', label: 'AutoRAG' },
      { id: 'Data Processing', label: 'Data Processing' },
      { id: 'Feature Store', label: 'Feature Store' },
      { id: 'SDG (Synthetic Data Generation)', label: 'SDG (Synthetic Data Generation)' },
    ],
  },
  {
    name: 'Agents',
    components: [
      { id: 'LlamaStack', label: 'LlamaStack' },
      { id: 'Agentic', label: 'Agentic' },
      { id: 'Agent Development', label: 'Agent Development' },
      { id: 'AgentOps', label: 'AgentOps' },
    ],
  },
  {
    name: 'Platform',
    components: [
      { id: 'Training', label: 'Training' },
      { id: 'Training Hub', label: 'Training Hub' },
      { id: 'Fine Tuning', label: 'Fine Tuning' },
      { id: 'Project Navigator', label: 'Project Navigator' },
      { id: 'Notebooks', label: 'Notebooks' },
      { id: 'AI Hub', label: 'AI Hub' },
      { id: 'AI Pipelines', label: 'AI Pipelines' },
      { id: 'MLflow', label: 'MLflow' },
      { id: 'Model Observability', label: 'Model Observability' },
      { id: 'Explainability', label: 'Explainability' },
      { id: 'AI Safety', label: 'AI Safety' },
      { id: 'Model Evaluation', label: 'Model Evaluation' },
    ],
  },
]

const ALL_OPTION = { id: 'all', label: 'Portfolio (All)', readOnly: true }
const COMPONENTS = [ALL_OPTION, ...PILLARS.flatMap(p => p.components)]

// Shared state across all views
const selectedComponent = ref('all')

export function useComponentSelector() {
  const isReadOnly = computed(() => {
    const component = COMPONENTS.find(c => c.id === selectedComponent.value)
    return component?.readOnly || false
  })

  return {
    components: COMPONENTS,
    pillars: PILLARS,
    selectedComponent,
    isReadOnly,
  }
}
