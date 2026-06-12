/**
 * Client for models.corp API (Gemini)
 */

/**
 * Create a models.corp client for AI extraction
 * @param {Object} config - Configuration
 * @param {string} config.apiKey - models.corp API key
 * @param {string} config.baseUrl - Base URL (default: https://developer.models.corp.redhat.com)
 */
function createModelsCorpClient(config) {
  const { apiKey, baseUrl = 'https://developer.models.corp.redhat.com' } = config

  if (!apiKey) {
    throw new Error('models.corp API key is required')
  }

  /**
   * Extract customer interaction data from transcript
   * @param {string} transcript - Meeting notes or call transcript
   * @returns {Promise<Object>} Extracted interaction data
   */
  async function extractFromTranscript(transcript) {
    const prompt = `You are a product manager assistant analyzing customer interaction transcripts.

Extract the following information from the transcript below and return it as JSON:

{
  "customerCompany": "Company name (if mentioned)",
  "contactName": "Contact person name (if mentioned)",
  "industryVertical": "Industry vertical (e.g., Banking, Healthcare, Manufacturing, etc.)",
  "geo": "Geography (NA, EMEA, APAC, or LATAM)",
  "customerType": "Customer type (SSA, CAI, or Customer)",
  "environment": "Environment (On-Prem, Cloud, Air-gapped, or Unknown)",
  "mainAIUseCase": "Brief description of their main AI/ML use case",
  "toolsOfChoice": ["Array of tools/frameworks mentioned (e.g., PyTorch, TensorFlow, etc.)"],
  "painPoints": "Summary of pain points and challenges mentioned",
  "featureFeedback": "Summary of feature requests and feedback",
  "futureWishlist": ["Array of future wishlist items mentioned"],
  "status": "Lead, Discovery, Evaluating, Feedback Received, or Closed"
}

Rules:
- If a field is not mentioned, use empty string or empty array
- For geo, infer from country/region if mentioned
- For status, use "Discovery" if uncertain
- Be concise but capture key details
- Return ONLY valid JSON, no markdown or explanation

TRANSCRIPT:
${transcript}

JSON:`

    // Use Gemini Vertex-OpenAI compatible endpoint
    const modelId = 'gemini-2.5-flash'
    const endpoint = `${baseUrl}/v1beta/openai/chat/completions`

    try {
      console.log(`Calling models.corp endpoint: ${endpoint}`)

      const requestBody = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 4096
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      console.log(`Response status: ${response.status}`)

      const responseText = await response.text()
      console.log(`Response preview: ${responseText.substring(0, 200)}`)

      if (!response.ok) {
        console.error(`API error ${response.status}:`, responseText.substring(0, 500))
        throw new Error(`models.corp API returned ${response.status}: ${responseText.substring(0, 200)}`)
      }

      const data = JSON.parse(responseText)
      console.log('Successfully received response from models.corp')

      // Extract the response text (OpenAI format - Vertex-OpenAI compatible)
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500))
        throw new Error('Unexpected response format from models.corp')
      }

      let extractedText = data.choices[0].message.content.trim()

      // Remove markdown code blocks if present
      if (extractedText.startsWith('```json')) {
        extractedText = extractedText.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (extractedText.startsWith('```')) {
        extractedText = extractedText.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      const extracted = JSON.parse(extractedText)

      return {
        ...extracted,
        component: 'platform', // Default, user can change
      }
    } catch (error) {
      console.error('Error extracting from transcript:', error)
      throw error
    }
  }

  /**
   * Generate AI insights from customer interactions data
   * @param {string} prompt - The insights generation prompt with customer data
   * @returns {Promise<Object>} Generated insights
   */
  async function generateInsights(prompt) {
    const modelId = 'gemini-2.5-flash'
    const endpoint = `${baseUrl}/v1beta/openai/chat/completions`

    try {
      console.log(`Calling models.corp for insights generation...`)

      const requestBody = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 8192
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      console.log(`Response status: ${response.status}`)

      const responseText = await response.text()
      console.log(`Response preview: ${responseText.substring(0, 200)}`)

      if (!response.ok) {
        console.error(`API error ${response.status}:`, responseText.substring(0, 500))
        throw new Error(`models.corp API returned ${response.status}: ${responseText.substring(0, 200)}`)
      }

      const data = JSON.parse(responseText)
      console.log('Successfully received insights from models.corp')

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500))
        throw new Error('Unexpected response format from models.corp')
      }

      let insightsText = data.choices[0].message.content.trim()

      // Remove markdown code blocks if present
      if (insightsText.startsWith('```json')) {
        insightsText = insightsText.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (insightsText.startsWith('```')) {
        insightsText = insightsText.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      const insights = JSON.parse(insightsText)
      return insights
    } catch (error) {
      console.error('Error generating insights:', error)
      throw error
    }
  }

  return {
    extractFromTranscript,
    generateInsights
  }
}

module.exports = { createModelsCorpClient }
