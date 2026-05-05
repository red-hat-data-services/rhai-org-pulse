# User Stories: Team Structure Management

## Overview

These user stories define making the app the source of truth for team structure data. The Google Sheet remains a read-only import source during roster sync, but all edits happen in the app.

### Key Decisions

- **LDAP remains the source of truth** for identity data (name, email, title, location, etc.)
- **Immediate persistence** — no draft/save workflow; changes take effect instantly

### Permission Tiers

| Tier | Detection | Scope |
|------|-----------|-------|
| **Admin** | Configured in allowlist | Full access across all orgs |
| **Manager** | Any person in the roster has `managerUid` matching their UID | Full LDAP org subtree beneath them |
| **Regular User** | All other authenticated users | Read-only |

### Custom Field Value Types

| Type | Description |
|------|-------------|
| **Free-text** | Arbitrary string input |
| **Constrained (enum)** | Selection from admin-defined allowed values |
| **Person reference (linked)** | Reference to a person in the roster; renders as a clickable link to their detail page |
| **Person reference (unlinked)** | Person name displayed as plain text (for people not in the app, e.g., PMs outside engineering) |

---

## Epic 1: Role-Based Access Control (RBAC)

**US-1.1** As a **system**, I can determine whether a logged-in user is a people manager by checking if any person in the roster has a `managerUid` matching their UID, so that manager-tier permissions can be granted automatically.

**US-1.2** As an **admin**, I can see which permission tier (admin, manager, regular user) each person has, so I understand who can make changes.

**US-1.3** As a **manager**, I can edit team assignments and field values for any person or team within my full LDAP org subtree (not just direct reports), so I can manage my entire organization.

**US-1.4** As an **admin**, I can edit team assignments and field values for any person or team across all orgs, so I have unrestricted management capability.

**US-1.5** As a **regular user**, I can view all team structure data but cannot make any edits, so the data is accessible but protected.

---

## Epic 2: Team Management

**US-2.1** As an **admin**, I can create a new team by specifying a name and selecting which org it belongs to, so that new teams can be established without editing the spreadsheet.

**US-2.2** As an **admin**, I can rename an existing team, so team names can evolve without data loss.

**US-2.3** As an **admin**, I can delete a team, and all its members become unassigned, so defunct teams can be cleaned up.

**US-2.4** As a **manager or admin**, I can assign a person to a team within my org, so team membership is kept current.

**US-2.5** As a **manager or admin**, I can unassign a person from a team, moving them to the unassigned bucket, so team composition can be adjusted.

**US-2.6** As a **manager or admin**, I can assign a person to multiple teams, so that cross-team contributors are accurately represented.

**US-2.7** As an **admin**, I can assign a person to a team even if that person is not in the admin's own LDAP subtree (cross-org assignment), so org boundaries don't prevent accurate team structure.

**US-2.8** As a **manager or admin**, I can view an "unassigned" bucket showing people in my org (or any org, for admins) who are not assigned to any team, so I can identify who still needs placement.

**US-2.9** As a **user**, I can toggle the unassigned view scope between "my direct reports," "my full org," and "everyone" (admin only for "everyone"), so I can focus on the relevant set of unassigned people.

---

## Epic 3: Person-Level Custom Fields

**US-3.1** As an **admin**, I can create a new person-level custom field with a label, value type (free-text, constrained, person-reference-linked, or person-reference-unlinked), required/optional flag, and display settings (visible, primary display), so the data model can be extended without code changes.

**US-3.2** As an **admin**, I can define allowed values for a constrained (enum) person-level field, so data entry is consistent.

**US-3.3** As an **admin**, I can edit a person-level custom field definition (rename, change allowed values, toggle required/optional, change display settings), so field definitions can evolve.

**US-3.4** As an **admin**, I can reorder person-level custom fields to control the display order in the UI.

**US-3.5** As an **admin**, I can soft-delete a person-level custom field, hiding it from the UI while preserving existing data, so deletions are non-destructive.

**US-3.6** As a **manager or admin**, I can edit person-level custom field values for people in my org (or any org, for admins), and the change takes effect immediately.

**US-3.7** As a **user**, I can see person-level custom field values displayed on person cards and detail views according to the field's display settings (visible, primary display).

---

## Epic 4: Team-Level Metadata Fields

**US-4.1** As an **admin**, I can create a new team-level metadata field with a label, value type (free-text, constrained, person-reference-linked, or person-reference-unlinked), required/optional flag, and display settings, so teams can carry structured metadata.

**US-4.2** As an **admin**, I can define allowed values for a constrained (enum) team-level field.

**US-4.3** As an **admin**, I can edit a team-level metadata field definition (rename, change allowed values, toggle required/optional, change display settings).

**US-4.4** As an **admin**, I can reorder team-level metadata fields to control the display order in the UI.

**US-4.5** As an **admin**, I can soft-delete a team-level metadata field, hiding it from the UI while preserving existing data.

**US-4.6** As a **manager or admin**, I can edit team-level metadata values for teams in my org (or any org, for admins), and the change takes effect immediately.

**US-4.7** As a **user**, I can see team-level metadata displayed on team views according to the field's display settings.

**US-4.8** As a **user**, when a team metadata field is a person-reference-linked type, I can click the value to navigate to that person's detail page.

**US-4.9** As a **user**, when a team metadata field is a person-reference-unlinked type, I see the person's name displayed as plain text (no link).

---

## Epic 5: Audit Log

**US-5.1** As a **system**, I record an audit log entry for every data change, capturing: who made the change, what was changed (entity type, entity ID, field name), old value, new value, and timestamp.

**US-5.2** As a **system**, I record audit log entries for structural changes: team created, team deleted, team renamed, custom field created/modified/deleted, allowed value added/removed.

**US-5.3** As an **admin**, I can view the full audit log across all orgs, with filtering by date range, change type, and user.

**US-5.4** As a **manager**, I can view audit log entries relevant to my org subtree, so I can track changes within my scope.

**US-5.5** As a **user**, audit log entries are purely informational with no undo/rollback capability.

---

## Epic 6: LDAP Data Protection

**US-6.1** As a **system**, I prevent editing of any field that originates from LDAP (name, UID, email, title, city, country, geo, location, office location, cost center, manager), enforcing LDAP as the source of truth for those attributes.

**US-6.2** As a **user**, I can see LDAP-sourced fields displayed on person views, but they are clearly non-editable (no edit controls shown).

---

## Non-Functional / Cross-Cutting

**US-NF.1** As a **system**, all edits are persisted immediately (no draft/save workflow) — changes are reflected in the app without delay.
