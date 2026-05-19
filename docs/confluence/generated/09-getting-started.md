<!-- Space: RHAI -->
<!-- Parent: Org Pulse Application -->
<!-- Title: Org Pulse — Getting Started -->

# Org Pulse — Getting Started

| | |
|---|---|
| **Platform Lead** | Saiesh Prabhu ([@saprabhu05](https://github.com/saprabhu05)) |
| **Platform Co-Lead** | Erle Marion ([@emarion](https://github.com/emarion)) |
| **Production URL** | [https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/) |
| **Repository** | [red-hat-data-services/rhai-org-pulse](https://github.com/red-hat-data-services/rhai-org-pulse) |

---

## Prerequisites

Before accessing Org Pulse, ensure you have the following:

- **Red Hat VPN access** — You must be connected to the Red Hat internal VPN to reach the production environment.
- **@redhat.com account** — A valid Red Hat corporate email address is required for authentication.
- **OpenShift OAuth authentication** — Org Pulse uses OpenShift OAuth as its identity provider. Your Red Hat SSO credentials are used to authenticate.
- **Allowlist approval** — An administrator must add your @redhat.com email address to `data/allowlist.json` in the repository before you can access the platform. Contact your team lead or an existing admin to request access.

---

## Accessing Org Pulse

Follow these steps to access the production instance:

1. **Connect to the Red Hat VPN** — Launch your VPN client and connect to the Red Hat internal network.
2. **Navigate to the production URL** — Open your browser and go to:
   [https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. **Authenticate via OpenShift OAuth** — You will be redirected to the OpenShift OAuth login page. Sign in with your Red Hat SSO credentials.
4. **Land on the home page** — After successful authentication, you will be directed to the Org Pulse home page, which displays module cards for each available feature area.

> **Note:** If you receive a 403 Forbidden error after authenticating, your email has not yet been added to the allowlist. Contact an administrator.

---

## Demo Mode

For local exploration without VPN access or production credentials, Org Pulse supports a **Demo Mode** that loads fixture data.

To run Org Pulse in Demo Mode:

1. Clone the repository:
   ```bash
   git clone https://github.com/red-hat-data-services/rhai-org-pulse.git
   cd rhai-org-pulse
   ```

2. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set the following variables:
   ```
   DEMO_MODE=true
   VITE_DEMO_MODE=true
   ```

4. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```

The application will start locally with synthetic fixture data, allowing you to explore all modules and UI features without connecting to any external data sources.

---

## API Access

Org Pulse provides programmatic access to all REST endpoints via API tokens.

### Creating an API Token

1. Click on the **User Menu** in the top-right corner of the application.
2. Select **API Tokens**.
3. Click **Create Token**, provide a descriptive name, and copy the generated token.

### Using Your Token

Include the token in the `Authorization` header of your HTTP requests:

```bash
curl -H "Authorization: Bearer <your-token>" \
  https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/<endpoint>
```

### Interactive API Documentation

Full interactive API documentation is available via Swagger UI at:

```
/api/docs
```

Navigate to [https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) to browse all available endpoints, view request/response schemas, and execute test requests directly from your browser.

---

## Navigating Modules

Org Pulse is organized into self-contained **modules**, each providing a focused set of views and functionality.

- **Sidebar navigation** — The left sidebar provides access to all enabled modules. Module sections are collapsible for a cleaner workspace.
- **Module views** — Each module defines its own set of views (e.g., dashboards, tables, detail pages). Click a module in the sidebar to expand its available views.
- **Admin module management** — Administrators can enable or disable modules via **Settings > Modules**. Disabled modules are hidden from all users.

---

## FAQ

### How often is data refreshed?

Data is refreshed **daily at 06:00 UTC** via an OpenShift CronJob. The CronJob pulls the latest data from all configured external sources (Jira, GitHub, GitLab, LDAP, Google Sheets) and updates the local JSON data store.

### How do I get added to the allowlist?

Contact an existing Org Pulse administrator. They will add your @redhat.com email address to `data/allowlist.json` in the repository and deploy the change. You can also open a pull request yourself and request review from a platform lead.

### Can I contribute a new module?

Yes. Org Pulse uses a manifest-driven module architecture designed for extensibility. See the **Module Development Guide** in the repository documentation for step-by-step instructions on creating, registering, and testing a new module.

---

*This page is auto-generated from the Org Pulse repository. Do not edit manually — changes will be overwritten on the next publish cycle.*
