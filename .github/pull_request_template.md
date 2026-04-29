## Description

<!-- Briefly describe what this PR does and why -->

**Jira Ticket:** <!-- Link to AIPCC-XXXXX -->

## Type of Change

- [ ] Feature (new functionality)
- [ ] Bug fix
- [ ] Refactor (no functional changes)
- [ ] Documentation update
- [ ] CI/CD or infrastructure change

## Pre-Commit Checklist

### Code Quality

- [ ] All tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] No test warnings or console errors
- [ ] New code has comprehensive unit tests
- [ ] Tests follow existing patterns (see `modules/team-tracker/__tests__/`)
- [ ] Edge cases are tested (null, zero, empty arrays, etc.)

### Code Style

- [ ] Follows Vue 3 Composition API with `<script setup>`
- [ ] Uses existing patterns from similar components
- [ ] Prop validation with proper types
- [ ] No console.log or debugging code left behind
- [ ] Comments only where WHY is non-obvious

### End-to-End Testing

- [ ] Tested feature in browser (`npm run dev:full`)
- [ ] Verified golden path works correctly
- [ ] Tested edge cases in UI
- [ ] Checked responsive behavior
- [ ] No console errors in browser DevTools

### Git Hygiene

- [ ] Working on feature branch (not main)
- [ ] Branch name follows convention: `feature/<module>-<description>` or `fix/<module>-<description>`
- [ ] Commit messages follow: `feat/fix/test/docs(<module>): description`
- [ ] All commits include: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

### Documentation

- [ ] Complex logic has clarifying comments
- [ ] README updated if module behavior changed
- [ ] API routes documented if added/changed

## Screenshots/Demo

<!-- If UI changes, add screenshots or screen recording -->

## Deployment Notes

<!-- Any special deployment steps, migrations, or environment variable changes -->

## Reviewer Notes

<!-- Anything specific you want reviewers to focus on -->
