# Custom Fields — User Stories

## Custom Field Definitions

**As an admin**, I want to define custom fields for my organization so that I can track metadata specific to my org's needs (e.g., "Component", "Focus Area", "Pod").

**As an admin**, I want to specify whether a custom field applies to people, teams, or both, so that the field appears in the right contexts.

**As an admin**, I want to define a field as having a constrained set of options (enumerated values) so that users select from a predefined list rather than entering freeform text.

**As an admin**, I want to define a field as freeform text so that users can enter any value.

**As an admin**, I want to add, rename, and remove options from a constrained field over time as my org's needs evolve.

**As an admin**, I want to reorder custom fields so that the most important fields appear first in the UI.

**As an admin**, I want to soft-delete (archive) a custom field so that historical data is preserved but the field no longer appears for new assignments.

## Assigning Field Values

**As a manager**, I want to assign a value from a constrained field to a person on my team (e.g., assign someone to the "Model Serving" component) so that I can track what they work on.

**As a manager**, I want to assign multiple values from a constrained field to a single person so that I can represent someone working across areas (e.g., two components).

**As an admin**, I want to assign field values to a team (e.g., tag a team with its primary components) so that I can categorize teams by org-specific dimensions.

**As a manager**, I want to remove or change a field value assignment for a person or team so that assignments stay current.

## Viewing & Filtering

**As a user**, I want to see custom field values displayed on person and team views so that I understand how people and teams are categorized.

**As a user**, I want to filter or group people by a custom field value (e.g., show all people assigned to a specific component) so that I can find the right people quickly.

**As a user**, I want to filter or group teams by a custom field value so that I can find teams by org-specific categories.

**As a user**, I want to filter people or teams by multiple field values at once (e.g., component = "Model Serving" AND designation = "Staff Engineer") so that I can answer targeted questions across dimensions.

**As a user**, I want to see aggregate counts when filtering by a custom field (e.g., "12 engineers work on component X") so that I can understand staffing distribution without counting manually.

## Multi-tenancy / Org Flexibility

**As an org adopting the platform**, I want the system to work with zero custom fields defined so that I'm not forced to configure fields I don't need.

**As an admin**, I want each org to have its own set of custom field definitions so that different orgs using the same platform can track different metadata.

**As a user**, I want to see only the custom fields relevant to the org/team I'm viewing so that the interface isn't cluttered with fields from other orgs.

## Audit & Governance

**As an admin**, I want changes to field definitions and field value assignments to be recorded in the audit log so that I can track who changed what and when.
