# Commitment Tracking vs. Delivery Analysis: Independent JQL Configuration

## Overview

The Releases module has two distinct subsystems that query Jira for features:

1. **Delivery Analysis** (Deliver tab: Risk Dashboard, Component Breakdown, etc.)
2. **Commitment Tracking** (Reports → Commitment Tracking)

These use **separate JQL configurations** so they can be tuned independently.

## Configuration

Located in `data/releases/delivery/config.json`:

```json
{
  "targetVersionJqlFragment": "cf[10855] in (\"rhoai-3.5\", ...)",
  "commitmentTrackingJql": "cf[10855] is not EMPTY"
}
```

### `targetVersionJqlFragment`
- **Used by**: Delivery Analysis (`/api/modules/releases/delivery/refresh`)
- **Purpose**: Controls which releases appear in the Deliver tab views
- **Typical value**: Hardcoded list of specific versions for current/future releases only
- **Example**: `cf[10855] in ("rhoai-3.5", "rhoai-3.6")` (hides past releases like 3.4)

### `commitmentTrackingJql`
- **Used by**: Commitment Tracking snapshot creation (`/api/modules/releases/delivery/commitment/snapshot/:version/:phase`)
- **Purpose**: Auto-discovers all versions for OKR tracking (including historical)
- **Typical value**: `cf[10855] is not EMPTY` (pulls everything, frontend filters to 3.4+)
- **Example**: Auto-discovers 3.4, 3.5, 3.6, 3.7, 4.0, etc. without manual updates

## Why Separate?

**Problem**: Delivery views should only show current/future releases, but Commitment Tracking needs historical data (3.4, 3.5, etc.) for OKR tracking.

**Solution**: Two independent JQL clauses.

- Delivery Analysis can filter to current releases without breaking Commitment Tracking
- Commitment Tracking auto-discovers future versions (3.7, 4.0) without manual config updates
- No risk of one breaking the other

## Production Setup

In production, after PR #772 merges:

1. Delivery Analysis will continue using its hardcoded list (no change)
2. Commitment Tracking will use `cf[10855] is not EMPTY` to auto-discover all versions
3. The two systems are **completely independent** - changing one does not affect the other

## Data Flow

### Delivery Analysis
1. Uses `targetVersionJqlFragment` to query Jira
2. Writes results to `data/releases/delivery/analysis-cache.json`
3. Deliver tab views read from this cache

### Commitment Tracking
1. Uses `commitmentTrackingJql` to query Jira **directly** (bypasses analysis cache)
2. Filters to requested version (e.g., 3.4) after fetching
3. Creates snapshot in `data/releases/planning/committed-snapshot-{version}-{phase}.json`
4. Compares snapshot vs. current Jira state for % delivered metric

**Key**: Commitment Tracking does NOT use the delivery analysis cache, so the two systems cannot interfere with each other.
