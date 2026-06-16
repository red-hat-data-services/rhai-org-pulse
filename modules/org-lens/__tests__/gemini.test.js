import { describe, it, expect, vi } from 'vitest';
const { buildSystemPrompt, processChat } = require('../server/gemini');

describe('gemini', () => {
  describe('buildSystemPrompt', () => {
    it('includes dataset info', () => {
      const prompt = buildSystemPrompt('Test Site', 42);
      expect(prompt).toContain('Test Site');
      expect(prompt).toContain('42');
    });

    it('instructs tool usage', () => {
      const prompt = buildSystemPrompt('Site', 10);
      expect(prompt).toContain('tool');
    });
  });

  describe('processChat', () => {
    it('calls Gemini and returns text for simple response', async () => {
      const mockStream = {
        stream: (async function* () {
          yield { text: () => 'Hello!', functionCalls: () => null };
        })(),
        response: Promise.resolve({
          text: () => 'Hello!',
          functionCalls: () => null,
        }),
      };
      const mockChat = {
        sendMessageStream: vi.fn().mockResolvedValue(mockStream),
      };
      const mockModel = {
        startChat: vi.fn().mockReturnValue(mockChat),
      };

      const chunks = [];
      await processChat(mockModel, 'Hi', [], null, {
        onChunk: (text) => chunks.push(text),
        executeToolCall: () => ({}),
        systemPrompt: 'You are helpful.',
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe('Hello!');
    });
  });
});
