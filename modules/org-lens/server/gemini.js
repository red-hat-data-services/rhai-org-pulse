'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getToolDeclarations } = require('./tool-definitions');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 5;

function createGeminiClient(apiKey, modelName) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName || DEFAULT_MODEL,
  });
}

function buildSystemPrompt(siteName, headcount) {
  return [
    'You are a helpful assistant for exploring an organization\'s people data.',
    'You have access to a dataset called "' + siteName + '" with ' + headcount + ' people.',
    'The dataset includes people profiles, skills, projects, org hierarchy, and work categories.',
    '',
    'TOOL SELECTION GUIDE:',
    '- "Who is X?" / "Tell me about X" → get_person (returns profile, manager, direct reports)',
    '- "Who knows X?" / "Find experts in X" → find_experts (ranked by relevance)',
    '- "Find someone named X" / general search → search_people',
    '- "Who is on X\'s team?" / "Who reports to X?" → get_team',
    '- "Who works with X?" → get_collaborators',
    '- "Who\'s in AI team?" / category questions → get_category',
    '- "Who is the top manager?" / "Who has the most reports?" / "How big is the org?" / any aggregate or overview question → get_site_overview (returns top managers, largest teams by report count, headcount, top technologies, products)',
    '- "List all managers" / "Managers sorted by team size" → list_managers',
    '- "What projects exist?" → list_projects',
    '- "What products?" → list_products',
    '- "Tell me about project X" → get_project',
    '- "What categories exist?" → list_categories',
    '',
    'IMPORTANT RULES:',
    '- Always use tools to look up data. NEVER say "I cannot" without trying a tool first.',
    '- For ANY question about org structure, hierarchy, top managers, or team sizes, call get_site_overview or list_managers — they have that data.',
    '- If one tool doesn\'t answer the question, try another. Chain multiple tool calls if needed.',
    '- Present results clearly with names, titles, and relevant details.',
    '- If a lookup returns no results, say so honestly.',
    '- Keep responses concise but informative. Use markdown formatting for readability.',
  ].join('\n');
}

async function processChat(model, message, history, toolDeclarations, options) {
  const { onChunk, executeToolCall, systemPrompt } = options;

  const tools = toolDeclarations ? [{ functionDeclarations: toolDeclarations }] : [{ functionDeclarations: getToolDeclarations() }];

  const chat = model.startChat({
    history: history || [],
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    tools,
  });

  let rounds = 0;

  let streamResult = await chat.sendMessageStream(message);

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    let functionCalls = null;

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        onChunk(text);
      }
      const calls = chunk.functionCalls();
      if (calls) functionCalls = calls;
    }

    if (!functionCalls || functionCalls.length === 0) break;

    const functionResponses = [];
    for (const call of functionCalls) {
      const result = executeToolCall(call.name, call.args || {});
      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: result,
        },
      });
    }

    streamResult = await chat.sendMessageStream(functionResponses);
  }
}

module.exports = { createGeminiClient, buildSystemPrompt, processChat };
