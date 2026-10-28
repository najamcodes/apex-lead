import '../../../server/polyfill';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initDb, getDataSource } from '@sdk/core/db';
import {
  isSuppressed,
  addSuppression,
  batchAddSuppressions,
  getAllSuppressions,
  removeSuppression,
} from '@sdk/core/db/queries/suppression.queries';
import { sendOutreachRecord } from '@sdk/core/outreach/index';

describe('Suppression & Do-Not-Contact (DNC) Engine', () => {
  const TEST_ORG_ID = 1;

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

  it('should return false for unsuppressed emails and domains', async () => {
    const suppressed = await isSuppressed('valid.prospect@growthco.io', TEST_ORG_ID);
    expect(suppressed).toBe(false);
  });

  it('should add an email to DNC list and detect direct suppression', async () => {
    const created = await addSuppression({
      org_id: TEST_ORG_ID,
      value: 'angry.customer@example.com',
      reason: 'unsubscribe',
    });

    expect(created).toBeDefined();
    expect(created?.type).toBe('email');
    expect(created?.value).toBe('angry.customer@example.com');

    const suppressed = await isSuppressed('angry.customer@example.com', TEST_ORG_ID);
    expect(suppressed).toBe(true);

    // Case insensitive matching
    const upperSuppressed = await isSuppressed('ANGRY.CUSTOMER@EXAMPLE.COM', TEST_ORG_ID);
    expect(upperSuppressed).toBe(true);
  });

  it('should add a domain to DNC and suppress any email under that domain', async () => {
    await addSuppression({
      org_id: TEST_ORG_ID,
      value: 'competitor.com',
      reason: 'competitor',
    });

    const isDirectDomainSuppressed = await isSuppressed('competitor.com', TEST_ORG_ID);
    expect(isDirectDomainSuppressed).toBe(true);

    const isEmployeeEmailSuppressed = await isSuppressed('sales@competitor.com', TEST_ORG_ID);
    expect(isEmployeeEmailSuppressed).toBe(true);

    const isFounderEmailSuppressed = await isSuppressed('founder@competitor.com', TEST_ORG_ID);
    expect(isFounderEmailSuppressed).toBe(true);
  });

  it('should batch add suppressions and handle duplicates cleanly', async () => {
    const res = await batchAddSuppressions(
      ['block1@dnc.org', 'block2@dnc.org', 'banned-domain.net', 'block1@dnc.org'],
      undefined,
      'manual',
      TEST_ORG_ID
    );

    expect(res.added).toBeGreaterThanOrEqual(3);

    const check1 = await isSuppressed('block1@dnc.org', TEST_ORG_ID);
    const check2 = await isSuppressed('block2@dnc.org', TEST_ORG_ID);
    const checkDomain = await isSuppressed('info@banned-domain.net', TEST_ORG_ID);

    expect(check1).toBe(true);
    expect(check2).toBe(true);
    expect(checkDomain).toBe(true);
  });

  it('should list and paginate suppressions with search filtering', async () => {
    const result = await getAllSuppressions(TEST_ORG_ID, {
      page: 1,
      pageSize: 10,
      search: 'competitor',
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].value).toContain('competitor');
  });

  it('should remove an item from the suppression list', async () => {
    const added = await addSuppression({
      org_id: TEST_ORG_ID,
      value: 'temporary-block@test.org',
      reason: 'manual',
    });
    expect(added).toBeDefined();

    const beforeRemoval = await isSuppressed('temporary-block@test.org', TEST_ORG_ID);
    expect(beforeRemoval).toBe(true);

    const removed = await removeSuppression(added!.id, TEST_ORG_ID);
    expect(removed).toBe(true);

    const afterRemoval = await isSuppressed('temporary-block@test.org', TEST_ORG_ID);
    expect(afterRemoval).toBe(false);
  });

  it('should abort outreach dispatch immediately when lead email is on DNC list', async () => {
    // Add target to suppression
    await addSuppression({
      org_id: TEST_ORG_ID,
      value: 'dnc-target@suppressed-org.com',
      reason: 'bounce',
    });

    const { leadStorage, outreachStorage } = await import('@sdk/core/storage');

    const lead = await leadStorage.insertLead({
      org_id: TEST_ORG_ID,
      email: 'dnc-target@suppressed-org.com',
      business_name: 'Suppressed Org',
      status: 'pending',
    } as any);

    const outreach = await outreachStorage.insertOutreach({
      org_id: TEST_ORG_ID,
      lead_id: lead.id,
      email_account_id: 1,
      template_id: 1,
      subject: 'Quick question',
      body: 'Hello John',
      status: 'pending',
      scheduled_at: new Date(),
    } as any);

    const outreachResult = await sendOutreachRecord(outreach.id);

    expect(outreachResult.success).toBe(false);
    expect(outreachResult.error).toContain('suppression list');
  });
});
