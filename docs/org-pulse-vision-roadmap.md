# Org Pulse — Vision & Roadmap

**Steering Committee Alignment — H2 2026**

Giulia Naponiello | 23rd June 2026

---

## Contents

1. [Mission](#1-mission)
2. [Guiding Principles](#2-guiding-principles)
3. [Core Platform vs. Engineering Modules](#3-core-platform-vs-engineering-modules)
4. [Six-Month Roadmap](#4-six-month-roadmap)
5. [Governance & Cadence](#5-governance--cadence)

---

## 1. Mission

The core idea behind Org Pulse is pretty simple: we want to take the
organizational processes that teams have struggled to follow consistently and
bake them into the tool itself. Not a general-purpose dashboard, not a
second Jira — more like an opinionated view of how software should move
through our org. When a team is doing things right, it's obvious. When
something's off, that's obvious too.

This also gives us a filter for what belongs in the tool and what doesn't.
Before we build something new, we should be able to say: does this codify a
process, or show something that Jira and Rover genuinely can't? If the answer
is no, it probably shouldn't live here. We already have plenty of tools;
Org Pulse should fill gaps, not duplicate them.

## 2. Guiding Principles

### Validate before you build

We can generate features fast with AI, which makes it easy to ship things
nobody asked for. If we're not measuring whether people use what we build, we'll
end up with a bloated tool everyone ignores.

### Push automation into the repo, not just the dashboard

Reporting on violations is fine, but preventing them where engineers work is
better. If teams keep forgetting to set a component in Jira, the fix should be
a CI check, not just a red flag in a dashboard. We've been calling this the
"training wheels" pattern: Org Pulse puts up guardrails, and once teams are
doing the right thing on their own, we take them down.

### Show people what they need, not everything

A release manager and a developer don't need the same view. Role-based
landing pages would let each person see what's relevant to them instead of
wading through the same wall of data.

### Don't rebuild Jira

Default to existing Red Hat tools wherever they work. Org Pulse is worth
reaching for when it does something they can't — like showing delivery
bottlenecks across the full pipeline or connecting team structure to feature
flow.

## 3. Core Platform vs. Engineering Modules

Other teams have started deploying Org Pulse for their own orgs, which is
great but also means we need to think about what's "core platform" versus
what's specific to AI Engineering. We're working on this split: the module
system, roster sync, auth, storage, and deployment infrastructure would be the
shared core. Things like the releases module or AI Impact assessments are our
stuff, built on top.

For the roadmap, this matters because some work — tech debt, CI/CD,
monitoring — benefits everyone running Org Pulse, while feature work is
team-specific. Module owners would keep managing their own backlogs day-to-day;
the steering committee would focus on the bigger-picture priorities that cut
across modules.

## 4. Six-Month Roadmap

These are the priorities we landed on during the 9th June steering committee.
Nothing here is set in stone — things will shift as we learn more —
but it gives us a shared starting point for what to work on next.

| Priority | Area | What & Why |
|----------|------|------------|
| **High** | User-specific views | Role-based landing pages so each person sees what matters to them. Everyone in the meeting agreed this is the top priority. |
| **High** | Chatbot integration | Bring the chatbot over from the AIPCC dashboard. Org Pulse isn't mission-critical, so it's a good place to experiment — measure hallucination rates, iterate, and learn for when we build AI into real products. |
| **High** | Pipeline visualization | We want to see "the plumbing" — where things flow and where they're stuck. This is probably the biggest reason people reach for Org Pulse instead of Jira. |
| **High** | Technical maintenance | Monitoring, CI/CD, data management, backups — the stuff that tends to get pushed aside when there's a shiny new feature to build. We've been handling these reactively; we agreed they should get planned time instead. |
| **Medium** | Usage measurement | We need to know what people actually use. If a feature sits there for a quarter and nobody touches it, we should be comfortable removing it rather than maintaining it out of guilt. |
| **Medium** | Org Pulse Social | A LinkedIn-style social feature for team interaction has been proposed. Still early — there's a prototype out for feedback on whether it fits and what it should look like. |

> **Open question:** We agreed that tech maintenance needs dedicated time, but we haven't figured out how much. Should we reserve a fixed percentage of capacity, or just make sure it shows up on the roadmap alongside feature work?

## 5. Governance & Cadence

We're setting up a monthly sync — basically project office hours. People
bring topics, we review where things stand, make decisions. If there's nothing
to discuss, we skip it. Between meetings, the Slack channel is where updates
and proposals happen — re-architecture plans and bigger decisions would be
shared there so people can weigh in asynchronously.
