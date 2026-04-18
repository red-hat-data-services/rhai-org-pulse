Bootstrap a new built-in module for the People & Teams app.

Ask the user for:

1. **Module name** (display name, e.g., "Sprint Health")
2. **Slug** (URL-safe identifier, e.g., "sprint-health")
3. **Description** (short, for landing page)
4. **Icon** (Lucide icon name, e.g., "bar-chart", "box", "search")
5. **Needs backend?** (whether to include server routes)

Then perform these steps:

## 1. Copy the template

```bash
cp -r docs/module-template modules/<slug>
```

## 2. Update module.json

Edit `modules/<slug>/module.json` with the provided name, slug, description, and icon. Update `navItems[0].label` to match the module name. If no backend is needed, remove the `server` section.

## 3. Update view template

Edit `modules/<slug>/client/views/MainView.vue` — replace "My Module" with the module name.

## 4. Update test

Edit `modules/<slug>/__tests__/client/MainView.test.js` — update the expected text to match the module name.

## 5. Add CODEOWNERS entry

Add to `.github/CODEOWNERS` (before the `module.json` wildcard line):

```
/modules/<slug>/          @<github-username>
```

Ask the user for their GitHub username if not known.

## 6. Validate

```bash
npm run validate:modules
```

## 7. Run tests

```bash
npm test
```

Confirm both pass before finishing.
