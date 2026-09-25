const yaml = require('js-yaml');
const { createJiraClient } = require('../../../shared/server/jira');
const { blockDuringImpersonation } = require('../../../shared/server/auth');

const PRODUCTS = ['agentic-base-images', 'ai-hub', 'base-images', 'docling', 'guidellm', 'rhaiis', 'rhelai', 'torch'];
const RHELAI_CONFIGS = [
  ['config-containers.yaml', 'containers'],
  ['config-disk-images.yaml', 'disk-images'],
  ['config-disk-image-containers.yaml', 'disk-image-containers'],
];
const RELEASE_PROJECT = 'RHAI';
const FEATURE_PROJECT = 'RHAISTRAT';
const JIRA_HOST_DEFAULT = 'https://redhat.atlassian.net';
const GITLAB_HOST_DEFAULT = 'https://gitlab.com';
const pmcSnapshotCache = new Map();
const triggerOptionsCache = new Map();
const TRIGGER_OPTIONS_CACHE_TTL = 30_000;
const INSTRUCTIONS = 'Component readiness is tracked through child Tasks linked to this epic. Use the component readiness skill to create a Task for a batch of components that are ready to release. Each Task carries image pullspecs and is linked to this epic via Epic Link.';

function configPaths(product, branch) {
  if (product === 'rhelai') {
    return RHELAI_CONFIGS.map(([filename]) => `${product}/${branch}/${filename}`);
  }
  return [`${product}/${branch}/config.yaml`];
}

function branchFromPath(path, product) {
  const prefix = `${product}/`;
  if (!path.startsWith(prefix)) return null;
  const remainder = path.slice(prefix.length);
  const slash = remainder.indexOf('/');
  return slash > 0 ? remainder.slice(0, slash) : null;
}

function parseYaml(value, path) {
  try {
    const parsed = yaml.load(value);
    if (!parsed || typeof parsed !== 'object') throw new Error('expected a YAML object');
    return parsed;
  } catch (err) {
    throw new Error(`Unable to parse PMC file ${path}: ${err.message}`, { cause: err });
  }
}

function firstPipeline(item, common) {
  const pipelines = Array.isArray(item.pipelinerun) ? item.pipelinerun : common.pipelinerun;
  return Array.isArray(pipelines) ? pipelines[0] || {} : {};
}

function branchApplication(base, branch) {
  return branch === 'main' ? base : `${base}-${branch.replaceAll('.', '-')}`;
}

function extractDefinition(definition, configFamily, branch) {
  const components = definition.components || {};
  const common = components.common || {};
  const items = Array.isArray(components.items) ? components.items : [];
  return {
    application: branchApplication(String(definition.application || ''), branch),
    baseApplication: String(definition.application || ''),
    tenant: String(definition.tenant || ''),
    components: items.filter(item => item && item.name).map(item => {
      const pipeline = firstPipeline(item, common);
      return {
        name: String(item.name),
        variant: pipeline.variant == null ? '' : String(pipeline.variant),
        tech_preview: item.tech_preview === true,
        config_family: configFamily,
        ...(item.stage_repository ? { stage_repository: String(item.stage_repository) } : {}),
      };
    }),
    releasePlans: Array.isArray(definition.release_plan)
      ? definition.release_plan.map(plan => plan && plan.name).filter(Boolean).map(String)
      : [],
    tags: Array.isArray(definition.release_plan_admission?.common?.tags)
      ? definition.release_plan_admission.common.tags.map(String)
      : [],
  };
}

function parseBranch(files, product, branch) {
  const paths = configPaths(product, branch);
  const availablePaths = product === 'rhelai'
    ? paths.filter(path => typeof files[path] === 'string')
    : paths;
  const missing = availablePaths.filter(path => typeof files[path] !== 'string');
  if (!availablePaths.length || missing.length) throw new Error(`Missing PMC config file(s): ${(missing.length ? missing : paths).join(', ')}`);

  const extracted = availablePaths.flatMap(path => {
    const family = product === 'rhelai'
      ? RHELAI_CONFIGS.find(([filename]) => path.endsWith(`/${filename}`))[1]
      : '—';
    const parsed = parseYaml(files[path], path);
    if (!Array.isArray(parsed.definitions)) throw new Error(`PMC file ${path} has no definitions list`);
    return parsed.definitions.map(definition => extractDefinition(definition, family, branch));
  });

  const applications = [...new Set(extracted.map(item => item.application).filter(Boolean))];
  const tenants = [...new Set(extracted.map(item => item.tenant).filter(Boolean))];
  if (applications.length !== 1) {
    throw new Error(`PMC application is inconsistent for ${product}/${branch}: ${applications.join(', ') || 'missing'}`);
  }
  if (tenants.length !== 1) {
    throw new Error(`PMC tenant is inconsistent for ${product}/${branch}: ${tenants.join(', ') || 'missing'}`);
  }

  const components = [];
  const seen = new Set();
  for (const item of extracted.flatMap(value => value.components)) {
    const key = `${item.config_family}:${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push(item);
  }

  return {
    product,
    branch,
    application: applications[0],
    tenant: tenants[0],
    config_files: availablePaths,
    config_families: product === 'rhelai'
      ? availablePaths.map(path => RHELAI_CONFIGS.find(([filename]) => path.endsWith(`/${filename}`))[1])
      : ['—'],
    components,
    release_plans: [...new Set(extracted.flatMap(item => item.releasePlans))],
    tags: [...new Set(extracted.flatMap(item => item.tags))],
    configured_tags: [...new Set(extracted.flatMap(item => item.tags))],
    configured_versions: [...new Set(extracted.flatMap(item => item.tags).filter(tag => /^(?:\d+\.\d+\.\d+)(?:-(?:ea|fast)\.\d+)?$/.test(String(tag))))],
    inferred_release_type: inferReleaseTypeForProduct(product, branch),
  };
}

function inferReleaseType(branch) {
  if (/-ea\d+$/i.test(branch) || /-fast\d+$/i.test(branch)) return 'EA';
  return 'GA';
}

function inferReleaseTypeForProduct(product, branch, version) {
  if (version && /-(?:ea|fast)\.\d+$/i.test(version)) return 'EA';
  if (/-ea\d+$/i.test(branch) || (product === 'rhaiis' && /-fast\d+$/i.test(branch))) return 'EA';
  return 'GA';
}

function listBranches(files, product) {
  const branches = new Set();
  for (const path of Object.keys(files)) {
    const branch = branchFromPath(path, product);
    const configs = configPaths(product, branch);
    const hasConfigs = product === 'rhelai'
      ? configs.some(config => typeof files[config] === 'string')
      : configs.every(config => typeof files[config] === 'string');
    if (branch && hasConfigs) {
      branches.add(branch);
    }
  }
  return [...branches].sort();
}

function parsePmcSnapshot(files) {
  const products = [];
  for (const product of PRODUCTS) {
    const ownersPath = `${product}/owners.yaml`;
    if (typeof files[ownersPath] !== 'string') continue;
    const branches = listBranches(files, product);
    products.push({
      key: product,
      branches: branches.map(branch => parseBranch(files, product, branch)),
    });
  }
  return products;
}

function canonicalChannelName(value) {
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(/^(\d+\.\d+)(?:\.0)?-(ea|fast)\.?(\d+)$/);
  return match ? `${match[1]}-${match[2]}${match[3]}` : text;
}

function resolveBranch(products, product, value) {
  const entry = products.find(item => item.key === product);
  if (!entry) throw new Error(`Unsupported product: ${product}`);
  const requested = String(value || '').trim();
  const branch = entry.branches.find(item => item.branch === requested)
    || entry.branches.find(item => item.branch.toLowerCase() === requested.toLowerCase())
    || entry.branches.find(item => canonicalChannelName(item.branch) === canonicalChannelName(requested));
  if (!branch) throw new Error(`Invalid PMC branch ${product}/${requested}. Valid branches: ${entry.branches.map(item => item.branch).join(', ')}`);
  return branch;
}

function resolveVersion(metadata, value) {
  const requested = String(value || '').trim();
  const exact = metadata.configured_versions.find(version => version === requested)
    || metadata.configured_versions.find(version => version.toLowerCase() === requested.toLowerCase());
  if (exact) return exact;
  const aliases = metadata.configured_versions.filter(version => canonicalChannelName(version) === canonicalChannelName(requested));
  if (aliases.length === 1) return aliases[0];
  return null;
}

function validateReleaseInput(products, body) {
  const product = String(body.product || '').trim();
  const requestedVersion = String(body.version || '').trim();
  const requestedBranch = String(body.branch || '').trim();
  const advisoryType = String(body.advisory_type || body.advisoryType || '').trim().toUpperCase();
  const releaseTypeInput = String(body.release_type || body.releaseType || '').trim().toUpperCase();
  if (!PRODUCTS.includes(product)) throw new Error(`Product must be one of: ${PRODUCTS.join(', ')}`);
  if (!requestedVersion) throw new Error('Version is required');
  if (!requestedBranch) throw new Error('Branch is required');
  if (!['RHEA', 'RHBA', 'RHSA'].includes(advisoryType)) throw new Error('Advisory type is required and must be RHEA, RHBA, or RHSA');
  if (releaseTypeInput && !['GA', 'EA'].includes(releaseTypeInput)) throw new Error('Release type must be GA or EA');

  const metadata = resolveBranch(products, product, requestedBranch);
  const branch = metadata.branch;
  const version = resolveVersion(metadata, requestedVersion);
  if (!version) {
    throw new Error(`Version ${requestedVersion} is not configured for ${product}/${branch}. Exact configured tags: ${metadata.tags.join(', ')}`);
  }
  const inferredReleaseType = inferReleaseTypeForProduct(product, branch, version);
  if (releaseTypeInput && releaseTypeInput !== inferredReleaseType) {
    throw new Error(`Release type ${releaseTypeInput} does not match the configured ${inferredReleaseType} version ${version}`);
  }
  const releaseType = releaseTypeInput || inferredReleaseType;
  return { product, version, branch, advisory_type: advisoryType, release_type: releaseType, metadata };
}

function parseExclusions(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function filterComponents(components, exclusions) {
  const excluded = new Set(exclusions);
  return components.filter(component => !excluded.has(component.name) && !excluded.has(component.variant));
}

function tableCell(text) {
  return {
    type: 'tableCell',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: String(text) }] }],
  };
}

function buildEpicAdf(input, components) {
  const metadata = [
    `product: ${input.product}`,
    `version: ${input.version}`,
    `branch: ${JSON.stringify(input.branch)}`,
    `release_type: ${input.release_type}`,
    `advisory_type: ${input.advisory_type}`,
    `tenant: ${input.metadata.tenant}`,
    `application: ${input.metadata.application}`,
  ].join('\n');
  const rows = [
    ['Component', 'Variant', 'Tech Preview', 'Config Family'].map(value => ({
      type: 'tableHeader',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
    })),
    ...components.map(component => [
      component.name,
      component.variant,
      component.tech_preview ? 'Yes' : 'No',
      component.config_family,
    ].map(tableCell)),
  ].map(content => ({ type: 'tableRow', content }));
  return {
    version: 1,
    type: 'doc',
    content: [
      { type: 'codeBlock', attrs: { language: 'yaml' }, content: [{ type: 'text', text: metadata }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Expected Components' }] },
      { type: 'table', content: rows },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'How to Add Components' }] },
      { type: 'paragraph', content: [{ type: 'text', text: INSTRUCTIONS }] },
    ],
  };
}

function variantList(components) {
  const values = components.map(component => component.variant || component.name);
  const limit = 12;
  return values.length > limit
    ? `${values.slice(0, limit).join(', ')}... (+${values.length - limit} more)`
    : values.join(', ');
}

function isZStream(version) {
  const match = String(version).match(/^\d+\.\d+\.(\d+)/);
  return Boolean(match && Number(match[1]) > 0);
}

function checklistPlan(input, components) {
  const plans = input.metadata.release_plans;
  const hasStage = plans.some(plan => /-stage$/.test(plan));
  const hasProd = plans.some(plan => /-prod$/.test(plan));
  const cards = [];
  const notCreated = [];
  const variants = variantList(components);
  if (hasStage) cards.push({
    kind: 'release', target: 'stage-rc', labels: ['planned'],
    summary: `Release ${input.product} ${input.version} (stage-rc): ${variants}`,
    adf: buildReadinessAdf(input, components, 'stage-rc'),
  });
  else notCreated.push({ summary: `Release ${input.product} ${input.version} (stage-rc): ${variants}`, reason: 'no release_plan entry ending in -stage' });
  if (hasProd) cards.push({
    kind: 'release', target: 'prod', labels: ['planned'],
    summary: `Release ${input.product} ${input.version} (prod): ${variants}`,
    adf: buildReadinessAdf(input, components, 'prod'),
  });
  else notCreated.push({ summary: `Release ${input.product} ${input.version} (prod): ${variants}`, reason: 'no release_plan entry ending in -prod' });

  if (input.advisory_type === 'RHSA' || isZStream(input.version)) cards.push({
    kind: 'checklist', labels: [],
    summary: `Determine CVEs fixed in ${input.product} ${input.version}`,
    text: `List the CVEs fixed in this release, then record them on the readiness cards so they reach the advisory. Close this card once the list is confirmed.`,
  });
  else notCreated.push({ summary: `Determine CVEs fixed in ${input.product} ${input.version}`, reason: 'not a z-stream and advisory type is not RHSA' });

  const announcementTarget = hasProd ? 'production release' : 'stage-rc release';
  cards.push({
    kind: 'checklist', labels: [],
    summary: `Send a ${input.product} ${input.version} release announcement email`,
    text: `Send the release announcement once this version's release has gone out — the ${announcementTarget}. Close this card after the email goes out.`,
  });

  const bumpEligible = input.release_type === 'GA'
    && !/(?:-ea\d+|-fast\d+)$/i.test(input.branch)
    && hasProd
    && input.metadata.tags.includes(input.version);
  if (bumpEligible) cards.push({
    kind: 'checklist', labels: [],
    summary: `Bump ${input.product} ${input.version} version tags for next z-stream`,
    text: 'After the production release succeeds, the automated post-release version-bump workflow updates the PMC tags, generates the KRD changes with PMT, opens MRs in both repositories, and closes this card after both MRs are created.',
  });
  else notCreated.push({
    summary: `Bump ${input.product} ${input.version} version tags for next z-stream`,
    reason: 'release type is not GA, branch is EA/fast, no production release plan, or exact version tag is absent',
  });
  return { cards, notCreated, hasStage, hasProd };
}

function buildReadinessAdf(input, components, target) {
  const componentYaml = components.map(component => [
    `  - name: ${component.name}`,
    `    variant: ${JSON.stringify(component.variant)}`,
    ...(component.config_family && component.config_family !== '—' ? [`    config_family: ${JSON.stringify(component.config_family)}`] : []),
  ].join('\n')).join('\n');
  const text = `product: ${input.product}\nversion: ${input.version}\ntarget: ${target}\ncomponents:\n${componentYaml}`;
  const rows = [
    ['Component', 'Variant'].map(value => ({ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] })),
    ...components.map(component => [component.name, component.variant].map(tableCell)),
  ].map(content => ({ type: 'tableRow', content }));
  return {
    version: 1,
    type: 'doc',
    content: [
      { type: 'codeBlock', attrs: { language: 'yaml' }, content: [{ type: 'text', text }] },
      { type: 'table', content: rows },
    ],
  };
}

function featureSuffix(branch, version) {
  const versionMatch = String(version || '').match(/-(ea|fast)\.(\d+)$/i);
  if (versionMatch) return versionMatch[1].toLowerCase() === 'ea' ? `EA${versionMatch[2]}` : `fast${versionMatch[2]}`;
  const tail = branch.includes('-') ? branch.slice(branch.lastIndexOf('-') + 1) : '';
  if (/^ea\d+$/i.test(tail)) return `EA${tail.slice(2)}`;
  if (/^fast\d+$/i.test(tail)) return tail;
  return 'GA';
}

function featureJql(input) {
  const ystream = String(input.version).match(/^\d+\.\d+/)?.[0];
  if (!ystream) throw new Error(`Version ${input.version} does not start with major.minor`);
  const terms = input.product === 'rhaiis' ? ['RHAII', 'RHAIIS'] : input.product === 'rhelai' ? ['RHEL AI'] : [input.product];
  const phrase = `${ystream} ${featureSuffix(input.branch, input.version)}`;
  return `project = ${FEATURE_PROJECT} AND issuetype = Feature AND (${terms.map(term => `summary ~ "${term} ${phrase}"`).join(' OR ')})`;
}

function duplicateJql(input) {
  return `project in (AIPCC, RHAI) AND issuetype = Epic AND labels = release-automation AND summary ~ "Release ${input.product} ${input.version}"`;
}

function issueSummary(issue) {
  const fields = issue.fields || {};
  return {
    key: issue.key,
    summary: fields.summary || '',
    status: fields.status?.name || '',
    url: `${JIRA_HOST_DEFAULT}/browse/${issue.key}`,
  };
}

function isMatchingDuplicate(issue, input) {
  const summary = String(issue.fields?.summary || '').toLowerCase();
  return summary.startsWith(`release ${input.product} ${input.version} `.toLowerCase());
}

function adfText(text) {
  return {
    type: 'doc',
    version: 1,
    content: String(text).split('\n').filter(Boolean).map(line => ({
      type: 'paragraph', content: [{ type: 'text', text: line }],
    })),
  };
}

function buildEpicFields(input, adf, featureKey) {
  const fields = {
    project: { key: RELEASE_PROJECT },
    summary: `Release ${input.product} ${input.version} ${input.release_type}`,
    issuetype: { name: 'Epic' },
    description: adf,
    components: [{ name: 'AIPCC Productization' }],
    labels: ['release-automation'],
    assignee: null,
    security: { name: 'Red Hat Employee' },
  };
  if (featureKey) fields.parent = { key: featureKey };
  return fields;
}

function buildTaskFields(epicKey, card) {
  const fields = {
    project: { key: RELEASE_PROJECT },
    summary: card.summary,
    issuetype: { name: 'Task' },
    parent: { key: epicKey },
    description: card.adf || adfText(card.text),
    components: [{ name: 'AIPCC Productization' }],
    labels: card.labels,
    assignee: null,
    security: { name: 'Red Hat Employee' },
  };
  return fields;
}

async function verifyCreatedEpic(jira, epicKey, featureKey) {
  const issue = await jira.jiraRequest(`/rest/api/3/issue/${encodeURIComponent(epicKey)}?fields=description,parent`);
  const warnings = [];
  const description = issue.fields?.description;
  const codeBlock = description?.content?.find(node => node.type === 'codeBlock');
  if (!codeBlock || !['yaml', 'yml'].includes(String(codeBlock.attrs?.language || '').toLowerCase())) {
    warnings.push('Epic description verification did not find a YAML metadata code block.');
  }
  if (featureKey && issue.fields?.parent?.key !== featureKey) {
    warnings.push(`Epic parent verification did not find ${featureKey}.`);
  }
  return warnings;
}

function callerKerberosId(req) {
  const email = String(req.userEmail || req.user?.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    throw new Error('Unable to identify the authenticated dashboard user reliably; release epic creation requires a signed-in dashboard identity.');
  }
  return email.split('@')[0];
}

function authorizedUsers(files, product) {
  const groups = parseYaml(files['owners-groups.yaml'], 'owners-groups.yaml').groups || {};
  const owners = parseYaml(files[`${product}/owners.yaml`], `${product}/owners.yaml`).owners || {};
  const users = new Set(Array.isArray(owners.users) ? owners.users.map(value => String(value).toLowerCase()) : []);
  for (const group of owners.groups || []) {
    const members = Array.isArray(groups[group]) ? groups[group] : [];
    members.forEach(member => users.add(String(member).toLowerCase()));
  }
  return [...users].sort();
}

function assertAuthorized(files, product, kerberosId) {
  if (typeof files['owners-groups.yaml'] !== 'string') throw new Error('PMC owners-groups.yaml is missing');
  const allowed = authorizedUsers(files, product);
  if (!allowed.includes(kerberosId)) {
    throw new Error(`You are not authorized to create release epics for ${product}.`);
  }
}

function createGitlabClient({ baseUrl = GITLAB_HOST_DEFAULT, project, token, fetchFn = fetch }) {
  if (!token) throw new Error('PMC GitLab read token is not configured (set PMC_GITLAB_TOKEN)');
  if (!project) throw new Error('PMC GitLab project is not configured (set PMC_GITLAB_PROJECT)');
  const host = baseUrl.replace(/\/$/, '');
  const projectId = /%2f/i.test(project) ? project : encodeURIComponent(project);
  const cacheTtl = 300000;
  async function fetchResponse(url, options) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchFn(url, { ...options, signal: AbortSignal.timeout(30000) });
        if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
      } catch (error) {
        lastError = error;
        if (attempt === 2) {
          const cause = error.cause?.message || error.message;
          throw new Error(`PMC GitLab request failed for ${url}: ${cause}`, { cause: error });
        }
      }
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
    throw lastError;
  }
  async function request(path) {
    const url = `${host}/api/v4${path}`;
    const response = await fetchResponse(url, {
      headers: { Accept: 'application/json', 'PRIVATE-TOKEN': token },
    });
    if (!response.ok) throw new Error(`PMC GitLab API returned HTTP ${response.status}`);
    return response.json();
  }
  async function listTree(path, ref, recursive = false) {
    const entries = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ ref, per_page: '100', page: String(page) });
      if (path) params.set('path', path);
      if (recursive) params.set('recursive', 'true');
      const pageEntries = await request(`/projects/${projectId}/repository/tree?${params}`);
      entries.push(...(Array.isArray(pageEntries) ? pageEntries : []));
      if (!Array.isArray(pageEntries) || pageEntries.length < 100) break;
    }
    return entries;
  }
  async function readFile(path, ref) {
    const url = `${host}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`;
    const response = await fetchResponse(url, {
      headers: { Accept: 'text/plain', 'PRIVATE-TOKEN': token },
    });
    if (!response.ok) throw new Error(`Unable to read PMC file ${path} at ${ref}: HTTP ${response.status}`);
    return response.text();
  }
  async function resolveRef(ref, forceRefresh = false) {
    const cacheKey = `${host}|${projectId}|commit|${ref}`;
    if (forceRefresh) pmcSnapshotCache.delete(cacheKey);
    const cached = pmcSnapshotCache.get(cacheKey);
    if (cached?.value && cached.expiresAt > Date.now()) return cached.value;
    if (cached?.promise) return cached.promise;
    const pending = request(`/projects/${projectId}/repository/commits/${encodeURIComponent(ref)}`).then(commit => {
      const sha = commit.id || commit.sha;
      if (!sha) throw new Error(`PMC ref ${ref} did not resolve to a commit SHA`);
      return sha;
    });
    pmcSnapshotCache.set(cacheKey, { promise: pending, expiresAt: Date.now() + cacheTtl });
    try {
      const sha = await pending;
      pmcSnapshotCache.set(cacheKey, { value: sha, expiresAt: Date.now() + cacheTtl });
      pmcSnapshotCache.set(`${host}|${projectId}|commit|${sha}`, { value: sha, expiresAt: Date.now() + cacheTtl });
      return sha;
    } catch (error) {
      pmcSnapshotCache.delete(cacheKey);
      throw error;
    }
  }
  async function repositoryCatalog(ref, forceRefresh = false) {
    const sha = await resolveRef(ref, forceRefresh);
    const cacheKey = `${host}|${projectId}|catalog|${sha}`;
    if (forceRefresh) pmcSnapshotCache.delete(cacheKey);
    const cached = pmcSnapshotCache.get(cacheKey);
    if (cached?.value && cached.expiresAt > Date.now()) return { sha, ...cached.value };
    if (cached?.promise) return { sha, ...(await cached.promise) };
    const pending = (async () => {
      const root = await listTree('', sha, false);
      const products = [];
      const productDirectories = new Set(root.filter(entry => entry.type === 'tree').map(entry => entry.path));
      for (const product of PRODUCTS.filter(value => productDirectories.has(value))) {
        const entries = await listTree(product, sha, false);
        if (!entries.some(entry => entry.type === 'blob' && entry.path === `${product}/owners.yaml`)) continue;
        const branches = entries
          .filter(entry => entry.type === 'tree')
          .map(entry => entry.path.slice(`${product}/`.length))
          .filter(Boolean);
        products.push({
          key: product,
          has_owner_file: true,
          branches: branches
            .map(branch => ({ branch, config_paths: configPaths(product, branch) }))
            .sort((left, right) => left.branch.localeCompare(right.branch)),
        });
      }
      return { root_paths: root.map(entry => entry.path), products };
    })();
    pmcSnapshotCache.set(cacheKey, { promise: pending, expiresAt: Date.now() + cacheTtl });
    try {
      const value = await pending;
      pmcSnapshotCache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtl });
      return { sha, ...value };
    } catch (error) {
      pmcSnapshotCache.delete(cacheKey);
      throw error;
    }
  }
  async function selective(ref, paths, forceRefresh = false) {
    const sha = await resolveRef(ref, forceRefresh);
    const uniquePaths = [...new Set(paths)].sort();
    const cacheKey = `${host}|${projectId}|files|${sha}|${uniquePaths.join(',')}`;
    if (forceRefresh) pmcSnapshotCache.delete(cacheKey);
    const cached = pmcSnapshotCache.get(cacheKey);
    if (cached?.value && cached.expiresAt > Date.now()) return { sha, files: cached.value };
    if (cached?.promise) return { sha, files: await cached.promise };
    const pending = (async () => {
      const files = {};
      const pendingPaths = [...uniquePaths];
      async function readNext() {
        const path = pendingPaths.shift();
        if (!path) return;
        try {
          files[path] = await readFile(path, sha);
        } catch (error) {
          const optionalFamily = /^rhelai\/[^/]+\/config-(?:containers|disk-images|disk-image-containers)\.yaml$/.test(path);
          if (!(error.message.includes('HTTP 404') && optionalFamily)) throw error;
        }
        return readNext();
      }
      await Promise.all(Array.from({ length: Math.min(4, pendingPaths.length) }, readNext));
      return files;
    })();
    pmcSnapshotCache.set(cacheKey, { promise: pending, expiresAt: Date.now() + cacheTtl });
    try {
      const files = await pending;
      pmcSnapshotCache.set(cacheKey, { value: files, expiresAt: Date.now() + cacheTtl });
      return { sha, files };
    } catch (error) {
      pmcSnapshotCache.delete(cacheKey);
      throw error;
    }
  }
  async function snapshot(ref, forceRefresh = false) {
    const catalog = await repositoryCatalog(ref, forceRefresh);
    const paths = new Set(['owners-groups.yaml']);
    for (const product of catalog.products) {
      paths.add(`${product.key}/owners.yaml`);
      for (const branch of product.branches) for (const path of branch.config_paths) paths.add(path);
    }
    const files = await selective(ref, [...paths], false);
    return { sha: catalog.sha, files: files.files };
  }
  return { snapshot, selective, repositoryCatalog, resolveRef };
}

function gitlabFor(context, deps = {}) {
  const secrets = context.secrets || {};
  return deps.gitlab || createGitlabClient({
    baseUrl: secrets.PMC_GITLAB_BASE_URL || GITLAB_HOST_DEFAULT,
    project: secrets.PMC_GITLAB_PROJECT,
    token: secrets.PMC_GITLAB_TOKEN || secrets.GITLAB_TOKEN,
    fetchFn: deps.fetchFn,
  });
}

function pmcRef(context) {
  return context.secrets?.PMC_GITLAB_REF || 'main';
}

async function loadPmcBranches(context, deps, candidates, forceRefresh = false) {
  const ref = pmcRef(context);
  const client = gitlabFor(context, deps);
  const selected = candidates.map(candidate => ({
    ...candidate,
    branch: String(candidate.branch).trim(),
    config_paths: configPaths(candidate.product, String(candidate.branch).trim()),
  }));
  const paths = new Set(['owners-groups.yaml']);
  for (const candidate of selected) {
    paths.add(`${candidate.product}/owners.yaml`);
    for (const path of candidate.config_paths) paths.add(path);
  }
  const snapshot = await client.selective(ref, [...paths], forceRefresh);
  const products = selected.map(candidate => {
    const branch = parseBranch(snapshot.files, candidate.product, candidate.branch);
    return { key: candidate.product, branches: [branch] };
  });
  return { ...snapshot, ref, files: snapshot.files, products, selected };
}

async function loadPmcBranch(context, deps, product, branch, forceRefresh = false) {
  return loadPmcBranches(context, deps, [{ product, branch }], forceRefresh);
}

async function loadReleaseEpicOptions(context, deps, product, branch) {
  const client = gitlabFor(context, deps);
  const ref = pmcRef(context);
  const catalog = await client.repositoryCatalog(ref);
  const products = catalog.products.map(item => ({
    key: item.key,
    branches: item.branches.map(value => ({ branch: value.branch })),
  }));
  if (!product && !branch) return { sha: catalog.sha, ref, products };
  if (!product || !branch) throw new Error('product and branch must be selected together');
  const selected = await loadPmcBranch(context, deps, product, branch);
  const selectedProduct = selected.products[0];
  const selectedBranch = selectedProduct.branches[0];
  const productEntry = products.find(item => item.key === product);
  if (productEntry) {
    productEntry.branches = productEntry.branches.map(item => item.branch === selectedBranch.branch ? selectedBranch : item);
  }
  return { sha: selected.sha, ref: selected.ref, products };
}

async function findFeatures(jira, input) {
  const result = await jira.jiraRequest('/rest/api/3/search/jql', {
    method: 'POST',
    body: { jql: featureJql(input), maxResults: 10, fields: ['key', 'summary', 'status', 'issuetype'] },
  });
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  return issues.map(issueSummary);
}

async function findDuplicates(jira, input) {
  const result = await jira.jiraRequest('/rest/api/3/search/jql', {
    method: 'POST',
    body: { jql: duplicateJql(input), maxResults: 50, fields: ['key', 'summary', 'status', 'labels'] },
  });
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  return issues.filter(issue => isMatchingDuplicate(issue, input)).map(issueSummary);
}

function featureMode(body) {
  return String(body.feature_mode || body.featureMode || 'auto').trim().toLowerCase();
}

async function resolveFeature(jira, input, body, createdKeys) {
  const mode = featureMode(body);
  if (mode === 'none') return null;
  if (mode === 'explicit') {
    const key = String(body.feature || body.feature_key || '').trim().toUpperCase();
    if (!/^RHAISTRAT-\d+$/.test(key)) throw new Error('Explicit parent feature must be a RHAISTRAT issue key');
    const issue = await jira.jiraRequest(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=project,issuetype,summary,status`);
    if (issue.fields?.project?.key !== FEATURE_PROJECT || issue.fields?.issuetype?.name !== 'Feature') {
      throw new Error(`Parent must be a Feature in ${FEATURE_PROJECT}: ${key}`);
    }
    return { key, summary: issue.fields.summary || '', status: issue.fields.status?.name || '' };
  }
  if (mode === 'create') {
    const summary = String(body.feature_summary || body.featureSummary || '').trim();
    if (!summary) throw new Error('A summary is required when creating a new parent Feature');
    const created = await jira.jiraRequest('/rest/api/3/issue', { method: 'POST', body: { fields: {
      project: { key: FEATURE_PROJECT }, issuetype: { name: 'Feature' }, summary,
      components: [{ name: 'AIPCC Productization' }], security: { name: 'Red Hat Employee' },
    } } });
    if (!created.key) throw new Error('Jira did not return the created Feature key');
    createdKeys.push(created.key);
    return { key: created.key, summary, status: '' };
  }

  const features = await findFeatures(jira, input);
  if (features.length === 1) return features[0];
  if (features.length === 0) {
    const error = new Error('No matching RHAISTRAT Feature found; choose an explicit Feature, create one, or skip it');
    error.code = 'feature-selection';
    error.features = [];
    throw error;
  }
  const error = new Error('Multiple matching RHAISTRAT Features found; choose one or skip it');
  error.code = 'feature-selection';
  error.features = features;
  throw error;
}

async function createReleaseEpic(jira, input, components, body) {
  const createdKeys = [];
  const warnings = [];
  const duplicates = await findDuplicates(jira, input);
  if (duplicates.length && body.confirm_duplicates !== true && body.confirmDuplicates !== true) {
    const error = new Error('A release Epic with the same product and version already exists; confirm before creating another');
    error.code = 'duplicates';
    error.duplicates = duplicates;
    throw error;
  }
  let feature;
  try {
    feature = await resolveFeature(jira, input, body, createdKeys);
  } catch (err) {
    err.createdKeys = createdKeys;
    if (feature?.key) err.featureKey = feature.key;
    throw err;
  }
  let epic;
  try {
    epic = await jira.jiraRequest('/rest/api/3/issue', {
      method: 'POST',
      body: { fields: buildEpicFields(input, buildEpicAdf(input, components), feature?.key) },
    });
    if (!epic.key) throw new Error('Jira did not return the created release Epic key');
  } catch (err) {
    err.createdKeys = createdKeys;
    if (feature?.key) err.featureKey = feature.key;
    throw err;
  }
  createdKeys.push(epic.key);
  try {
    warnings.push(...await verifyCreatedEpic(jira, epic.key, feature?.key));
  } catch (err) {
    warnings.push(`Epic verification failed: ${err.message}`);
  }
  const plan = checklistPlan(input, components);
  const cards = [];
  const failures = [];
  for (const card of plan.cards) {
    try {
      const created = await jira.jiraRequest('/rest/api/3/issue', {
        method: 'POST',
        body: { fields: buildTaskFields(epic.key, card) },
      });
      if (!created.key) throw new Error('Jira did not return the created Task key');
      createdKeys.push(created.key);
      cards.push({ key: created.key, summary: card.summary, labels: card.labels });
    } catch (err) {
      failures.push({ summary: card.summary, error: err.message });
    }
  }
  if (failures.length) warnings.push('Some checklist cards failed to create; see failures.');
  return {
    status: 'created',
    epic: { key: epic.key, url: `${JIRA_HOST_DEFAULT}/browse/${epic.key}`, summary: `Release ${input.product} ${input.version} ${input.release_type}` },
    feature: feature || null,
    cards,
    not_created: plan.notCreated,
    failures,
    created_keys: createdKeys,
    warnings,
    metadata: {
      product: input.product, version: input.version, branch: input.branch,
      release_type: input.release_type, advisory_type: input.advisory_type,
      component_count: components.length,
    },
  };
}

const RELEASE_LIFECYCLE_LABELS = new Set(['planned', 'ready', 'triggered', 'released', 'failed', 'skip']);
const RELEASE_STATE_PRECEDENCE = ['planned', 'triggered', 'ready', 'failed', 'released', 'skip'];
const RELEASE_INPUT_TYPES = new Set(['image-list', 'git-tag', 'commit-sha']);
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;
const STAGE_TAG_RE = /-\d+$/;

function releaseState(labels = []) {
  const present = new Set(labels);
  return RELEASE_STATE_PRECEDENCE.find(label => present.has(label)) || null;
}

function labelsForState(labels, state) {
  return [...new Set(labels.filter(label => !RELEASE_LIFECYCLE_LABELS.has(label)).concat(state))];
}

function adfTextContent(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(adfTextContent).join('');
}

function walkAdfNodes(node, type, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (node.type === type) result.push(node);
  for (const child of node.content || []) walkAdfNodes(child, type, result);
  return result;
}

function firstYamlBlock(description) {
  return walkAdfNodes(description, 'codeBlock').find(block => (
    ['yaml', 'yml', ''].includes(String(block.attrs?.language || '').toLowerCase())
  ));
}

function parseIssueYaml(description, issueKey) {
  const block = firstYamlBlock(description);
  if (!block) throw new Error(`Task ${issueKey} has no YAML code block`);
  const parsed = yaml.load(adfTextContent(block));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Task ${issueKey} YAML is not an object`);
  }
  return parsed;
}

function parseEpicIssue(issue) {
  const fields = issue.fields || {};
  const metadata = parseIssueYaml(fields.description, issue.key);
  const table = walkAdfNodes(fields.description, 'table')[0];
  const expected = [];
  if (table) {
    const rows = walkAdfNodes(table, 'tableRow');
    const headers = walkAdfNodes(rows[0], 'tableHeader').length
      ? walkAdfNodes(rows[0], 'tableHeader')
      : walkAdfNodes(rows[0], 'tableCell');
    const headerNames = headers.map(adfTextContent).map(value => value.trim().toLowerCase());
    const index = name => headerNames.indexOf(name);
    for (const row of rows.slice(1)) {
      const cells = walkAdfNodes(row, 'tableCell').map(adfTextContent).map(value => value.trim());
      if (cells.length < 2 || !cells[0]) continue;
      expected.push({
        name: cells[index('component') >= 0 ? index('component') : 0],
        variant: cells[index('variant') >= 0 ? index('variant') : 1] || '',
        tech_preview: (cells[index('tech preview')] || '').toLowerCase() === 'yes',
        config_family: cells[index('config family')] || '—',
      });
    }
  }
  return {
    key: issue.key,
    project: String(fields.project?.key || issue.key?.split('-')[0] || RELEASE_PROJECT),
    summary: fields.summary || '',
    status: fields.status?.name || '',
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    created: fields.created || null,
    updated: fields.updated || null,
    product: String(metadata.product || ''),
    version: String(metadata.version || ''),
    branch: String(metadata.branch || ''),
    release_type: String(metadata.release_type || ''),
    advisory_type: String(metadata.advisory_type || '').toUpperCase(),
    tenant: String(metadata.tenant || ''),
    application: String(metadata.application || ''),
    expected_components: expected,
  };
}

function expectedComponentsForEpic(epic, branch) {
  const pmcComponents = branch.components || [];
  if (!epic.expected_components.length) return pmcComponents.map(component => ({ ...component }));
  const table = epic.expected_components;
  const matches = pmcComponents.filter(component => table.some(expected => (
    expected.name.toLowerCase() === component.name.toLowerCase()
      && expected.variant.toLowerCase() === component.variant.toLowerCase()
      && (expected.config_family === '—' || expected.config_family === component.config_family)
  )));
  if (!matches.length) throw new Error(`Epic ${epic.key} has no expected components configured in PMC`);
  return matches.map(component => ({ ...component }));
}

function parseReadinessCard(issue, comments = [], parent = null) {
  const fields = issue.fields || {};
  const labels = Array.isArray(fields.labels) ? fields.labels : [];
  const state = releaseState(labels);
  if (!state) return null;
  const data = parseIssueYaml(fields.description, issue.key);
  const components = Array.isArray(data.components) ? data.components.map(component => ({
    name: String(component.name || ''),
    variant: String(component.variant || ''),
    config_family: String(component.config_family || '—'),
    pullspec: component.pullspec ? String(component.pullspec) : '',
    cves: component.cves ? String(component.cves) : '',
    reason: component.reason ? String(component.reason) : '',
  })) : [];
  const detectorComments = comments
    .filter(comment => adfTextContent(comment.body).includes('readiness-detector:'))
    .sort((a, b) => String(a.created || '').localeCompare(String(b.created || '')));
  const latest = detectorComments.at(-1);
  return {
    key: issue.key,
    epic_key: parent?.key || parentKeyForChild(issue) || null,
    parent,
    summary: fields.summary || '',
    status: fields.status?.name || '',
    labels,
    state,
    target: String(data.target || ''),
    product: String(data.product || ''),
    version: String(data.version || ''),
    input_type: String(data.input_type || 'image-list'),
    input_value: data.input_value == null ? '' : String(data.input_value),
    pipeline_components: data.pipeline_components == null ? null : String(data.pipeline_components),
    cve_list: data.cve_list == null ? null : String(data.cve_list),
    user_prompt: data.user_prompt == null ? null : String(data.user_prompt),
    components,
    detector_comment: latest ? adfTextContent(latest.body) : null,
    created: fields.created || null,
    updated: fields.updated || null,
  };
}

function componentKey(component) {
  return `${component.name}\u0000${component.variant || ''}\u0000${component.config_family || '—'}`;
}

const taskComponentKey = componentKey;

function componentNameVariantKey(component) {
  return `${component.name}\u0000${component.variant || ''}`;
}

function expectedComponentMatch(component, expectedComponents) {
  if (component.config_family && component.config_family !== '—') {
    return expectedComponents.find(expected => componentKey(expected) === componentKey(component)) || null;
  }
  const matches = expectedComponents.filter(expected => componentNameVariantKey(expected) === componentNameVariantKey(component));
  return matches.length === 1 ? matches[0] : null;
}

function normalizeComponentIdentity(component, expectedComponents) {
  const expected = expectedComponentMatch(component, expectedComponents);
  return expected
    ? {
        ...component,
        name: expected.name,
        variant: expected.variant,
        config_family: expected.config_family,
        stage_repository: expected.stage_repository,
      }
    : component;
}

function normalizeCardComponents(card, expectedComponents) {
  return {
    ...card,
    components: (card.components || []).map(component => normalizeComponentIdentity(component, expectedComponents)),
  };
}

function canonicalComponentToken(component, expectedComponents) {
  const base = component.variant || component.name;
  const duplicate = expectedComponents.filter(item => (item.variant || item.name).toLowerCase() === base.toLowerCase()).length > 1;
  return duplicate ? `${base}:${component.config_family || '—'}` : base;
}

function canonicalComponentTokens(expectedComponents) {
  return [...new Set(expectedComponents.flatMap(component => [component.name, component.variant]
    .filter(Boolean)
    .map(base => {
      const duplicate = expectedComponents.filter(item => (item.variant || item.name).toLowerCase() === base.toLowerCase()).length > 1;
      return duplicate ? `${base}:${component.config_family || '—'}` : base;
    })))];
}

function variantsSummary(components) {
  return [...new Set(components.map(component => canonicalComponentToken(component, components)))].join(', ');
}

function triggerSummary(input, target, components) {
  return `Release ${input.product} ${input.version} (${target}): ${variantsSummary(components)}`;
}

function triggerAdf(input, target, action, components, inputType, inputValue, options = {}) {
  const lines = [
    `product: ${input.product}`,
    `version: ${input.version}`,
    `target: ${target}`,
  ];
  if (inputType) lines.push(`input_type: ${inputType}`);
  if (inputValue) lines.push(`input_value: ${JSON.stringify(inputValue)}`);
  if (options.pipelineComponents) lines.push(`pipeline_components: ${JSON.stringify(options.pipelineComponents)}`);
  if (options.cveList) lines.push(`cve_list: ${JSON.stringify(options.cveList)}`);
  if (options.userPrompt) lines.push(`user_prompt: ${JSON.stringify(options.userPrompt)}`);
  lines.push('components:');
  for (const component of components) {
    lines.push(`  - name: ${component.name}`, `    variant: ${JSON.stringify(component.variant || '')}`);
    if (component.config_family && component.config_family !== '—') lines.push(`    config_family: ${JSON.stringify(component.config_family)}`);
    if (inputType === 'image-list' && component.pullspec) lines.push(`    pullspec: ${JSON.stringify(component.pullspec)}`);
    if (component.cves) lines.push(`    cves: ${JSON.stringify(component.cves)}`);
    if (action === 'skip') lines.push(`    reason: ${JSON.stringify(component.reason || 'Excluded from this release')}`);
  }
  const tableHeaders = action === 'skip'
    ? ['Component', 'Variant', 'Reason']
    : inputType === 'image-list' && components.some(component => component.pullspec)
      ? ['Component', 'Variant', 'Pullspec', ...(components.some(component => component.cves) ? ['CVEs'] : [])]
      : ['Component', 'Variant', ...(components.some(component => component.cves) ? ['CVEs'] : [])];
  const rows = [
    tableHeaders.map(value => ({ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] })),
    ...components.map(component => {
      const values = action === 'skip'
        ? [component.name, component.variant || '', component.reason || 'Excluded from this release']
        : [component.name, component.variant || '']
          .concat(inputType === 'image-list' && components.some(item => item.pullspec) ? [component.pullspec || ''] : [])
          .concat(components.some(item => item.cves) ? [component.cves || ''] : []);
      return values.map(tableCell);
    }),
  ].map(content => ({ type: 'tableRow', content }));
  const content = [
    { type: 'codeBlock', attrs: { language: 'yaml' }, content: [{ type: 'text', text: lines.join('\n') }] },
    { type: 'table', content: rows },
  ];
  return { version: 1, type: 'doc', content };
}

function triggerDecision(body, type, action) {
  const decision = body.decision && typeof body.decision === 'object' ? body.decision : {};
  if (decision.type === type && (!decision.action || decision.action === action)) return decision;
  return {};
}

function triggerError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertTriggerInputType(inputType, inputValue) {
  if (!RELEASE_INPUT_TYPES.has(inputType)) throw new Error('input_type must be image-list, git-tag, or commit-sha');
  if (inputType === 'git-tag' && (!inputValue || /\s/.test(inputValue))) throw new Error('git-tag requires a non-empty tag without whitespace');
  if (inputType === 'commit-sha' && !/^[0-9a-f]{7,64}$/i.test(inputValue || '')) throw new Error('commit-sha must be a hexadecimal SHA prefix of 7 to 64 characters');
}

function parseCves(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  const cves = [...new Set(values.map(item => String(item).trim().toUpperCase()).filter(Boolean))];
  const invalid = cves.filter(cve => !CVE_RE.test(cve));
  if (invalid.length) throw new Error(`Invalid CVE(s): ${invalid.join(', ')}. Use CVE-YYYY-NNNN+.`);
  return cves.join(',');
}

function repositoryAndReference(pullspec) {
  const value = String(pullspec || '').trim();
  if (value.includes('@')) {
    const [repository, reference] = value.split('@', 2);
    return { repository, reference, digest: true };
  }
  const slash = value.lastIndexOf('/');
  const colon = value.lastIndexOf(':');
  if (colon <= slash) return { repository: value, reference: '', digest: false };
  return { repository: value.slice(0, colon), reference: value.slice(colon + 1), digest: false };
}

function validateStagePullspec(component, pullspec, version) {
  const expected = String(component.stage_repository || '').replace(/\/$/, '');
  const parsed = repositoryAndReference(pullspec);
  if (!expected) throw new Error(`PMC has no stage_repository for component ${component.name}`);
  if (parsed.repository !== expected) {
    throw new Error(`${component.name} pullspec must use PMC stage repository ${expected}; client-supplied repositories are not accepted`);
  }
  if (parsed.digest) {
    if (!/^sha256:[0-9a-f]{64}$/i.test(parsed.reference)) {
      throw new Error(`${component.name} pullspec digest must be @sha256:<64 hex characters>`);
    }
    return;
  }
  if (!parsed.reference || parsed.reference === version || !parsed.reference.startsWith(`${version}-`) || !STAGE_TAG_RE.test(parsed.reference)) {
    throw new Error(`${component.name} pullspec must use ${expected}:${version}-<timestamp> or ${expected}@sha256:<64 hex digest>`);
  }
  if (parsed.repository === 'quay.io/redhat-user-workloads' || parsed.repository.startsWith('quay.io/redhat-user-workloads/')) {
    throw new Error(`${component.name} pullspec cannot use quay.io/redhat-user-workloads`);
  }
}

function normalizeTriggerComponents(bodyComponents) {
  if (!Array.isArray(bodyComponents) || bodyComponents.length === 0) throw new Error('At least one component must be selected');
  return bodyComponents.map(component => ({
    name: String(component?.name || '').trim(),
    variant: String(component?.variant || '').trim(),
    config_family: String(component?.config_family || component?.configFamily || '—').trim(),
    pullspec: String(component?.pullspec || '').trim(),
    cves: component?.cves,
    reason: String(component?.reason || '').trim(),
  }));
}

function componentMatchesToken(expectedComponents, token) {
  const normalized = String(token || '').trim().toLowerCase();
  const separator = normalized.includes(':') ? ':' : normalized.includes('/') ? '/' : null;
  if (separator) {
    const [base, family] = normalized.split(separator, 2);
    return expectedComponents.filter(component => (
      componentTokenAliases(component).some(alias => alias === base || alias.startsWith(`${base}-`))
      && (component.config_family || '—').toLowerCase() === family
    ));
  }
  return expectedComponents.filter(component => componentTokenAliases(component)
    .some(alias => alias === normalized || alias.startsWith(`${normalized}-`)));
}

function componentTokenAliases(component) {
  const name = component.name.toLowerCase();
  const shortName = name
    .replace(/^(?:rhaiis|rhelai)-/, '')
    .replace(/-(?:ubi9|rhel9)$/, '');
  return [...new Set([name, shortName, String(component.variant || '').toLowerCase()].filter(Boolean))];
}

function resolveCardComponentTokens(expectedComponents, value) {
  const tokens = String(value || '').split(/[\s,]+/).map(token => token.trim()).filter(Boolean);
  if (tokens.some(token => token.toLowerCase() === 'all')) {
    if (tokens.length !== 1) throw new Error('components cannot combine all with other component names');
    return expectedComponents.map(component => ({ ...component }));
  }
  const result = [];
  const seen = new Set();
  for (const token of tokens) {
    const matches = componentMatchesToken(expectedComponents, token);
    if (!matches.length) throw new Error(`Unknown components name or variant: ${token}`);
    const families = new Set(matches.map(component => component.config_family || '—'));
    if (families.size > 1) throw new Error(`Component name or variant is ambiguous: ${token}; specify the config family`);
    for (const component of matches) {
      const key = taskComponentKey(component);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...component });
    }
  }
  return result;
}

function resolveComponentTokens(expectedComponents, value, label) {
  const tokens = String(value || '').split(/[\s,]+/).map(token => token.trim()).filter(Boolean);
  if (tokens.some(token => token.toLowerCase() === 'all')) {
    if (tokens.length !== 1) throw new Error(`${label} cannot combine all with other component names`);
    return expectedComponents.map(component => ({ ...component }));
  }
  const result = [];
  const seen = new Set();
  for (const token of tokens) {
    const matches = componentMatchesToken(expectedComponents, token);
    if (!matches.length) throw new Error(`Unknown ${label} component or variant: ${token}`);
    const families = new Set(matches.map(component => component.config_family || '—'));
    if (families.size > 1) throw new Error(`${label} component or variant is ambiguous: ${token}`);
    for (const component of matches) {
      const key = taskComponentKey(component);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...component });
    }
  }
  return result;
}

function parseImageListInput(value, readyComponents) {
  const lines = String(value || '').split(/[\r\n,]+/).map(line => line.trim()).filter(Boolean);
  const pullspecs = new Map();
  for (const line of lines) {
    let token;
    let pullspec;
    if (line.includes('=')) {
      [token, pullspec] = line.split('=', 2).map(part => part.trim());
      if (!token || !pullspec) throw new Error('image-list input_value lines must use component=pullspec');
      const matches = componentMatchesToken(readyComponents, token);
      if (!matches.length) throw new Error(`image-list input_value names a component that is not ready: ${token}`);
      if (matches.length > 1) throw new Error(`image-list input_value component is ambiguous: ${token}`);
      token = taskComponentKey(matches[0]);
    } else {
      const parsed = repositoryAndReference(line);
      const matches = readyComponents.filter(component => (
        component.stage_repository && component.stage_repository.replace(/\/$/, '') === parsed.repository
      ));
      if (matches.length !== 1) {
        if (readyComponents.length !== 1) throw new Error('A raw image-list pullspec is accepted only when it maps unambiguously to one ready component');
        [token] = readyComponents;
      } else {
        [token] = matches;
      }
      pullspec = line;
      token = taskComponentKey(token);
    }
    if (pullspecs.has(token)) throw new Error('image-list input_value names a component more than once');
    pullspecs.set(token, pullspec);
  }
  return pullspecs;
}

function freeFormTriggerComponents(epic, branch, body) {
  const expected = expectedComponentsForEpic(epic, branch);
  const ready = resolveComponentTokens(expected, body.ready_components, 'ready');
  const skipped = String(body.skipped_components || '').trim()
    ? resolveComponentTokens(expected, body.skipped_components, 'skipped')
    : expected.filter(component => !ready.some(item => taskComponentKey(item) === taskComponentKey(component)));
  const readyKeys = new Set(ready.map(taskComponentKey));
  const overlap = skipped.filter(component => readyKeys.has(taskComponentKey(component)));
  if (overlap.length) throw new Error(`Components cannot be both ready and skipped: ${overlap.map(component => component.name).join(', ')}`);
  if (!ready.length && !skipped.length) throw new Error('At least one ready or skipped component is required');

  const inputType = String(body.input_type || body.inputType || 'image-list').trim();
  const inputValue = String(body.input_value || body.inputValue || '').trim();
  if (ready.length) assertTriggerInputType(inputType, inputValue);
  else if (!RELEASE_INPUT_TYPES.has(inputType)) throw new Error('input_type must be image-list, git-tag, or commit-sha');
  const pullspecs = inputType === 'image-list' ? parseImageListInput(inputValue, ready) : new Map();
  const cves = body.cve_list == null ? '' : parseCves(body.cve_list);
  const skipComponents = skipped.map(component => ({ ...component, action: 'skip', reason: 'Excluded from this release' }));
  const readyComponents = ready.map(component => ({
    ...component,
    action: 'ready',
    pullspec: pullspecs.get(taskComponentKey(component)) || '',
    cves,
  }));
  return { inputType, inputValue, components: skipComponents.concat(readyComponents) };
}

function mergeTaskComponents(current, requested, expectedByKey) {
  return requested.map(component => {
    const currentComponent = current.find(item => taskComponentKey(item) === taskComponentKey(component));
    const expected = expectedByKey.get(componentKey(component)) || expectedByKey.get(`${component.name}\u0000${component.variant}\u0000`);
    return {
      name: component.name,
      variant: component.variant || expected?.variant || currentComponent?.variant || '',
      config_family: component.config_family || expected?.config_family || currentComponent?.config_family || '—',
      stage_repository: expected?.stage_repository || currentComponent?.stage_repository || component.stage_repository || '',
      pullspec: component.pullspec || currentComponent?.pullspec || '',
      cves: component.cves == null || component.cves === '' ? (currentComponent?.cves || '') : parseCves(component.cves),
      reason: component.reason || currentComponent?.reason || '',
    };
  });
}

function validateReadyComponentList(input, components, expectedComponents, inputType) {
  for (const component of components) {
    if (component.cves) component.cves = parseCves(component.cves);
  }
  if (inputType === 'image-list') {
    const missing = components.filter(component => !component.pullspec).map(component => component.name);
    if (missing.length) throw new Error(`Ready image-list requires a pullspec for every selected component; missing: ${missing.join(', ')}`);
    for (const component of components) {
      const expected = expectedComponents.find(item => taskComponentKey(item) === taskComponentKey(component));
      if (!expected) throw new Error(`Component ${component.name} is no longer an expected component on the selected epic`);
      validateStagePullspec(expected, component.pullspec, input.version);
    }
  }
  if (input.advisory_type === 'RHSA') {
    const missing = components.filter(component => !component.cves).map(component => component.name);
    if (missing.length) throw new Error(`RHSA readiness requires CVEs for every selected component; missing: ${missing.join(', ')}`);
  }
}

function validateTriggerComponents(input, metadata, requested, currentCards, action, inputType) {
  const expectedByKey = new Map(metadata.expected_components.map(component => [componentKey(component), component]));
  const seen = new Set();
  const validated = [];
  for (const component of requested) {
    const expected = expectedComponentMatch(component, metadata.expected_components);
    if (!expected) throw new Error(`Component ${component.name} (${component.variant}) is not an unambiguous expected component on the selected epic`);
    const key = taskComponentKey(expected);
    if (seen.has(key)) throw new Error(`Component ${component.name} is selected more than once`);
    seen.add(key);
    const value = {
      ...component,
      name: expected.name,
      variant: expected.variant,
      config_family: expected.config_family,
      cves: component.cves ? parseCves(component.cves) : '',
    };
    if (inputType !== 'image-list' && action !== 'skip' && value.pullspec) {
      throw new Error(`${value.name} cannot carry a pullspec with ${inputType}; use image-list or remove the pullspec`);
    }
    if (action === 'skip' && value.pullspec) {
      throw new Error(`${value.name} cannot carry a pullspec when skipped`);
    }
    if (inputType === 'image-list' && value.pullspec && (action === 'ready' || action === 'planned')) {
      validateStagePullspec({ ...expected, stage_repository: expected.stage_repository }, value.pullspec, input.version);
    }
    validated.push({ value, expected });
  }
  if (action === 'ready' && inputType === 'image-list') {
    const missing = validated.filter(({ value }) => !value.pullspec).map(({ value }) => value.name);
    if (missing.length) throw new Error(`Ready image-list requires a pullspec for every selected component; missing: ${missing.join(', ')}`);
  }
  if (input.advisory_type === 'RHSA' && action === 'ready') {
    const missing = validated.filter(({ value }) => !value.cves).map(({ value }) => value.name);
    if (missing.length) throw new Error(`RHSA readiness requires CVEs for every selected component; missing: ${missing.join(', ')}`);
  }
  if (action === 'skip') {
    for (const { value } of validated) value.reason = value.reason || 'Excluded from this release';
  }
  return { components: validated.map(({ value }) => value), expectedByKey };
}

function childTaskJql(epicKey) {
  return `project in (AIPCC, RHAI) AND issuetype = Task AND (parent = ${epicKey} OR "Epic Link" = ${epicKey})`;
}

function bulkChildTaskJql(epicKeys) {
  const keys = epicKeys.join(', ');
  return `project in (AIPCC, RHAI) AND issuetype = Task AND status != Closed AND (parent in (${keys}) OR "Epic Link" in (${keys}))`;
}

function parentKeyForChild(issue) {
  const fields = issue.fields || {};
  const parent = fields.parent?.key || fields['Epic Link'] || fields.customfield_10014;
  return typeof parent === 'object' ? parent.key : parent;
}

async function getIssueComments(jira, key) {
  const result = await jira.jiraRequest(`/rest/api/3/issue/${encodeURIComponent(key)}/comment?maxResults=100`);
  return Array.isArray(result?.comments) ? result.comments : [];
}

async function readTriggerEpic(jira, issue) {
  const children = await jira.fetchAllJqlResults(childTaskJql(issue.key), 'key,summary,status,labels,description,parent,customfield_10014,created,updated', { maxResults: 100 });
  const cards = [];
  for (const child of children) {
    const labels = child.fields?.labels || [];
    if (!labels.some(label => RELEASE_LIFECYCLE_LABELS.has(label))) continue;
    let comments = [];
    try {
      comments = releaseState(labels) === 'failed' ? await getIssueComments(jira, child.key) : [];
      const card = parseReadinessCard(child, comments);
      if (card) cards.push(card);
    } catch (error) {
      const detectorComments = comments
        .filter(comment => adfTextContent(comment.body).includes('readiness-detector:'))
        .sort((a, b) => String(a.created || '').localeCompare(String(b.created || '')));
      cards.push({
        key: child.key,
        summary: child.fields?.summary || '',
        labels,
        state: releaseState(labels),
        components: [],
        detector_comment: detectorComments.at(-1) ? adfTextContent(detectorComments.at(-1).body) : null,
        parse_error: error.message,
      });
    }
  }
  return cards;
}

async function loadTriggerOptions(jira, context, req, deps = {}) {
  const kerberosId = callerKerberosId(req);
  const cacheKey = `trigger:${kerberosId}`;
  const cached = triggerOptionsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const issues = await jira.fetchAllJqlResults(
    'project in (AIPCC, RHAI) AND issuetype = Epic AND labels = release-automation AND status != Closed',
    'key,summary,status,labels,description,created,updated',
    { maxResults: 200 },
  );
  const parsed = issues.map(issue => {
    try {
      return { issue, epic: parseEpicIssue(issue) };
    } catch (error) {
      console.warn(`[release-trigger] Ignoring malformed epic ${issue.key}: ${error.message}`);
      return null;
    }
  }).filter(item => item && PRODUCTS.includes(item.epic.product) && item.epic.branch && item.epic.version);
  const client = gitlabFor(context, deps);
  const ref = pmcRef(context);
  const products = [...new Set(parsed.map(({ epic }) => epic.product))];
  const owners = await client.selective(ref, ['owners-groups.yaml', ...products.map(product => `${product}/owners.yaml`)]);
  const pmc = { sha: owners.sha, ref, files: owners.files };
  const epics = [];
  for (const { issue, epic } of parsed) {
    try {
      assertAuthorized(pmc.files, epic.product, kerberosId);
      epics.push({
        key: epic.key,
        project: epic.project,
        summary: epic.summary,
        status: epic.status,
        labels: epic.labels,
         product: epic.product,
         application: epic.product,
         version: epic.version,
        branch: epic.branch,
        release_type: epic.release_type,
        advisory_type: epic.advisory_type,
        expected_components: [],
        component_names: [],
        targets: [],
        updated: epic.updated,
      });
    } catch (error) {
      console.warn(`[release-trigger] Ignoring malformed epic ${issue.key}: ${error.message}`);
    }
  }
  const parentByKey = new Map(epics.map(epic => [epic.key, epic]));
  const cards = [];
  if (epics.length) {
    const children = await jira.fetchAllJqlResults(
      bulkChildTaskJql(epics.map(epic => epic.key)),
      'key,summary,status,labels,description,parent,customfield_10014,created,updated',
      { maxResults: 200 },
    );
    for (const child of children) {
      const parentKey = parentKeyForChild(child);
      const parent = parentByKey.get(parentKey);
      if (!parent) continue;
      const state = releaseState(child.fields?.labels || []);
      if (!['planned', 'failed'].includes(state)) continue;
      try {
        const card = parseReadinessCard(child, [], parent);
        if (card) cards.push(card);
      } catch (error) {
        console.warn(`[release-trigger] Ignoring malformed readiness card ${child.key}: ${error.message}`);
      }
    }
  }
  const value = { sha: pmc.sha, ref: pmc.ref, epics, cards };
  triggerOptionsCache.set(cacheKey, { value, expiresAt: Date.now() + TRIGGER_OPTIONS_CACHE_TTL });
  return value;
}

function invalidateTriggerOptionsCache() {
  triggerOptionsCache.clear();
}

function currentCardsForTarget(cards, target) {
  return cards.filter(card => card.target === target && !card.parse_error);
}

function cardComponentKeys(card) {
  return new Set((card.components || []).map(taskComponentKey));
}

function componentValuesForCard(card) {
  return (card.components || []).map(component => ({ ...component }));
}

function cardCandidate(card, selectedKeys) {
  return [...cardComponentKeys(card)].some(key => selectedKeys.has(key));
}

function decisionForCandidates(candidates, action) {
  return triggerError('More than one readiness card matches the selected components; choose one before continuing.', 'multiple-candidates', {
    decisions: {
      type: 'candidate',
      action,
      candidates: candidates.map(card => ({
        key: card.key,
        summary: card.summary,
        state: card.state,
        target: card.target,
        input_type: card.input_type,
        input_value: card.input_value,
        components: card.components,
      })),
    },
  });
}

async function mutateSingleTriggerRelease(jira, pmc, epicIssue, body) {
  const epic = parseEpicIssue(epicIssue);
  const branch = resolveBranch(pmc.products, epic.product, epic.branch);
  epic.expected_components = expectedComponentsForEpic(epic, branch);
  const version = resolveVersion(branch, epic.version);
  if (!version) throw new Error(`Epic version ${epic.version} is no longer configured for ${epic.product}/${epic.branch}`);
  const input = {
    product: epic.product,
    version,
    branch: branch.branch,
    release_type: epic.release_type,
    advisory_type: epic.advisory_type,
    metadata: branch,
  };
  const allCards = (await readTriggerEpic(jira, epicIssue)).map(card => normalizeCardComponents(card, epic.expected_components));
  const cardKey = String(body.card_key || '').trim().toUpperCase();
  const selectedCard = cardKey ? allCards.find(card => card.key === cardKey) : null;
  if (cardKey && !selectedCard) throw new Error(`Selected readiness card ${cardKey} is not a child of ${epic.key}`);
  if (selectedCard && !['planned', 'failed'].includes(selectedCard.state)) {
    throw new Error(`Readiness card ${selectedCard.key} is not available for triggering`);
  }
  const cardTarget = selectedCard?.target || '';
  if (selectedCard && !['stage-rc', 'prod'].includes(cardTarget)) {
    throw new Error(`Readiness card ${selectedCard.key} has no valid target`);
  }
  const requestedTarget = String(body.target || '').trim();
  if (cardTarget && requestedTarget && cardTarget !== requestedTarget) {
    throw new Error(`Selected readiness card ${selectedCard.key} targets ${cardTarget}; target confirmation does not match`);
  }
  const target = selectedCard ? cardTarget : requestedTarget;
  const action = String(body.action || (selectedCard ? 'ready' : 'planned')).trim().toLowerCase();
  if (!['stage-rc', 'prod'].includes(target)) throw new Error('target must be stage-rc or prod');
  if (!['planned', 'ready', 'skip'].includes(action)) throw new Error('action must be planned, ready, or skip');
  if (!branch.release_plans.some(plan => target === 'prod' ? /-prod$/.test(plan) : /-(?:stage|stage-rc)$/.test(plan))) {
    throw new Error(`${epic.product}/${branch.branch} has no ${target} release plan`);
  }
  const inputType = String(body.input_type || body.inputType || 'image-list').trim();
  const inputValue = String(body.input_value || body.inputValue || '').trim();
  const cardComponents = selectedCard ? componentValuesForCard(selectedCard) : [];
  const threeWayReady = Boolean(selectedCard && action === 'ready'
    && Object.prototype.hasOwnProperty.call(body, 'skipped_components'));
  if (threeWayReady && !RELEASE_INPUT_TYPES.has(inputType)) {
    throw new Error('input_type must be image-list, git-tag, or commit-sha');
  }
  if (!threeWayReady) assertTriggerInputType(inputType, inputValue);
  let requested;
  const pipelineComponents = body.pipeline_components != null
    ? String(body.pipeline_components)
    : typeof body.components === 'string' ? body.components : (selectedCard?.pipeline_components || '');
  if (Array.isArray(body.components)) {
    requested = normalizeTriggerComponents(body.components)
      .map(component => normalizeComponentIdentity(component, epic.expected_components));
    if (selectedCard) {
      const selectedCardKeys = cardComponentKeys(selectedCard);
      const outsideCard = requested.filter(component => !selectedCardKeys.has(taskComponentKey(component)));
      if (outsideCard.length) {
        throw new Error(`Component(s) ${outsideCard.map(component => component.name).join(', ')} are not on selected readiness card ${selectedCard.key}`);
      }
    }
  } else if (selectedCard) {
    const componentInput = threeWayReady && typeof body.components === 'string' && !body.components.trim()
      ? ''
      : pipelineComponents || 'all';
    requested = componentInput
      ? resolveCardComponentTokens(cardComponents, componentInput).map(component => ({ ...component, action }))
      : [];
  } else if (pipelineComponents.trim()) {
    requested = resolveCardComponentTokens(epic.expected_components, pipelineComponents)
      .map(component => ({ ...component, action }));
  } else {
    throw new Error('components is required');
  }
  requested = requested.map(component => {
    const expected = expectedComponentMatch(component, epic.expected_components);
    return { ...(expected || {}), ...component };
  });
  if (!requested.length && !threeWayReady) throw new Error('The selected readiness card has no internal components to trigger');
  if (requested.length) assertTriggerInputType(inputType, inputValue);
  if (inputType === 'image-list' && !Array.isArray(body.components) && requested.length && inputValue) {
    const pullspecs = parseImageListInput(inputValue, requested);
    requested = requested.map(component => ({
      ...component,
      pullspec: pullspecs.get(taskComponentKey(component)) || component.pullspec || '',
    }));
  }
  const sharedCves = body.cve_list == null
    ? (selectedCard?.cve_list ? parseCves(selectedCard.cve_list) : '')
    : parseCves(body.cve_list);
  if (requested.length && !sharedCves && input.advisory_type === 'RHSA') throw new Error('cve_list is required for RHSA releases');
  if (sharedCves && input.advisory_type !== 'RHSA') throw new Error('cve_list is only valid for RHSA releases');
  for (const component of requested) {
    if ((component.cves == null || component.cves === '') && sharedCves) component.cves = sharedCves;
  }
  const { components: validated, expectedByKey } = validateTriggerComponents(input, epic, requested, [], action, inputType);
  let skippedRequested = [];
  if (threeWayReady) {
    const skippedInput = String(body.skipped_components || '').trim();
    skippedRequested = skippedInput ? resolveCardComponentTokens(cardComponents, skippedInput) : [];
    const readyKeys = new Set(validated.map(taskComponentKey));
    const overlap = skippedRequested.filter(component => readyKeys.has(taskComponentKey(component)));
    if (overlap.length) {
      throw new Error(`Components cannot be both ready and skipped: ${overlap.map(component => component.name).join(', ')}`);
    }
  }
  const cards = currentCardsForTarget(allCards, target);
  if (allCards.some(card => card.parse_error && releaseState(card.labels)
    && (!card.target || card.target === target))) {
    throw new Error('A readiness card for this target has invalid YAML. Fix it in Jira before changing release readiness.');
  }
  const selectedKeys = new Set(validated.map(taskComponentKey));
  const mutable = selectedCard
    ? [selectedCard]
    : cards.filter(card => ['planned', 'failed'].includes(card.state) && cardCandidate(card, selectedKeys));
  if (mutable.length > 1 && !triggerDecision(body, 'candidate', action).task_key) throw decisionForCandidates(mutable, action);
  let candidate = selectedCard || mutable[0] || null;
  const chosenKey = triggerDecision(body, 'candidate', action).task_key;
  if (chosenKey) {
    candidate = mutable.find(card => card.key === chosenKey);
    if (!candidate) throw new Error(`Selected readiness card ${chosenKey} is not a valid candidate`);
    const overlappingCandidates = mutable.filter(card => card.key !== chosenKey && cardCandidate(card, selectedKeys));
    if (overlappingCandidates.length) {
      throw triggerError(
        'The selected readiness card still shares components with another open card. Resolve the overlap in Jira before continuing.',
        'overlapping-candidates',
        { decisions: { type: 'blocked-candidates', action, candidates: mutable.map(card => ({ key: card.key, summary: card.summary, state: card.state, components: card.components })) } },
      );
    }
  }
  const otherCards = cards.filter(card => !candidate || card.key !== candidate.key);
  const occupied = new Map();
  for (const card of otherCards) for (const component of card.components || []) {
    const key = taskComponentKey(component);
    if (!occupied.has(key)) occupied.set(key, []);
    occupied.get(key).push(card);
  }
  const duplicateComponents = threeWayReady ? validated.concat(skippedRequested) : validated;
  const duplicateCards = duplicateComponents.flatMap(component => occupied.get(taskComponentKey(component)) || []);
  const duplicateStates = [...new Map(duplicateCards.map(card => [card.key, card])).values()];
  const skippedDuplicateCards = skippedRequested.flatMap(component => occupied.get(taskComponentKey(component)) || []);
  const skippedDuplicateStates = [...new Map(skippedDuplicateCards.map(card => [card.key, card])).values()];
  const alreadySkipped = duplicateStates.filter(card => card.state === 'skip');
  if (threeWayReady && skippedDuplicateStates.some(card => card.state === 'skip')) {
    const skipCards = skippedDuplicateStates.filter(card => card.state === 'skip');
    throw triggerError(`Cannot skip components already recorded on skip card(s): ${skipCards.map(card => card.key).join(', ')}`, 'skip-duplicate', {
      decisions: { type: 'skip-duplicate', action, cards: skipCards.map(card => ({ key: card.key, summary: card.summary, components: card.components })) },
    });
  }
  if (action === 'skip' && alreadySkipped.length && candidate) {
    throw triggerError(`Cannot skip components already recorded on skip card(s): ${alreadySkipped.map(card => card.key).join(', ')}`, 'skip-duplicate', {
      decisions: { type: 'skip-duplicate', action, cards: alreadySkipped.map(card => ({ key: card.key, summary: card.summary, components: card.components })) },
    });
  }
  if (action === 'skip' && alreadySkipped.length && !candidate) {
    return { status: 'unchanged', action, epic_key: epic.key, tasks: alreadySkipped.map(card => ({ key: card.key, operation: 'unchanged', state: card.state })), pmc_sha: pmc.sha };
  }
  const dangerous = duplicateStates.filter(card => ['ready', 'released'].includes(card.state)
    || (action !== 'skip' && card.state === 'skip'));
  const triggered = duplicateStates.filter(card => card.state === 'triggered');
  if (triggered.length) {
    throw triggerError(`Cannot change components already on triggered card(s): ${triggered.map(card => card.key).join(', ')}`, 'triggered-duplicate', {
      decisions: { type: 'triggered', action, cards: triggered.map(card => ({ key: card.key, summary: card.summary, components: card.components })) },
    });
  }
  if (dangerous.length && !triggerDecision(body, 'duplicate', action).confirm) {
    throw triggerError('Some selected components already have an active or completed readiness card; confirm before creating another card.', 'dangerous-duplicate', {
      decisions: { type: 'duplicate', action, cards: dangerous.map(card => ({ key: card.key, state: card.state, summary: card.summary, components: card.components })), requires_confirmation: true },
    });
  }
  if (action === 'ready' && candidate?.state === 'failed' && !triggerDecision(body, 'failed-retry', action).confirm) {
    throw triggerError(`Readiness card ${candidate.key} failed. Confirm that the reported cause has been addressed before retrying.`, 'failed-retry', {
      decisions: { type: 'failed-retry', action, task: { key: candidate.key, summary: candidate.summary, comment: candidate.detector_comment || 'No readiness-detector comment was found.' }, requires_confirmation: true },
    });
  }

  const current = candidate ? componentValuesForCard(candidate) : [];
  const merged = mergeTaskComponents(current, validated, expectedByKey);
  const existingType = candidate?.input_type || 'image-list';
  const existingValue = candidate?.input_value || '';
  const requestedInput = body.input_type == null && candidate ? existingType : inputType;
  const requestedValue = body.input_type == null && candidate ? existingValue : inputValue;
  if (candidate && merged.length && requestedInput !== existingType && current.some(component => component.pullspec) && !triggerDecision(body, 'input-conversion', action).confirm) {
    throw triggerError(`Changing ${candidate.key} from ${existingType} to ${requestedInput} would discard recorded pullspecs. Confirm the conversion.`, 'input-conversion', {
      decisions: { type: 'input-conversion', action, task: candidate.key, from: existingType, to: requestedInput, requires_confirmation: true },
    });
  }
  if (merged.length) assertTriggerInputType(requestedInput, requestedValue);
  const prompt = body.user_prompt == null
    ? (selectedCard?.user_prompt || '')
    : String(body.user_prompt);
  const cardOptions = { pipelineComponents, cveList: sharedCves, userPrompt: prompt };
  if (requestedInput !== 'image-list') for (const component of merged) component.pullspec = '';
  if (requestedInput === 'image-list' && merged.length) {
    const pullspecs = parseImageListInput(requestedValue, merged);
    for (const component of merged) component.pullspec = pullspecs.get(taskComponentKey(component)) || component.pullspec || '';
  }
  if (action === 'ready') validateReadyComponentList(input, merged, [...expectedByKey.values()], requestedInput);

  const createdKeys = [];
  const write = async (card, nextAction, nextComponents, nextInputType, nextInputValue, summaryOverride, optionsOverride = cardOptions) => {
    const labels = labelsForState(card?.labels || [], nextAction);
    const fields = {
      labels,
      description: triggerAdf(input, target, nextAction, nextComponents, nextInputType, nextInputValue, optionsOverride),
    };
    if (summaryOverride) fields.summary = summaryOverride;
    if (!card) {
      let created;
      try {
        created = await jira.jiraRequest('/rest/api/3/issue', { method: 'POST', body: { fields: {
            ...fields,
            project: { key: epic.project || RELEASE_PROJECT },
            summary: summaryOverride || triggerSummary(input, target, nextComponents),
            issuetype: { name: 'Task' },
            parent: { key: epic.key },
            ...(epic.project === 'AIPCC' ? { components: [{ name: 'AIPCC Productization' }] } : {}),
            assignee: null,
            security: { name: 'Red Hat Employee' },
          } } });
      } catch (error) {
        error.createdKeys = createdKeys;
        throw error;
      }
      if (!created.key) throw new Error('Jira did not return the created readiness Task key');
      createdKeys.push(created.key);
      return { key: created.key, operation: 'created', state: nextAction, components: nextComponents };
    }
    try {
      await jira.jiraRequest(`/rest/api/3/issue/${encodeURIComponent(card.key)}`, { method: 'PUT', body: { fields } });
    } catch (error) {
      error.createdKeys = createdKeys;
      throw error;
    }
    return { key: card.key, operation: 'updated', state: nextAction, components: nextComponents };
  };

  if (action === 'planned') {
    if (candidate) {
      const finalComponents = merged;
      const result = await write(candidate, candidate.state, finalComponents, requestedInput, requestedValue,
        triggerSummary(input, target, finalComponents));
      return { status: 'updated', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
    }
    const result = await write(null, 'planned', merged, requestedInput, requestedValue);
    return { status: 'created', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
  }

  if (threeWayReady) {
    const readyKeys = new Set(validated.map(taskComponentKey));
    const skippedKeys = new Set(skippedRequested.map(taskComponentKey));
    const planned = current.filter(component => !readyKeys.has(taskComponentKey(component)) && !skippedKeys.has(taskComponentKey(component)));
    const skipped = current
      .filter(component => skippedKeys.has(taskComponentKey(component)))
      .map(component => ({ ...component, action: 'skip', pullspec: '', cves: '', reason: 'Excluded from this release' }));
    const plannedOptions = {
      pipelineComponents: candidate.pipeline_components || '',
      cveList: candidate.cve_list || '',
      userPrompt: candidate.user_prompt || '',
    };
    const tasks = [];
    if (planned.length) {
      tasks.push(await write(candidate, 'planned', planned, existingType, existingValue,
        triggerSummary(input, target, planned), plannedOptions));
    } else if (merged.length) {
      validateReadyComponentList(input, merged, [...expectedByKey.values()], requestedInput);
      tasks.push(await write(candidate, 'ready', merged, requestedInput, requestedValue,
        merged.length === current.length ? undefined : triggerSummary(input, target, merged)));
    } else {
      tasks.push(await write(candidate, 'skip', skipped, 'image-list', '', candidate.summary, {}));
    }
    if (planned.length && merged.length) {
      validateReadyComponentList(input, merged, [...expectedByKey.values()], requestedInput);
      tasks.push(await write(null, 'ready', merged, requestedInput, requestedValue, undefined, cardOptions));
    }
    if (skipped.length && (planned.length || merged.length)) {
      tasks.push(await write(null, 'skip', skipped, 'image-list', '', undefined, {}));
    }
    return {
      status: planned.length || skipped.length ? 'split' : 'updated',
      action,
      epic_key: epic.key,
      tasks,
      pmc_sha: pmc.sha,
    };
  }

  if (action === 'skip') {
    if (candidate) {
      const currentKeys = cardComponentKeys(candidate);
      const selectedOnCandidate = new Set([...selectedKeys].filter(key => currentKeys.has(key)));
      const remainder = current.filter(component => !selectedOnCandidate.has(taskComponentKey(component)));
      const skipped = merged;
      if (remainder.length) {
        const updated = await write(candidate, candidate.state, remainder, candidate.input_type || 'image-list', candidate.input_value || '', triggerSummary(input, target, remainder));
        const created = await write(null, 'skip', skipped, 'image-list', '', triggerSummary(input, target, skipped));
        return { status: 'split', action, epic_key: epic.key, tasks: [updated, created], pmc_sha: pmc.sha };
      }
      const result = await write(candidate, 'skip', skipped, 'image-list', '', candidate.summary);
      return { status: 'updated', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
    }
    if (alreadySkipped.length) return { status: 'unchanged', action, epic_key: epic.key, tasks: alreadySkipped.map(card => ({ key: card.key, operation: 'unchanged', state: card.state })), pmc_sha: pmc.sha };
    const result = await write(null, 'skip', merged, 'image-list', '', undefined);
    return { status: 'created', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
  }

  const candidateKeys = candidate ? cardComponentKeys(candidate) : new Set();
  const remainder = candidate ? current.filter(component => !selectedKeys.has(taskComponentKey(component))) : [];
  const extras = validated.filter(component => !candidateKeys.has(taskComponentKey(component)) && !occupied.has(taskComponentKey(component)));
  const finalReady = candidate ? merged.concat(extras.filter(extra => !candidateKeys.has(taskComponentKey(extra)))) : merged;
  if (candidate && remainder.length) {
    const splitDecision = triggerDecision(body, 'split', action);
    if (!splitDecision.choice) {
      throw triggerError(`${candidate.key} contains components outside the requested subset; choose a whole-card transition or split the card.`, 'split-choice', {
        decisions: { type: 'split', action, candidate: { key: candidate.key, summary: candidate.summary, components: current }, requested: validated, remainder, extras, choices: ['whole', 'split'] },
      });
    }
    if (splitDecision.choice === 'whole') {
      const all = current.map(component => merged.find(item => taskComponentKey(item) === taskComponentKey(component)) || component)
        .concat(extras);
      if (requestedInput !== 'image-list') for (const component of all) component.pullspec = '';
      validateReadyComponentList(input, all, [...expectedByKey.values()], requestedInput);
      const result = await write(candidate, 'ready', all, requestedInput, requestedValue, all.length === current.length ? undefined : triggerSummary(input, target, all));
      return { status: 'updated', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
    }
    if (splitDecision.choice !== 'split') throw new Error('split decision must be whole or split');
    validateReadyComponentList(input, finalReady, [...expectedByKey.values()], requestedInput);
     const updated = await write(candidate, candidate.state, remainder, candidate.input_type || 'image-list', candidate.input_value || '', triggerSummary(input, target, remainder));
     const created = await write(null, 'ready', finalReady, requestedInput, requestedValue);
    return { status: 'split', action, epic_key: epic.key, tasks: [created, updated], pmc_sha: pmc.sha };
  }
  if (candidate) {
    validateReadyComponentList(input, finalReady, [...expectedByKey.values()], requestedInput);
    const result = await write(candidate, 'ready', finalReady, requestedInput, requestedValue,
      finalReady.length === current.length ? undefined : triggerSummary(input, target, finalReady));
    return { status: 'updated', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
  }
  validateReadyComponentList(input, merged, [...expectedByKey.values()], requestedInput);
  const result = await write(null, 'ready', merged, requestedInput, requestedValue);
  return { status: 'created', action, epic_key: epic.key, tasks: [result], pmc_sha: pmc.sha };
}

function groupedTriggerActions(body) {
  const components = Array.isArray(body.components) ? body.components : [];
  const fallbackAction = String(body.action || 'planned').trim().toLowerCase();
  const groups = new Map();
  for (const component of components) {
    const action = String(component?.action || fallbackAction).trim().toLowerCase();
    if (!['planned', 'ready', 'skip'].includes(action)) {
      throw new Error('component action must be planned, ready, or skip');
    }
    if (!groups.has(action)) groups.set(action, []);
    groups.get(action).push(component);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => ({ skip: 0, ready: 1, planned: 2 }[left] - ({ skip: 0, ready: 1, planned: 2 }[right])))
    .map(([action, groupedComponents]) => ({ action, components: groupedComponents }));
}

async function mutateTriggerRelease(jira, pmc, epicIssue, body) {
  let normalizedBody = body;
  if (!body.card_key && !Array.isArray(body.components) && typeof body.components !== 'string') {
    const epic = parseEpicIssue(epicIssue);
    const branch = resolveBranch(pmc.products, epic.product, epic.branch);
    const freeForm = freeFormTriggerComponents(epic, branch, body);
    normalizedBody = { ...body, input_type: freeForm.inputType, input_value: freeForm.inputValue, components: freeForm.components };
  }
  const groups = groupedTriggerActions(normalizedBody);
  if (!groups.length) {
    return mutateSingleTriggerRelease(jira, pmc, epicIssue, normalizedBody);
  }

  const results = [];
  const createdKeys = [];
  for (const group of groups) {
    const groupBody = {
      ...normalizedBody,
      action: group.action,
      components: group.components,
    };
    if (group.action === 'skip') {
      groupBody.input_type = 'image-list';
      groupBody.input_value = '';
    }
    try {
      const result = await mutateSingleTriggerRelease(jira, pmc, epicIssue, groupBody);
      results.push(result);
      createdKeys.push(...result.tasks.filter(task => task.operation === 'created').map(task => task.key));
    } catch (error) {
      error.createdKeys = [...createdKeys, ...(error.createdKeys || [])];
      throw error;
    }
  }
  const statuses = results.map(result => result.status);
  const tasksByKey = new Map();
  for (const task of results.flatMap(result => result.tasks)) tasksByKey.set(task.key, task);
  return {
    status: statuses.length === 1
      ? statuses[0]
      : statuses.every(status => status === 'unchanged')
        ? 'unchanged'
        : statuses.includes('split')
          ? 'split'
          : statuses.includes('created')
            ? 'created'
            : 'updated',
    epic_key: results[0].epic_key,
    tasks: [...tasksByKey.values()],
    pmc_sha: results[0].pmc_sha,
    groups: results.map(result => ({ action: result.action, status: result.status, tasks: result.tasks })),
  };
}

function registerReleaseEpicRoutes(router, context, deps = {}) {
  const requireAuth = context.requireAuth || ((_req, _res, next) => next());
  const requireScope = context.requireScope || (() => (_req, _res, next) => next());
  const releaseScope = requireScope('product-builds:release');
  let jira;
  function getJira() {
    if (deps.jira) return deps.jira;
    if (!jira) {
      const secrets = context.secrets || {};
      jira = createJiraClient({
        email: secrets.JIRA_EMAIL || '', token: secrets.JIRA_TOKEN || '', host: secrets.JIRA_HOST,
      });
    }
    return jira;
  }

  /**
   * @openapi
   * /api/modules/product-builds/release-trigger/options:
   *   get:
   *     tags: [Product Builds]
    *     summary: List release readiness cards the caller may manage
    *     description: Returns planned and failed child Tasks for authorized open release Epics, with the parent Epic metadata needed to submit a release.
   *     responses:
   *       200:
    *         description: Authorized planned or failed readiness cards with parent Epic metadata
   *       401:
   *         description: Authentication required
   *       502:
   *         description: PMC or Jira could not be read
   */
  router.get('/release-trigger/options', requireAuth, releaseScope, async function(req, res) {
    try {
      res.json(await loadTriggerOptions(getJira(), context, req, deps));
    } catch (err) {
      console.error('[release-trigger] Options failed:', err.message);
      res.status(/authorized|identity|signed-in/.test(err.message) ? 403 : 502).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/release-trigger:
   *   post:
   *     tags: [Product Builds]
    *     summary: Trigger a selected component readiness Task
    *     description: Reloads the selected child Task and its parent release Epic, validates ownership and PMC input, then transitions the card to ready.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
    *             required: [components, input_type, input_value]
   *             properties:
    *               card_key: {type: string, description: Selected planned or failed readiness child Task}
    *               epic_key: {type: string, description: Deprecated compatibility identifier for the parent Epic}
    *               target: {type: string, enum: [stage-rc, prod], description: Optional confirmation; must match the selected card}
    *               action: {type: string, enum: [planned, ready, skip], description: Compatibility fallback when component actions are omitted}
   *               input_type: {type: string, enum: [image-list, git-tag, commit-sha], description: Input anchor for ready components}
    *               input_value: {type: string, description: "Free-form tag, SHA, or image URLs"}
    *               components:
    *                 description: "PMC component input: all or comma-separated user-level names such as cuda, rocm, model-opt"
    *                 oneOf:
    *                   - type: string
    *                   - type: array
    *                     description: Legacy internal component objects
    *                     items:
    *                       type: object
    *                       required: [name]
    *                       properties:
    *                         name: {type: string}
    *                         variant: {type: string}
    *                         action: {type: string, enum: [planned, ready, skip]}
    *                         pullspec: {type: string}
    *                         cves: {type: string}
    *                         reason: {type: string}
    *               cve_list: {type: string, description: "Comma-separated CVEs for RHSA releases"}
    *               skipped_components: {type: string, description: "Optional comma-separated components to exclude from this release when transitioning a selected card to ready"}
    *               user_prompt: {type: string, description: "Additional context or special instructions for the AI agent"}
   *               decision: {type: object}
   *     responses:
   *       200:
   *         description: Readiness Tasks created or updated
   *       400:
   *         description: Validation failed before a Jira write
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Caller is not authorized or is impersonating
   *       409:
   *         description: User decision is required before mutation
   *       502:
   *         description: Jira or PMC could not be read or updated
   */
  router.post('/release-trigger', requireAuth, releaseScope, blockDuringImpersonation, async function(req, res) {
    try {
      const cardKey = String(req.body?.card_key || '').trim().toUpperCase();
      const legacyEpicKey = String(req.body?.epic_key || '').trim().toUpperCase();
      if (cardKey && !/^(?:AIPCC|RHAI)-\d+$/.test(cardKey)) throw new Error('card_key must be an AIPCC or RHAI Jira issue key');
      if (!cardKey && !/^(?:AIPCC|RHAI)-\d+$/.test(legacyEpicKey)) throw new Error('card_key is required');
      const selectedIssue = cardKey
        ? await getJira().jiraRequest(`/rest/api/3/issue/${encodeURIComponent(cardKey)}?fields=key,summary,status,labels,description,issuetype,project,parent,customfield_10014,created,updated`)
        : null;
      const parentKey = selectedIssue ? parentKeyForChild(selectedIssue) : legacyEpicKey;
      const epicKey = String(parentKey || '').trim().toUpperCase();
      if (!/^(?:AIPCC|RHAI)-\d+$/.test(epicKey)) throw new Error('Selected card must have an AIPCC or RHAI parent Epic');
      if (selectedIssue && (selectedIssue.key !== cardKey
        || selectedIssue.fields?.project?.key !== cardKey.split('-')[0]
        || selectedIssue.fields?.issuetype?.name !== 'Task'
        || selectedIssue.fields?.status?.statusCategory?.key === 'done'
        || String(selectedIssue.fields?.status?.name || '').toLowerCase() === 'closed')) {
        throw triggerError(`${cardKey} is not a Jira Task`, 'invalid-card');
      }
      const issue = await getJira().jiraRequest(`/rest/api/3/issue/${encodeURIComponent(epicKey)}?fields=key,summary,status,labels,description,issuetype,project,created,updated`);
       if (issue.key !== epicKey
        || issue.fields?.project?.key !== epicKey.split('-')[0]
        || issue.fields?.issuetype?.name !== 'Epic'
        || !(issue.fields?.labels || []).includes('release-automation')
        || String(issue.fields?.status?.name || '').toLowerCase() === 'closed'
        || issue.fields?.status?.statusCategory?.key === 'done') {
        throw triggerError(`${epicKey} is not an open release-automation Epic`, 'invalid-epic');
      }
      const epic = parseEpicIssue(issue);
      const pmc = await loadPmcBranch(context, deps, epic.product, epic.branch, true);
      assertAuthorized(pmc.files, epic.product, callerKerberosId(req));
      const requestedPmcSha = String(req.body?.pmc_sha || '').trim();
      if (requestedPmcSha && requestedPmcSha.toLowerCase() !== pmc.sha.toLowerCase()) {
        throw triggerError('Release data changed while this form was open. Reload the release options and try again.', 'stale-pmc');
      }
       const result = await mutateTriggerRelease(getJira(), pmc, issue, req.body || {});
      invalidateTriggerOptionsCache();
      res.json(result);
    } catch (err) {
       const status = err.code === 'invalid-epic' || err.code === 'invalid-card'
        ? 400
        : err.code && (err.code === 'stale-pmc' || err.code.includes('candidate') || err.code.includes('duplicate') || err.code.includes('retry') || err.code.includes('choice') || err.code.includes('conversion'))
        ? 409
        : /authorized|identity|signed-in|impersonat/.test(err.message) ? 403
         : /required|must be|Invalid|Unknown|ambiguous|both ready and skipped|At least one ready|not configured|no .*release plan|not an unambiguous|not on selected readiness card|selected more than|pullspec|CVE|SHA|tag without|epic_key|card_key|stage_repository|target confirmation/.test(err.message) ? 400
            : 502;
      const payload = { error: err.message };
      if (err.code) payload.code = err.code;
      if (err.decisions) payload.decisions = err.decisions;
      if (err.createdKeys?.length) payload.created_keys = err.createdKeys;
      console.error('[release-trigger] Workflow failed:', err.message);
      res.status(status).json(payload);
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/release-epic/options:
   *   get:
   *     tags: [Product Builds]
   *     summary: Load PMC release-epic metadata and valid choices
   *     parameters:
   *       - name: product
   *         in: query
   *         schema: {type: string}
   *         description: Optional product whose selected branch should be loaded
   *       - name: branch
   *         in: query
   *         schema: {type: string}
   *         description: Optional branch to load with release-plan and component metadata
   *     responses:
   *       200:
   *         description: SHA-pinned product, branch, version, component, and release-plan metadata
   *       502:
   *         description: PMC could not be read
   */
   router.get('/release-epic/options', async function(req, res) {
    try {
      const product = String(req.query?.product || '').trim();
      const branch = String(req.query?.branch || '').trim();
      res.json(await loadReleaseEpicOptions(context, deps, product, branch));
    } catch (err) {
      console.error('[release-epic] PMC metadata failed:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/release-epic:
   *   post:
   *     tags: [Product Builds]
   *     summary: Create a deterministic PMC-backed release Epic and checklist Tasks
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [product, version, branch, advisory_type]
   *             properties:
   *               product: {type: string, enum: [agentic-base-images, ai-hub, base-images, docling, guidellm, rhaiis, rhelai, torch]}
   *               version: {type: string}
   *               branch: {type: string}
   *               release_type: {type: string, enum: [GA, EA]}
   *               advisory_type: {type: string, enum: [RHEA, RHBA, RHSA]}
   *     responses:
   *       201:
   *         description: Release Epic and checklist cards created
   *       409:
   *         description: Duplicate or Feature choice requires confirmation
   *       403:
   *         description: Not authorized to create release epics for this product
   */
  router.post('/release-epic', requireAuth, releaseScope, blockDuringImpersonation, async function(req, res) {
    let createdKeys = [];
    try {
      const kerberosId = callerKerberosId(req);
      const requestedPmcSha = String(req.body?.pmc_sha || '').trim();
      if (requestedPmcSha && !/^[0-9a-f]{40}$/i.test(requestedPmcSha)) {
        throw new Error('PMC snapshot must be a full commit SHA');
      }
       const currentPmc = await loadPmcBranch(
         context,
         deps,
         String(req.body?.product || '').trim(),
         String(req.body?.branch || '').trim(),
         true,
       );
      if (requestedPmcSha && requestedPmcSha.toLowerCase() !== currentPmc.sha.toLowerCase()) {
        const error = new Error('Release data changed while this form was open. Reload the release options and try again.');
        error.code = 'stale-pmc';
        throw error;
      }
      const pmc = currentPmc;
      const input = validateReleaseInput(pmc.products, req.body || {});
      assertAuthorized(pmc.files, input.product, kerberosId);
      const components = filterComponents(input.metadata.components, parseExclusions(req.body.exclude));
      if (components.length === 0) throw new Error('Exclusions removed every expected component; at least one component is required');
      const secrets = context.secrets || {};
      if (!secrets.JIRA_EMAIL || !secrets.JIRA_TOKEN) {
        const error = new Error('Jira is not configured (JIRA_EMAIL/JIRA_TOKEN missing)');
        error.code = 'jira-config';
        throw error;
      }
      const result = await createReleaseEpic(getJira(), input, components, req.body || {});
      createdKeys = result.created_keys;
      res.status(201).json({ ...result, pmc_sha: pmc.sha });
    } catch (err) {
      const status = err.code === 'duplicates' || err.code === 'feature-selection' || err.code === 'stale-pmc' ? 409 : err.code === 'jira-config' ? 503 : /identif|identity|authorized|signed-in/.test(err.message) ? 403 : /required|must be|Invalid|not configured|not configured for|Unsupported|Missing|not start/.test(err.message) ? 400 : 502;
      const payload = { error: err.message };
      if (err.code) payload.code = err.code;
      if (err.duplicates) payload.duplicates = err.duplicates;
      if (err.features) payload.features = err.features;
      if (err.featureKey) payload.feature_key = err.featureKey;
      if (createdKeys.length || err.createdKeys?.length) payload.created_keys = err.createdKeys || createdKeys;
      console.error('[release-epic] Workflow failed:', err.message, createdKeys.length ? `created=${createdKeys.join(',')}` : '');
      res.status(status).json(payload);
    }
  });
}

module.exports = registerReleaseEpicRoutes;
module.exports._testExports = {
  PRODUCTS, RHELAI_CONFIGS, branchApplication, inferReleaseType, inferReleaseTypeForProduct,
  parseBranch, parsePmcSnapshot, validateReleaseInput, filterComponents, buildEpicAdf,
  buildReadinessAdf, checklistPlan, isZStream, featureSuffix, featureJql, duplicateJql,
  callerKerberosId, authorizedUsers, createGitlabClient, findFeatures, findDuplicates, resolveFeature,
  createReleaseEpic, buildEpicFields, buildTaskFields,
  verifyCreatedEpic,
  releaseState, parseEpicIssue, parseReadinessCard, repositoryAndReference,
  expectedComponentsForEpic, resolveComponentTokens, resolveCardComponentTokens, canonicalComponentTokens, parseImageListInput, freeFormTriggerComponents,
  validateStagePullspec, validateTriggerComponents, triggerAdf, mutateTriggerRelease, loadTriggerOptions, bulkChildTaskJql,
};
