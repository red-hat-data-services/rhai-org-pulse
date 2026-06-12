# Customer Insights Module - PR Summary

## What This Adds

A complete Customer Insights module for tracking customer interactions, feedback, and product roadmap alignment.

### Core Features

✅ **Customer Interaction Tracking**
- Kanban board view (by engagement stage)
- Table view with filtering
- Detail modals with full interaction history

✅ **Analytics Dashboard**
- Customer segmentation (geography, industry, environment)
- Interaction status tracking
- AI tool usage analysis
- Pain point trends
- Wishlist/feature request aggregation

✅ **AI-Powered Insights**
- Gemini (models.corp) integration
- Automated analysis of customer feedback
- Strategic recommendations
- Competitive signals detection

✅ **Product Roadmap**
- Customer-driven initiatives tracking
- ARR impact visibility
- Deliverable tracking
- AI-powered roadmap recommendations (priority adjustments, coverage gaps, quick wins)

✅ **RFE Creation Workflow**
- AI-powered duplicate detection
- Pre-filled from customer interactions
- Jira integration (creates issues in redhat.atlassian.net)
- Demo mode (saves locally without Jira)

✅ **Data Import**
- CSV upload with column mapping
- Transcript extraction (meeting notes → structured data)
- **Google Drive OAuth integration** (optional, requires setup)

### Architecture

**Per-user OAuth:**
- Google Drive import uses per-user authentication
- Each user authenticates with their own Google account
- No shared credentials for Drive access

**Demo mode support:**
- All features work with fixture data
- No external API credentials required for testing

**Module system:**
- Self-contained in `modules/customer-insights/`
- No cross-module dependencies
- Auto-discovered by module loader

## Files Changed

### New Module
```
modules/customer-insights/
├── module.json                          # Module manifest
├── client/
│   ├── index.js                        # Client entry point
│   ├── views/                          # 7 views (Kanban, Table, Dashboard, etc.)
│   ├── components/                     # 3 components (RoadmapCard, etc.)
│   └── composables/                    # 8 composables (API clients)
├── server/
│   ├── index.js                        # Server entry point
│   ├── routes/                         # 8 route files
│   └── services/                       # Jira client, RFE builder, Google auth
└── fixtures/                           # Demo data

fixtures/customer-insights/             # Demo fixture data
```

### Documentation
```
docs/GOOGLE-DRIVE-INTEGRATION.md        # Architecture & security
docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md  # Step-by-step setup (10 mins)
GOOGLE-DRIVE-QUICKSTART.md              # Quick reference
CUSTOMER-INSIGHTS-PR-SUMMARY.md         # This file
```

### Configuration
```
eslint.config.mjs                       # Added 'test' global for Vitest
```

## Configuration Required

### Required for Full Functionality

**Jira (RFE creation):**
```bash
JIRA_EMAIL=your-email@redhat.com
JIRA_TOKEN=your-jira-api-token
```

**models.corp (AI insights):**
```bash
MODELS_CORP_API_KEY=your-api-key
MODELS_CORP_BASE_URL=https://gemini--apicast-production.apps...
```

### Optional (Google Drive Import)

**Google OAuth (per-user Drive access):**
```bash
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
GOOGLE_PICKER_API_KEY=AIzaSy...
VITE_GOOGLE_PICKER_API_KEY=AIzaSy...  # Same as above, for frontend
```

**Session support (required for OAuth):**
```bash
npm install express-session
```

Add to `server/dev-server.js` after line 176:
```javascript
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));
```

**Setup guide:** See `docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md` (10-15 minutes)

## What Works Without Configuration

✅ All views load and display correctly (with demo data)  
✅ CSV/transcript import  
✅ Kanban/table/dashboard/analytics  
✅ RFE creator (saves locally, no Jira issues created)  
✅ Roadmap view  

❌ AI insights generation (needs models.corp API)  
❌ Jira RFE creation (needs Jira credentials)  
❌ Google Drive import (needs OAuth setup)  

## Security Notes

### Per-User OAuth (Google Drive)
- Each user authenticates with **their own** Google account
- Tokens stored in HTTP-only session cookies (not accessible to JavaScript)
- Read-only Drive access (`drive.readonly` scope)
- CSRF protection via state parameter
- Admin's Drive is **not accessible** to other users

### Shared Credentials (Jira)
- Uses **one Jira account** for all RFE creation
- Recommended: Create a service account (e.g., `pulse-bot@redhat.com`)
- All RFEs appear as created by that account
- Can be left unconfigured (demo mode)

### AI Integration (models.corp)
- Shared API key for all users
- No personal data accessed (only customer feedback text)

## Testing

**Local testing (demo mode):**
```bash
cp .env.example .env.local
# Set DEMO_MODE=true
npm run dev:full
# Navigate to Customer Insights
```

**Local testing (with Google Drive):**
```bash
# Follow docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md
# Add credentials to .env.local
# Install express-session
# Add session middleware to server/dev-server.js
npm run dev:full
```

**Smoke tests:**
```bash
make smoke-test  # Tests app loads without errors
```

## Deployment Notes

### Production Checklist

1. **Google OAuth credentials:**
   - Create **separate** Google Cloud project for production
   - Use production URL in redirect URIs
   - Add credentials to deployment secrets

2. **Session secret:**
   - Set `SESSION_SECRET` to secure random value
   - Use environment variable (not hardcoded)

3. **Jira credentials:**
   - Use service account (not personal)
   - Add to deployment secrets

4. **models.corp:**
   - Add API key to deployment secrets

### Environment-Specific URLs

Google OAuth redirect URIs must match **exactly**:
- Dev: `http://localhost:5173/api/modules/customer-insights/auth/google/callback`
- Prod: `https://your-domain.com/api/modules/customer-insights/auth/google/callback`

Create separate OAuth clients for each environment.

## Known Limitations

1. **Google Drive import requires session storage:**
   - Single-server: In-memory sessions work
   - Multi-server: Need Redis or similar (not implemented yet)

2. **Jira integration is shared account:**
   - Per-user Jira OAuth not implemented (future enhancement)

3. **AI insights require external models.corp:**
   - Cannot use OpenAI/Anthropic directly
   - Specific to Red Hat internal AI platform

## Next Steps (Future Work)

- [ ] Per-user Jira OAuth (so RFEs show actual creator)
- [ ] Redis session store (for multi-server deployments)
- [ ] Column mapping UI for Google Sheets
- [ ] Progress indicators for large file downloads
- [ ] Batch operations (bulk status updates, etc.)
- [ ] Export to CSV/Excel

## Questions?

See documentation:
- **Google Drive setup:** `docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md`
- **Architecture:** `docs/GOOGLE-DRIVE-INTEGRATION.md`
- **Quick start:** `GOOGLE-DRIVE-QUICKSTART.md`
