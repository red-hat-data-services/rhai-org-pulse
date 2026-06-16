'use strict';

function getToolDeclarations() {
  return [
    {
      name: 'search_people',
      description: 'Search for people by name or broad text query. Use for "Find someone named Adi" or "Who has OpenShift in their profile?"',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term — matched against summary, products, technologies, work focus, and job title' },
          limit: { type: 'integer', description: 'Maximum results to return (default 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'find_experts',
      description: 'Find people with expertise in a topic, ranked by relevance with evidence. Use for "Who knows Kubernetes?" or "Find someone who works on KServe".',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Technology, product, domain, or skill to search for' },
          limit: { type: 'integer', description: 'Maximum results to return (default 10)' },
        },
        required: ['topic'],
      },
    },
    {
      name: 'get_person',
      description: 'Get the full profile for a specific person, including their manager and direct reports. Use for "What does Avi Cohen work on?" or "Tell me about bkap".',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: "Person's name (partial OK), uid, or email" },
        },
        required: ['identifier'],
      },
    },
    {
      name: 'get_team',
      description: "Get a manager and their direct reports (org hierarchy). Use for \"Who is on Daniel's team?\" or \"Who reports to dgur?\".",
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: "Manager's name (partial OK), uid, or email" },
        },
        required: ['identifier'],
      },
    },
    {
      name: 'get_collaborators',
      description: 'Find people who share code repositories or Jira projects with a given person. Use for "Who works with Benjamin Kapner?".',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: "Person's name (partial OK), uid, or email" },
          limit: { type: 'integer', description: 'Maximum results to return (default 10)' },
        },
        required: ['identifier'],
      },
    },
    {
      name: 'get_category',
      description: 'Get all people in a specific work category. Use for "Who\'s in the AI team?" or "Show me people doing Infrastructure & DevOps".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Category name (partial match OK, case-insensitive)' },
        },
        required: ['name'],
      },
    },
    {
      name: 'get_site_overview',
      description: 'Get high-level site stats: headcount, top technologies, products, categories. Use for "Give me an overview" or "How big is the team?".',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_project',
      description: 'Get detailed view of a specific Jira project or product. Use for "Tell me about the RHOAIENG project" or "What is ODF?".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project key (e.g. "OCPBUGS"), project name, or product name. Partial match OK.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'list_projects',
      description: 'List Jira projects with stats (issue count, contributors). Use for "What are the biggest projects?".',
      parameters: {
        type: 'object',
        properties: {
          sort_by: { type: 'string', enum: ['issues', 'contributors', 'name'], description: "Sort by (default: 'issues')" },
          limit: { type: 'integer', description: 'Maximum results (default 20)' },
        },
      },
    },
    {
      name: 'list_products',
      description: 'List products with people counts. Use for "What products does the team work on?".',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Maximum results (default 20)' },
        },
      },
    },
  ];
}

function executeToolCall(index, toolName, args) {
  switch (toolName) {
    case 'search_people':
      return index.search(args.query, args.limit || 10);

    case 'find_experts':
      return index.findExperts(args.topic, args.limit || 10);

    case 'get_person': {
      const person = index.getPerson(args.identifier);
      if (!person) return { error: 'Person not found: ' + args.identifier };
      const managerPerson = person.manager ? index.getPerson(person.manager) : null;
      const directReports = index.getDirectReports(person.uid || '');
      return {
        ...person,
        managerInfo: managerPerson ? { name: managerPerson.name, uid: managerPerson.uid, title: managerPerson.title } : null,
        directReports: directReports.map(r => ({ name: r.name, uid: r.uid, title: r.title })),
      };
    }

    case 'get_team': {
      const manager = index.getPerson(args.identifier);
      if (!manager) return { error: 'Manager not found: ' + args.identifier };
      const reports = index.getDirectReports(manager.uid || '');
      return {
        manager: { name: manager.name, uid: manager.uid, title: manager.title },
        directReports: reports.map(r => ({ name: r.name, uid: r.uid, title: r.title, summary: r.summary || '' })),
        count: reports.length,
      };
    }

    case 'get_collaborators':
      return index.findCollaborators(args.identifier, args.limit || 10);

    case 'get_category': {
      const cat = index.findCategory(args.name);
      if (!cat) return { error: 'Category not found: ' + args.name };
      return cat;
    }

    case 'get_site_overview':
      return index.getSiteOverview();

    case 'get_project': {
      const proj = index.getProject(args.name);
      if (!proj) return { error: 'Project not found: ' + args.name };
      return proj;
    }

    case 'list_projects':
      return { projects: index.listProjects(args.sort_by || 'issues', args.limit || 20) };

    case 'list_products':
      return { products: index.listProducts(args.limit || 20) };

    default:
      return { error: 'Unknown tool: ' + toolName };
  }
}

module.exports = { getToolDeclarations, executeToolCall };
