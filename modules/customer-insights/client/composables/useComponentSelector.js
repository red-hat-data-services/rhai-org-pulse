import { ref, computed } from 'vue'

const COMPONENTS = [
  { id: 'all', label: 'Portfolio (All)', readOnly: true },
  // Inference & Model Serving
  { id: 'vLLM', label: 'vLLM' },
  { id: 'llm-d', label: 'llm-d' },
  { id: 'Model Serving', label: 'Model Serving' },
  { id: 'Model Runtimes', label: 'Model Runtimes' },
  { id: 'LlamaStack', label: 'LlamaStack' },
  // RAG & Data
  { id: 'RAG + Vector DB', label: 'RAG + Vector DB' },
  { id: 'AutoRAG', label: 'AutoRAG' },
  { id: 'Data Processing', label: 'Data Processing' },
  { id: 'Feature Store', label: 'Feature Store' },
  // Training
  { id: 'Training', label: 'Training' },
  { id: 'Training Hub', label: 'Training Hub' },
  { id: 'Fine Tuning', label: 'Fine Tuning' },
  { id: 'SDG (Synthetic Data Generation)', label: 'SDG (Synthetic Data Generation)' },
  // Agents
  { id: 'Agentic', label: 'Agentic' },
  { id: 'Agent Development', label: 'Agent Development' },
  { id: 'AgentOps', label: 'AgentOps' },
  // Platform & Tooling
  { id: 'Project Navigator', label: 'Project Navigator' },
  { id: 'Notebooks', label: 'Notebooks' },
  { id: 'AI Hub', label: 'AI Hub' },
  { id: 'AI Pipelines', label: 'AI Pipelines' },
  { id: 'MLflow', label: 'MLflow' },
  // Observability & Safety
  { id: 'Model Observability', label: 'Model Observability' },
  { id: 'Explainability', label: 'Explainability' },
  { id: 'AI Safety', label: 'AI Safety' },
  { id: 'Model Evaluation', label: 'Model Evaluation' },
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
