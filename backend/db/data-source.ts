import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'path';
import fs from 'fs';

import { OrganizationEntity } from './entities/OrganizationEntity';
import { LeadEntity } from './entities/LeadEntity';
import { UserEntity } from './entities/UserEntity';
import { UserOrganizationEntity } from './entities/UserOrganizationEntity';
import { ProxyConfigEntity } from './entities/ProxyConfigEntity';
import { SettingsEntity } from './entities/SettingsEntity';
import { OutreachEntity } from './entities/OutreachEntity';
import { NoteEntity } from './entities/NoteEntity';
import { ActivityEntity } from './entities/ActivityEntity';
import { ScrapeJobEntity } from './entities/ScrapeJobEntity';
import { EmailTemplateEntity } from './entities/EmailTemplateEntity';
import { EmailAccountEntity } from './entities/EmailAccountEntity';
import { PluginSettingsEntity } from './entities/PluginSettingsEntity';
import { PipelineDefinitionEntity } from './entities/PipelineDefinitionEntity';
import { PipelineRunEntity } from './entities/PipelineRunEntity';
import { CollectionRecordEntity } from './entities/CollectionRecordEntity';
import { WorkerNodeEntity } from './entities/WorkerNodeEntity';
import { ApprovalEntity } from './entities/ApprovalEntity';
import { AIConnectionEntity } from './entities/AIConnectionEntity';
import { CustomNodeEntity } from './entities/CustomNodeEntity';
import { AuditLogEntity } from './entities/AuditLogEntity';

export const allEntities = [
  OrganizationEntity,
  UserEntity,
  UserOrganizationEntity,
  ProxyConfigEntity,
  LeadEntity,
  SettingsEntity,
  OutreachEntity,
  NoteEntity,
  ActivityEntity,
  ScrapeJobEntity,
  EmailTemplateEntity,
  EmailAccountEntity,
  PluginSettingsEntity,
  PipelineDefinitionEntity,
  PipelineRunEntity,
  CollectionRecordEntity,
  WorkerNodeEntity,
  ApprovalEntity,
  AIConnectionEntity,
  CustomNodeEntity,
  AuditLogEntity,
];

const isPostgres = process.env.DB_TYPE === 'postgres' || (typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.startsWith('postgres'));

function getDbPath(): string {
  if (process.env.LEADHUNTER_DB_PATH) {
    return process.env.LEADHUNTER_DB_PATH;
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'leadhunter.db');
}

export const AppDataSource = new DataSource(
  isPostgres
    ? {
        type: 'postgres',
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/apexlead',
        synchronize: false,
        entities: allEntities,
        migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
        logging: process.env.DB_LOGGING === 'true',
      }
    : {
        type: 'better-sqlite3',
        database: getDbPath(),
        synchronize: true,
        entities: allEntities,
        migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
        logging: process.env.DB_LOGGING === 'true',
      }
);
