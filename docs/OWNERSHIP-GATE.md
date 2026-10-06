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
- Only `APPROVED` reviews made on the current PR head count. A force-push,
  rebase, or later change request invalidates the approval for this gate.
- Changes to `CODEOWNERS`, this workflow, or its evaluator always need an
  independent `org-pulse-maintainers` approval.
- The intentionally unowned deployment-promotion manifests require an
  independent maintainer approval for human PRs. The existing authenticated
  image-promotion automation continues to update them directly.

The status comment lists the changed ownership areas and the owners who can
satisfy any outstanding requirement.

## Implementation and trust boundary

The workflow runs on `pull_request_target` and reads only GitHub API metadata:
the base-branch `CODEOWNERS` file, changed paths, reviews, team membership, and
repository permissions. It never checks out or executes pull-request code.

It uses the existing `rhai-org-pulse` GitHub App to read team membership and
write the `Ownership Gate` commit status. The merge queue receives the same
App-owned status on its synthetic merge-group commit after a PR has passed the
gate.

The evaluator supports the CODEOWNERS pattern forms currently used in this
repository, including root paths, directories, `*`, `**`, and `?`. Unsupported
patterns fail the gate instead of silently changing review policy.
