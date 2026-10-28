import '../../../server/polyfill';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initDb, getDataSource } from '@sdk/core/db';
import { RecordRepository, sanitizeJsonPayload } from '../../../server/src/db/repositories/RecordRepository';

describe('Dynamic Polymorphic Records & Deduplication Engine (Prompt 01)', () => {
  let recordRepo: RecordRepository;

  beforeAll(async () => {
    global.currentUserRole = 'admin';
    global.currentOrgId = 1;
    await initDb();
    recordRepo = new RecordRepository();
  });

  afterAll(async () => {
    const ds = getDataSource();
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  it('should store arbitrary polymorphic JSON fields without fixed column limits', async () => {
    const timestamp = Date.now();
    const result = await recordRepo.upsertRecord({
      orgId: 1,
      collectionType: 'contractors',
      title: `Apex Roofing Masters ${timestamp}`,
      status: 'verified',
      source: 'contractor_registry',
      enrichmentScore: 88,
      data: {
        trade: 'Roofing & Solar',
        license_number: `ROC-${timestamp}`,
        bonded: true,
        insurance_limit_usd: 2000000,
        active_crews: 4,
        preferred_shingle_brand: 'GAF Timberline',
      },
      identities: [
        { type: 'domain', value: `apexroofing-${timestamp}.com` },
        { type: 'phone', value: `+1555${timestamp.toString().slice(-6)}` },
      ],
    });

    expect(result.isNew).toBe(true);
    expect(result.record.id).toBeGreaterThan(0);
    expect(result.record.title).toBe(`Apex Roofing Masters ${timestamp}`);
    expect(result.record.collection_type).toBe('contractors');
    expect(result.record.enrichment_score).toBe(88);

    const data = typeof result.record.data === 'string' ? JSON.parse(result.record.data) : result.record.data;
    expect(data.trade).toBe('Roofing & Solar');
    expect(data.license_number).toBe(`ROC-${timestamp}`);
    expect(data.bonded).toBe(true);
    expect(data.insurance_limit_usd).toBe(2000000);
  });

  it('should perform O(1) deduplication matching on normalized email and merge data', async () => {
    const timestamp = Date.now();
    const email = `founder_${timestamp}@innovatetech.io`;

    // 1. Ingest initial record
    const first = await recordRepo.upsertRecord({
      orgId: 1,
      collectionType: 'b2b_saas',
      title: 'InnovateTech Systems',
      status: 'new',
      source: 'g2',
      enrichmentScore: 60,
      data: {
        tier: 'Growth',
        initial_source: 'g2_crowd',
      },
      identities: [{ type: 'email', value: email }],
    });
    expect(first.isNew).toBe(true);

    // 2. Ingest duplicate lead with uppercase email & higher enrichment score
    const second = await recordRepo.upsertRecord({
      orgId: 1,
      collectionType: 'b2b_saas',
      title: 'InnovateTech Systems Updated',
      status: 'in_progress',
      source: 'crunchbase',
      enrichmentScore: 95,
      data: {
        funding_round: 'Series A',
        capital_raised_usd: 5000000,
      },
      identities: [
        { type: 'email', value: `   ${email.toUpperCase()}   ` }, // Trimming & lowercasing test
        { type: 'domain', value: `innovatetech-${timestamp}.io` }, // Newly discovered identity
      ],
    });

    expect(second.isNew).toBe(false);
    expect(second.record.id).toBe(first.record.id); // Same record ID!
    expect(second.record.enrichment_score).toBe(95); // Took higher score

    const mergedData = typeof second.record.data === 'string' ? JSON.parse(second.record.data) : second.record.data;
    expect(mergedData.tier).toBe('Growth'); // Retained original
    expect(mergedData.funding_round).toBe('Series A'); // Merged new
    expect(mergedData.capital_raised_usd).toBe(5000000);

    // 3. Verify newly discovered identity is now attached to the record
    const identities = await recordRepo.findIdentities(1, first.record.id);
    const types = identities.map((i) => i.identifier_type);
    expect(types).toContain('email');
    expect(types).toContain('domain');
  });

  it('should perform deduplication matching on phone number', async () => {
    const timestamp = Date.now();
    const phone = `+1972555${timestamp.toString().slice(-4)}`;

    const r1 = await recordRepo.upsertRecord({
      orgId: 1,
      title: 'Lone Star Electric',
      data: { trade: 'Electrician' },
      identities: [{ type: 'phone', value: phone }],
    });
    expect(r1.isNew).toBe(true);

    const r2 = await recordRepo.upsertRecord({
      orgId: 1,
      title: 'Lone Star Electric Dallas',
      data: { master_electrician: 'James Wilson' },
      identities: [{ type: 'phone', value: phone }],
    });
    expect(r2.isNew).toBe(false);
    expect(r2.record.id).toBe(r1.record.id);

    const mergedData = typeof r2.record.data === 'string' ? JSON.parse(r2.record.data) : r2.record.data;
    expect(mergedData.trade).toBe('Electrician');
    expect(mergedData.master_electrician).toBe('James Wilson');
  });

  describe('Security & Vulnerability Defenses', () => {
    it('should strip prototype pollution keys (__proto__, constructor, prototype) recursively', () => {
      const maliciousPayload = JSON.parse(`{
        "normalField": "safe value",
        "__proto__": { "polluted": true },
        "nested": {
          "constructor": { "isAdmin": true },
          "prototype": { "exploited": true },
          "validChild": 42
        }
      }`);

      const clean = sanitizeJsonPayload(maliciousPayload);

      expect(clean.normalField).toBe('safe value');
      expect((clean as any).__proto__).toBeUndefined();
      expect(clean.nested.validChild).toBe(42);
      expect((clean.nested as any).constructor).toBeUndefined();
      expect((clean.nested as any).prototype).toBeUndefined();

      // Ensure global Object.prototype was NOT polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should reject JSON payloads with excessively deep nesting (>20) to prevent Stack Overflow DoS', () => {
      let deep: any = { leaf: true };
      for (let i = 0; i < 25; i++) {
        deep = { child: deep };
      }

      expect(() => sanitizeJsonPayload(deep)).toThrow('Payload nesting depth exceeded maximum threshold');
    });

    it('should strictly enforce multi-tenant isolation (Org 2 cannot match or see Org 1 records)', async () => {
      const timestamp = Date.now();
      const sharedDomain = `secure-isolated-${timestamp}.com`;

      // Org 1 creates record
      const org1Record = await recordRepo.upsertRecord({
        orgId: 1,
        title: 'Org 1 Private Prospect',
        data: { confidential_deal_size: 100000 },
        identities: [{ type: 'domain', value: sharedDomain }],
      });
      expect(org1Record.isNew).toBe(true);

      // Org 2 ingests record with the SAME domain
      const org2Record = await recordRepo.upsertRecord({
        orgId: 2,
        title: 'Org 2 Private Prospect',
        data: { confidential_deal_size: 500 },
        identities: [{ type: 'domain', value: sharedDomain }],
      });

      // Must be a separate, new record for Org 2!
      expect(org2Record.isNew).toBe(true);
      expect(org2Record.record.id).not.toBe(org1Record.record.id);
      expect(org2Record.record.org_id).toBe(2);

      // Org 1 cannot see Org 2's record
      const org1Lookup = await recordRepo.findById(1, org2Record.record.id);
      expect(org1Lookup).toBeNull();

      // Org 2 cannot see Org 1's record
      const org2Lookup = await recordRepo.findById(2, org1Record.record.id);
      expect(org2Lookup).toBeNull();

      // Listing records for Org 1 only returns Org 1 items
      const org1List = await recordRepo.listRecords(1, { search: 'Org 2 Private Prospect' });
      expect(org1List.total).toBe(0);
    });

    it('should reject operations without a valid tenant orgId', async () => {
      expect(
        recordRepo.upsertRecord({
          orgId: 0 as any,
          title: 'Invalid Org',
          data: {},
          identities: [],
        })
      ).rejects.toThrow('Valid tenant orgId is required');

      expect(recordRepo.findById(0 as any, 1)).rejects.toThrow('Tenant context (orgId) is mandatory');
      expect(recordRepo.deleteById(-1 as any, 1)).rejects.toThrow('Tenant context (orgId) is mandatory');
    });
  });
});
