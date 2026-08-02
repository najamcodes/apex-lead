// backend/templates/pipeline-templates.ts
// Pre-built pipeline templates for various automation use cases (like n8n templates).

import type { PipelineDefinition } from '../../shared/types/pipeline.types'

export interface PipelineTemplate {
  id: string
  name: string
  description: string
  category: 'Scraping & Lead Gen' | 'API & Webhooks' | 'Data Processing' | 'AI & Content' | 'Notifications'
  icon: string
  definition: Omit<PipelineDefinition, 'id' | 'org_id' | 'created_at' | 'updated_at'>
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'tpl-maps-lead-gen',
    name: 'Google Maps Lead Scraper & AI Scoring',
    description: 'Scrape businesses from Google Maps, evaluate website quality using AI, and store qualified leads.',
    category: 'Scraping & Lead Gen',
    icon: 'MapPin',
    definition: {
      name: 'Google Maps Lead Scraper & AI Scoring',
      description: 'Scrapes businesses from Google Maps, evaluates website quality with AI, and stores qualified leads.',
      collection: 'leads',
      status: 'draft',
      version: 1,
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          label: 'Start Trigger',
          enabled: true,
          position: { x: 80, y: 180 },
          config: {
            type: 'manual',
            collection: 'leads',
          },
        },
        {
          id: 'scraper_1',
          type: 'scraper',
          label: 'Google Maps Scraper',
          enabled: true,
          position: { x: 300, y: 180 },
          config: {
            plugin: 'google-maps',
            query: 'Dentists in Austin TX',
            max_results: 20,
          },
        },
        {
          id: 'ai_1',
          type: 'ai',
          label: 'AI Site Scorer',
          enabled: true,
          position: { x: 550, y: 180 },
          config: {
            model: 'anthropic/claude-3-haiku',
            prompt: 'Score the following website for quality and modernity on a scale of 0-100: {{input.website_url}}',
            output_field: 'ai_site_score',
          },
        },
        {
          id: 'store_1',
          type: 'store',
          label: 'Save Leads',
          enabled: true,
          position: { x: 800, y: 180 },
          config: {
            collection: 'leads',
            mode: 'upsert',
            set_status: 'scraped',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'trigger_1', to: 'scraper_1' },
        { id: 'e2', from: 'scraper_1', to: 'ai_1' },
        { id: 'e3', from: 'ai_1', to: 'store_1' },
      ],
    },
  },
  {
    id: 'tpl-webhook-discord-notify',
    name: 'Webhook Ingestion & Discord Alert',
    description: 'Receive payload via HTTP Webhook, transform the fields, and send a formatted alert to Discord / Slack.',
    category: 'API & Webhooks',
    icon: 'Webhook',
    definition: {
      name: 'Webhook Ingestion & Discord Alert',
      description: 'Receives external webhook POSTs, transforms fields, and broadcasts an alert to Discord.',
      collection: 'webhook_events',
      status: 'draft',
      version: 1,
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          label: 'Webhook Receiver',
          enabled: true,
          position: { x: 80, y: 180 },
          config: {
            type: 'webhook',
            webhook_slug: 'incoming-alert',
            collection: 'webhook_events',
          },
        },
        {
          id: 'code_1',
          type: 'code',
          label: 'Format Message',
          enabled: true,
          position: { x: 340, y: 180 },
          config: {
            code: `// Format incoming webhook data for alert
const eventName = record.event || record.type || 'Custom Event'
const user = record.user || record.sender || 'Anonymous'
const details = record.message || record.text || JSON.stringify(record)

return {
  alert_title: '🚨 New Event: ' + eventName,
  formatted_body: \`User **\${user}** triggered **\${eventName}**:\n> \${details}\`,
  timestamp: new Date().toISOString()
}`,
          },
        },
        {
          id: 'notify_1',
          type: 'notify',
          label: 'Discord Notification',
          enabled: true,
          position: { x: 600, y: 180 },
          config: {
            channel: 'discord',
            url: 'https://discord.com/api/webhooks/...',
            body: '{{record.formatted_body}}',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'trigger_1', to: 'code_1' },
        { id: 'e2', from: 'code_1', to: 'notify_1' },
      ],
    },
  },
  {
    id: 'tpl-cron-api-collector',
    name: 'Scheduled API Poller & Database Sync',
    description: 'Periodically fetch data from an external REST API, split array items, and upsert records into a collection.',
    category: 'API & Webhooks',
    icon: 'RefreshCw',
    definition: {
      name: 'Scheduled API Poller & DB Sync',
      description: 'Pulls records from a REST API every hour and synchronizes to local collection.',
      collection: 'api_records',
      status: 'draft',
      version: 1,
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          label: 'Hourly Cron Trigger',
          enabled: true,
          position: { x: 80, y: 180 },
          config: {
            type: 'cron',
            cron: '0 * * * *',
            collection: 'api_records',
          },
        },
        {
          id: 'http_1',
          type: 'http',
          label: 'Fetch REST API',
          enabled: true,
          position: { x: 320, y: 180 },
          config: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts',
            split_array: true,
            response_field: 'post_data',
          },
        },
        {
          id: 'store_1',
          type: 'store',
          label: 'Sync to Collection',
          enabled: true,
          position: { x: 580, y: 180 },
          config: {
            collection: 'api_records',
            mode: 'upsert',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'trigger_1', to: 'http_1' },
        { id: 'e2', from: 'http_1', to: 'store_1' },
      ],
    },
  },
  {
    id: 'tpl-csv-processor',
    name: 'CSV Importer, Filter & Aggregator',
    description: 'Parse raw CSV text into records, filter rows based on conditions, and calculate aggregate summary statistics.',
    category: 'Data Processing',
    icon: 'FileSpreadsheet',
    definition: {
      name: 'CSV Importer, Filter & Summary',
      description: 'Processes CSV spreadsheet rows, filters items, and aggregates summaries.',
      collection: 'csv_data',
      status: 'draft',
      version: 1,
      nodes: [
        {
          id: 'csv_1',
          type: 'spreadsheet',
          label: 'CSV Data Input',
          enabled: true,
          position: { x: 80, y: 180 },
          config: {
            mode: 'read',
            delimiter: ',',
            collection: 'csv_data',
            csv_data: `name,department,salary,status
Alice,Engineering,110000,active
Bob,Marketing,75000,active
Charlie,Engineering,125000,inactive
Diana,Sales,95000,active
Eve,Engineering,140000,active`,
          },
        },
        {
          id: 'filter_1',
          type: 'filter',
          label: 'Filter Active Only',
          enabled: true,
          position: { x: 340, y: 180 },
          config: {
            filter_mode: 'expression',
            condition: 'data.status === "active"',
          },
        },
        {
          id: 'aggregate_1',
          type: 'aggregate',
          label: 'Aggregate Salary Sum',
          enabled: true,
          position: { x: 600, y: 180 },
          config: {
            mode: 'sum',
            field: 'salary',
            output_field: 'total_active_payroll',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'csv_1', to: 'filter_1' },
        { id: 'e2', from: 'filter_1', to: 'aggregate_1' },
      ],
    },
  },
  {
    id: 'tpl-ai-content-pipeline',
    name: 'AI Text Summarizer & Enrichment',
    description: 'Seed custom topics or articles, enrich them with LLM summaries, and export to CSV or collection.',
    category: 'AI & Content',
    icon: 'Sparkles',
    definition: {
      name: 'AI Text Summarizer & Enrichment',
      description: 'Generates structured AI summaries and action items for articles/topics.',
      collection: 'ai_articles',
      status: 'draft',
      version: 1,
      nodes: [
        {
          id: 'set_1',
          type: 'set',
          label: 'Seed Topic',
          enabled: true,
          position: { x: 80, y: 180 },
          config: {
            fields: [
              { name: 'topic', value: 'Artificial Intelligence in Healthcare 2026' },
              { name: 'author', value: 'LeadHunter Team' },
            ],
            collection: 'ai_articles',
          },
        },
        {
          id: 'ai_1',
          type: 'ai',
          label: 'AI Summary Generator',
          enabled: true,
          position: { x: 340, y: 180 },
          config: {
            model: 'anthropic/claude-3-haiku',
            prompt: 'Write a 3-bullet executive summary and key trend forecast for the topic: {{input.topic}}',
            output_field: 'ai_summary',
          },
        },
        {
          id: 'store_1',
          type: 'store',
          label: 'Save Article',
          enabled: true,
          position: { x: 600, y: 180 },
          config: {
            collection: 'ai_articles',
            mode: 'insert',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'set_1', to: 'ai_1' },
        { id: 'e2', from: 'ai_1', to: 'store_1' },
      ],
    },
  },
]
