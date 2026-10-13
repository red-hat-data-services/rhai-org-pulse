# Ownership Gate

`Ownership Gate` is the repository's required status for changes to `main`.
It uses [`.github/CODEOWNERS`](../.github/CODEOWNERS) as the ownership map,
but deliberately does not use GitHub's native required Code Owner review.

## Policy

- An author who owns every changed path can merge after the normal CI and
  merge-queue requirements pass. Authors cannot approve their own pull request.
- For each changed path the author does **not** own, one current approval from
  a matching owner is required. A single reviewer can cover several paths when
  they own all of them.
- An owner can be an individual GitHub user or a member of a GitHub team named
  in `CODEOWNERS`.
- An eligible owner with repository write access can approve by leaving a
  standalone `/lgtm` or `/approve` comment on the PR, or by submitting an
  `APPROVED` review. The PR author and bot accounts cannot approve.
- Only approvals made on the current PR head count. A push or rebase requires
  a new comment or review. A later change request from the same owner revokes
  their earlier approval.
- A pull request must have a head commit that is not associated with another
  pull request. If another open, closed, or merged PR shares the same head
  commit, the gate fails until the author pushes a new commit. This prevents
  one PR's commit status from satisfying another PR's approval requirement.
- Changes to `CODEOWNERS`, this workflow, or its evaluator always need an
  independent `org-pulse-maintainers` approval.
- The intentionally unowned deployment-promotion manifests require an
  independent maintainer approval for human PRs. The existing authenticated
  image-promotion automation continues to update them directly.

The status comment lists the changed ownership areas and the owners who can
satisfy any outstanding requirement. It also explains both comment commands.

## Implementation and trust boundary

The workflow runs on `pull_request_target`, `issue_comment`, or
`workflow_run`, and reads only GitHub API metadata: the base-branch
`CODEOWNERS` file, changed paths, reviews, PR comments and timeline, team
membership, and repository permissions. It never checks out or executes
pull-request code.

Review events use a two-stage trigger. `Ownership Review Signal` runs on
`pull_request_review` in an unprivileged context, records the PR number and
head SHA in an artifact, and uses no secrets. When that signal workflow
finishes, `Ownership Gate` runs on `workflow_run` in the default-branch
context, downloads the signal artifact, verifies its head SHA, and performs the
privileged evaluation. This bridge is necessary because review events from
fork pull requests do not receive repository secrets, while `workflow_run`
events do.

It uses the existing `rhai-org-pulse` GitHub App to read team membership and
write the `Ownership Gate` commit status. The merge queue re-evaluates every
queued PR against the merge group's current base SHA before publishing the
same App-owned status on its synthetic commit.

Because GitHub commit statuses are keyed by commit SHA and status context, the
evaluator also checks every PR associated with the current head SHA. It fails
closed if another PR uses that SHA, ensuring approval state cannot leak between
PRs that happen to share the same commit.

The evaluator supports the CODEOWNERS pattern forms currently used in this
repository, including root paths, directories, `*`, `**`, and `?`. Unsupported
patterns fail the gate instead of silently changing review policy.
