import { describe, it, expect } from 'vitest';
const { getToolDeclarations, executeToolCall } = require('../server/tool-definitions');

describe('tool-definitions', () => {
  describe('getToolDeclarations', () => {
    it('returns an array of function declarations', () => {
      const tools = getToolDeclarations();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(11);
    });

    it('each tool has name, description, and parameters', () => {
      for (const tool of getToolDeclarations()) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
      }
    });
  });

  describe('executeToolCall', () => {
    const mockIndex = {
      search: (_q, _l) => ({ results: [{ name: 'Test' }], total: 1 }),
      findExperts: (_t, _l) => ({ results: [{ name: 'Expert', relevanceScore: 5 }], total: 1 }),
      getPerson: (_id) => _id === 'test' ? { name: 'Test Person', uid: 'test' } : null,
      getDirectReports: (uid) => uid === 'mgr' ? [{ name: 'Report', uid: 'r1' }] : [],
      findCollaborators: (_id, _l) => ({ results: [], total: 0 }),
      findCategory: (_n) => ({ category_name: 'Test', people: ['a'] }),
      getSiteOverview: () => ({ headcount: 10, topTechnologies: [] }),
      getProject: (_n) => ({ key: 'TEST', name: 'Test Project' }),
      listProjects: (_s, _l) => [{ key: 'A', name: 'A Project' }],
      listProducts: (_l) => [{ name: 'Product A' }],
    };

    it('dispatches search_people', () => {
      const result = executeToolCall(mockIndex, 'search_people', { query: 'test' });
      expect(result.results).toBeDefined();
    });

    it('dispatches find_experts', () => {
      const result = executeToolCall(mockIndex, 'find_experts', { topic: 'k8s' });
      expect(result.results).toBeDefined();
    });

    it('dispatches get_person with manager and reports', () => {
      const mockWithManager = {
        ...mockIndex,
        getPerson: (_id) => ({ name: 'Manager', uid: 'mgr', manager: '' }),
        getDirectReports: (uid) => uid === 'mgr' ? [{ name: 'R1', uid: 'r1' }] : [],
      };
      const result = executeToolCall(mockWithManager, 'get_person', { identifier: 'mgr' });
      expect(result.name).toBe('Manager');
      expect(result.directReports).toBeDefined();
    });

    it('returns error for unknown tool', () => {
      const result = executeToolCall(mockIndex, 'nonexistent_tool', {});
      expect(result.error).toBeDefined();
    });
  });
});
