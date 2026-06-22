# Platform Extensions

The `platform/` directory holds deployment-specific customizations to core UI.
This is separate from `modules/` (which are for feature domains). Platform
extensions customize core chrome — tabs, panels, branding — without forking
core files.

## How it works

Core discovers platform extensions via Vite's `import.meta.glob`. When
`platform/` is absent (core-only deployments), the globs return empty objects
and no platform extensions are loaded. No conditional logic is needed.

## About Page Tabs (`platform/about-tabs/`)

The About page supports extensible tabs via `platform/about-tabs/manifest.json`.

### Manifest format

```json
{
  "tabs": [
    {
      "id": "docs",
      "label": "Docs",
      "icon": "BookOpen",
      "component": "./DocsTab.vue",
      "order": 15
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique tab identifier |
| `label` | string | yes | Display text on the tab button |
| `icon` | string | yes | Lucide icon name (resolved via shared ICON_MAP) |
| `component` | string | yes | Path to Vue component relative to `platform/about-tabs/` |
| `order` | number | no | Sort position (default: 100) |
| `requireRole` | string | no | Role required to see this tab |

### Core tab ordering

| Order | Tab |
|-------|-----|
| 10 | About |
| 30 | Site Usage |
| 40 | Backups |
| 50 | Help & Debug |

Platform tabs default to `order: 100` (after all core tabs). Set a lower value
to insert between core tabs — e.g., `15` places a tab between About and Site
Usage.

### Adding a new tab

1. Create a Vue component in `platform/about-tabs/` (e.g., `MyTab.vue`)
2. Add an entry to `platform/about-tabs/manifest.json`
3. Run `npm run validate:platform` to verify the manifest
4. The tab appears automatically on the About page

### Component contract

Platform tab components receive no props and emit no events. They are
standalone sections that render their own content.

## Dockerfile layering

The core frontend builder does NOT include `platform/`. Deployment-specific
Dockerfiles add it:

```dockerfile
# In deploy/ai-eng.frontend.Dockerfile
COPY platform/ ./platform/
```

## Validation

Run `npm run validate:platform` to check manifest structure. This runs
automatically in CI. It gracefully skips if `platform/` doesn't exist
(core-only builds).
