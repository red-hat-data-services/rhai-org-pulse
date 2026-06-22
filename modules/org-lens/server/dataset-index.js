'use strict';

class DatasetIndex {
  constructor(name, summariesData, categoriesData, projectsData) {
    this.name = name;
    this.people = [];
    this.metadata = {};

    this.byUid = {};
    this.byName = {};
    this.searchCorpus = {};

    this.categories = [];
    this.categoryByName = {};

    this.byManager = {};

    this.jiraProjects = [];
    this.products = [];
    this.repos = [];
    this.jiraProjectByKey = {};
    this.jiraProjectByName = {};
    this.productByName = {};

    this.allTechnologies = {};
    this.allProducts = {};
    this.allWorkFocus = {};

    this._init(summariesData, categoriesData, projectsData);
  }

  _init(summariesData, categoriesData, projectsData) {
    this.metadata = summariesData.metadata || {};
    this.people = summariesData.people_summaries || [];

    if (categoriesData) {
      this.categories = categoriesData.categories || [];
    }

    if (projectsData) {
      this.jiraProjects = projectsData.jira_projects || [];
      this.products = projectsData.products || [];
      this.repos = projectsData.repos || [];
    }

    this._buildIndexes();
  }

  _buildIndexes() {
    for (const person of this.people) {
      const uid = person.uid || '';
      const name = person.name || '';

      if (uid) this.byUid[uid] = person;
      if (name) this.byName[name.toLowerCase()] = person;

      const codeActivity = person.code_activity || {};
      const jiraHl = person.jira_highlights || {};
      const corpusParts = [
        name,
        uid,
        person.summary || '',
        (person.products || []).join(' '),
        (person.technologies || []).join(' '),
        (person.work_focus || []).join(' '),
        person.title || '',
        this._repoTexts(codeActivity).join(' '),
        (codeActivity.recent_mr_entries || []).join(' '),
        (jiraHl.epics || []).join(' '),
        (jiraHl.recent_tasks || []).join(' '),
        (jiraHl.labels || []).join(' '),
        (jiraHl.components || []).join(' '),
      ];
      const key = uid || name.toLowerCase();
      this.searchCorpus[key] = corpusParts.join(' ').toLowerCase();

      for (const tech of person.technologies || []) {
        this.allTechnologies[tech] = (this.allTechnologies[tech] || 0) + 1;
      }
      for (const prod of person.products || []) {
        this.allProducts[prod] = (this.allProducts[prod] || 0) + 1;
      }
      for (const focus of person.work_focus || []) {
        this.allWorkFocus[focus] = (this.allWorkFocus[focus] || 0) + 1;
      }

      const managerUid = person.manager || '';
      if (managerUid) {
        if (!this.byManager[managerUid]) this.byManager[managerUid] = [];
        this.byManager[managerUid].push(person);
      }
    }

    for (const cat of this.categories) {
      const catName = cat.category_name || '';
      if (catName) this.categoryByName[catName.toLowerCase()] = cat;
    }

    for (const proj of this.jiraProjects) {
      const key = proj.key || '';
      const name = proj.name || '';
      if (key) this.jiraProjectByKey[key.toLowerCase()] = proj;
      if (name) this.jiraProjectByName[name.toLowerCase()] = proj;
    }
    for (const prod of this.products) {
      const name = prod.name || '';
      if (name) this.productByName[name.toLowerCase()] = prod;
    }

    this.orgRoots = this.people.filter(p => !p.manager || !this.byUid[p.manager]);
  }

  search(query, limit = 10) {
    const queryLower = query.toLowerCase();
    const matches = [];

    for (const [key, corpus] of Object.entries(this.searchCorpus)) {
      if (!corpus.includes(queryLower)) continue;
      const person = this.byUid[key] || this.byName[key];
      if (!person) continue;
      const matchedIn = this._matchedFields(person, queryLower);
      matches.push({ ...person, matchedIn });
    }

    return { results: matches.slice(0, limit), total: matches.length };
  }

  findExperts(topic, limit = 10) {
    const topicLower = topic.toLowerCase();
    const scored = [];

    for (const [key, corpus] of Object.entries(this.searchCorpus)) {
      if (!corpus.includes(topicLower)) continue;
      const person = this.byUid[key] || this.byName[key];
      if (!person) continue;

      let score = 0;
      const detail = [];

      if ((person.technologies || []).some(t => t.toLowerCase().includes(topicLower))) {
        score += 3; detail.push('technologies');
      }
      if ((person.products || []).some(p => p.toLowerCase().includes(topicLower))) {
        score += 3; detail.push('products');
      }
      const codeActivity = person.code_activity || {};
      if ((codeActivity.recent_mr_entries || []).some(t => t.toLowerCase().includes(topicLower))) {
        score += 3; detail.push('code_mr_titles');
      }
      if (this._repoTexts(codeActivity).some(r => r.toLowerCase().includes(topicLower))) {
        score += 3; detail.push('code_repos');
      }
      const jiraHl = person.jira_highlights || {};
      if ((jiraHl.epics || []).some(e => e.toLowerCase().includes(topicLower))) {
        score += 3; detail.push('jira_epics');
      }
      if ((jiraHl.recent_tasks || []).some(t => t.toLowerCase().includes(topicLower))) {
        score += 2; detail.push('jira_tasks');
      }
      if ((jiraHl.labels || []).some(l => l.toLowerCase().includes(topicLower))) {
        score += 2; detail.push('jira_labels');
      }
      if ((jiraHl.components || []).some(c => c.toLowerCase().includes(topicLower))) {
        score += 2; detail.push('jira_components');
      }
      if ((person.work_focus || []).some(f => f.toLowerCase().includes(topicLower))) {
        score += 2; detail.push('work_focus');
      }
      if ((person.title || '').toLowerCase().includes(topicLower)) {
        score += 2; detail.push('title');
      }
      if ((person.summary || '').toLowerCase().includes(topicLower)) {
        score += 1; detail.push('summary');
      }

      if (score > 0) {
        const evidence = this._extractEvidence(person, topicLower);
        scored.push({
          name: person.name,
          uid: person.uid,
          title: person.title,
          relevanceScore: score,
          relevanceDetail: detail,
          evidence,
          summary: person.summary || '',
        });
      }
    }

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return { results: scored.slice(0, limit), total: scored.length };
  }

  getPerson(identifier) {
    if (this.byUid[identifier]) return this.byUid[identifier];
    const idLower = identifier.toLowerCase();
    if (this.byName[idLower]) return this.byName[idLower];
    for (const [name, person] of Object.entries(this.byName)) {
      if (name.includes(idLower)) return person;
    }
    return null;
  }

  getDirectReports(uid) {
    return this.byManager[uid] || [];
  }

  findCollaborators(identifier, limit = 10) {
    const person = this.getPerson(identifier);
    if (!person) return { results: [], total: 0 };

    const codeActivity = person.code_activity || {};
    const personRepos = new Set();
    for (const r of codeActivity.repos || []) {
      const p = typeof r === 'object' ? (r.path || '') : r;
      if (p) personRepos.add(p.toLowerCase());
    }
    const personProjects = new Set((person.jira_projects || []).map(p => p.toLowerCase()));

    if (personRepos.size === 0 && personProjects.size === 0) {
      return { results: [], total: 0 };
    }

    const personUid = person.uid || '';
    const scored = [];

    for (const other of this.people) {
      if (other.uid === personUid) continue;

      const sharedRepos = [];
      const otherCa = other.code_activity || {};
      for (const r of otherCa.repos || []) {
        const p = typeof r === 'object' ? (r.path || '') : r;
        if (personRepos.has(p.toLowerCase())) sharedRepos.push(p);
      }

      const sharedProjects = [];
      for (const p of other.jira_projects || []) {
        if (personProjects.has(p.toLowerCase())) sharedProjects.push(p);
      }

      if (sharedRepos.length > 0 || sharedProjects.length > 0) {
        scored.push({
          name: other.name,
          uid: other.uid,
          title: other.title,
          sharedRepos,
          sharedProjects,
          overlapScore: sharedRepos.length * 2 + sharedProjects.length,
          summary: other.summary || '',
        });
      }
    }

    scored.sort((a, b) => b.overlapScore - a.overlapScore);
    return { results: scored.slice(0, limit), total: scored.length };
  }

  findCategory(name) {
    const nameLower = name.toLowerCase();
    if (this.categoryByName[nameLower]) return this.categoryByName[nameLower];
    for (const [catName, cat] of Object.entries(this.categoryByName)) {
      if (catName.includes(nameLower)) return cat;
    }
    return null;
  }

  getSiteOverview() {
    const topTech = Object.entries(this.allTechnologies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    const topProd = Object.entries(this.allProducts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    const topManagers = this.orgRoots
      .map(p => ({
        name: p.name, uid: p.uid, title: p.title,
        directReportCount: (this.byManager[p.uid] || []).length,
      }));
    const managers = this.people
      .filter(p => (this.byManager[p.uid] || []).length > 0)
      .map(p => ({ name: p.name, uid: p.uid, title: p.title, directReportCount: this.byManager[p.uid].length }))
      .sort((a, b) => b.directReportCount - a.directReportCount)
      .slice(0, 10);
    return {
      headcount: this.people.length,
      topManagers,
      largestTeams: managers,
      topTechnologies: topTech,
      topProducts: topProd,
      categories: this.categories.map(c => ({
        name: c.category_name,
        count: (c.people || []).length,
      })),
    };
  }

  getProject(name) {
    const nameLower = name.toLowerCase();
    if (this.jiraProjectByKey[nameLower]) return this.jiraProjectByKey[nameLower];
    if (this.jiraProjectByName[nameLower]) return this.jiraProjectByName[nameLower];
    if (this.productByName[nameLower]) return this.productByName[nameLower];
    for (const [k, proj] of Object.entries(this.jiraProjectByName)) {
      if (k.includes(nameLower)) return proj;
    }
    for (const [k, prod] of Object.entries(this.productByName)) {
      if (k.includes(nameLower)) return prod;
    }
    return null;
  }

  listProjects(sortBy = 'issues', limit = 20) {
    const projects = [...this.jiraProjects];
    if (sortBy === 'issues') {
      projects.sort((a, b) => (b.issue_count || 0) - (a.issue_count || 0));
    } else if (sortBy === 'contributors') {
      projects.sort((a, b) => (b.contributors || []).length - (a.contributors || []).length);
    } else {
      projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return projects.slice(0, limit);
  }

  listProducts(limit = 20) {
    const products = [...this.products];
    products.sort((a, b) => (b.people_count || 0) - (a.people_count || 0));
    return products.slice(0, limit);
  }

  _repoTexts(codeActivity) {
    return (codeActivity.repos || []).map(r =>
      typeof r === 'object' ? ((r.path || '') + ' ' + (r.description || '')) : r
    );
  }

  _matchedFields(person, queryLower) {
    const matched = [];
    if ((person.summary || '').toLowerCase().includes(queryLower)) matched.push('summary');
    if ((person.technologies || []).some(t => t.toLowerCase().includes(queryLower))) matched.push('technologies');
    if ((person.products || []).some(p => p.toLowerCase().includes(queryLower))) matched.push('products');
    if ((person.work_focus || []).some(f => f.toLowerCase().includes(queryLower))) matched.push('work_focus');
    if ((person.title || '').toLowerCase().includes(queryLower)) matched.push('title');
    const ca = person.code_activity || {};
    if ((ca.recent_mr_entries || []).some(t => t.toLowerCase().includes(queryLower))) matched.push('code_mr_titles');
    if (this._repoTexts(ca).some(r => r.toLowerCase().includes(queryLower))) matched.push('code_repos');
    const jh = person.jira_highlights || {};
    if ((jh.epics || []).some(e => e.toLowerCase().includes(queryLower))) matched.push('jira_epics');
    if ((jh.recent_tasks || []).some(t => t.toLowerCase().includes(queryLower))) matched.push('jira_tasks');
    if ((jh.labels || []).some(l => l.toLowerCase().includes(queryLower))) matched.push('jira_labels');
    return matched;
  }

  _extractEvidence(person, topicLower, maxItems = 3) {
    const evidence = [];
    const jiraHl = person.jira_highlights || {};
    for (const epic of jiraHl.epics || []) {
      if (epic.toLowerCase().includes(topicLower)) evidence.push('Epic: ' + epic);
    }
    for (const task of jiraHl.recent_tasks || []) {
      if (task.toLowerCase().includes(topicLower)) evidence.push('Task: ' + task);
    }
    const ca = person.code_activity || {};
    for (const mr of ca.recent_mr_entries || []) {
      if (mr.toLowerCase().includes(topicLower)) evidence.push('MR: ' + mr.slice(0, 150));
    }
    for (const repo of ca.repos || []) {
      const p = typeof repo === 'object' ? (repo.path || '') : repo;
      const d = typeof repo === 'object' ? (repo.description || '') : '';
      if (p.toLowerCase().includes(topicLower) || d.toLowerCase().includes(topicLower)) {
        evidence.push('Repo: ' + p);
      }
    }
    return evidence.slice(0, maxItems);
  }
}

module.exports = { DatasetIndex };
