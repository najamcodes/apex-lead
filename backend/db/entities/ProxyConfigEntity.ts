import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export type ProxyType = 'http' | 'https' | 'socks5'

@Entity('proxy_configs')
export class ProxyConfigEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int' })
  org_id!: number

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text' })
  server!: string

  @Column({ type: 'int', default: 8080 })
  port!: number

  @Column({ type: 'text', nullable: true })
  username!: string | null

  @Column({ type: 'text', nullable: true })
  password!: string | null

  @Column({ type: 'text', default: 'http' })
  type!: string

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  @Column({ type: 'int', default: 0 })
  success_count!: number

  @Column({ type: 'int', default: 0 })
  fail_count!: number

  @Column({ type: 'int', nullable: true })
  avg_latency_ms!: number | null

  @Column({ type: 'text', nullable: true })
  last_used_at!: string | null

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}