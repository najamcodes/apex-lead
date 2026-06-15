import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm'
import type { LeadStatus } from '../../types'

@Entity('leads')
@Index('idx_leads_unique_biz', ['business_name', 'city'], { unique: true })
export class LeadEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text' })
  business_name!: string

  @Column({ type: 'text', default: '' })
  category!: string

  @Column({ type: 'text', default: '' })
  city!: string

  @Column({ type: 'text', default: '' })
  country!: string

  @Column({ type: 'text', nullable: true })
  phone!: string | null

  @Column({ type: 'text', nullable: true })
  email!: string | null

  @Column({ type: 'boolean', nullable: true })
  email_verified!: boolean | null

  @Column({ type: 'text', nullable: true })
  website_url!: string | null

  @Column({ type: 'text', nullable: true })
  google_maps_url!: string | null

  @Column({ type: 'text', default: 'unchecked' })
  website_status!: string

  @Column({ type: 'int', nullable: true })
  pagespeed_mobile!: number | null

  @Column({ type: 'int', nullable: true })
  pagespeed_desktop!: number | null

  @Column({ type: 'boolean', nullable: true })
  ssl_valid!: boolean | null

  @Column({ type: 'text', nullable: true })
  tech_stack!: string | null

  @Column({ type: 'int', nullable: true })
  site_built_year!: number | null

  @Column({ type: 'int', nullable: true })
  ai_site_score!: number | null

  @Column({ type: 'text', nullable: true })
  ai_site_summary!: string | null

  @Column({ type: 'text', default: 'scraped' })
  status!: LeadStatus

  @Column({ type: 'text', nullable: true })
  flag_reason!: string | null

  @Column({ type: 'text', nullable: true })
  reviewer_notes!: string | null

  @Column({ type: 'text', nullable: true })
  outreach_channel!: string | null

  @Column({ type: 'text', default: 'manual' })
  source!: string

  @Column({ type: 'text', nullable: true })
  ai_personalized_hook!: string | null

  @Column({ type: 'text', nullable: true })
  contact_name!: string | null

  @Column({ type: 'text', nullable: true })
  ai_icebreaker!: string | null

  @Column({ type: 'float', nullable: true })
  review_rating!: number | null

  @Column({ type: 'int', nullable: true })
  review_count!: number | null

  @Column({ type: 'text', nullable: true })
  social_links!: string | null

  @Column({ type: 'text', nullable: true })
  seo_metrics!: string | null

  @Column({ type: 'int', nullable: true })
  priority_score!: number | null

  @Column({ type: 'text', nullable: true })
  priority_breakdown!: string | null

  @Column({ type: 'text', default: () => "datetime('now')" })
  scraped_at!: string

  @Column({ type: 'text', default: () => "datetime('now')" })
  updated_at!: string
}
