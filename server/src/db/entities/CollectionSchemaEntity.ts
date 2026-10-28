import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

const isPostgres =
  process.env.DB_TYPE === 'postgres' ||
  (typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.startsWith('postgres'));

@Entity('collection_schemas')
@Unique('uq_org_collection_slug', ['org_id', 'slug'])
@Index(['org_id', 'slug'])
export class CollectionSchemaEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int' })
  @Index()
  org_id!: number;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: false })
  is_system!: boolean;

  @Column({
    type: isPostgres ? 'jsonb' : 'simple-json',
    default: isPostgres ? '[]' : '[]',
  })
  fields!: Array<Record<string, unknown>>;

  @Column({
    type: isPostgres ? 'jsonb' : 'simple-json',
    default: isPostgres ? '[]' : '[]',
  })
  views!: Array<Record<string, unknown>>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
