const swaggerJsdoc = require('swagger-jsdoc');

function createOpenApiSpec() {
  const options = {
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'Org Pulse API',
        version: '1.0.0',
        description:
          'API for the AI Platform Org Pulse application.\n\n' +
          '**Authentication:** In production, all routes (except health checks and docs) are ' +
          'authenticated via an OpenShift OAuth proxy that sets `X-Forwarded-Email` and ' +
          '`X-Forwarded-User` headers. In local dev, auth is bypassed and the first ' +
          '`ADMIN_EMAILS` entry is used.\n\n' +
          '**Legacy path aliases:** Many Org Pulse module routes are also accessible at ' +
          'legacy paths (e.g., `/api/roster` forwards to `/api/modules/team-tracker/roster`). ' +
          'These aliases are not documented separately.\n\n' +
          '**Demo mode:** When `DEMO_MODE=true`, all POST refresh endpoints return a ' +
          'stub response and external API calls are disabled.'
      },
      servers: [
        { url: '/', description: 'Application root' }
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Auth', description: 'Authentication, user info, and API tokens' },
        { name: 'Allowlist', description: 'Email allowlist management (admin)' },
        { name: 'Git-Static Modules', description: 'Git-static module management' },
        { name: 'Built-in Modules', description: 'Built-in module state management' },
        { name: 'Export', description: 'Data export endpoints' },
        { name: 'TT: Roster', description: 'Org Pulse roster and person data' },
        { name: 'TT: Metrics', description: 'Org Pulse Jira metrics' },
        { name: 'TT: GitHub', description: 'Org Pulse GitHub contribution data' },
        { name: 'TT: GitLab', description: 'Org Pulse GitLab contribution data' },
        { name: 'TT: Trends', description: 'Org Pulse trend data' },
        { name: 'TT: Sprints', description: 'Org Pulse sprint and board data' },
        { name: 'TT: Snapshots', description: 'Org Pulse monthly snapshots' },
        { name: 'TT: Admin', description: 'Org Pulse admin configuration' },
        { name: 'OR: Teams', description: 'Org Roster team data' },
        { name: 'OR: People', description: 'Org Roster people data' },
        { name: 'OR: RFE', description: 'Org Roster RFE backlog data' },
        { name: 'OR: Sync', description: 'Org Roster sync operations' },
        { name: 'OR: Config', description: 'Org Roster configuration' }
      ],
      components: {
        securitySchemes: {
          forwardedEmail: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Forwarded-Email',
            description: 'Email address set by the OpenShift OAuth proxy'
          },
          bearerToken: {
            type: 'http',
            scheme: 'bearer',
            description: 'API token (prefix: tt_). Generate at /api-tokens.'
          }
        },
        schemas: {
          ErrorResponse: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' }
            },
            example: { error: 'Something went wrong' }
          },
          Person: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              jiraDisplayName: { type: 'string' },
              uid: { type: 'string' },
              email: { type: 'string' },
              title: { type: 'string' },
              manager: { type: 'string', nullable: true },
              githubUsername: { type: 'string', nullable: true },
              gitlabUsername: { type: 'string', nullable: true },
              geo: { type: 'string', nullable: true },
              location: { type: 'string', nullable: true },
              country: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              customFields: { type: 'object' }
            }
          },
          PersonMetrics: {
            type: 'object',
            properties: {
              jiraDisplayName: { type: 'string' },
              jiraAccountId: { type: 'string' },
              fetchedAt: { type: 'string', format: 'date-time' },
              lookbackDays: { type: 'integer' },
              resolved: {
                type: 'object',
                properties: {
                  count: { type: 'integer' },
                  storyPoints: { type: 'integer' },
                  issues: { type: 'array', items: { $ref: '#/components/schemas/JiraIssue' } }
                }
              },
              inProgress: {
                type: 'object',
                properties: {
                  count: { type: 'integer' },
                  storyPoints: { type: 'integer' },
                  issues: { type: 'array', items: { $ref: '#/components/schemas/JiraIssue' } }
                }
              },
              cycleTime: {
                type: 'object',
                properties: {
                  avgDays: { type: 'number', nullable: true },
                  medianDays: { type: 'number', nullable: true }
                }
              }
            }
          },
          JiraIssue: {
            type: 'object',
            properties: {
              key: { type: 'string', example: 'PROJ-1234' },
              summary: { type: 'string' },
              status: { type: 'string' },
              storyPoints: { type: 'integer', nullable: true },
              resolutionDate: { type: 'string', nullable: true },
              cycleTimeDays: { type: 'number', nullable: true }
            }
          },
          TeamMetrics: {
            type: 'object',
            properties: {
              teamKey: { type: 'string' },
              displayName: { type: 'string' },
              memberCount: { type: 'integer' },
              aggregate: {
                type: 'object',
                properties: {
                  resolvedCount: { type: 'integer' },
                  resolvedPoints: { type: 'integer' },
                  inProgressCount: { type: 'integer' },
                  avgCycleTimeDays: { type: 'number', nullable: true }
                }
              },
              members: { type: 'array', items: { type: 'object' } },
              resolvedIssues: { type: 'array', items: { $ref: '#/components/schemas/JiraIssue' } }
            }
          },
          RosterResponse: {
            type: 'object',
            properties: {
              vp: { type: 'string', nullable: true },
              orgs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    displayName: { type: 'string' },
                    leader: { type: 'object' },
                    teams: { type: 'object' }
                  }
                }
              },
              visibleFields: { type: 'array', items: { type: 'object' } },
              primaryDisplayField: { type: 'string', nullable: true }
            }
          },
          GitHubContributions: {
            type: 'object',
            properties: {
              users: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    totalContributions: { type: 'integer' },
                    months: { type: 'object' },
                    fetchedAt: { type: 'string', format: 'date-time' },
                    username: { type: 'string' }
                  }
                }
              },
              fetchedAt: { type: 'string', format: 'date-time', nullable: true }
            }
          },
          GitLabContributions: {
            type: 'object',
            properties: {
              users: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    totalContributions: { type: 'integer' },
                    months: { type: 'object' },
                    fetchedAt: { type: 'string', format: 'date-time' },
                    source: { type: 'string' },
                    username: { type: 'string' }
                  }
                }
              },
              fetchedAt: { type: 'string', format: 'date-time', nullable: true }
            }
          },
          Snapshot: {
            type: 'object',
            properties: {
              periodStart: { type: 'string', format: 'date' },
              periodEnd: { type: 'string', format: 'date' },
              generatedAt: { type: 'string', format: 'date-time' },
              team: {
                type: 'object',
                properties: {
                  resolvedCount: { type: 'integer' },
                  resolvedPoints: { type: 'integer' },
                  avgCycleTimeDays: { type: 'number', nullable: true },
                  githubContributions: { type: 'integer' },
                  gitlabContributions: { type: 'integer' }
                }
              },
              members: { type: 'object' }
            }
          },
          RefreshRequest: {
            type: 'object',
            required: ['scope'],
            properties: {
              scope: { type: 'string', enum: ['person', 'team', 'org', 'all'] },
              name: { type: 'string', description: 'Person name (required for scope=person)' },
              teamKey: { type: 'string', description: 'Team key (required for scope=team)' },
              orgKey: { type: 'string', description: 'Org key (required for scope=org)' },
              force: { type: 'boolean', default: false },
              sources: {
                type: 'object',
                properties: {
                  jira: { type: 'boolean', default: true },
                  github: { type: 'boolean', default: true },
                  gitlab: { type: 'boolean', default: true }
                }
              }
            }
          },
          ApiToken: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              tokenPrefix: { type: 'string', example: 'tt_a1b2c3d4' },
              ownerEmail: { type: 'string', format: 'email' },
              createdAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
              lastUsedAt: { type: 'string', format: 'date-time', nullable: true }
            }
          },
          AllowlistResponse: {
            type: 'object',
            properties: {
              emails: { type: 'array', items: { type: 'string', format: 'email' } }
            }
          }
        },
        responses: {
          ServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          Forbidden: {
            description: 'Forbidden - admin access required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: 'Admin access required' }
              }
            }
          },
          NotFound: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      security: [{ forwardedEmail: [] }, { bearerToken: [] }]
    },
    apis: ['server/dev-server.js', 'modules/*/server/index.js']
  };

  return swaggerJsdoc(options);
}

module.exports = { createOpenApiSpec };
