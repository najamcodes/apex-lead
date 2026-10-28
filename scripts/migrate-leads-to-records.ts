import { initDb, getDataSource } from '@sdk/core/db';
import { RecordEntity } from '@sdk/core/db/entities/RecordEntity';
import { RecordIdentityEntity } from '@sdk/core/db/entities/RecordIdentityEntity';

export async function migrateLeadsToRecords() {
  const dataSource = await initDb();
  const queryRunner = dataSource.createQueryRunner();

  console.log('[Migration] Checking for legacy leads table...');
  const tableExists = await queryRunner.hasTable('leads');
  if (!tableExists) {
    console.log('[Migration] No legacy leads table found. Skipping.');
    return;
  }

  const leads = await queryRunner.query('SELECT * FROM leads');
  console.log(`[Migration] Migrating ${leads.length} legacy leads to dynamic records...`);

  const recordRepo = dataSource.getRepository(RecordEntity);
  const identityRepo = dataSource.getRepository(RecordIdentityEntity);

  let migratedCount = 0;

  for (const lead of leads) {
    const orgId = Number(lead.org_id) || 1;
    const identities: Array<{ type: string; value: string }> = [];

    if (lead.email && typeof lead.email === 'string') {
      const email = lead.email.trim().toLowerCase();
      if (email) identities.push({ type: 'email', value: email });
    }

    if (lead.website_url && typeof lead.website_url === 'string') {
      try {
        const urlStr = lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`;
        const domain = new URL(urlStr).hostname.replace(/^www\./, '').toLowerCase();
        if (domain) identities.push({ type: 'domain', value: domain });
      } catch {
        const fallback = lead.website_url.trim().toLowerCase();
        if (fallback) identities.push({ type: 'domain', value: fallback });
      }
    }

    if (lead.phone && typeof lead.phone === 'string') {
      const phoneDigits = lead.phone.replace(/[^0-9+]/g, '');
      if (phoneDigits) identities.push({ type: 'phone', value: phoneDigits });
    }

    if (lead.google_maps_url && typeof lead.google_maps_url === 'string') {
      identities.push({ type: 'maps_place_id', value: lead.google_maps_url.trim() });
    }

    const techStackParsed =
      typeof lead.tech_stack === 'string'
        ? (() => {
            try {
              return JSON.parse(lead.tech_stack);
            } catch {
              return [];
            }
          })()
        : lead.tech_stack || [];

    const dynamicData = {
      business_name: lead.business_name,
      category: lead.category,
      city: lead.city,
      country: lead.country,
      phone: lead.phone,
      email: lead.email,
      website_url: lead.website_url,
      google_maps_url: lead.google_maps_url,
      ai_site_score: lead.ai_site_score,
      ai_site_summary: lead.ai_site_summary,
      ai_personalized_hook: lead.ai_personalized_hook,
      tech_stack: techStackParsed,
      review_rating: lead.review_rating,
      review_count: lead.review_count,
      pagespeed_mobile: lead.pagespeed_mobile,
      ssl_valid: lead.ssl_valid,
      migrated_from_lead_id: lead.id,
    };

    const newRecord = recordRepo.create({
      org_id: orgId,
      collection_type: 'leads',
      title: lead.business_name || 'Untitled Lead',
      status: lead.status || 'new',
      source: lead.source || 'google_maps',
      enrichment_score: Number(lead.ai_site_score) || 0,
      data: dynamicData,
      created_at: lead.created_at ? new Date(lead.created_at) : new Date(),
      updated_at: lead.updated_at ? new Date(lead.updated_at) : new Date(),
    });

    const savedRecord = await recordRepo.save(newRecord);

    for (const ident of identities) {
      try {
        const existingIdent = await identityRepo.findOne({
          where: {
            org_id: orgId,
            identifier_type: ident.type as any,
            identifier_value: ident.value,
          },
        });
        if (!existingIdent) {
          const identityEntity = identityRepo.create({
            org_id: orgId,
            record_id: savedRecord.id,
            identifier_type: ident.type as any,
            identifier_value: ident.value,
          });
          await identityRepo.save(identityEntity);
        }
      } catch {
        // Unique identity collision handled
      }
    }

    migratedCount++;
  }

  console.log(`[Migration] Successfully migrated ${migratedCount} leads into records & record_identities.`);
}

if (import.meta.main) {
  migrateLeadsToRecords()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}
