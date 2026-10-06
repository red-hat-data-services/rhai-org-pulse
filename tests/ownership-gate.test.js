import { expect, test } from 'vitest';

import {
  MAINTAINER_TEAM,
  currentApprovers,
  evaluateOwnership,
  ownersForPath,
  parseCodeowners
} from '../scripts/ownership-gate.mjs';

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
  expect(
    ownersForPath(entries, 'deploy/openshift/overlays/ai-eng-prod/kustomization.yaml')
  ).toEqual([]);
});

test('an individual code owner can merge their own module change', () => {
  const result = evaluate({
    authorLogin: 'saprabhu05',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue']
  });

  expect(result.passed).toBe(true);
  expect(result.areas[0].authorOwns).toBe(true);
});

test('a non-owner needs approval from a matching owner', () => {
  const blocked = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue']
  });
  expect(blocked.passed).toBe(false);

  const approved = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue'],
    approvedReviewers: ['saprabhu05']
  });
  expect(approved.passed).toBe(true);
  expect(approved.areas[0].approver).toBe('saprabhu05');
});

test('an approval from a different ownership area does not satisfy the gate', () => {
  const result = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['modules/okr-hub/client/Dashboard.vue'],
    approvedReviewers: ['wznoinsk']
  });

  expect(result.passed).toBe(false);
});

test('an owner spanning all changed modules needs no approval', () => {
  const result = evaluate({
    authorLogin: 'saprabhu05',
    changedFiles: [
      'modules/okr-hub/client/Dashboard.vue',
      'modules/releases/client/Timeline.vue'
    ]
  });

  expect(result.passed).toBe(true);
  expect(result.areas.every(area => area.authorOwns)).toBe(true);
});

test('a maintainer owns shared fallback areas', () => {
  const result = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['server/index.js']
  });

  expect(result.passed).toBe(true);
});

test('policy files require an independent maintainer approval', () => {
  const blocked = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['.github/CODEOWNERS']
  });
  expect(blocked.passed).toBe(false);
  expect(blocked.areas[0].kind).toBe('policy');

  const approved = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['.github/CODEOWNERS'],
    approvedReviewers: ['saprabhu05']
  });
  expect(approved.passed).toBe(true);
});

test('intentionally unowned deployment paths require an independent maintainer approval', () => {
  const blocked = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['deploy/openshift/overlays/ai-eng-prod/kustomization.yaml']
  });
  expect(blocked.passed).toBe(false);
  expect(blocked.areas[0].kind).toBe('unowned');

  const approved = evaluate({
    authorLogin: 'accorvin',
    changedFiles: ['deploy/openshift/overlays/ai-eng-prod/kustomization.yaml'],
    approvedReviewers: ['saprabhu05']
  });
  expect(approved.passed).toBe(true);
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

  expect(approvers).toEqual(['wznoinsk']);
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

  expect(approvers).toEqual([]);
});
