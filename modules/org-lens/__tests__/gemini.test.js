import { describe, it, expect, vi } from 'vitest';
const { buildSystemPrompt, processChat } = require('../server/gemini');

describe('gemini', () => {
  describe('buildSystemPrompt', () => {
    it('includes dataset info', () => {
      const prompt = buildSystemPrompt({ name: 'Test Site', people: new Array(42), orgRoots: [] });
      expect(prompt).toContain('Test Site');
      expect(prompt).toContain('42');
    });

    it('instructs tool usage', () => {
      const prompt = buildSystemPrompt({ name: 'Site', people: new Array(10), orgRoots: [] });
      expect(prompt).toContain('tool');
    });

    it('includes org root context when roots exist', () => {
      const prompt = buildSystemPrompt({
        name: 'manager_shuels',
        people: new Array(100),
        orgRoots: [{ name: 'Steven Huels', title: 'Senior Director', uid: 'shuels' }],
      });
      expect(prompt).toContain('Steven Huels');
      expect(prompt).toContain('Senior Director');
      expect(prompt).toContain('scoped to the organization under manager UID "shuels"');
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
