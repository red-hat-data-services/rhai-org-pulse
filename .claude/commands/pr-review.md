Review a GitHub pull request.

## Arguments

This command accepts a PR number as its argument: `/pr-review <PR_NUMBER>`

## Steps

1. Fetch the PR diff using `gh pr diff $ARGUMENTS`
2. Fetch the PR description using `gh pr view $ARGUMENTS`
3. Read `.github/instructions/review.instructions.md` and apply its review criteria to the diff.
4. Read any files from the repo that you need additional context on to complete the review.
5. Print a review summary to the terminal with:
   - An overall assessment
   - Specific issues found, organized by file, with line references
