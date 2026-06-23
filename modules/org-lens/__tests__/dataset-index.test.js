import { describe, it, expect, beforeAll } from 'vitest'
import path from 'path'
import fs from 'fs'

const { DatasetIndex } = require('../server/dataset-index');

const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/org-lens/demo_dataset');

describe('DatasetIndex', () => {
  let index;

  beforeAll(() => {
    const summariesData = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'people_summaries_demo_dataset.json'), 'utf-8'));
    const categoriesData = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'people_categories_demo_dataset.json'), 'utf-8'));
    const projectsData = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'projects_demo_dataset.json'), 'utf-8'));

    index = new DatasetIndex('demo_dataset', summariesData, categoriesData, projectsData);
  });

  describe('constructor / loading', () => {
    it('loads all people from summaries', () => {
      expect(index.people.length).toBe(10);
    });

    it('builds uid index', () => {
      expect(index.byUid['acohen']).toBeDefined();
      expect(index.byUid['acohen'].name).toBe('Avi Cohen');
    });

    it('builds name index (lowercased)', () => {
      expect(index.byName['avi cohen']).toBeDefined();
    });

    it('builds manager index', () => {
      const reports = index.byManager['dgur'];
      expect(reports).toBeDefined();
      expect(reports.length).toBeGreaterThanOrEqual(4);
    });

    it('loads categories', () => {
      expect(index.categories.length).toBe(6);
      expect(index.categoryByName['ai & machine learning']).toBeDefined();
    });

    it('loads projects', () => {
      expect(index.jiraProjects.length).toBe(4);
      expect(index.jiraProjectByKey['ocpbugs']).toBeDefined();
    });
  });

  describe('search', () => {
    it('finds people by name substring', () => {
      const { results } = index.search('avi');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Avi Cohen');
    });

    it('finds people by technology', () => {
      const { results } = index.search('kubernetes');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('returns matchedIn fields', () => {
      const { results } = index.search('kubernetes');
      const avi = results.find(r => r.uid === 'acohen');
      expect(avi.matchedIn).toContain('technologies');
    });

    it('respects limit', () => {
      const { results, total } = index.search('e', 2);
      expect(results.length).toBeLessThanOrEqual(2);
      expect(total).toBeGreaterThanOrEqual(results.length);
    });
  });

  describe('findExperts', () => {
    it('ranks by relevance score', () => {
      const { results } = index.findExperts('kubernetes');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].relevanceScore).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].relevanceScore).toBeLessThanOrEqual(results[i - 1].relevanceScore);
      }
    });

    it('includes evidence snippets', () => {
      const { results } = index.findExperts('kubernetes');
      const top = results[0];
      expect(top.evidence).toBeDefined();
      expect(Array.isArray(top.evidence)).toBe(true);
    });

    it('includes relevance detail', () => {
      const { results } = index.findExperts('kubernetes');
      const top = results[0];
      expect(top.relevanceDetail).toBeDefined();
      expect(top.relevanceDetail.length).toBeGreaterThan(0);
    });
  });

  describe('getPerson', () => {
    it('finds by uid', () => {
      const person = index.getPerson('bkap');
      expect(person).toBeDefined();
      expect(person.name).toBe('Benjamin Kapner');
    });

    it('finds by exact name (case-insensitive)', () => {
      const person = index.getPerson('Sarah Chen');
      expect(person).toBeDefined();
      expect(person.uid).toBe('schen');
    });

    it('finds by partial name', () => {
      const person = index.getPerson('kapner');
      expect(person).toBeDefined();
      expect(person.uid).toBe('bkap');
    });

    it('returns null for unknown identifier', () => {
      expect(index.getPerson('nonexistent')).toBeNull();
    });
  });

  describe('getDirectReports', () => {
    it('returns direct reports for a manager', () => {
      const reports = index.getDirectReports('dgur');
      expect(reports.length).toBeGreaterThanOrEqual(4);
      expect(reports.some(r => r.uid === 'acohen')).toBe(true);
    });

    it('returns empty array for non-manager', () => {
      expect(index.getDirectReports('acohen')).toEqual([]);
    });
  });

  describe('findCollaborators', () => {
    it('finds people sharing repos', () => {
      const { results } = index.findCollaborators('bkap');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const naloni = results.find(r => r.uid === 'naloni');
      expect(naloni).toBeDefined();
      expect(naloni.sharedRepos.length).toBeGreaterThan(0);
    });

    it('returns empty for unknown person', () => {
      const { results } = index.findCollaborators('nobody');
      expect(results).toEqual([]);
    });
  });

  describe('findCategory', () => {
    it('finds by exact name', () => {
      const cat = index.findCategory('AI & Machine Learning');
      expect(cat).toBeDefined();
      expect(cat.people.length).toBeGreaterThan(0);
    });

    it('finds by partial name', () => {
      const cat = index.findCategory('network');
      expect(cat).toBeDefined();
      expect(cat.category_name).toBe('Networking');
    });

    it('returns null for unknown category', () => {
      expect(index.findCategory('nonexistent')).toBeNull();
    });
  });

  describe('getSiteOverview', () => {
    it('returns headcount and top items', () => {
      const overview = index.getSiteOverview();
      expect(overview.headcount).toBe(10);
      expect(overview.topTechnologies.length).toBeGreaterThan(0);
      expect(overview.topProducts.length).toBeGreaterThan(0);
      expect(overview.categories.length).toBeGreaterThan(0);
    });
  });

  describe('getProject', () => {
    it('finds Jira project by key', () => {
      const proj = index.getProject('OCPBUGS');
      expect(proj).toBeDefined();
      expect(proj.name).toBe('OpenShift Bugs');
    });

    it('finds product by name', () => {
      const prod = index.getProject('OpenShift AI');
      expect(prod).toBeDefined();
    });

    it('returns null for unknown', () => {
      expect(index.getProject('FAKE')).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('returns sorted projects', () => {
      const projects = index.listProjects('issues', 10);
      expect(projects.length).toBeGreaterThan(0);
      for (let i = 1; i < projects.length; i++) {
        expect(projects[i].issue_count).toBeLessThanOrEqual(projects[i - 1].issue_count);
      }
    });
  });

  describe('listProducts', () => {
    it('returns sorted products', () => {
      const products = index.listProducts(10);
      expect(products.length).toBeGreaterThan(0);
      for (let i = 1; i < products.length; i++) {
        expect(products[i].people_count).toBeLessThanOrEqual(products[i - 1].people_count);
      }
    });
  });
});
