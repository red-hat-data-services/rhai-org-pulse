---
repository: "red-hat-data-services/product-pages-generator"
overall_score: 0.6
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "Only a placeholder contextLoads() test — no real unit tests exist"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests of any kind"
  - dimension: "Build Integration"
    score: 1.0
    status: "Maven build works but no PR triggers — code merges unchecked"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images or Dockerfiles — runs as a JAR only"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tools, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "Single workflow on push-to-main and weekly cron — no PR gating"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Hardcoded API token in source code"
    impact: "Smartsheet API access token committed to public GitHub repository — credential leak"
    severity: "CRITICAL"
    effort: "1 hour"
  - title: "No tests for business logic"
    impact: "Date calculations, version bumping, and SmartSheet writes have zero test coverage — bugs ship silently"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No PR-triggered CI — code merges without checks"
    impact: "Broken code reaches main branch without build verification or test execution"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning"
    impact: "Vulnerable dependencies (Spring Boot 2.5.5 is EOL) and hardcoded secrets go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Outdated dependencies (Spring Boot 2.5.5, JDK 11)"
    impact: "Known CVEs in EOL Spring Boot 2.5.x; JDK 11 approaching extended support end"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Rotate and remove the hardcoded API token"
    effort: "1 hour"
    impact: "Eliminates active credential exposure in a public repository"
  - title: "Add PR trigger to the CI workflow"
    effort: "30 minutes"
    impact: "Prevents broken code from reaching main branch"
  - title: "Add unit tests for date calculation methods"
    effort: "4-6 hours"
    impact: "Covers the most complex business logic — getNextFriday, getDatesWithoutWeekends, calculateNextVersion"
  - title: "Upgrade to setup-java action and remove apt-get"
    effort: "30 minutes"
    impact: "Faster, more reliable CI with proper Java version management"
  - title: "Add Dependabot for dependency updates"
    effort: "30 minutes"
    impact: "Automated PRs for vulnerable and outdated dependencies"
recommendations:
  priority_0:
    - "IMMEDIATELY rotate the Smartsheet API token exposed in SmartsheetDateUtil.java line 35 and add gitleaks to prevent future secret commits"
    - "Add PR triggers to CI workflow to gate merges on build success"
    - "Write unit tests for all date calculation and version increment logic"
  priority_1:
    - "Upgrade Spring Boot from 2.5.5 (EOL) to 3.x and JDK from 11 to 17+"
    - "Add CodeQL or Semgrep for SAST scanning"
    - "Add code coverage generation with JaCoCo and enforce thresholds"
    - "Create a CLAUDE.md with project context and testing standards"
  priority_2:
    - "Add pre-commit hooks for code formatting (google-java-format)"
    - "Add integration tests that mock the Smartsheet SDK"
    - "Containerize the application with a Dockerfile for consistent execution"
    - "Move CombinedDateMonthDifference.java out of production code (appears to be scratch/test code)"
---

# Quality Analysis: product-pages-generator

## Executive Summary

- **Overall Score: 0.6 / 10**
- **Repository Type**: Internal automation tool (Spring Boot CLI + Python script)
- **Primary Language**: Java (Spring Boot 2.5.5), with a Python helper script
- **Purpose**: Automates RHOAI release schedule planning on SmartSheet
- **Size**: ~809 lines of Java, 1 Python script (37 lines)

### Key Strengths
- Functional application that accomplishes its automation goal
- Uses Spring Boot framework (though outdated version)
- Has a CI workflow that builds and runs the application weekly

### Critical Gaps
- **CRITICAL: Hardcoded Smartsheet API token committed to a public repository**
- Zero meaningful test coverage (only a placeholder Spring Boot context test)
- No PR-triggered CI — code merges to main unchecked
- No security scanning, linting, or code quality tools
- Severely outdated dependencies (Spring Boot 2.5.5 EOL, JDK 11)

### Agent Rules Status: **Missing** — No CLAUDE.md, AGENTS.md, or `.claude/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | Only placeholder `contextLoads()` — no business logic tests |
| Integration/E2E | 0/10 | None exist |
| **Build Integration** | **1/10** | **Maven build works but no PR triggers — code merges unchecked** |
| Image Testing | 0/10 | No container images or Dockerfiles |
| Coverage Tracking | 0/10 | No coverage tools, no codecov, no thresholds |
| CI/CD Automation | 2/10 | Single workflow on push-to-main and weekly cron |
| Agent Rules | 0/10 | No agent rules or testing guidance |

## Critical Gaps

### 1. CRITICAL: Hardcoded API Token in Source Code
- **File**: `src/main/java/com/smartsheet/smartsheetautomation/SmartsheetDateUtil.java:35`
- **Finding**: A Smartsheet API access token (`h9ffps5tf...`) is hardcoded in the source code of a public GitHub repository
- **Impact**: Anyone with access to the repository can use this token to read/write SmartSheet data
- **Severity**: CRITICAL
- **Effort**: 1 hour (rotate token, remove from code, use environment variable)
- **Fix**: Rotate the token immediately, replace with `System.getenv("ACCESS_TOKEN")` pattern already used in `SmartsheetAutomationApplication.java`

### 2. No Tests for Business Logic
- **Finding**: The only test file is `SmartsheetAutomationApplicationTests.java` with a single empty `contextLoads()` method
- **Impact**: Date calculations (`getNextFriday`, `getDatesWithoutWeekends`, `calculateNextVersion`, `getDateDifference`) have zero coverage — bugs in release schedule calculations ship silently
- **Severity**: HIGH
- **Effort**: 8-16 hours to add comprehensive unit tests
- **Untested critical methods**:
  - `calculateNextVersion()` — version incrementing
  - `getNextFriday()` / `getNextMonday()` — date arithmetic
  - `getDatesWithoutWeekends()` — business day calculations
  - `getDateDifference()` — release count calculation
  - `writeSmartsheetData()` — the main orchestration logic

### 3. No PR-Triggered CI
- **Finding**: The CI workflow only triggers on `push: branches: [main]` and a weekly cron schedule
- **Impact**: Pull requests are not validated before merge — broken builds, test failures, and regressions reach main
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. No Security Scanning
- **Finding**: No CodeQL, Trivy, Snyk, gitleaks, or any security scanning configured
- **Impact**: Vulnerable dependencies (Spring Boot 2.5.5 has known CVEs) and hardcoded secrets go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 5. Outdated Dependencies
- **Finding**: Spring Boot 2.5.5 (released Oct 2021, EOL), JDK 11 (approaching end of extended support)
- **Impact**: Known security vulnerabilities in EOL framework; no access to modern Java features and performance improvements
- **Severity**: MEDIUM
- **Effort**: 4-8 hours for upgrade

## Quick Wins

### 1. Rotate and Remove the Hardcoded API Token (1 hour)
Remove the hardcoded token from `SmartsheetDateUtil.java:35` and rotate it in SmartSheet. The `SmartsheetAutomationApplication.java` already reads from environment variables — apply the same pattern.

### 2. Add PR Trigger to CI Workflow (30 minutes)
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'
```

### 3. Upgrade to setup-java Action (30 minutes)
Replace the manual `apt-get install openjdk-11-jdk` with:
```yaml
- name: Set up JDK 17
  uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '17'
    cache: 'maven'
```

### 4. Add Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "maven"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 5. Add Unit Tests for Date Calculations (4-6 hours)
```java
@Test
void testCalculateNextVersion() {
    assertEquals("2.8", calc.calculateNextVersion("2.7"));
    assertEquals("3.0", calc.calculateNextVersion("2.9"));
    assertEquals("1.1", calc.calculateNextVersion("1.0"));
}

@Test
void testGetNextFriday() {
    // Monday -> Friday same week
    assertEquals(LocalDate.of(2024, 1, 5),
        calc.getNextFriday(LocalDate.of(2024, 1, 1)));
    // Friday -> same Friday (0 days added)
    assertEquals(LocalDate.of(2024, 1, 5),
        calc.getNextFriday(LocalDate.of(2024, 1, 5)));
}
```

## Detailed Findings

### CI/CD Pipeline

**Workflow**: `.github/workflows/java-ci.yml`

| Aspect | Finding | Grade |
|--------|---------|-------|
| PR Triggers | Missing — no PR gating | FAIL |
| Build | `mvn clean install -B` works | PASS |
| Test Execution | Tests run via Maven but only placeholder test exists | WEAK |
| Caching | No Maven dependency caching | FAIL |
| Actions Versions | Uses `actions/checkout@v2` (outdated, should be v4) | FAIL |
| JDK Setup | `apt-get install` instead of `setup-java` action | FAIL |
| Concurrency | No concurrency control configured | FAIL |
| Secret Handling | Uses `secrets.ACCESS_TOKEN` properly in workflow | PASS |

**Issues**:
1. No `pull_request` trigger — all code reaches main unchecked
2. `apt-get update && apt-get install openjdk-11-jdk` is slow and unreliable vs. `setup-java@v4`
3. No Maven caching — every build downloads all dependencies
4. Checkout action is 2 major versions behind
5. Workflow runs the application on every push to main (executes side effects against SmartSheet)

### Test Coverage

**Test File**: `src/test/java/com/smartsheet/smartsheetautomation/SmartsheetAutomationApplicationTests.java`

```java
@SpringBootTest
class SmartsheetAutomationApplicationTests {
    @Test
    void contextLoads() {
        // Empty — just verifies Spring context starts
    }
}
```

| Metric | Value |
|--------|-------|
| Test files | 1 |
| Test methods | 1 (empty placeholder) |
| Source files | 4 Java + 1 Python |
| Lines of code | ~809 Java |
| Test-to-code ratio | ~0.01 |
| Coverage | 0% meaningful coverage |
| Coverage tool | None |
| Coverage enforcement | None |

**Untested Methods (Risk Assessment)**:

| Method | Risk | Impact if Broken |
|--------|------|-----------------|
| `calculateNextVersion()` | HIGH | Wrong version numbers in release schedule |
| `getNextFriday()` | HIGH | Incorrect milestone dates |
| `getNextMonday()` | HIGH | Incorrect milestone dates |
| `getDatesWithoutWeekends()` | HIGH | Schedules on weekends |
| `getDateDifference()` | HIGH | Wrong number of releases planned |
| `writeSmartsheetData()` | CRITICAL | Corrupted SmartSheet data |

### Code Quality

| Tool | Status |
|------|--------|
| Linting (Checkstyle/SpotBugs) | Not configured |
| Code formatter | Not configured |
| Pre-commit hooks | Not configured |
| Static analysis (SpotBugs/PMD) | Not configured |
| EditorConfig | Not present |

**Code Quality Issues Found**:
1. `CombinedDateMonthDifference.java` — scratch/test file in production source path (wrong package, no package declaration)
2. Field naming: `Cells` (capital C) violates Java conventions
3. Unused `SmartsheetDateUtil.main()` with hardcoded credentials — appears to be debug code left in production
4. `printIndentData()` method appears unused
5. Raw type usage: `Map<String, String>` where parameterized types or records would be clearer
6. System.out.println used for logging instead of SLF4J/Logback (available via Spring Boot)
7. Exception handling via `e.printStackTrace()` instead of proper logging
8. Mixed date APIs: both `java.time` and legacy `java.util.Date`/`SimpleDateFormat`

### Container Images

**Status**: Not applicable — no Dockerfile, Containerfile, or container build process exists.

The application runs as a fat JAR (`smartsheet-automation-0.0.1-SNAPSHOT.jar`) directly via `java -jar`. There is no containerization strategy.

### Security

| Check | Status |
|-------|--------|
| **Hardcoded secrets** | **CRITICAL — API token in source** |
| CodeQL/SAST | Not configured |
| Dependency scanning | Not configured |
| Secret detection (gitleaks) | Not configured |
| Trivy/Snyk scanning | Not configured |
| Dependabot | Not configured |
| SBOM generation | Not configured |

**Security Finding — CRITICAL**:

In `SmartsheetDateUtil.java:35`:
```java
String accessToken = "h9ffps5tfyPBUOCArgYpsA02lQdcgnOIMEUkn";
```
A Smartsheet API access token is hardcoded in source code on a public GitHub repository. This token should be immediately rotated and the code changed to read from environment variables.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: Everything — no CLAUDE.md, no AGENTS.md, no `.claude/` directory, no `.claude/rules/`, no `.claude/skills/`
- **Recommendation**: Generate test rules with `/test-rules-generator` after adding actual tests

## Recommendations

### Priority 0 (Critical — Do Immediately)

1. **Rotate the exposed Smartsheet API token** — The token in `SmartsheetDateUtil.java:35` must be rotated in SmartSheet immediately, and the hardcoded value removed from the codebase. Use `git filter-branch` or BFG Repo Cleaner to remove it from git history as well.

2. **Add PR triggers to CI workflow** — Add `pull_request: branches: [main]` to prevent unvalidated code from reaching main.

3. **Write unit tests for date calculation methods** — `calculateNextVersion`, `getNextFriday`, `getNextMonday`, `getDatesWithoutWeekends`, and `getDateDifference` are pure functions that are straightforward to test and critical to correctness.

### Priority 1 (High Value — Next Sprint)

4. **Upgrade Spring Boot** from 2.5.5 (EOL) to 3.x and JDK from 11 to 17+ — addresses known CVEs and gains modern language features.

5. **Add CodeQL or Semgrep** for automated SAST scanning on PRs.

6. **Add gitleaks** to prevent future secret commits.

7. **Add JaCoCo code coverage** with Maven plugin and set a minimum threshold (start at 50%, increase over time).

8. **Create CLAUDE.md** with project context, coding standards, and testing expectations.

### Priority 2 (Nice-to-Have)

9. **Add pre-commit hooks** with google-java-format for consistent code style.

10. **Add integration tests** that mock the Smartsheet SDK to validate write operations without hitting the real API.

11. **Remove or relocate** `CombinedDateMonthDifference.java` (scratch file in production source).

12. **Containerize the application** with a Dockerfile for consistent, reproducible execution.

13. **Replace System.out.println** with SLF4J logging throughout the codebase.

14. **Clean up unused code** — `SmartsheetDateUtil.main()`, `printIndentData()`, and other debug methods.

## Comparison to Gold Standards

| Dimension | product-pages-generator | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| Unit Tests | 1/10 (placeholder only) | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 1/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 0/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 2/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **0.6/10** | **8.5/10** | **7.0/10** | **8.0/10** |

## File Paths Reference

| File | Purpose | Notes |
|------|---------|-------|
| `.github/workflows/java-ci.yml` | CI workflow | Push-to-main + weekly cron only |
| `pom.xml` | Maven build config | Spring Boot 2.5.5, JDK 11 |
| `config.properties` | Runtime configuration | Contains sheet ID, empty token field |
| `src/main/java/.../SmartsheetAutomationApplication.java` | Entry point | Reads token from env var (good) |
| `src/main/java/.../UpdateSmartsheetDateCalculation.java` | Core logic | Date calculations, SmartSheet writes |
| `src/main/java/.../SmartsheetDateUtil.java` | Utilities | **Contains hardcoded API token** |
| `src/main/java/CombinedDateMonthDifference.java` | Scratch file | Should not be in production source |
| `src/python/ProductPageAPI.py` | Product page API caller | Template with placeholder values |
| `src/test/java/.../SmartsheetAutomationApplicationTests.java` | Test file | Empty placeholder test only |
