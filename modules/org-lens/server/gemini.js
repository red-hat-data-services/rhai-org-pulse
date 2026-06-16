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
    'IMPORTANT RULES:',
    '- Always use the provided tools to look up data. Never make up information about people.',
    '- When asked about a person, use get_person. When asked "who knows X", use find_experts.',
    '- For team questions, use get_team. For collaboration, use get_collaborators.',
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
    systemInstruction: systemPrompt,
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
