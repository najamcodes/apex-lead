import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

import type { RecordEntity } from './RecordEntity';

export type IdentifierType =
  | 'domain'
  | 'email'
  | 'phone'
  | 'maps_place_id'
  | 'linkedin'
  | 'external_id'
  | (string & {});

@Entity('record_identities')
@Unique('uq_org_identifier', ['org_id', 'identifier_type', 'identifier_value'])
@Index(['org_id', 'identifier_type', 'identifier_value'])
export class RecordIdentityEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int' })
  @Index()
  org_id!: number;

  @Column({ type: 'int' })
  @Index()
  record_id!: number;

  @ManyToOne('RecordEntity', 'identities', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  record?: RecordEntity;

  @Column({ type: 'varchar', length: 32 })
  identifier_type!: IdentifierType;

  @Column({ type: 'varchar', length: 255 })
  identifier_value!: string;

  @CreateDateColumn()
  created_at!: Date;
}
