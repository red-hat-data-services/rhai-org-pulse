#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { config: null, modulesDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) {
      args.config = argv[++i];
    } else if (argv[i] === '--modules-dir' && argv[i + 1]) {
      args.modulesDir = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;

function resolveFromScript(...segments) {
  return path.resolve(SCRIPT_DIR, ...segments);
}

/**
 * Read and parse a JSON file. Exits with code 1 on failure.
 */
function readJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: ${label} not found at ${filePath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: Failed to parse ${label} at ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Read a text file. Returns null if optional is true and file doesn't exist.
 * Exits with code 1 if required and missing.
 */
function readText(filePath, label, optional) {
  if (!fs.existsSync(filePath)) {
    if (optional) return null;
    console.error(`ERROR: ${label} not found at ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Parse a partial markdown file into sections keyed by H2 header text.
 * For example, "## Key Features" becomes the key "Key Features".
 * The value is the content between this header and the next H2 (or EOF),
 * with leading/trailing whitespace trimmed.
 */
function parsePartialSections(markdown) {
  const sections = {};
  const lines = markdown.split('\n');
  let currentKey = null;
  let currentLines = [];

  for (const line of lines) {
    const headerMatch = line.match(/^## (.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentKey !== null) {
        sections[currentKey] = currentLines.join('\n').trim();
      }
      currentKey = headerMatch[1].trim();
      currentLines = [];
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
  }
  // Save the last section
  if (currentKey !== null) {
    sections[currentKey] = currentLines.join('\n').trim();
  }

  return sections;
}

/**
 * Replace all template variables in a string.
 * Variables are of the form {{VAR_NAME}}.
 */
function applyVariables(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Replace all occurrences of {{KEY}}
    result = result.split(`{{${key}}}`).join(value != null ? String(value) : '');
  }
  return result;
}

/**
 * Generate a markdown table row for the module overview table.
 */
function makeOverviewTableRow(mod, modConfig) {
  const roles = modConfig.audiences.roles;
  const teams = modConfig.audiences.teams;

  // Abbreviate common role names for the table
  const roleAbbrevs = roles.map((r) => {
    return r
      .replace('Individual Contributors', 'ICs')
      .replace('Program Managers', 'PMs');
  });

  // Abbreviate team names
  const teamAbbrevs = teams.map((t) => {
    return t.replace('Open Source Program Office', 'OSPO');
  });

  const statusLabel = modConfig.status.includes('Beta')
    ? 'Beta (Disabled)'
    : modConfig.status;

  const consumers = `${roleAbbrevs.join(', ')} \u00b7 ${teamAbbrevs.join(', ')}`;

  const ownerCell = modConfig.owner === 'Unassigned'
    ? 'Unassigned'
    : `${modConfig.ownerName} (${modConfig.owner})`;

  return `| [${mod.name}](Org Pulse \u2014 ${mod.name}) | ${statusLabel} | ${ownerCell} | ${consumers} |`;
}

/**
 * Generate the full module overview table.
 */
function generateModuleTable(modules, config) {
  const header = `| Module | Status | Owner | Consumers |\n|---|---|---|---|`;
  const rows = modules.map((mod) => {
    const modConfig = config.modules[mod.slug];
    if (modConfig) {
      return makeOverviewTableRow(mod, modConfig);
    }
    // Stub row for modules without config
    const name = mod.name || titleCaseSlug(mod.slug);
    const status = mod.enabled === false ? 'Beta (Disabled)' : 'Active';
    const owner = `${config.platform.lead.name} (${config.platform.lead.github})`;
    return `| [${name}](Org Pulse \u2014 ${name}) | ${status} | ${owner} | TBD |`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Generate the services table for the team-api page.
 */
function generateServicesTable(modules, config) {
  const header = `| Service | Description | Status | Consumption Model |\n|---|---|---|---|`;
  const rows = modules.map((mod) => {
    const modConfig = config.modules[mod.slug];
    const statusLabel = modConfig
      ? (modConfig.status.includes('Beta') ? 'Beta' : modConfig.status)
      : (mod.enabled === false ? 'Beta' : 'Active');
    return `| ${mod.name || titleCaseSlug(mod.slug)} | ${mod.description || 'To be documented'} | ${statusLabel} | Self-Service |`;
  });
  // Add the REST API row
  rows.push('| REST API | Programmatic access to all platform data | Active | Self-Service |');
  return [header, ...rows].join('\n');
}

/**
 * Generate a views table from module.json views array.
 */
function generateViewsContent(views) {
  if (!views || views.length === 0) return '_No views defined._';
  // If views is an array of objects with name/purpose
  if (typeof views[0] === 'object') {
    const header = '| View | Purpose |\n|---|---|';
    const rows = views.map((v) => `| **${v.name}** | ${v.purpose || v.description || ''} |`);
    return [header, ...rows].join('\n');
  }
  // If views is a simple array of strings
  return views.map((v) => `- ${v}`).join('\n');
}

/**
 * Generate dependencies content from module.json dependencies array.
 */
function generateDependenciesContent(dependencies) {
  if (!dependencies || dependencies.length === 0) {
    return '- Core module \u2014 no dependencies on other modules';
  }
  return dependencies.map((d) => {
    if (typeof d === 'object') {
      return `- Depends on **${d.name || d.module}**${d.reason ? ` \u2014 ${d.reason}` : ''}`;
    }
    return `- Depends on **${d}**`;
  }).join('\n');
}

/**
 * Title-case a slug, preserving common acronyms (AI, API, RFE, etc.).
 */
const ACRONYMS = new Set(['ai', 'api', 'rfe', 'ui', 'ci', 'cd', 'qa', 'sla', 'url', 'id']);

function titleCaseSlug(slug) {
  return slug.split('-').map((w) => {
    if (ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

/**
 * Produce a display-friendly name from a module name or slug.
 */
function displayName(mod) {
  return mod.name || titleCaseSlug(mod.slug);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);

  // Resolve paths
  const configPath = args.config
    ? path.resolve(args.config)
    : resolveFromScript('confluence.config.json');

  const modulesDirArg = args.modulesDir
    ? path.resolve(args.modulesDir)
    : resolveFromScript('..', '..', 'modules');

  const partialsDir = resolveFromScript('partials');
  const templatesDir = resolveFromScript('templates');
  const generatedDir = resolveFromScript('generated');

  // Ensure generated directory exists
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  console.log('=== Confluence Page Generator ===');
  console.log(`Config:      ${configPath}`);
  console.log(`Modules dir: ${modulesDirArg}`);
  console.log(`Partials:    ${partialsDir}`);
  console.log(`Templates:   ${templatesDir}`);
  console.log(`Output:      ${generatedDir}`);
  console.log('');

  // ---- Load config ----
  const config = readJSON(configPath, 'confluence.config.json');

  // ---- Load templates ----
  const modulePageTemplate = readText(
    path.join(templatesDir, 'module-page.md.tmpl'),
    'module-page.md.tmpl template'
  );
  const overviewTemplate = readText(
    path.join(templatesDir, 'overview.md.tmpl'),
    'overview.md.tmpl template'
  );
  const teamApiTemplate = readText(
    path.join(templatesDir, 'team-api.md.tmpl'),
    'team-api.md.tmpl template'
  );

  // ---- Build shared template variables from config ----
  // Normalise URLs: strip trailing slash from prodUrl so {{PROD_URL}}{{API_DOCS_PATH}}
  // doesn't produce a double-slash.
  const prodUrl = config.platform.prodUrl.replace(/\/+$/, '');
  const sharedVars = {
    SPACE_KEY: config.confluence.spaceKey,
    PARENT_PAGE: config.confluence.parentPageTitle,
    LEAD_NAME: config.platform.lead.name,
    LEAD_GITHUB: config.platform.lead.github,
    COLEAD_NAME: config.platform.coLead.name,
    COLEAD_GITHUB: config.platform.coLead.github,
    REPO_URL: config.platform.repoUrl,
    PROD_URL: prodUrl,
    API_DOCS_PATH: config.platform.apiDocsPath,
  };

  // ---- Discover modules ----
  // Try to read module.json files from the modules directory.
  // Each module should live in modules/{slug}/module.json.
  const modules = [];
  const moduleSlugs = Object.keys(config.modules);

  if (fs.existsSync(modulesDirArg)) {
    // Read all subdirectories looking for module.json
    const entries = fs.readdirSync(modulesDirArg, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(modulesDirArg, entry.name, 'module.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = readJSON(manifestPath, `module.json for ${entry.name}`);
          modules.push(manifest);
        }
      }
    }
  }

  // If no module.json files were found on disk, synthesize from config
  // so the generator still works with only the config + partials.
  if (modules.length === 0) {
    console.log('NOTE: No module.json files found in modules directory.');
    console.log('      Synthesizing module data from confluence.config.json and partials.\n');
    let syntheticOrder = 2; // 0 = overview, 1 = team-api, modules start at 2
    for (const slug of moduleSlugs) {
      const modConfig = config.modules[slug];
      modules.push({
        name: titleCaseSlug(slug),
        slug: slug,
        description: '',
        icon: null,
        views: [],
        enabled: !modConfig.status.includes('Disabled'),
        order: syntheticOrder++,
        dependencies: [],
      });
    }
  }

  // Sort modules by order
  modules.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Classify modules: those with full docs vs those needing stubs
  const fullModules = [];
  const stubModules = [];

  for (const mod of modules) {
    const slug = mod.slug;
    const hasConfig = !!config.modules[slug];
    const partialPath = path.join(partialsDir, `${slug}.md`);
    const hasPartial = fs.existsSync(partialPath);

    if (hasConfig && hasPartial) {
      fullModules.push(mod);
    } else {
      const missing = [];
      if (!hasConfig) missing.push('confluence.config.json entry');
      if (!hasPartial) missing.push(`partial (${slug}.md)`);
      console.log(`WARN: Module "${slug}" missing ${missing.join(' and ')} — generating stub page.`);
      stubModules.push(mod);
    }
  }

  // ---- Generate full module pages ----
  console.log('\nGenerating module pages...');
  for (const mod of fullModules) {
    const slug = mod.slug;
    const modConfig = config.modules[slug];
    const partialPath = path.join(partialsDir, `${slug}.md`);
    const partialContent = readText(partialPath, `partial for ${slug}`);
    const sections = parsePartialSections(partialContent);

    const modDisplayName = displayName(mod);

    // Build module-specific variables
    const moduleVars = Object.assign({}, sharedVars, {
      MODULE_DISPLAY_NAME: modDisplayName,
      MODULE_SLUG: slug,
      MODULE_STATUS: modConfig.status,
      MODULE_OWNER_NAME: modConfig.ownerName,
      MODULE_OWNER_GITHUB: modConfig.owner,
      AUDIENCE_ROLES: modConfig.audiences.roles.join(', '),
      AUDIENCE_TEAMS: modConfig.audiences.teams.join(', '),
      MODULE_DESCRIPTION: sections['Description'] || mod.description || '',
      MODULE_FEATURES: sections['Key Features'] || '',
      MODULE_VIEWS: sections['Views / UI'] || generateViewsContent(mod.views),
      MODULE_INTEGRATIONS: sections['Data Sources & Integrations'] || '',
      MODULE_DEPENDENCIES: sections['Dependencies'] || generateDependenciesContent(mod.dependencies),
      MODULE_LIMITATIONS: sections['Known Limitations'] || '',
    });

    const rendered = applyVariables(modulePageTemplate, moduleVars);
    const order = String(mod.order).padStart(2, '0');
    const outFile = path.join(generatedDir, `${order}-${slug}.md`);
    fs.writeFileSync(outFile, rendered, 'utf8');
    console.log(`  [OK] ${path.basename(outFile)}  (${modDisplayName})`);
  }

  // ---- Generate stub pages for new/undocumented modules ----
  if (stubModules.length > 0) {
    console.log('\nGenerating stub pages for new modules...');
    for (const mod of stubModules) {
      const slug = mod.slug;
      const modDisplayName = displayName(mod);
      const modConfig = config.modules[slug];

      // Use config values if available, otherwise use sensible defaults
      const ownerName = modConfig ? modConfig.ownerName : config.platform.lead.name;
      const ownerGithub = modConfig ? modConfig.owner : config.platform.lead.github;
      const status = modConfig ? modConfig.status : (mod.enabled === false ? 'Beta (Disabled by Default)' : 'Active');
      const audienceRoles = modConfig ? modConfig.audiences.roles.join(', ') : 'TBD';
      const audienceTeams = modConfig ? modConfig.audiences.teams.join(', ') : 'TBD';

      const stubVars = Object.assign({}, sharedVars, {
        MODULE_DISPLAY_NAME: modDisplayName,
        MODULE_SLUG: slug,
        MODULE_STATUS: status,
        MODULE_OWNER_NAME: ownerName,
        MODULE_OWNER_GITHUB: ownerGithub,
        AUDIENCE_ROLES: audienceRoles,
        AUDIENCE_TEAMS: audienceTeams,
        MODULE_DESCRIPTION: mod.description || `${modDisplayName} module for the Org Pulse platform.`,
        MODULE_FEATURES: '_Detailed documentation coming soon. To contribute, add a partial at `docs/confluence/partials/' + slug + '.md`._',
        MODULE_VIEWS: generateViewsContent(mod.views),
        MODULE_INTEGRATIONS: '_To be documented._',
        MODULE_DEPENDENCIES: generateDependenciesContent(mod.dependencies),
        MODULE_LIMITATIONS: '_To be documented._',
      });

      const rendered = applyVariables(modulePageTemplate, stubVars);
      const order = String(mod.order).padStart(2, '0');
      const outFile = path.join(generatedDir, `${order}-${slug}.md`);
      fs.writeFileSync(outFile, rendered, 'utf8');
      console.log(`  [STUB] ${path.basename(outFile)}  (${modDisplayName})`);
    }
  }

  // ---- Generate overview page (00-overview.md) ----
  console.log('\nGenerating overview page...');
  const overviewDescription =
    'Org Pulse is an internal platform application that provides self-service delivery ' +
    'visibility for the Red Hat AI Platform (RHAI) organization. It aggregates data from ' +
    'Jira, GitHub, GitLab, LDAP, Google Sheets, and Product Pages into a unified dashboard ' +
    '\u2014 eliminating the manual effort of gathering delivery metrics across disparate tools.\n\n' +
    'Built as a modular Vue 3 + Express.js application deployed on OpenShift, Org Pulse is ' +
    'owned, roadmapped, and operated as an internal product serving RHAI delivery teams.';

  const moduleTable = generateModuleTable(modules, config);
  const overviewVars = Object.assign({}, sharedVars, {
    OVERVIEW_DESCRIPTION: overviewDescription,
    MODULE_TABLE: moduleTable,
  });
  const overviewRendered = applyVariables(overviewTemplate, overviewVars);
  const overviewPath = path.join(generatedDir, '00-overview.md');
  fs.writeFileSync(overviewPath, overviewRendered, 'utf8');
  console.log(`  [OK] 00-overview.md`);

  // ---- Generate team-api page (01-team-api.md) ----
  console.log('\nGenerating team-api page...');
  const servicesTable = generateServicesTable(modules, config);
  const teamApiVars = Object.assign({}, sharedVars, {
    SERVICES_TABLE: servicesTable,
  });
  const teamApiRendered = applyVariables(teamApiTemplate, teamApiVars);
  const teamApiPath = path.join(generatedDir, '01-team-api.md');
  fs.writeFileSync(teamApiPath, teamApiRendered, 'utf8');
  console.log(`  [OK] 01-team-api.md`);

  // ---- Preserve hand-authored pages (getting-started, architecture) ----
  console.log('\nPreserving hand-authored pages...');
  const handAuthored = [
    { file: '09-getting-started.md', label: 'Getting Started' },
    { file: '10-architecture.md', label: 'Architecture' },
    { file: '11-contributors-guide.md', label: "Contributor's Guide" },
  ];
  for (const entry of handAuthored) {
    const existingPath = path.join(generatedDir, entry.file);
    if (fs.existsSync(existingPath)) {
      console.log(`  [OK] ${entry.file}  (preserved, hand-authored)`);
    } else {
      console.log(`  [--] ${entry.file}  (not found, skipping \u2014 hand-authored page)`);
    }
  }

  // ---- Summary ----
  const allGenerated = fs.readdirSync(generatedDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  console.log(`\nDone. ${allGenerated.length} pages in ${generatedDir}:`);
  for (const f of allGenerated) {
    console.log(`  - ${f}`);
  }
}

main();
