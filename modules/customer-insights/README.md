# Customer Insights Module

Track customer interactions and product feedback from field teams using Google Sheets as the data source.

## Setup

1. Navigate to the Customer Insights module
2. The onboarding modal will guide you through:
   - Connecting your Google account (OAuth)
   - Selecting a Google Spreadsheet for data storage

## Google Sheet Structure

Your spreadsheet must have a sheet named **"Interactions"** with the following columns:

### Required Columns

| Column | Description | Example Values |
|--------|-------------|----------------|
| ID | Unique identifier | `int-001`, `CUST-123` |
| Date | Interaction date | `2024-01-15`, `Jan 15, 2024` |
| Customer Company | Company name | `Acme Corp`, `TechStart Inc` |
| Contact Name | Customer contact | `John Smith` |
| Field Contact Name | Internal field contact | `Jane Doe` |
| Component | Product component | See Component Values below |
| Geo | Geographic region | `NA`, `EMEA`, `APAC`, `LATAM` |
| Industry Vertical | Industry sector | `Financial Services`, `Healthcare`, `Retail` |
| Environment | Deployment environment | `On-prem`, `Cloud`, `Hybrid` |
| Customer Type | Customer tier | `Enterprise`, `Mid-market`, `Strategic` |
| Status | Engagement status | `Lead`, `Discovery`, `Evaluating`, `Feedback Received`, `Closed` |
| Main AI Use Case | Primary use case | `Document Processing`, `Chatbot`, `Code Generation` |
| Tools of Choice | Preferred tools (comma-separated) | `PyTorch, Hugging Face, vLLM` |
| Pain Points | Customer challenges | Free text |
| Feature Feedback | Product feedback | Free text |
| Future Wishlist | Requested features (comma-separated) | `Multi-modal support, GPU optimization` |
| PM Comments | Internal PM notes | Free text |

### Component Values

Use these exact values in the **Component** column to enable filtering:

#### Inference & Model Serving
- `vLLM`
- `llm-d`
- `Model Serving`
- `Model Runtimes`
- `LlamaStack`

#### RAG & Data
- `RAG + Vector DB`
- `AutoRAG`
- `Data Processing`
- `Feature Store`

#### Training
- `Training`
- `Training Hub`
- `Fine Tuning`
- `SDG (Synthetic Data Generation)`

#### Agents
- `Agentic`
- `Agent Development`
- `AgentOps`

#### Platform & Tooling
- `Project Navigator`
- `Notebooks`
- `AI Hub`
- `AI Pipelines`
- `MLflow`

#### Observability & Safety
- `Model Observability`
- `Explainability`
- `AI Safety`
- `Model Evaluation`

### Status Values

Use these values for the **Status** column:

- `Lead` - Initial contact
- `Discovery` - Learning phase
- `Evaluating` - Assessment in progress
- `Feedback Received` - Customer provided feedback
- `Closed` - Interaction complete

## Features

### Views

1. **Kanban Board** - Visual pipeline by engagement status
2. **Table View** - Sortable table of all interactions
3. **Analytics** - Charts and metrics
4. **AI Insights** - AI-powered analysis of feedback patterns
5. **Roadmap** - Customer-driven roadmap with ARR impact
6. **Create RFE** - Generate RFEs from customer feedback
7. **Import Data** - Bulk import interactions

### Search & Filtering

- **Search by customer** - Type in the search bar to filter by company name
- **Filter by component** - Use the dropdown to view interactions for specific products
- Both filters work together for precise results

## Data Privacy

- Each user connects their own Google account (OAuth)
- Each user selects their own spreadsheet
- Data is read directly from Google Sheets in real-time
- No data is stored on the server (except OAuth tokens)
- All data access respects Google Sheet permissions

## Troubleshooting

### "No interactions found"
- Verify your spreadsheet has a sheet named "Interactions"
- Check that the first row contains the column headers
- Ensure there's data in rows 2 and beyond

### "Not authenticated with Google"
- Click the onboarding modal to reconnect
- Make sure you authorized both Google Sheets and Drive access

### Component filtering not working
- Verify Component column values match exactly (case-sensitive)
- Use the values listed in "Component Values" section above

## Development

### Adding New Components

1. Update `modules/customer-insights/client/composables/useComponentSelector.js`
2. Add color classes in `KanbanView.vue` and `TableView.vue` badge functions
3. Update this README with the new component name
4. Update the OnboardingModal component values list
