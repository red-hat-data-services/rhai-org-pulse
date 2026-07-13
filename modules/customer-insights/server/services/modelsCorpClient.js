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

  // APIcast uses API key as basic auth username
  // Node.js fetch doesn't allow credentials in URL, so we use Basic Auth header
  function getAuthHeaders() {
    // Basic auth with API key as username and empty password
    const credentials = Buffer.from(`${apiKey}:`).toString('base64')
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
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
      console.log(`Calling models.corp endpoint: ${baseUrl}/v1beta/openai/chat/completions`)

      const requestBody = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 4096
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      })

      console.log(`Response status: ${response.status}`)

      const responseText = await response.text()
      console.log(`Response preview: ${responseText.substring(0, 200)}`)

      if (!response.ok) {
        console.error(`API error ${response.status}:`, responseText.substring(0, 500))

        if (response.status === 403 && responseText.includes('Authentication')) {
          throw new Error(
            'models.corp API authentication failed. The API key may be invalid or expired. ' +
            'Please contact the platform team to get a valid MODELS_CORP_API_KEY.'
          )
        }

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

      let extracted
      try {
        extracted = JSON.parse(extractedText)
      } catch (parseError) {
        console.error('Failed to parse extraction JSON. Raw text (first 1000 chars):', extractedText.substring(0, 1000))
        console.error('Parse error:', parseError.message)

        // Try to extract just the JSON object if there's extra text
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            extracted = JSON.parse(jsonMatch[0])
          } catch (retryError) {
            throw new Error(`AI returned invalid JSON: ${parseError.message}`, { cause: retryError })
          }
        } else {
          throw new Error(`AI returned invalid JSON: ${parseError.message}`, { cause: parseError })
        }
      }

      return {
        ...extracted,
        component: extracted.component || '',
      }
    } catch (error) {
      console.error('Error extracting from transcript:', error)

      // Better error messages for common issues
      if (error.cause && error.cause.code === 'ENOTFOUND') {
        throw new Error(
          'Cannot reach models.corp API. This requires VPN access to Red Hat internal network. ' +
          'Please connect to VPN and try again, or extract data manually.',
          { cause: error }
        )
      }

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
        max_tokens: 16384
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      })

      console.log(`Response status: ${response.status}`)

      const responseText = await response.text()
      console.log(`Response preview: ${responseText.substring(0, 200)}`)

      if (!response.ok) {
        console.error(`API error ${response.status}:`, responseText.substring(0, 500))

        if (response.status === 403 && responseText.includes('Authentication')) {
          throw new Error(
            'models.corp API authentication failed. The API key may be invalid or expired. ' +
            'Please contact the platform team to get a valid MODELS_CORP_API_KEY.'
          )
        }

        throw new Error(`models.corp API returned ${response.status}: ${responseText.substring(0, 200)}`)
      }

      const data = JSON.parse(responseText)
      console.log('Successfully received insights from models.corp')

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500))
        throw new Error('Unexpected response format from models.corp')
      }

      // Check if response was truncated
      const finishReason = data.choices[0].finish_reason
      if (finishReason === 'length') {
        console.warn('Response was truncated due to token limit. Consider reducing prompt size or expected output.')
        throw new Error('Response truncated - output too large. Try filtering by component or reducing data size.')
      }

      let insightsText = data.choices[0].message.content.trim()

      // Remove markdown code blocks if present
      if (insightsText.startsWith('```json')) {
        insightsText = insightsText.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (insightsText.startsWith('```')) {
        insightsText = insightsText.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      try {
        const insights = JSON.parse(insightsText)
        return insights
      } catch (parseError) {
        console.error('Failed to parse insights JSON. Raw text (first 1000 chars):', insightsText.substring(0, 1000))
        console.error('Parse error:', parseError.message)

        // Try to extract just the JSON object if there's extra text
        const jsonMatch = insightsText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0])
          } catch {
            console.error('Retry parse also failed')
          }
        }

        throw new Error(`AI returned invalid JSON: ${parseError.message}. Check server logs for details.`, { cause: parseError })
      }
    } catch (error) {
      console.error('Error generating insights:', error)

      // Better error messages for common issues
      if (error.cause && error.cause.code === 'ENOTFOUND') {
        throw new Error(
          'Cannot reach models.corp API. This requires VPN access to Red Hat internal network. ' +
          'Please connect to VPN and try again.',
          { cause: error }
        )
      }

      throw error
    }
  }

  async function generateText(prompt) {
    const modelId = 'gemini-2.5-flash'
    const endpoint = `${baseUrl}/v1beta/openai/chat/completions`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 8192
      })
    })

    if (!response.ok) {
      const text = await response.text()
      if (response.status === 403 && text.includes('Authentication')) {
        throw new Error(
          'models.corp API authentication failed. The API key may be invalid or expired. ' +
          'Please contact the platform team to get a valid MODELS_CORP_API_KEY.'
        )
      }
      throw new Error(`models.corp API returned ${response.status}: ${text.substring(0, 200)}`)
    }

    const data = await response.json()
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Unexpected response format from models.corp')
    }

    return data.choices[0].message.content.trim()
  }

  return {
    extractFromTranscript,
    generateInsights,
    generateText
  }
}

module.exports = { createModelsCorpClient }
