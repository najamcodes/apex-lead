import '../../../server/polyfill';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initDb, getDataSource } from '@sdk/core/db';
import { createKatalApp } from '../../../server/src/app';

describe('Katal MVC & IoC Architecture (Prompt 02)', () => {
  let app: ReturnType<typeof createKatalApp>;

  beforeAll(async () => {
    global.currentUserRole = 'admin';
    global.currentOrgId = 1;
    await initDb();
    app = createKatalApp();
  });

  afterAll(async () => {
    const ds = getDataSource();
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  it('should serve healthy status on GET /health via Katal Controller', async () => {
    const res = await app.fetch(new Request('http://localhost/health'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.framework).toBe('katal@3.0.0');
    expect(body.version).toBe('1.0.0');
  });

  it('should handle POST /api/v1/records/upsert and return 201 for fresh polymorphic record', async () => {
    const timestamp = Date.now();
    const req = new Request('http://localhost/api/v1/records/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Org-Id': '1',
      },
      body: JSON.stringify({
        title: `Katal Ingested Prospect ${timestamp}`,
        collectionType: 'contractors',
        status: 'qualified',
        source: 'google_maps',
        enrichmentScore: 82,
        data: {
          trade: 'HVAC Specialist',
          emergency_service_24_7: true,
          fleet_vehicles: 6,
        },
        identities: [
          { type: 'email', value: `hvac_${timestamp}@dallashvacpros.com` },
          { type: 'phone', value: `+1214${timestamp.toString().slice(-6)}` },
        ],
      }),
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.data.id).toBeGreaterThan(0);
    expect(body.data.title).toBe(`Katal Ingested Prospect ${timestamp}`);
  });

  it('should return 200 with merged data when ingesting a duplicate identity', async () => {
    const timestamp = Date.now();
    const email = `plumber_${timestamp}@texasrapidplumbing.com`;

    // 1. First ingest
    const firstRes = await app.fetch(
      new Request('http://localhost/api/v1/records/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Id': '1' },
        body: JSON.stringify({
          title: 'Texas Rapid Plumbing',
          collectionType: 'contractors',
          enrichmentScore: 50,
          data: { trade: 'Plumbing' },
          identities: [{ type: 'email', value: email }],
        }),
      })
    );
    expect(firstRes.status).toBe(201);
    const firstBody = await firstRes.json();
    const recordId = firstBody.data.id;

    // 2. Duplicate ingest with updated data
    const secondRes = await app.fetch(
      new Request('http://localhost/api/v1/records/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Id': '1' },
        body: JSON.stringify({
          title: 'Texas Rapid Plumbing LLC',
          enrichmentScore: 90,
          data: { master_plumber: 'Robert Vance' },
          identities: [{ type: 'email', value: email }],
        }),
      })
    );
    expect(secondRes.status).toBe(200);
    const secondBody = await secondRes.json();
    expect(secondBody.isNew).toBe(false);
    expect(secondBody.data.id).toBe(recordId);
    expect(secondBody.data.enrichment_score).toBe(90);

    const mergedData =
      typeof secondBody.data.data === 'string' ? JSON.parse(secondBody.data.data) : secondBody.data.data;
    expect(mergedData.trade).toBe('Plumbing');
    expect(mergedData.master_plumber).toBe('Robert Vance');
  });

  it('should list records with pagination on GET /api/v1/records', async () => {
    const req = new Request('http://localhost/api/v1/records?page=1&limit=5', {
      headers: { 'X-Org-Id': '1' },
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.records)).toBe(true);
    expect(body.data.total).toBeGreaterThan(0);
    expect(body.data.page).toBe(1);
    expect(body.data.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('should retrieve a single record on GET /api/v1/records/:id', async () => {
    // 1. Create a record first
    const createRes = await app.fetch(
      new Request('http://localhost/api/v1/records/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Id': '1' },
        body: JSON.stringify({
          title: 'Single Target Verification',
          data: { verification: true },
          identities: [{ type: 'domain', value: `target-${Date.now()}.io` }],
        }),
      })
    );
    const created = await createRes.json();
    const id = created.data.id;

    // 2. Fetch it by ID
    const getRes = await app.fetch(
      new Request(`http://localhost/api/v1/records/${id}`, {
        headers: { 'X-Org-Id': '1' },
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.id).toBe(id);
    expect(getBody.data.title).toBe('Single Target Verification');
    expect(Array.isArray(getBody.data.identities)).toBe(true);
  });

  it('should delete a record on DELETE /api/v1/records/:id', async () => {
    // 1. Create a record to delete
    const createRes = await app.fetch(
      new Request('http://localhost/api/v1/records/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Id': '1' },
        body: JSON.stringify({
          title: 'To Be Deleted',
          data: { temp: true },
          identities: [],
        }),
      })
    );
    const created = await createRes.json();
    const id = created.data.id;

    // 2. Delete it
    const deleteRes = await app.fetch(
      new Request(`http://localhost/api/v1/records/${id}`, {
        method: 'DELETE',
        headers: { 'X-Org-Id': '1' },
      })
    );
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.data.deleted).toBe(true);

    // 3. Confirm 404 on subsequent get
    const getRes = await app.fetch(
      new Request(`http://localhost/api/v1/records/${id}`, {
        headers: { 'X-Org-Id': '1' },
      })
    );
    expect(getRes.status).toBe(404);
  });

  it('should return 400 Bad Request when validation fails', async () => {
    const req = new Request('http://localhost/api/v1/records/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Org-Id': '1' },
      body: JSON.stringify({
        // Missing title!
        data: {},
      }),
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(400);
  });
});
