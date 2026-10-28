import '../../../server/polyfill';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initDb, getDataSource } from '@sdk/core/db';
import { LeadEntity } from '@sdk/core/db/entities/LeadEntity';
import { RecordEntity } from '@sdk/core/db/entities/RecordEntity';
import { RecordIdentityEntity } from '@sdk/core/db/entities/RecordIdentityEntity';
import { migrateLeadsToRecords } from '../../../scripts/migrate-leads-to-records';

describe('Legacy Leads to Polymorphic Records Migration', () => {
  beforeAll(async () => {
    global.currentUserRole = 'admin';
    global.currentOrgId = 1;
    await initDb();
  });

  afterAll(async () => {
    const ds = getDataSource();
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  it('should seamlessly migrate existing LeadEntity rows into RecordEntity and RecordIdentityEntity', async () => {
    const ds = getDataSource();
    const leadRepo = ds.getRepository(LeadEntity);
    const recordRepo = ds.getRepository(RecordEntity);
    const identityRepo = ds.getRepository(RecordIdentityEntity);

    const timestamp = Date.now();
    const testEmail = `migrated_${timestamp}@acmeplumbing.com`;
    const testPhone = `+1555${timestamp.toString().slice(-6)}`;
    const testWebsite = `https://www.acmeplumbing-${timestamp}.com/about`;

    // 1. Seed a legacy lead
    const legacyLead = leadRepo.create({
      org_id: 1,
      business_name: `Acme Premier Plumbing ${timestamp}`,
      category: 'Plumbing & Drains',
      city: 'Austin',
      country: 'US',
      phone: testPhone,
      email: testEmail,
      website_url: testWebsite,
      google_maps_url: `https://maps.google.com/?cid=${timestamp}`,
      ai_site_score: 92,
      ai_site_summary: 'Leading commercial plumber in Austin metro.',
      ai_personalized_hook: 'Saw your 92 rating and recent hospital plumbing contracts.',
      tech_stack: JSON.stringify(['WordPress', 'Google Analytics 4', 'Cloudflare']),
      review_rating: '4.9',
      review_count: 148,
      status: 'qualified',
      source: 'google_maps',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const savedLegacy = await leadRepo.save(legacyLead);
    expect(savedLegacy.id).toBeDefined();

    // 2. Run the migration
    await migrateLeadsToRecords();

    // 3. Verify migration landed in RecordEntity
    const migratedRecord = await recordRepo.findOne({
      where: {
        org_id: 1,
        title: `Acme Premier Plumbing ${timestamp}`,
      },
    });

    expect(migratedRecord).not.toBeNull();
    expect(migratedRecord!.collection_type).toBe('leads');
    expect(migratedRecord!.status).toBe('qualified');
    expect(migratedRecord!.enrichment_score).toBe(92);

    const data = typeof migratedRecord!.data === 'string' ? JSON.parse(migratedRecord!.data) : migratedRecord!.data;
    expect(data.business_name).toBe(`Acme Premier Plumbing ${timestamp}`);
    expect(data.category).toBe('Plumbing & Drains');
    expect(data.city).toBe('Austin');
    expect(data.tech_stack).toEqual(['WordPress', 'Google Analytics 4', 'Cloudflare']);
    expect(Number(data.review_rating)).toBe(4.9);
    expect(data.review_count).toBe(148);

    // 4. Verify identities extracted into record_identities
    const identities = await identityRepo.find({
      where: {
        org_id: 1,
        record_id: migratedRecord!.id,
      },
    });

    expect(identities.length).toBeGreaterThanOrEqual(3);
    const emailIdent = identities.find((i) => i.identifier_type === 'email');
    const domainIdent = identities.find((i) => i.identifier_type === 'domain');
    const phoneIdent = identities.find((i) => i.identifier_type === 'phone');

    expect(emailIdent?.identifier_value).toBe(testEmail);
    expect(domainIdent?.identifier_value).toBe(`acmeplumbing-${timestamp}.com`);
    expect(phoneIdent?.identifier_value).toBe(testPhone);
  });
});
