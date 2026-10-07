import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAINTAINER_TEAM,
  currentApprovers,
  currentHeadApprovalComments,
  evaluateOwnership,
  ownersForPath,
  parseCodeowners,
  pullRequestNumbersFromMergeGroupRef,
  renderComment
} from './ownership-gate.mjs';

const CODEOWNERS = `
* @red-hat-data-services/org-pulse-maintainers
/modules/okr-hub/ @saprabhu05
/modules/releases/ @saprabhu05 @wznoinsk @epacific1
/deploy/ @red-hat-data-services/org-pulse-maintainers
/deploy/openshift/overlays/ai-eng-prod/kustomization.yaml
`;

const teamMembers = new Map([
  [MAINTAINER_TEAM, new Set(['accorvin', 'saprabhu05'])]
]);

function evaluate({ authorLogin, changedFiles, approvedReviewers = [] }) {
  return evaluateOwnership({
    entries: parseCodeowners(CODEOWNERS),
    changedFiles,
    authorLogin,
    approvedReviewers,
    teamMembers
  });
}

test('the final CODEOWNERS match preserves an explicit no-owner exception', () => {
  const entries = parseCodeowners(CODEOWNERS);
  assert.deepEqual(
    ownersForPath(entries, 'deploy/openshift/overlays/ai-eng-prod/kustomization.yaml'),
    []
  );
});

test('merge-queue refs identify every queued pull request without synthetic-SHA lookup', () => {
  assert.deepEqual(
    pullRequestNumbersFromMergeGroupRef(
      'gh-readonly-queue/main/pr-1710-8da093f12b64bdd3af25397a0846d6b7c604a133'
    ),
    [1710]
  );
  assert.deepEqual(
    pullRequestNumbersFromMergeGroupRef(
      'gh-readonly-queue/main/pr-1710-8da093f/pr-1711-0123456789abcdef'
    ),
    [1710, 1711]
  );
  assert.deepEqual(pullRequestNumbersFromMergeGroupRef('gh-readonly-queue/main/no-pr'), []);
});

test('an individual code owner can merge their own module change', () => {
  const result = evaluate({
    authorLogin: 'saprabhu05',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue']
  });

  assert.equal(result.passed, true);
  assert.equal(result.areas[0].authorOwns, true);
});

test('a non-owner needs approval from a matching owner', () => {
  const blocked = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue']
  });
  assert.equal(blocked.passed, false);

  const approved = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue'],
    approvedReviewers: ['saprabhu05']
  });
  assert.equal(approved.passed, true);
  assert.equal(approved.areas[0].approver, 'saprabhu05');
});

test('an approval from a different ownership area does not satisfy the gate', () => {
  const result = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue'],
    approvedReviewers: ['wznoinsk']
  });

  assert.equal(result.passed, false);
});

test('an owner spanning all changed modules needs no approval', () => {
  const result = evaluate({
    authorLogin: 'saprabhu05',
    changedFiles: [
      'modules/okr-hub/client/Dashboard.vue',
      'modules/releases/client/Timeline.vue'
    ]
  });

  assert.equal(result.passed, true);
  assert.ok(result.areas.every(area => area.authorOwns));
});

test('a maintainer owns shared fallback areas', () => {
  const result = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['server/index.js']
  });

  assert.equal(result.passed, true);
});

test('policy files require an independent maintainer approval', () => {
  const blocked = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['.github/CODEOWNERS']
  });
  assert.equal(blocked.passed, false);
  assert.equal(blocked.areas[0].kind, 'policy');

  const approved = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['.github/CODEOWNERS'],
    approvedReviewers: ['saprabhu05']
  });
  assert.equal(approved.passed, true);
});

test('intentionally unowned deployment paths require an independent maintainer approval', () => {
  const blocked = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['deploy/openshift/overlays/ai-eng-prod/kustomization.yaml']
  });
  assert.equal(blocked.passed, false);
  assert.equal(blocked.areas[0].kind, 'unowned');

  const approved = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['deploy/openshift/overlays/ai-eng-prod/kustomization.yaml'],
    approvedReviewers: ['saprabhu05']
  });
  assert.equal(approved.passed, true);
});

test('only current-head approvals are eligible', () => {
  const approvers = currentApprovers([
    {
      state: 'APPROVED',
      commit_id: 'old-sha',
      submitted_at: '2026-10-06T10:00:00Z',
      user: { login: 'saprabhu05', type: 'User' }
    },
    {
      state: 'APPROVED',
      commit_id: 'current-sha',
      submitted_at: '2026-10-06T11:00:00Z',
      user: { login: 'wznoinsk', type: 'User' }
    },
    {
      state: 'APPROVED',
      commit_id: 'current-sha',
      submitted_at: '2026-10-06T12:00:00Z',
      user: { login: 'accorvin', type: 'User' }
    }
  ], {
    headSha: 'current-sha',
    authorLogin: 'accorvin'
  });

  assert.deepEqual(approvers, ['wznoinsk']);
});

test('a later non-approval on the current head supersedes an earlier approval', () => {
  const approvers = currentApprovers([
    {
      state: 'APPROVED',
      commit_id: 'current-sha',
      submitted_at: '2026-10-06T10:00:00Z',
      user: { login: 'saprabhu05', type: 'User' }
    },
    {
      state: 'CHANGES_REQUESTED',
      commit_id: 'current-sha',
      submitted_at: '2026-10-06T11:00:00Z',
      user: { login: 'saprabhu05', type: 'User' }
    }
  ], {
    headSha: 'current-sha',
    authorLogin: 'accorvin'
  });

  assert.deepEqual(approvers, []);
});

test('only standalone approval comments after the current head count', () => {
  const timeline = [
    { event: 'committed', sha: 'old-sha' },
    { event: 'commented', id: 1 },
    { event: 'committed', sha: 'current-sha' },
    { event: 'commented', id: 2 },
    { event: 'commented', id: 3 },
    { event: 'head_ref_force_pushed' },
    { event: 'commented', id: 4 },
    { event: 'commented', id: 5 },
    { event: 'commented', id: 6 }
  ];
  const comments = [
    { id: 1, body: '/lgtm', user: { login: 'saprabhu05' } },
    { id: 2, body: 'please /approve', user: { login: 'saprabhu05' } },
    { id: 3, body: '/approve', user: { login: 'wznoinsk' } },
    { id: 4, body: '  /LGTM\n', user: { login: 'epacific1' } },
    { id: 6, body: 'approval withdrawn', user: { login: 'saprabhu05' } }
  ];

  assert.deepEqual(
    currentHeadApprovalComments(timeline, comments, 'current-sha').map(comment => comment.user.login),
    ['epacific1']
  );
  assert.deepEqual(currentHeadApprovalComments(timeline, comments, 'missing-sha'), []);
  assert.deepEqual(
    currentHeadApprovalComments([
      { event: 'committed', sha: 'current-sha' },
      { event: 'commented', id: 7 }
    ], [{ id: 7, body: '/approve', user: { login: 'wznoinsk' } }], 'current-sha')
      .map(comment => comment.user.login),
    ['wznoinsk']
  );
});

test('status comments explain both approval commands', () => {
  const result = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue']
  });
  const comment = renderComment(result, 'accorvin', 'current-sha');

  assert.match(comment, /standalone `\/lgtm` or `\/approve` PR comment/);
  assert.match(comment, /Post a new approval after each push/);
});

test('comment approvals exclude the author and bots', () => {
  const approvers = currentApprovers([], {
    headSha: 'current-sha',
    authorLogin: 'accorvin',
    comments: [
      { user: { login: 'accorvin', type: 'User' }, created_at: '2026-10-07T10:00:00Z' },
      { user: { login: 'automation[bot]', type: 'Bot' }, created_at: '2026-10-07T10:01:00Z' },
      { user: { login: 'saprabhu05', type: 'User' }, created_at: '2026-10-07T10:02:00Z' }
    ]
  });

  assert.deepEqual(approvers, ['saprabhu05']);
});

test('a later change request supersedes a comment approval', () => {
  const approvers = currentApprovers([
    {
      state: 'CHANGES_REQUESTED',
      commit_id: 'current-sha',
      submitted_at: '2026-10-07T11:00:00Z',
      user: { login: 'saprabhu05', type: 'User' }
    }
  ], {
    headSha: 'current-sha',
    authorLogin: 'accorvin',
    comments: [{
      user: { login: 'saprabhu05', type: 'User' },
      created_at: '2026-10-07T10:00:00Z'
    }]
  });

  assert.deepEqual(approvers, []);
});

test('a later comment approval supersedes a change request', () => {
  const approvers = currentApprovers([
    {
      state: 'CHANGES_REQUESTED',
      commit_id: 'current-sha',
      submitted_at: '2026-10-07T10:00:00Z',
      user: { login: 'saprabhu05', type: 'User' }
    }
  ], {
    headSha: 'current-sha',
    authorLogin: 'accorvin',
    comments: [{
      user: { login: 'saprabhu05', type: 'User' },
      created_at: '2026-10-07T11:00:00Z'
    }]
  });

  assert.deepEqual(approvers, ['saprabhu05']);
});
