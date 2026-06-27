# User Plugins

Place your custom plugins here. Each plugin must be a directory containing:

- `plugin.json` — Plugin manifest (see below)
- `index.ts` — Plugin entry file exporting the plugin as `default`

## Plugin Manifest (`plugin.json`)

```json
{
  "id": "my-custom-enricher",
  "kind": "enricher",
  "name": "My Custom Enricher",
  "version": "1.0.0",
  "description": "Adds custom data to leads.",
  "author": "Your Name",
  "main": "index.ts",
  "enabledByDefault": false,
  "tags": ["enricher", "custom"]
}
```

## Plugin Kinds

- **scraper** — Produces raw leads from any data source
- **enricher** — Adds data fields to existing leads
- **connector** — Pushes lead events to external systems

## Example Plugin

See [`../built-in/connector-webhook/`](../built-in/connector-webhook/) for a full reference implementation.

## Available Types

Import types from `../../types`:

```typescript
import type { EnricherPlugin, LeadSnapshot, LeadEnrichment } from '../../types'
```

## Enable Your Plugin

After creating your plugin directory, enable it via the API:

```bash
PATCH /api/plugins/my-custom-enricher/toggle
{ "enabled": true }
```

Or configure it:

```bash
PUT /api/plugins/my-custom-enricher/config
{ "api_key": "your-key-here" }
```
