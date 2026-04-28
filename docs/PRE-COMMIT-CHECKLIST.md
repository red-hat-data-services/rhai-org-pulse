# Pre-Commit Checklist

Use this checklist before marking any Jira ticket as complete or creating a pull request.

## Code Quality

### Tests
- [ ] All new code has comprehensive unit tests
- [ ] Tests follow existing patterns (see `modules/team-tracker/__tests__/` for examples)
- [ ] Chart.js components properly mock `vue-chartjs` and `chart.js` to avoid canvas errors
- [ ] Tests verify computed properties, not just component mounting
- [ ] Edge cases are tested (null, zero, empty arrays, etc.)
- [ ] All tests pass: `npm test`
- [ ] No test warnings or errors in console output

### Linting
- [ ] Code passes ESLint: `npm run lint`
- [ ] No ESLint warnings
- [ ] Pre-commit hooks ran successfully (husky + lint-staged)

### Code Style
- [ ] Follows Vue 3 Composition API with `<script setup>`
- [ ] Uses existing patterns from similar components
- [ ] Prop validation with proper types and validators
- [ ] Comments only where WHY is non-obvious (avoid what/how comments)
- [ ] No console.log statements left in code
- [ ] No debugging code or TODOs left behind

### Module Structure
- [ ] Feature branch follows naming: `feature/<module-slug>-<description>`
- [ ] Changes isolated to single module where possible
- [ ] Module manifest (module.json) updated if needed
- [ ] Tests located in `modules/<slug>/__tests__/client/` or `/__tests__/server/`

## Functionality

### End-to-End Testing
- [ ] Tested feature in browser (http://localhost:5173)
- [ ] Verified golden path works correctly
- [ ] Tested edge cases in UI
- [ ] Checked responsive behavior on different screen sizes
- [ ] No console errors in browser DevTools
- [ ] Charts render correctly with different data scenarios

### Data Flow
- [ ] Backend API endpoints return expected data shape
- [ ] Frontend composables handle loading/error states
- [ ] Caching works correctly if applicable
- [ ] Data transformations produce correct output

## Git Hygiene

### Branch Management
- [ ] Working on feature branch (not main)
- [ ] Branch name describes the feature: `feature/<module>-<description>`
- [ ] All changes committed with clear messages
- [ ] Commit messages follow convention: `feat/fix/test/refactor(<module>): description`
- [ ] Co-authored-by line included: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

### Pre-PR Checks
- [ ] Branch is up to date with main
- [ ] All commits are clean and logical
- [ ] No merge conflicts
- [ ] No untracked test files or directories (like `modules/backlog-health/`)

## Documentation

### Code Documentation
- [ ] Complex logic has clarifying comments (WHY, not what)
- [ ] Prop descriptions are clear
- [ ] API contracts are documented if changed

### Module Documentation
- [ ] README updated if module behavior changed
- [ ] CLAUDE.md updated if project patterns changed
- [ ] API routes documented if added/changed

## Jira Workflow

### Before Closing
- [ ] All checklist items above are complete
- [ ] Feature has been demonstrated/tested end-to-end
- [ ] Known issues or limitations documented
- [ ] Transition to appropriate status (In Progress → Review → Closed)
- [ ] Add comment to Jira ticket with:
  - Summary of changes
  - Commit SHA or PR link
  - Screenshots if UI changes
  - Any deployment notes or migration steps

## Pre-Merge

### Pull Request
- [ ] PR description explains what and why
- [ ] PR links to Jira ticket
- [ ] All CI checks pass
- [ ] Code review completed if required
- [ ] No requested changes outstanding

## Quick Pre-Commit Commands

```bash
# Run all checks
npm run lint && npm test

# Check git status
git status

# Verify you're on a feature branch
git branch --show-current

# View recent commits
git log --oneline -5
```

## Common Patterns Reference

### Chart Component Tests
See `modules/team-tracker/__tests__/client/DoughnutChart.test.js` for the standard:
- Mock vue-chartjs and chart.js
- Test chartData computed properties
- Test chartOptions configuration
- Test edge cases
- Test user interactions

### Vue Component Structure
```vue
<template>
  <!-- Markup -->
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Props with validation
})

const computed = computed(() => {
  // Logic
})
</script>
```

### Test Structure
```javascript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('dependency', () => ({
  // Mocks
}))

describe('Component', () => {
  it('describes behavior', () => {
    // Arrange
    // Act
    // Assert
  })
})
```
