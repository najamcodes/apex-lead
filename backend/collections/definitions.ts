// backend/collections/definitions.ts
// Registry of collection schemas. Built-in 'leads' mirrors LeadEntity.
// User-defined collections can be added via the API (future).

import type { CollectionDefinition } from '../../shared/types/collection.types'

const _definitions = new Map<string, CollectionDefinition>()

// Built-in leads collection (mirrors LeadEntity fields)
registerBuiltIn({
  id: 'leads',
  name: 'Leads',
  description: 'Business leads scraped from Google Maps and other sources.',
  system: true,
  fields: [
    { name: 'business_name', label: 'Business Name', type: 'string', nullable: false, uniqueKey: true, indexed: true },
    { name: 'category', label: 'Category', type: 'string', nullable: true },
    { name: 'city', label: 'City', type: 'string', nullable: true, indexed: true, uniqueKey: true },
    { name: 'country', label: 'Country', type: 'string', nullable: true },
    { name: 'phone', label: 'Phone', type: 'string', nullable: true },
    { name: 'email', label: 'Email', type: 'string', nullable: true, indexed: true },
    { name: 'website_url', label: 'Website URL', type: 'string', nullable: true },
    { name: 'google_maps_url', label: 'Google Maps URL', type: 'string', nullable: true },
    { name: 'website_status', label: 'Website Status', type: 'string', nullable: true },
    { name: 'ai_site_score', label: 'AI Site Score', type: 'number', nullable: true },
    { name: 'ai_site_summary', label: 'AI Summary', type: 'string', nullable: true },
    { name: 'ai_personalized_hook', label: 'AI Hook', type: 'string', nullable: true },
    { name: 'status', label: 'Status', type: 'string', nullable: true, indexed: true },
    { name: 'source', label: 'Source', type: 'string', nullable: true },
    { name: 'review_rating', label: 'Review Rating', type: 'number', nullable: true },
    { name: 'review_count', label: 'Review Count', type: 'number', nullable: true },
    { name: 'pagespeed_mobile', label: 'PageSpeed (Mobile)', type: 'number', nullable: true },
    { name: 'ssl_valid', label: 'SSL Valid', type: 'boolean', nullable: true },
    { name: 'tech_stack', label: 'Tech Stack', type: 'json', nullable: true },
  ],
})

// Example built-in collection for the Amazon use case (illustrative)
registerBuiltIn({
  id: 'amazon_products',
  name: 'Amazon Products',
  description: 'Products scraped from Amazon for price/opportunity tracking.',
  system: true,
  fields: [
    { name: 'asin', label: 'ASIN', type: 'string', nullable: false, uniqueKey: true, indexed: true },
    { name: 'title', label: 'Title', type: 'string', nullable: false },
    { name: 'price', label: 'Price', type: 'number', nullable: true },
    { name: 'currency', label: 'Currency', type: 'string', nullable: true },
    { name: 'rating', label: 'Rating', type: 'number', nullable: true },
    { name: 'review_count', label: 'Review Count', type: 'number', nullable: true },
    { name: 'url', label: 'URL', type: 'string', nullable: true },
    { name: 'image_url', label: 'Image URL', type: 'string', nullable: true },
    { name: 'category', label: 'Category', type: 'string', nullable: true },
    { name: 'seller', label: 'Seller', type: 'string', nullable: true },
    { name: 'in_stock', label: 'In Stock', type: 'boolean', nullable: true },
    { name: 'ai_opportunity', label: 'AI Opportunity', type: 'string', nullable: true },
  ],
})

function registerBuiltIn(def: CollectionDefinition) {
  _definitions.set(def.id, def)
}

export function getAllCollections(): CollectionDefinition[] {
  return [..._definitions.values()]
}

export function getCollectionDefinition(id: string): CollectionDefinition | undefined {
  return _definitions.get(id)
}

export function registerCollection(def: CollectionDefinition) {
  _definitions.set(def.id, def)
}
