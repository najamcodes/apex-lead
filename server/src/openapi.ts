import { OpenAPIHono } from '@hono/zod-openapi'

export function createOpenAPIApp() {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: 'Validation error', details: result.error.flatten().fieldErrors },
          400
        )
      }
    },
  })

  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      title: 'LeadGen Desk API',
      version: '1.0.0',
      description: 'Lead Generation and Outreach Platform API',
      contact: { name: 'LeadGen Desk', url: 'https://github.com/leadgen-desk' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development server' },
      { url: 'https://api.leadgen-desk.com', description: 'Production server' },
    ],
    security: [{ cookieAuth: [] }],
    tags: [
      { name: 'Leads', description: 'Lead management operations' },
      { name: 'Stats', description: 'Dashboard statistics and analytics' },
      { name: 'Scraper', description: 'Google Maps scraping operations' },
      { name: 'AI', description: 'AI-powered lead scoring and email drafting' },
      { name: 'Settings', description: 'Application settings management' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Analysis', description: 'Lead analysis and enrichment' },
      { name: 'Outreach', description: 'Email outreach and sequences' },
      { name: 'Bulk', description: 'Bulk operations on leads' },
      { name: 'Notes', description: 'Lead notes and activity' },
      { name: 'Scheduler', description: 'Scheduler status and control' },
      { name: 'EmailFinder', description: 'Email finding operations' },
      { name: 'EmailVerifier', description: 'Email verification operations' },
      { name: 'Templates', description: 'Email template management' },
      { name: 'Pipeline', description: 'Pipeline targets and digests' },
      { name: 'QueryProfiles', description: 'Smart query profile management' },
      { name: 'EmailAccounts', description: 'Email account management' },
      { name: 'Users', description: 'User management' },
      { name: 'Extension', description: 'Chrome extension endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  })

  // Inline Swagger UI — no @hono/swagger-ui dependency needed
  app.get('/swagger', (c) => {
    return c.html(`<!DOCTYPE html>
<html><head>
<title>LeadGen Desk API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/doc', dom_id: '#swagger-ui' })</script>
</body></html>`)
  })

  return app
}