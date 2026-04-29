#!/usr/bin/env node

/**
 * PR Validation Script
 *
 * Runs automated checks for code quality that aren't covered by linting/testing.
 * Intended to run in CI on pull requests.
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { glob } from 'glob'

let hasErrors = false

function error(message) {
  console.error(`❌ ${message}`)
  hasErrors = true
}

function warn(message) {
  console.warn(`⚠️  ${message}`)
}

function success(message) {
  console.log(`✅ ${message}`)
}

function info(message) {
  console.log(`ℹ️  ${message}`)
}

// Check 1: No console.log in client-side code
async function checkConsoleLogs() {
  info('Checking for console.log statements in client-side code...')

  const files = await glob('**/*.{js,vue}', {
    ignore: [
      'node_modules/**',
      'dist/**',
      '**/__tests__/**',
      '**/test/**',
      'scripts/**',
      'server/**',
      '**/server/**',
      'shared/server/**'
    ]
  })

  const violations = []

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Skip commented lines
      if (line.trim().startsWith('//')) return
      if (line.trim().startsWith('*')) return

      // Check for console.log (but allow console.warn, console.error)
      if (/console\.log\(/.test(line)) {
        violations.push(`${file}:${index + 1}`)
      }
    })
  }

  if (violations.length > 0) {
    error(`Found ${violations.length} console.log statement(s) in client-side code:`)
    violations.forEach(v => console.error(`  ${v}`))
    console.error('  Remove console.log statements or replace with console.warn/console.error if needed.')
    console.error('  Note: Server-side logging with console.log is allowed.')
  } else {
    success('No console.log statements found in client-side code')
  }
}

// Check 2: TODO comments should be rare
async function checkTodoComments() {
  info('Checking for TODO comments...')

  const files = await glob('**/*.{js,vue}', {
    ignore: ['node_modules/**', 'dist/**', '**/__tests__/**', '**/test/**']
  })

  const todos = []

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      if (/\/\/\s*TODO|\/\*\s*TODO|\*\s*TODO/.test(line)) {
        todos.push(`${file}:${index + 1}: ${line.trim()}`)
      }
    })
  }

  if (todos.length > 3) {
    warn(`Found ${todos.length} TODO comments (should be tracked in Jira instead):`)
    todos.forEach(t => console.warn(`  ${t}`))
  } else if (todos.length > 0) {
    info(`Found ${todos.length} TODO comment(s) (acceptable)`)
  } else {
    success('No TODO comments found')
  }
}

// Check 3: Co-Authored-By in commits
function checkCommitAuthorship() {
  info('Checking commit authorship...')

  try {
    // Get commits in this branch (not in origin/main)
    const commitHashes = execSync('git log origin/main..HEAD --format="%H"', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)

    if (commitHashes.length === 0) {
      info('No new commits to check')
      return
    }

    const missingCoAuthor = []

    commitHashes.forEach(hash => {
      const subject = execSync(`git log --format=%s -n 1 ${hash}`, { encoding: 'utf8' }).trim()
      const body = execSync(`git log --format=%b -n 1 ${hash}`, { encoding: 'utf8' }).trim()
      const fullMessage = `${subject}\n${body}`

      if (!fullMessage.includes('Co-Authored-By: Claude Sonnet')) {
        missingCoAuthor.push(`${hash.substring(0, 7)}: ${subject}`)
      }
    })

    if (missingCoAuthor.length > 0) {
      error(`Found ${missingCoAuthor.length} commit(s) without Co-Authored-By line:`)
      missingCoAuthor.forEach(c => console.error(`  ${c}`))
      console.error('  Add "Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>" to commit messages')
    } else {
      success(`All ${commitHashes.length} commit(s) have proper Co-Authored-By line`)
    }
  } catch {
    // Likely not in a git repo or origin/main doesn't exist
    warn('Could not check commit authorship (not a git branch?)')
  }
}

// Check 4: Feature branch naming convention
function checkBranchName() {
  info('Checking branch naming convention...')

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()

    // Allow main, develop, and properly named feature/fix/etc branches
    const validPrefixes = ['feature/', 'fix/', 'refactor/', 'test/', 'docs/', 'chore/']
    const specialBranches = ['main', 'develop']

    if (specialBranches.includes(branch)) {
      info(`On special branch: ${branch}`)
      return
    }

    const hasValidPrefix = validPrefixes.some(prefix => branch.startsWith(prefix))

    if (!hasValidPrefix) {
      error(`Branch name "${branch}" doesn't follow convention`)
      console.error(`  Expected: feature/<module>-<description> or fix/<module>-<description>`)
    } else {
      success(`Branch name follows convention: ${branch}`)
    }
  } catch {
    warn('Could not check branch name')
  }
}

// Check 5: New modules have proper structure
async function checkModuleStructure() {
  info('Checking module structure for new modules...')

  try {
    // Get list of added files in this PR
    const newFiles = execSync('git diff --name-only --diff-filter=A origin/main..HEAD', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)

    // Find new module.json files
    const newModules = newFiles.filter(f => f.match(/^modules\/[^/]+\/module\.json$/))

    if (newModules.length === 0) {
      info('No new modules added')
      return
    }

    for (const moduleFile of newModules) {
      const modulePath = moduleFile.replace('/module.json', '')
      const moduleName = modulePath.split('/').pop()

      // Check required structure
      const requiredPaths = [
        `${modulePath}/client/index.js`,
        `${modulePath}/server/index.js`,
        `${modulePath}/__tests__`
      ]

      const missing = requiredPaths.filter(p => !existsSync(p))

      if (missing.length > 0) {
        error(`New module "${moduleName}" is missing required structure:`)
        missing.forEach(p => console.error(`  ${p}`))
      } else {
        success(`New module "${moduleName}" has proper structure`)
      }
    }
  } catch {
    warn('Could not check module structure')
  }
}

// Run all checks
async function main() {
  console.log('=== PR Validation Checks ===\n')

  await checkConsoleLogs()
  await checkTodoComments()
  checkCommitAuthorship()
  checkBranchName()
  await checkModuleStructure()

  console.log('\n=== Validation Complete ===')

  if (hasErrors) {
    console.error('\n❌ Validation failed. Please fix the errors above.')
    process.exit(1)
  } else {
    console.log('\n✅ All validation checks passed!')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('Validation script error:', err)
  process.exit(1)
})
