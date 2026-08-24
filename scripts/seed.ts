import { getDataSource, initDb } from '../src/db'
import { LeadEntity } from '../src/db/entities/LeadEntity'
import { UserEntity } from '../src/db/entities/UserEntity'
import { OrganizationEntity } from '../src/db/entities/OrganizationEntity'
import { SettingsEntity } from '../src/db/entities/SettingsEntity'
import { EmailTemplateEntity } from '../src/db/entities/EmailTemplateEntity'
import { ScrapeTargetEntity } from '../src/db/entities/ScrapeTargetEntity'
import { QueryProfileEntity } from '../src/db/entities/QueryProfileEntity'
import { EmailAccountEntity } from '../src/db/entities/EmailAccountEntity'
import { OutreachEntity } from '../src/db/entities/OutreachEntity'
import { ActivityEntity } from '../src/db/entities/ActivityEntity'
import { NoteEntity } from '../src/db/entities/NoteEntity'
import { hashPassword } from '../backend/core/utils/crypto'

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
  { city: 'Philadelphia', state: 'PA', country: 'USA' },
  { city: 'San Antonio', state: 'TX', country: 'USA' },
  { city: 'San Diego', state: 'CA', country: 'USA' },
  { city: 'Dallas', state: 'TX', country: 'USA' },
  { city: 'Austin', state: 'TX', country: 'USA' },
  { city: 'Seattle', state: 'WA', country: 'USA' },
  { city: 'Denver', state: 'CO', country: 'USA' },
  { city: 'Boston', state: 'MA', country: 'USA' },
  { city: 'Miami', state: 'FL', country: 'USA' },
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
  'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
]

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
]

const streetNames = [
  'Main St', 'Oak Ave', 'Park Rd', 'Elm St', 'First St', 'Second St',
  'Maple Dr', 'Cedar Ln', 'Washington Blvd', 'Lincoln Ave', 'Jefferson St',
  'Franklin Rd', 'Madison Ave', 'Monroe St', 'Jackson Dr', 'Adams Ln',
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
  console.log('🌱 Starting database seeding...')

  await initDb()

  const dataSource = getDataSource()
  await dataSource.initialize()

  const leadRepo = dataSource.getRepository(LeadEntity)
  const userRepo = dataSource.getRepository(UserEntity)
  const orgRepo = dataSource.getRepository(OrganizationEntity)
  const settingsRepo = dataSource.getRepository(SettingsEntity)
  const templateRepo = dataSource.getRepository(EmailTemplateEntity)
  const targetRepo = dataSource.getRepository(ScrapeTargetEntity)
  const profileRepo = dataSource.getRepository(QueryProfileEntity)
  const emailAccountRepo = dataSource.getRepository(EmailAccountEntity)
  const outreachRepo = dataSource.getRepository(OutreachEntity)

  // Clear existing data (in reverse order of dependencies)
  console.log('🧹 Clearing existing data...')
  await outreachRepo.clear()
  await leadRepo.clear()
  await templateRepo.clear()
  await targetRepo.clear()
  await profileRepo.clear()
  await emailAccountRepo.clear()
  await settingsRepo.clear()
  await userRepo.clear()
  await orgRepo.clear()

  // Create organization
  console.log('🏢 Creating organization...')
  const org = orgRepo.create({
    name: 'LeadGen Demo Org',
    tier: 'pro',
    max_users: 10,
    settings: JSON.stringify({ theme: 'dark', default_proxy: null }),
  })
  await orgRepo.save(org)

  // Create users with role hierarchy
  console.log('👥 Creating users with role hierarchy...')
  const adminUser = userRepo.create({
    email: 'admin@leadgen-demo.com',
    password_hash: hashPassword('admin123'),
    role: 'org_admin',
    org_id: org.id,
    name: 'Alex Admin',
    hierarchy_level: 4,
    permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach', 'manage_team']),
  })
  await userRepo.save(adminUser)

  const managerUser = userRepo.create({
    email: 'manager@leadgen-demo.com',
    password_hash: hashPassword('manager123'),
    role: 'manager',
    org_id: org.id,
    name: 'Maria Manager',
    hierarchy_level: 3,
    permissions: JSON.stringify(['view_leads', 'run_scraper', 'send_outreach']),
  })
  await userRepo.save(managerUser)

  const teamUser = userRepo.create({
    email: 'team@leadgen-demo.com',
    password_hash: hashPassword('team123'),
    role: 'user',
    org_id: org.id,
    name: 'Tom User',
    hierarchy_level: 2,
    permissions: JSON.stringify(['view_leads', 'run_scraper', 'send_outreach']),
  })
  await userRepo.save(teamUser)

  const viewerUser = userRepo.create({
    email: 'viewer@leadgen-demo.com',
    password_hash: hashPassword('viewer123'),
    role: 'viewer',
    org_id: org.id,
    name: 'Vera Viewer',
    hierarchy_level: 1,
    permissions: JSON.stringify(['view_leads']),
  })
  await userRepo.save(viewerUser)

  // Create default settings
  console.log('⚙️ Creating default settings...')
  const defaultSettings = [
    { org_id: org.id, key: 'scrape_delay_ms', value: '1200' },
    { org_id: org.id, key: 'max_results_per_run', value: '100' },
    { org_id: org.id, key: 'default_country', value: 'United States' },
    { org_id: org.id, key: 'default_city', value: '' },
    { org_id: org.id, key: 'seo_audit_engine', value: 'pagespeed' },
    { org_id: org.id, key: 'pagespeed_api_key', value: '' },
    { org_id: org.id, key: 'ai_provider', value: 'openrouter' },
    { org_id: org.id, key: 'openrouter_api_key', value: '' },
    { org_id: org.id, key: 'ai_model_site_scoring', value: 'anthropic/claude-3-haiku' },
    { org_id: org.id, key: 'ai_model_email_draft', value: 'anthropic/claude-3-5-sonnet' },
    { org_id: org.id, key: 'ai_enabled', value: 'false' },
    { org_id: org.id, key: 'smtp_host', value: 'smtp.gmail.com' },
    { org_id: org.id, key: 'smtp_port', value: '587' },
    { org_id: org.id, key: 'smtp_secure', value: 'false' },
    { org_id: org.id, key: 'smtp_username', value: '' },
    { org_id: org.id, key: 'smtp_password', value: '' },
    { org_id: org.id, key: 'smtp_from_name', value: 'LeadGen Demo' },
    { org_id: org.id, key: 'smtp_from_email', value: '' },
    { org_id: org.id, key: 'hunter_api_key', value: '' },
    { org_id: org.id, key: 'email_finder_enabled', value: 'false' },
    { org_id: org.id, key: 'auto_send_enabled', value: 'false' },
    { org_id: org.id, key: 'auto_send_cron', value: '0 9 * * *' },
    { org_id: org.id, key: 'theme', value: 'light' },
    { org_id: org.id, key: 'captcha_strategy', value: 'pause' },
    { org_id: org.id, key: 'two_captcha_key', value: '' },
    { org_id: org.id, key: 'captcha_timeout_s', value: '120' },
    { org_id: org.id, key: 'scraper_headful', value: 'false' },
    { org_id: org.id, key: 'pipeline_enabled', value: 'false' },
    { org_id: org.id, key: 'pipeline_scrape_cron', value: '0 2 * * *' },
    { org_id: org.id, key: 'pipeline_digest_cron', value: '0 7 * * *' },
    { org_id: org.id, key: 'digest_recipient_email', value: '' },
    { org_id: org.id, key: 'auto_approve_threshold', value: '0' },
    { org_id: org.id, key: 'auto_sequence_on_approve', value: 'false' },
    { org_id: org.id, key: 'discord_webhook_url', value: '' },
    { org_id: org.id, key: 'use_ai_for_outreach', value: 'true' },
    { org_id: org.id, key: 'default_email_template_id', value: 'null' },
    { org_id: org.id, key: 'imap_cron', value: '*/5 * * * *' },
    { org_id: org.id, key: 'warmup_cron', value: '*/30 * * * *' },
    { org_id: org.id, key: 'outreach_disabled', value: 'false' },
  ]

  for (const setting of defaultSettings) {
    await settingsRepo.save(settingsRepo.create({ ...setting, org_id: org.id }))
  }

  // Create email templates
  console.log('📧 Creating email templates...')
  const templates = [
    {
      org_id: org.id,
      name: 'Cold Outreach v1',
      subject: 'Quick question about {{business_name}}',
      body: `Hi {{contact_name}},

I came across {{business_name}} and was impressed by your work in {{city}}.

I'm reaching out because we help businesses like yours {{ai_hook}}.

Would you be open to a brief 15-minute call to see if we're a good fit?

Best regards,
{{developer_name}}`,
    },
    {
      org_id: org.id,
      name: 'Follow-up Template',
      subject: 'Following up on my previous note',
      body: `Hi {{contact_name}},

I wanted to follow up on my previous message about {{business_name}}.

I genuinely believe we could help you {{ai_hook}}. Even if now isn't the right time, I'd love to stay in touch.

No pressure - just let me know if you'd like to chat.

Best,
{{developer_name}}`,
    },
    {
      org_id: org.id,
      name: 'Referral Request',
      subject: 'Who handles {{category}} decisions at {{business_name}}?',
      body: `Hi {{contact_name}},

I know you're busy, so I'll keep this brief.

I'm looking to connect with the person who handles {{category}} decisions at {{business_name}}.

Could you point me in the right direction?

Thanks,
{{developer_name}}`,
    },
  ]

  for (const template of templates) {
    await templateRepo.save(templateRepo.create(template))
  }

  // Create scrape targets
  console.log('🎯 Creating scrape targets...')
  const targets = [
    {
      org_id: org.id,
      label: 'SF Restaurants',
      query: 'restaurants',
      city: 'San Francisco',
      country: 'United States',
      max_per_run: 50,
      min_ai_score: 0,
      website_filter: 'all',
      use_proxy: false,
      status: 'active',
    },
    {
      org_id: org.id,
      label: 'NYC Dentists',
      query: 'dentists',
      city: 'New York',
      country: 'United States',
      max_per_run: 30,
      min_ai_score: 60,
      website_filter: 'has_website',
      use_proxy: false,
      status: 'active',
    },
    {
      org_id: org.id,
      label: 'LA Lawyers',
      query: 'lawyers',
      city: 'Los Angeles',
      country: 'United States',
      max_per_run: 40,
      min_ai_score: 70,
      website_filter: 'all',
      use_proxy: true,
      status: 'paused',
    },
  ]

  for (const target of targets) {
    await targetRepo.save(targetRepo.create(target))
  }

  // Create query profiles
  console.log('🔍 Creating query profiles...')
  const profiles = [
    {
      org_id: org.id,
      label: 'High-Value Local Services',
      target_audience: 'Local service businesses with 10-50 employees',
      core_offer: 'Lead generation and marketing automation',
      cities: JSON.stringify(['San Francisco', 'Los Angeles', 'New York', 'Chicago']),
      countries: JSON.stringify(['United States']),
      status: 'active',
    },
    {
      org_id: org.id,
      label: 'Healthcare Practices',
      target_audience: 'Independent medical and dental practices',
      core_offer: 'Patient acquisition and reputation management',
      cities: JSON.stringify(['San Francisco', 'Los Angeles', 'New York', 'Miami']),
      countries: JSON.stringify(['United States']),
      status: 'active',
    },
    {
      org_id: org.id,
      label: 'Legal & Professional Services',
      target_audience: 'Law firms, accounting firms, consulting agencies',
      core_offer: 'Client acquisition and retention systems',
      cities: JSON.stringify(['New York', 'Chicago', 'Washington DC', 'Boston']),
      countries: JSON.stringify(['United States']),
      status: 'paused',
    },
  ]

  for (const profile of profiles) {
    await profileRepo.save(profileRepo.create(profile))
  }

  // Generate sample leads
  console.log('📋 Generating sample leads...')
  const statuses = ['scraped', 'qualified', 'review', 'approved', 'outreach', 'replied', 'closed', 'skipped']
  const websiteStatuses = ['unchecked', 'none', 'outdated', 'modern']

  const leads = []
  for (let i = 0; i < 200; i++) {
    const category = randomItem(sampleCategories)
    const location = randomItem(sampleCities)
    const businessName = generateBusinessName()
    const contactName = `${randomItem(firstNames)} ${randomItem(lastNames)}`
    const hasWebsite = Math.random() > 0.3
    const hasPhone = Math.random() > 0.2
    const hasEmail = Math.random() > 0.4

    const status = randomItem(statuses)
    const websiteStatus = hasWebsite ? randomItem(websiteStatuses.filter(s => s !== 'none')) : 'none'

    const aiScore = status === 'approved' || status === 'outreach' || status === 'replied' || status === 'closed'
      ? randomInt(70, 100)
      : status === 'review'
        ? randomInt(40, 75)
        : randomInt(0, 50)

    const scrapedAt = randomDate(new Date('2024-01-01'), new Date())

    // Distribute leads among users for per-user data isolation demo
    const assigneeIds = [adminUser.id, managerUser.id, teamUser.id]
    const assignedUserId = status === 'approved' || status === 'outreach' ? managerUser.id 
      : i % 3 === 0 ? teamUser.id 
      : i % 3 === 1 ? managerUser.id 
      : adminUser.id

    const lead = leadRepo.create({
      org_id: org.id,
      scraped_by_user_id: assignedUserId,
      business_name: businessName,
      category,
      city: location.city,
      country: location.country,
      phone: hasPhone ? randomPhone() : null,
      email: hasEmail ? randomEmail(businessName, 'example.com') : null,
      website_url: hasWebsite ? randomWebsite(businessName) : null,
      google_maps_url: `https://maps.google.com/?q=${encodeURIComponent(businessName + ' ' + location.city)}`,
      website_status: websiteStatus,
      ssl_valid: hasWebsite ? Math.random() > 0.1 : null,
      source: 'google_maps',
      ai_site_score: aiScore > 0 ? aiScore : null,
      ai_site_summary: aiScore > 70 ? 'Modern, professional website with good conversion elements' : aiScore > 40 ? 'Functional website but could use modernization' : null,
      ai_personalized_hook: aiScore > 60 ? 'Could benefit from automated lead follow-up' : null,
      ai_icebreaker: aiScore > 50 ? 'Noticed your recent expansion...' : null,
      contact_name: Math.random() > 0.5 ? contactName : null,
      review_rating: hasWebsite ? (3.5 + Math.random() * 1.5) : null,
      review_count: hasWebsite ? randomInt(10, 500) : null,
      tech_stack: hasWebsite ? JSON.stringify(['WordPress', 'Google Analytics', 'Cloudflare']) : null,
      social_links: hasWebsite ? JSON.stringify({ facebook: `https://facebook.com/${businessName.toLowerCase().replace(/\s+/g, '')}`, instagram: `https://instagram.com/${businessName.toLowerCase().replace(/\s+/g, '')}` }) : null,
      seo_metrics: hasWebsite ? JSON.stringify({ organic_traffic: randomInt(100, 10000), keywords: randomInt(50, 500) }) : null,
      email_verified: hasEmail ? Math.random() > 0.3 : null,
      status,
      scraped_at: scrapedAt.toISOString(),
      updated_at: randomDate(scrapedAt, new Date()).toISOString(),
    })
    leads.push(lead)
  }

  // Batch insert leads
  const batchSize = 50
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize)
    await leadRepo.save(batch)
    console.log(`  Inserted ${Math.min(i + batchSize, leads.length)}/${leads.length} leads...`)
  }

  // Create email accounts
  console.log('📮 Creating email accounts...')
  const emailAccounts = [
    {
      org_id: org.id,
      email_address: 'outreach@leadgen-demo.com',
      app_password: 'demo-password-123',
      sender_name: 'LeadGen Demo Team',
      daily_limit: 50,
      status: 'active',
    },
    {
      org_id: org.id,
      email_address: 'sales@leadgen-demo.com',
      app_password: 'demo-password-456',
      sender_name: 'Sales Team',
      daily_limit: 100,
      status: 'active',
    },
  ]

  for (const account of emailAccounts) {
    await emailAccountRepo.save(emailAccountRepo.create(account))
  }

  // Create outreach records
  console.log('📤 Creating outreach records...')
  // Actually fetch leads with emails
  const leadsWithEmail = await leadRepo
    .createQueryBuilder('lead')
    .where('lead.org_id = :orgId', { orgId: org.id })
    .andWhere('lead.email IS NOT NULL AND lead.email != \'\'')
    .limit(50)
    .getMany()

  const outreachSteps = ['initial', 'followup_1', 'followup_2', 'followup_3', 'breakup']
  const outreachStatuses = ['queued', 'sent', 'replied', 'bounced', 'failed']

  for (const lead of leadsWithEmail) {
    const steps = randomInt(1, 3)
    const template = await templateRepo.findOneBy({ org_id: org.id })

    for (let step = 0; step < steps; step++) {
      const status = step === 0 ? 'sent' : randomItem(outreachStatuses.filter(s => s !== 'queued'))
      const scheduledAt = new Date(Date.now() + step * 3 * 24 * 60 * 60 * 1000)

      await outreachRepo.save(outreachRepo.create({
        org_id: org.id,
        lead_id: lead.id,
        step: step + 1,
        channel: 'email',
        subject: template?.subject || `Reaching out to ${lead.business_name}`,
        body: template?.body || 'Template body',
        scheduled_at: scheduledAt.toISOString(),
        status,
        sent_at: status === 'sent' || status === 'replied' ? new Date(scheduledAt.getTime() + 60000).toISOString() : null,
        replied_at: status === 'replied' ? new Date(scheduledAt.getTime() + 3600000).toISOString() : null,
      }))
    }
  }

  // Create activity logs for some leads
  console.log('📝 Creating activity logs...')
  const activityEvents = [
    'lead_scraped', 'lead_analyzed', 'lead_approved', 'lead_skipped',
    'email_found', 'email_verified', 'note_added', 'email_sent',
    'email_replied', 'email_bounced', 'lead_closed'
  ]

  for (const lead of leadsWithEmail.slice(0, 20)) {
    const eventCount = randomInt(2, 5)
    for (let i = 0; i < eventCount; i++) {
      const event = randomItem(activityEvents)
      const detail = event === 'email_sent' ? 'Sent initial outreach'
        : event === 'email_replied' ? 'Prospect replied - interested'
        : event === 'lead_approved' ? 'Approved by admin'
        : event === 'lead_scraped' ? 'Found via Google Maps'
        : event === 'lead_analyzed' ? 'AI analysis complete'
        : event === 'note_added' ? 'Added internal note'
        : ''

      const activityRepo = dataSource.getRepository(ActivityEntity)
      await activityRepo.save(activityRepo.create({
        org_id: org.id,
        lead_id: lead.id,
        event,
        detail,
        created_at: randomDate(new Date(lead.scraped_at || '2024-01-01'), new Date()).toISOString(),
      }))
    }
  }

  console.log('✅ Seeding completed successfully!')
  console.log(`
  📊 Summary:
  - Organization: 1
  - Users: 2 (admin@leadgen-demo.com / admin123, team@leadgen-demo.com / team123)
  - Leads: ${leads.length}
  - Email Templates: ${templates.length}
  - Scrape Targets: ${targets.length}
  - Query Profiles: ${profiles.length}
  - Email Accounts: ${emailAccounts.length}
  - Outreach Records: ~${leadsWithEmail.length * 2}
  `)

  await dataSource.destroy()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('❌ Seeding failed:', err)
  const dataSource = getDataSource()
  if (dataSource.isInitialized) {
    await dataSource.destroy()
  }
  process.exit(1)
})