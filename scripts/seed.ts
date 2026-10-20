import '../server/polyfill'
import { initDb, getDataSource } from '../backend/db'
import { OrganizationEntity } from '../backend/db/entities/OrganizationEntity'
import { UserEntity } from '../backend/db/entities/UserEntity'
import { UserOrganizationEntity } from '../backend/db/entities/UserOrganizationEntity'
import { LeadEntity } from '../backend/db/entities/LeadEntity'
import { SettingsEntity } from '../backend/db/entities/SettingsEntity'
import { EmailTemplateEntity } from '../backend/db/entities/EmailTemplateEntity'
import { EmailAccountEntity } from '../backend/db/entities/EmailAccountEntity'
import { OutreachEntity } from '../backend/db/entities/OutreachEntity'
import { ActivityEntity } from '../backend/db/entities/ActivityEntity'
import { NoteEntity } from '../backend/db/entities/NoteEntity'
import { ApprovalEntity } from '../backend/db/entities/ApprovalEntity'
import { CollectionRecordEntity } from '../backend/db/entities/CollectionRecordEntity'
import { seedDefaultPipelines } from '../backend/pipelines/seed'
import { hashPassword } from '@sdk/core/utils/crypto'

const sampleCategories = [
  'Restaurant', 'Dentist', 'Lawyer', 'Plumber', 'Electrician', 'Real Estate Agent',
  'Accountant', 'Chiropractor', 'Gym', 'Salon', 'Auto Repair', 'Coffee Shop',
  'Bakery', 'Florist', 'Veterinarian', 'Optometrist', 'Physical Therapist',
  'Insurance Agency', 'Marketing Agency', 'Web Design', 'IT Support',
]

const sampleCities = [
  { city: 'San Francisco', state: 'CA', country: 'USA' },
  { city: 'Los Angeles', state: 'CA', country: 'USA' },
  { city: 'New York', state: 'NY', country: 'USA' },
  { city: 'Chicago', state: 'IL', country: 'USA' },
  { city: 'Houston', state: 'TX', country: 'USA' },
  { city: 'Phoenix', state: 'AZ', country: 'USA' },
  { city: 'Austin', state: 'TX', country: 'USA' },
  { city: 'Seattle', state: 'WA', country: 'USA' },
  { city: 'Denver', state: 'CO', country: 'USA' },
  { city: 'Boston', state: 'MA', country: 'USA' },
]

const businessPrefixes = [
  'Premier', 'Elite', 'Top', 'Pro', 'Expert', 'Prime', 'Choice', 'Select',
  'Quality', 'Trusted', 'Reliable', 'Professional', 'Advanced', 'Modern',
]

const businessSuffixes = [
  'Services', 'Solutions', 'Group', 'Associates', 'Partners', 'Co', 'LLC',
  'Inc', 'Enterprises', 'Systems', 'Works', 'Pros', 'Experts',
]

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph',
  'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy',
]

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
]

const streetNames = [
  'Main St', 'Oak Ave', 'Park Rd', 'Elm St', 'First St', 'Second St',
  'Maple Dr', 'Cedar Ln', 'Washington Blvd', 'Lincoln Ave',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomPhone(): string {
  const area = randomInt(200, 999)
  const prefix = randomInt(200, 999)
  const line = randomInt(1000, 9999)
  return `+1-${area}-${prefix}-${line}`
}

function randomEmail(name: string, domain: string): string {
  const cleanName = name.toLowerCase().replace(/[^a-z]/g, '')
  const num = randomInt(1, 999)
  return `${cleanName}${num}@${domain}`
}

function randomWebsite(name: string): string {
  const cleanName = name.toLowerCase().replace(/[^a-z]/g, '')
  const tlds = ['.com', '.net', '.org', '.io', '.co']
  return `https://www.${cleanName}${randomItem(tlds)}`
}

function randomAddress(): string {
  const num = randomInt(1, 9999)
  const street = randomItem(streetNames)
  return `${num} ${street}`
}

function generateBusinessName(): string {
  const prefix = randomItem(businessPrefixes)
  const suffix = randomItem(businessSuffixes)
  const category = randomItem(sampleCategories)
  return `${prefix} ${category} ${suffix}`
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function seed() {
  const isClean = process.argv.includes('--clean')
  console.log(`🌱 Starting database seeding (clean mode: ${isClean})...`)

  const dataSource = await initDb()

  const orgRepo = dataSource.getRepository(OrganizationEntity)
  const userRepo = dataSource.getRepository(UserEntity)
  const userOrgRepo = dataSource.getRepository(UserOrganizationEntity)
  const leadRepo = dataSource.getRepository(LeadEntity)
  const settingsRepo = dataSource.getRepository(SettingsEntity)
  const templateRepo = dataSource.getRepository(EmailTemplateEntity)
  const emailAccountRepo = dataSource.getRepository(EmailAccountEntity)
  const outreachRepo = dataSource.getRepository(OutreachEntity)
  const activityRepo = dataSource.getRepository(ActivityEntity)
  const approvalRepo = dataSource.getRepository(ApprovalEntity)
  const collectionRepo = dataSource.getRepository(CollectionRecordEntity)

  // Idempotency check unless --clean requested
  const existingOrg = await orgRepo.findOne({ where: { name: 'Acme Growth Labs' } })
  if (existingOrg && !isClean) {
    console.log('[Seed] Database already seeded with Acme Growth Labs. Skipping duplicate seeding.')
    console.log('To force reset, pass --clean flag: bun run scripts/seed.ts --clean')
    await dataSource.destroy()
    process.exit(0)
  }

  if (isClean) {
    console.log('🧹 Clearing existing demo data...')
    try { await outreachRepo.clear() } catch {}
    try { await activityRepo.clear() } catch {}
    try { await approvalRepo.clear() } catch {}
    try { await collectionRepo.clear() } catch {}
    try { await leadRepo.clear() } catch {}
    try { await templateRepo.clear() } catch {}
    try { await emailAccountRepo.clear() } catch {}
  }

  // 1. Create Organization
  console.log('🏢 Creating demo organization...')
  let org = await orgRepo.findOne({ where: { name: 'Acme Growth Labs' } })
  if (!org) {
    org = orgRepo.create({
      name: 'Acme Growth Labs',
      plan: 'pro',
      settings: JSON.stringify({ theme: 'dark', default_proxy: null }),
    })
    await orgRepo.save(org)
  }

  // 2. Create Users
  console.log('👥 Creating users...')
  let admin = await userRepo.findOne({ where: { email: 'admin@acme.io' } })
  if (!admin) {
    admin = userRepo.create({
      email: 'admin@acme.io',
      password_hash: hashPassword('Password123!'),
      role: 'super_admin',
      name: 'Alex Admin',
      default_org_id: org.id,
      permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach', 'manage_team']),
    })
    await userRepo.save(admin)

    await userOrgRepo.save(userOrgRepo.create({
      user_id: admin.id,
      org_id: org.id,
      role: 'owner',
      permissions: JSON.stringify(['all']),
    }))
  }

  // 3. Settings
  console.log('⚙️ Configuring settings...')
  const defaultSettings = [
    { org_id: org.id, key: 'scrape_delay_ms', value: '1200' },
    { org_id: org.id, key: 'max_results_per_run', value: '100' },
    { org_id: org.id, key: 'ai_enabled', value: 'true' },
    { org_id: org.id, key: 'theme', value: 'dark' },
    { org_id: org.id, key: 'use_ai_for_outreach', value: 'true' },
  ]
  for (const s of defaultSettings) {
    await settingsRepo.save(settingsRepo.create(s))
  }

  // 4. Email Templates
  console.log('📧 Creating email templates...')
  const templates = [
    {
      org_id: org.id,
      name: 'B2B Growth Cold Email',
      subject: 'Quick question about {{business_name}} growth',
      body: `Hi {{contact_name}},\n\nI came across {{business_name}} and love what you are building in {{city}}.\n\nWe recently helped a similar company scale their customer acquisition by 40%.\n\nWould you be open to a quick 10-minute intro call this week?\n\nBest,\nAlex`,
    },
    {
      org_id: org.id,
      name: 'Follow-up Email',
      subject: 'Following up on {{business_name}}',
      body: `Hi {{contact_name}},\n\nJust wanted to circle back on my note from last week.\n\nLet me know if you have 5 minutes for a quick chat.\n\nCheers,\nAlex`,
    },
  ]
  for (const t of templates) {
    await templateRepo.save(templateRepo.create(t))
  }

  // 5. Seed Pipeline Definitions
  console.log('🔄 Seeding default pipelines...')
  try {
    await seedDefaultPipelines(org.id)
  } catch (err) {
    console.warn('[Seed] Pipeline seeder notice:', err)
  }

  // 6. Generate 60 Synthetic Leads
  console.log('📋 Generating synthetic leads...')
  const statuses = ['scraped', 'qualified', 'review', 'approved', 'outreach', 'replied']
  const websiteStatuses = ['checked', 'modern', 'outdated']
  const leads: LeadEntity[] = []

  for (let i = 0; i < 60; i++) {
    const category = randomItem(sampleCategories)
    const location = randomItem(sampleCities)
    const businessName = generateBusinessName()
    const contactName = `${randomItem(firstNames)} ${randomItem(lastNames)}`
    const hasWebsite = Math.random() > 0.2
    const hasPhone = Math.random() > 0.1
    const hasEmail = Math.random() > 0.2
    const status = randomItem(statuses)
    const score = randomInt(40, 98)
    const scrapedAt = randomDate(new Date('2025-01-01'), new Date())

    const lead = leadRepo.create({
      org_id: org.id,
      scraped_by_user_id: admin.id,
      business_name: businessName,
      category,
      city: location.city,
      country: location.country,
      phone: hasPhone ? randomPhone() : null,
      email: hasEmail ? randomEmail(businessName, 'acmetargets.com') : null,
      website_url: hasWebsite ? randomWebsite(businessName) : null,
      google_maps_url: `https://maps.google.com/?q=${encodeURIComponent(businessName + ' ' + location.city)}`,
      website_status: hasWebsite ? randomItem(websiteStatuses) : 'none',
      ssl_valid: hasWebsite ? true : null,
      source: 'google_maps',
      ai_site_score: score,
      ai_site_summary: 'Solid local presence with high digital expansion potential.',
      ai_personalized_hook: 'Modernizing conversion funnel and automated follow-ups.',
      ai_icebreaker: 'Noticed your strong customer feedback and reviews.',
      contact_name: contactName,
      review_rating: +(3.8 + Math.random() * 1.2).toFixed(1),
      review_count: randomInt(15, 350),
      tech_stack: JSON.stringify(['Next.js', 'Tailwind', 'Stripe']),
      social_links: JSON.stringify({ linkedin: `https://linkedin.com/company/${businessName.toLowerCase().replace(/[^a-z]/g, '')}` }),
      seo_metrics: JSON.stringify({ organic_traffic: randomInt(500, 15000), keywords: randomInt(50, 400) }),
      email_verified: hasEmail ? true : null,
      status,
      scraped_at: scrapedAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    leads.push(lead)
  }

  await leadRepo.save(leads)
  console.log(`  Inserted ${leads.length} leads successfully.`)

  // 7. Human Approvals in Queue
  console.log('⚖️ Creating pending approvals...')
  const sampleApprovals = [
    { title: 'AI Copy Review: Apex Software', description: 'Review drafted cold email sequence before dispatch.', status: 'pending' },
    { title: 'High-Value Lead Review: Global Dental Pros', description: 'Score: 95. Verify corporate contact details.', status: 'pending' },
    { title: 'Domain Verification: CloudScale Labs', description: 'Approve custom outreach domain DNS setup.', status: 'pending' },
    { title: 'Campaign Budget Approval: Q4 SaaS Outreach', description: 'Monthly email sending allocation request.', status: 'pending' },
    { title: 'Webhook Dispatch Review: CRM Sync', description: 'Approve batch export of 50 qualified leads.', status: 'pending' },
  ]

  for (let idx = 0; idx < sampleApprovals.length; idx++) {
    const app = sampleApprovals[idx]
    await approvalRepo.save(approvalRepo.create({
      org_id: org.id,
      pipeline_id: 'lead-generation-pipeline',
      run_id: `run-seed-${idx + 1}`,
      node_id: `approval-node-${idx + 1}`,
      node_label: app.title,
      records: JSON.stringify([{ index: idx, business: `Prospect ${idx + 1}` }]),
      status: app.status as any,
      reviewer_notes: app.description,
    }))
  }

  // 8. Collections
  console.log('📁 Creating lead collections...')
  const collections = [
    { id: 'col-saas-1', collection: 'saas_targets', data: JSON.stringify({ count: 25, tag: 'saas' }) },
    { id: 'col-dental-1', collection: 'dental_clinics', data: JSON.stringify({ count: 18, tag: 'dental' }) },
    { id: 'col-ecom-1', collection: 'ecom_founders', data: JSON.stringify({ count: 17, tag: 'ecom' }) },
  ]
  const nowStr = new Date().toISOString()
  for (const c of collections) {
    await collectionRepo.save(collectionRepo.create({
      id: c.id,
      collection: c.collection,
      org_id: org.id,
      data: c.data,
      created_at: nowStr,
      updated_at: nowStr,
    }))
  }

  console.log('✅ Seeding completed successfully!')
  console.log(`
  📊 Seeded Records:
  - Organization: ${org.name} (ID: ${org.id})
  - Admin User: ${admin.email} (Password: Password123!)
  - Leads: ${leads.length}
  - Templates: ${templates.length}
  - Approvals: ${sampleApprovals.length}
  - Collections: ${collections.length}
  `)

  await dataSource.destroy()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('❌ Seeding failed:', err)
  try {
    const dataSource = getDataSource()
    if (dataSource.isInitialized) {
      await dataSource.destroy()
    }
  } catch {}
  process.exit(1)
})