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
  const missing = paths.filter(path => typeof files[path] !== 'string');
  if (missing.length) throw new Error(`Missing PMC config file(s): ${missing.join(', ')}`);

  const extracted = paths.flatMap(path => {
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
    config_files: paths,
    config_families: product === 'rhelai' ? RHELAI_CONFIGS.map(([, family]) => family) : ['—'],
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
    if (branch && configPaths(product, branch).every(config => typeof files[config] === 'string')) {
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
  async function snapshot(ref, forceRefresh = false) {
    const cacheKey = `${host}|${projectId}|${ref}`;
    if (forceRefresh) pmcSnapshotCache.delete(cacheKey);
    const cached = pmcSnapshotCache.get(cacheKey);
    if (cached?.snapshot && cached.expiresAt > Date.now()) return cached.snapshot;
    if (cached?.promise) return cached.promise;

    const pending = loadSnapshot(ref);
    pmcSnapshotCache.set(cacheKey, { promise: pending, expiresAt: Date.now() + cacheTtl });
    try {
      const result = await pending;
      const expiresAt = Date.now() + cacheTtl;
      pmcSnapshotCache.set(cacheKey, { snapshot: result, expiresAt });
      pmcSnapshotCache.set(`${host}|${projectId}|${result.sha}`, { snapshot: result, expiresAt });
      return result;
    } catch (error) {
      pmcSnapshotCache.delete(cacheKey);
      throw error;
    }
  }
  async function loadSnapshot(ref) {
    const commit = await request(`/projects/${projectId}/repository/commits/${encodeURIComponent(ref)}`);
    const sha = commit.id || commit.sha;
    if (!sha) throw new Error(`PMC ref ${ref} did not resolve to a commit SHA`);
    const tree = await listTree('', sha, true);
    const paths = new Set(['owners-groups.yaml']);
    for (const product of PRODUCTS) {
      if (!tree.some(entry => entry.type === 'blob' && entry.path === `${product}/owners.yaml`)) continue;
      paths.add(`${product}/owners.yaml`);
      const configPattern = product === 'rhelai'
        ? /^rhelai\/[^/]+\/config-(?:containers|disk-images|disk-image-containers)\.yaml$/
        : new RegExp(`^${product.replace('-', '\\-')}\\/[^/]+\\/config\\.yaml$`);
      for (const entry of tree) {
        if (entry.type === 'blob' && configPattern.test(entry.path)) paths.add(entry.path);
      }
    }
    const files = {};
    const pendingPaths = [...paths];
    async function readNext() {
      const path = pendingPaths.shift();
      if (!path) return;
      files[path] = await readFile(path, sha);
      return readNext();
    }
    await Promise.all(Array.from({ length: Math.min(4, pendingPaths.length) }, readNext));
    return { sha, files };
  }
  return { snapshot };
}

async function loadPmc(context, deps = {}, refOverride, forceRefresh = false) {
  const secrets = context.secrets || {};
  const token = secrets.PMC_GITLAB_TOKEN || secrets.GITLAB_TOKEN;
  const client = deps.gitlab || createGitlabClient({
    baseUrl: secrets.PMC_GITLAB_BASE_URL || GITLAB_HOST_DEFAULT,
    project: secrets.PMC_GITLAB_PROJECT,
    token,
    fetchFn: deps.fetchFn,
  });
  const ref = refOverride || secrets.PMC_GITLAB_REF || 'main';
  const snapshot = await client.snapshot(ref, forceRefresh);
  return { ...snapshot, products: parsePmcSnapshot(snapshot.files), ref };
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

function registerReleaseEpicRoutes(router, context, deps = {}) {
  const requireAuth = context.requireAuth || ((_req, _res, next) => next());
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
   * /api/modules/product-builds/release-epic/options:
   *   get:
   *     tags: [Product Builds]
   *     summary: Load PMC release-epic metadata and valid choices
   *     responses:
   *       200:
   *         description: SHA-pinned product, branch, version, component, and release-plan metadata
   *       502:
   *         description: PMC could not be read
   */
  router.get('/release-epic/options', async function(_req, res) {
    try {
      const pmc = await loadPmc(context, deps);
      res.json({ sha: pmc.sha, ref: pmc.ref, products: pmc.products });
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
  router.post('/release-epic', requireAuth, blockDuringImpersonation, async function(req, res) {
    let createdKeys = [];
    try {
      const kerberosId = callerKerberosId(req);
      const requestedPmcSha = String(req.body?.pmc_sha || '').trim();
      if (requestedPmcSha && !/^[0-9a-f]{40}$/i.test(requestedPmcSha)) {
        throw new Error('PMC snapshot must be a full commit SHA');
      }
      const currentPmc = await loadPmc(context, deps, undefined, true);
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
};
