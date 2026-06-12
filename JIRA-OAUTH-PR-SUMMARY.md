# Jira OAuth 2.0 Per-User Authentication - Summary

## What This Adds

A **shared infrastructure** for per-user Jira authentication using OAuth 2.0 (3LO), enabling any module to create Jira issues as the actual user instead of a shared service account.

## Key Benefits

✅ **Per-user authentication**: Each user connects their own Atlassian account  
✅ **Correct issue attribution**: RFEs show the real creator, not a bot  
✅ **Automatic token refresh**: Tokens refresh automatically for 90 days  
✅ **Secure**: HTTP-only session cookies, CSRF protection, rotating refresh tokens  
✅ **Reusable**: Any module can use this (not just Customer Insights)  

## Architecture

### Shared Server Module (`shared/server/jira-oauth.js`)

Provides `registerJiraOAuthRoutes(router, options)` that any module can use:

```javascript
const { registerJiraOAuthRoutes } = require('@shared/server').jiraOAuth

const router = express.Router()
registerJiraOAuthRoutes(router, {
  clientId: secrets.JIRA_OAUTH_CLIENT_ID,
  clientSecret: secrets.JIRA_OAUTH_CLIENT_SECRET,
  scopes: ['write:jira-work', 'read:jira-user', 'offline_access']
})

// Use the helper to get per-user Jira client
const { jiraRequest, cloudId } = await router.getJiraClient(req)
const issue = await jiraRequest('/rest/api/2/issue', {
  method: 'POST',
  body: { /* issue payload */ }
})
```

### Shared Client Composable (`shared/client/composables/useJiraAuth.js`)

Frontend composable for OAuth flow management:

```javascript
import { useJiraAuth } from '@shared'

const {
  connected,
  connecting,
  siteName,
  connectJira,
  disconnectJira
} = useJiraAuth('/api/modules/customer-insights')

// User clicks "Connect Jira" button
await connectJira()
// OAuth popup opens, user grants access, tokens stored in session
```

## How It Works

### 1. OAuth Flow

1. User clicks **"Connect Jira"**
2. App opens popup → `https://auth.atlassian.com/authorize`
3. User signs in + grants access
4. Atlassian redirects to callback with authorization code
5. App exchanges code for access token + refresh token
6. App fetches user's accessible Jira sites (cloud ID)
7. Tokens + cloud ID stored in session cookie

### 2. Creating Issues

```javascript
// In route handler
const { jiraRequest, cloudId } = await router.getJiraClient(req)

// Automatically handles:
// - Token refresh if expired
// - Bearer token authentication
// - Cloud ID in API path
const issue = await jiraRequest('/rest/api/2/issue', {
  method: 'POST',
  body: {
    fields: {
      project: { key: 'RHAIRFE' },
      summary: 'User feedback: Add dark mode',
      description: '...',
      issuetype: { name: 'Feature Request' }
    }
  }
})
```

### 3. Token Refresh

Access tokens expire after 1 hour. The `getJiraClient()` helper:
- Checks if token expires in < 1 minute
- Automatically refreshes using refresh token
- Updates session with new tokens (rotating refresh tokens!)
- Returns fresh client ready to use

## Files Added

### Shared Infrastructure
```
shared/
├── server/
│   ├── jira-oauth.js          # OAuth routes + client helper
│   └── index.js                # Export jiraOAuth
└── client/
    ├── composables/
    │   └── useJiraAuth.js      # Frontend OAuth composable
    └── index.js                # Export useJiraAuth
```

### Documentation
```
docs/
└── JIRA-OAUTH-SETUP.md         # Step-by-step setup guide (10-15 min)
```

### Summary
```
JIRA-OAUTH-PR-SUMMARY.md        # This file
```

## Configuration Required

### Development

Add to `.env.local`:

```bash
# Jira OAuth 2.0 (per-user)
JIRA_OAUTH_CLIENT_ID=ari:cloud:platform::app/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
JIRA_OAUTH_CLIENT_SECRET=ATOAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Production

Add to deployment secrets (OpenShift, Kubernetes, etc.):

```bash
JIRA_OAUTH_CLIENT_ID=ari:cloud:platform::app/...
JIRA_OAUTH_CLIENT_SECRET=ATOAxxxxxxx...
SESSION_SECRET=$(openssl rand -base64 32)  # For session encryption
```

## Session Middleware Requirement

Jira OAuth requires `express-session` for token storage:

```bash
npm install express-session
```

Add to `server/dev-server.js`:

```javascript
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
  }
}));
```

**Note**: If Google Drive OAuth is already set up, this is already done!

## How Modules Use This

### Example: Customer Insights Module

1. **Add secrets to `module.json`:**

```json
{
  "secrets": [
    { "name": "JIRA_OAUTH_CLIENT_ID" },
    { "name": "JIRA_OAUTH_CLIENT_SECRET" }
  ]
}
```

2. **Register routes in `server/index.js`:**

```javascript
const { registerJiraOAuthRoutes } = require('@shared/server').jiraOAuth

module.exports = (context) => {
  const router = express.Router()

  // Register Jira OAuth routes
  registerJiraOAuthRoutes(router, {
    clientId: context.secrets.JIRA_OAUTH_CLIENT_ID,
    clientSecret: context.secrets.JIRA_OAUTH_CLIENT_SECRET
  })

  // Use in RFE creation route
  router.post('/rfe/create', async (req, res) => {
    const { jiraRequest } = await router.getJiraClient(req)
    const issue = await jiraRequest('/rest/api/2/issue', {
      method: 'POST',
      body: req.body
    })
    res.json(issue)
  })

  return router
}
```

3. **Use in frontend:**

```vue
<script setup>
import { useJiraAuth } from '@shared'

const { connected, siteName, connectJira } = useJiraAuth('/api/modules/customer-insights')

async function handleConnect() {
  await connectJira()
  // User is now connected!
}
</script>

<template>
  <button v-if="!connected" @click="handleConnect">
    Connect Jira
  </button>
  <div v-else>
    ✓ Connected to {{ siteName }}
  </div>
</template>
```

## Security Features

### CSRF Protection
- State parameter validated on callback
- Prevents authorization hijacking attacks

### Token Storage
- HTTP-only cookies (not accessible to JavaScript)
- Secure flag in production (HTTPS only)
- 90-day expiration

### Rotating Refresh Tokens
- Each refresh returns new refresh token
- Old token immediately invalidated
- Reduces window of compromise

### Scoped Permissions
- Only requests minimum required scopes
- User permissions always constrain app
- Can't do more than user is allowed

## Testing

### Local Testing

1. Follow `docs/JIRA-OAUTH-SETUP.md` (10-15 minutes)
2. Create OAuth app in Atlassian Developer Console
3. Add credentials to `.env.local`
4. Restart server: `npm run dev:full`
5. Navigate to module with Jira integration
6. Click "Connect Jira" → Grant access
7. Create an issue → Check Jira (shows you as creator!)

### Demo Mode

Jira OAuth gracefully degrades in demo mode:
- Connection UI still shown
- OAuth flow works if credentials configured
- Can be left unconfigured (no errors)

## Deployment Notes

### Multi-Server Environments

**Issue**: In-memory sessions don't sync across instances.

**Solution**: Use Redis for session storage:

```bash
npm install connect-redis redis
```

```javascript
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... other options
}));
```

### Environment-Specific OAuth Apps

**Best Practice**: Create separate OAuth apps per environment:

- **Dev**: Callback = `http://localhost:3001/.../auth/jira/callback`
- **Preprod**: Callback = `https://dev.example.com/.../auth/jira/callback`
- **Prod**: Callback = `https://prod.example.com/.../auth/jira/callback`

Each gets its own client ID/secret.

## What Works Without Configuration

✅ **All views load** (no errors if OAuth not configured)  
✅ **Connection UI shown** (explains how to set up)  
✅ **Graceful degradation** (users see clear instructions)  

❌ **Jira issue creation** (requires OAuth setup)  

## Comparison: Per-User vs Shared

| Aspect | Per-User OAuth | Shared Credentials |
|--------|----------------|-------------------|
| **Setup** | Create OAuth app (10 min) | Create API token (2 min) |
| **Issue Creator** | Actual user | Bot/service account |
| **Security** | User's permissions | Service account permissions |
| **Token Lifetime** | 90 days (auto-refresh) | Indefinite |
| **Multi-user** | Each user authenticates | One token for all |
| **Audit Trail** | Clear attribution | All issues from same account |

## Known Limitations

1. **Single Jira site**: User selects first accessible site. Multi-site selection not implemented.
2. **Session storage**: Requires Redis for multi-server deployments.
3. **90-day token expiration**: Users must re-authenticate after 90 days of inactivity.

## Future Enhancements

- [ ] Multi-site selector (if user has access to multiple Jira instances)
- [ ] Remember last-used site per user
- [ ] Webhook notifications when issues are updated
- [ ] Bulk operations (create multiple issues at once)

## References

- **Setup Guide**: `docs/JIRA-OAUTH-SETUP.md`
- **Atlassian OAuth Docs**: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- **Jira Scopes**: https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/

## Questions?

See `docs/JIRA-OAUTH-SETUP.md` for:
- Step-by-step setup (with screenshots)
- Troubleshooting common issues
- Production deployment considerations
