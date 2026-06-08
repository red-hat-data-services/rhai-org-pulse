# Documentation View — Graph Reference

The Documentation view (`DocumentationContent.vue` + `MrKpiCharts.vue`)
displays seven graphs across two rows. This document describes each graph's
purpose, data source, and interpretation.

## Row 1 — Documentation KPIs (`DocumentationContent.vue`)

Three graphs in a `lg:grid-cols-3` layout covering Jira-side documentation
activity.

### Graph A: Features Ready for Documentation

- **Type**: Line chart (area fill)
- **Source**: `trendData[].demand` from doc-fetcher
- **What it shows**: Count of RHAISTRAT issues in Review or Release Pending
  with "Product Documentation Required" = Yes, over time
- **Interpretation**: Rising trend = growing doc demand; flat/declining =
  stable or shrinking backlog. This is independent of the AI-First tool —
  it measures the demand signal, not the response.

### Graph B: Coverage Rate

- **Type**: Stacked bar chart
- **Source**: `trendData[].contributedCount`, `trendData[].skippedCount`
- **What it shows**: How many demand issues have been covered, split by
  "AI Generated" (`ai1st-doc-contributed` label) vs "Skipped"
  (`ai1st-doc-skip` — already has docs/release notes)
- **Interpretation**: Growing stack = AI-First tool is covering more issues.
  The headline percentage is `(contributed + skipped) / demand`.

### Graph C: Tool Activity

- **Type**: Dual line chart (area fill)
- **Source**: `trendData[].invokedRate`, `trendData[].contributedRate`
- **What it shows**: 7-day rolling average of daily label additions from
  Jira changelog — "invoked" (tool started) vs "contributed" (MR raised)
- **Interpretation**: Rising = tool accelerating; flat = stable usage. Gap
  between invoked and contributed indicates how often the tool starts but
  doesn't produce an MR.

## Row 2 — MR Quality KPIs (`MrKpiCharts.vue`)

Four graphs in a `lg:grid-cols-4` layout covering GitLab merge request
quality metrics. Data comes from `doc-mr-kpi-data.json`, fetched from
GitLab via `mr-kpi-fetcher.js`.

### Graph E: AI Draft Maturity Score (position 1)

- **Type**: Line chart (area fill) with headline percentage
- **Source**: Computed from `mr.commitCount` and `mr.commentCount` per
  merged MR
- **What it shows**: A composite score estimating how mature AI-generated
  drafts are at submission — i.e. how close to merge-ready without human
  intervention. Displayed as a weekly average trend over the last 3 months,
  with an overall headline percentage.

#### Formula

```
score = 1 / (1 + 0.3 * (commits - 1) + 0.1 * comments)
```

- **commits** — total commit count. The initial AI commit is subtracted
  (−1) because it is not rework.
- **comments** — total review comment count. Weighted 3x lower than
  commits because discussion is not always rework.
- **Range** — 0 to 1 (displayed as 0–100%).

#### Interpretation

| Score | Color | Meaning |
|-------|-------|---------|
| 70–100% | Green | AI output merged as-is or with light review |
| 40–69% | Yellow | Normal review process with some rework |
| < 40% | Orange | Significant human rework needed |

#### Parameter rationale

- **α = 0.3** (commits weight): Each additional commit beyond the first
  represents a code-change cycle — the strongest rework signal.
- **β = 0.1** (comments weight): Review comments can be discussion,
  context-setting, or approval — not necessarily rework.
- Harmonic decay (vs exponential) was chosen so that heavily-reworked MRs
  still produce distinguishable scores (long tail), keeping the weekly
  trend line readable.

#### Design intent

This graph is the "executive summary" of the row — placed first so it's
the first thing leadership sees. They can read a single percentage and its
trend direction without interpreting the distribution charts. The remaining
three graphs (D, F, G) provide the engineering-level breakdown behind the
number.

### Graph D: Commits per MR (position 2)

- **Type**: Stacked bar chart (Open + Merged)
- **Source**: `mr.commitCount` distribution across active MRs
- **What it shows**: How many MRs have 1 commit, 2 commits, etc. Stacked
  by state (open vs merged).
- **Interpretation**: Concentration at 1 commit = AI output ships as-is.
  Long tail toward higher counts = MRs need multiple rework cycles.

### Graph F: Comments per MR (position 3)

- **Type**: Stacked bar chart (Open + Merged)
- **Source**: `mr.commentCount` bucketed in ranges of 5 (0–4, 5–9, etc.)
- **What it shows**: Distribution of review comment counts across active
  MRs, stacked by state.
- **Interpretation**: Concentration in the 0–4 bucket = MRs need little
  discussion. Spread into higher buckets = more review cycles needed.

### Graph G: Time to First Review (position 4)

- **Type**: Bar chart with clickable infinity (∞) bar
- **Source**: `mr.firstReviewAt` minus `mr.createdAt`, bucketed into time
  ranges (<4h, 4–12h, 12–24h, 1–3d, 3d+, ∞)
- **What it shows**: How quickly human reviewers engage with AI-generated
  MRs. The ∞ bar counts MRs with no human review yet — clicking it shows
  a popover listing those MRs with links.
- **Interpretation**: Concentration in <4h and 4–12h = reviewers are
  responsive. Heavy ∞ bar = MRs are being ignored.
