# ApexLead Plugin System (`plugins/`)

The `plugins/` directory contains the extensible integration framework for ApexLead, enabling third-party CRM sync, notifications, and custom scraping/enrichment hooks.

---

## 🏗️ Directory Structure

```
plugins/
├── registry.ts            # Plugin discovery, tenant activation, and lifecycle management
├── runner.ts              # Event hook execution engine (trigger dispatching)
├── types.ts               # Plugin interfaces, manifest schema, and hook definitions
├── built-in/              # Pre-installed standard plugins
│   ├── discord/           # Discord channel notification connector
│   ├── slack/             # Slack webhook notification connector
│   ├── hubspot/           # HubSpot CRM lead sync
│   └── webhook/           # Generic JSON webhook emitter
└── user/                  # Directory for custom user-created plugins
```

---

## ⚡ Plugin Lifecycle & Event Hooks

Plugins subscribe to core system events and can modify or forward lead data:

| Event Hook | Trigger Moment | Typical Use Case |
| :--- | :--- | :--- |
| `lead.created` | New lead scraped/imported | Push to external CRM or enrich data |
| `lead.approved` | Lead approved in Review queue | Trigger automated outreach sequence |
| `outreach.sent` | Email dispatched via SMTP | Log to communication channels |
| `outreach.replied` | Prospect responds to email | Notify sales team on Slack/Discord |

---

## 🛠️ Creating a Custom Plugin

1. Create a folder in `plugins/user/<your-plugin-name>/`.
2. Add a `manifest.json`:
   ```json
   {
     "id": "my-custom-sync",
     "name": "My Custom Sync",
     "version": "1.0.0",
     "description": "Syncs leads to my internal ERP",
     "entry": "index.js",
     "hooks": ["lead.created", "outreach.replied"]
   }
   ```
3. Implement your handler in `index.js` exporting the hook functions.
