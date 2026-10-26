import '../../../server/polyfill';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initDb, getDataSource } from '../../../backend/db/index';
import { insertBatchLeads, getAllLeads } from '../../../backend/db/queries/leads.queries';

describe('Batch Leads Import Engine', () => {
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

  it('should successfully import an array of valid leads and report counts', async () => {
    const timestamp = Date.now();
    const batch = [
      {
        business_name: `Batch Target Alpha ${timestamp}`,
        city: 'New York',
        country: 'US',
        email: `alpha_${timestamp}@testdomain.io`,
        phone: '+1 555-0101',
        category: 'Software',
      },
      {
        business_name: `Batch Target Beta ${timestamp}`,
        city: 'San Francisco',
        country: 'US',
        email: `beta_${timestamp}@testdomain.io`,
        phone: '+1 555-0102',
        category: 'Design',
      },
      {
        business_name: `Batch Target Gamma ${timestamp}`,
        city: 'Austin',
        country: 'US',
        email: `gamma_${timestamp}@testdomain.io`,
        phone: '+1 555-0103',
        category: 'Finance',
      },
    ];

    const result = await insertBatchLeads(batch as any);
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);

    const leads = await getAllLeads({ city: 'New York' });
    const importedLead = leads.data.find(l => l.business_name === `Batch Target Alpha ${timestamp}`);
    expect(importedLead).toBeDefined();
    expect(importedLead?.email).toBe(`alpha_${timestamp}@testdomain.io`);
  });

  it('should skip rows with missing business name', async () => {
    const timestamp = Date.now();
    const batch = [
      {
        business_name: '',
        city: 'Miami',
        email: 'invalid@test.com',
      },
      {
        business_name: `Valid Delta ${timestamp}`,
        city: 'Miami',
        email: `delta_${timestamp}@test.com`,
      },
    ];

    const result = await insertBatchLeads(batch as any);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should handle duplicates safely without throwing errors', async () => {
    const timestamp = Date.now();
    const lead = {
      business_name: `Duplicate Test ${timestamp}`,
      city: 'Chicago',
      email: `dup_${timestamp}@test.com`,
    };

    const firstRun = await insertBatchLeads([lead] as any);
    expect(firstRun.imported).toBe(1);

    // Second run with same business name and city
    const secondRun = await insertBatchLeads([lead] as any);
    expect(secondRun.imported).toBe(1); // Returns existing lead gracefully
  });
});
