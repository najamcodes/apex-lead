import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RecordIdentityEntity } from './RecordIdentityEntity';

const isPostgres =
  process.env.DB_TYPE === 'postgres' ||
  (typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.startsWith('postgres'));

@Entity('records')
@Index(['org_id', 'collection_type'])
@Index(['org_id', 'status'])
@Index(['org_id', 'enrichment_score'])
export class RecordEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int' })
  @Index()
  org_id!: number;

  @Column({ type: 'varchar', length: 64, default: 'leads' })
  collection_type!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 64, default: 'new' })
  status!: string;

  @Column({ type: 'varchar', length: 64, default: 'manual' })
  source!: string;

  @Column({ type: 'int', default: 0 })
  enrichment_score!: number;

  @Column({
    type: isPostgres ? 'jsonb' : 'simple-json',
    default: isPostgres ? '{}' : '{}',
  })
  data!: Record<string, unknown>;

  @OneToMany(() => RecordIdentityEntity, (identity) => identity.record, { cascade: true })
  identities?: RecordIdentityEntity[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date | null;
}
