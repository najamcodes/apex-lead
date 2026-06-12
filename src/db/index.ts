import 'reflect-metadata'
import { DataSource } from 'typeorm'
import path from 'path'
import { app } from 'electron'

import { LeadEntity } from './entities/LeadEntity'
import { SettingsEntity } from './entities/SettingsEntity'
import { OutreachEntity } from './entities/OutreachEntity'
import { NoteEntity } from './entities/NoteEntity'
import { ActivityEntity } from './entities/ActivityEntity'
import { ScrapeJobEntity } from './entities/ScrapeJobEntity'

let _dataSource: DataSource | null = null

export async function initDb(): Promise<DataSource> {
  if (_dataSource?.isInitialized) return _dataSource

  const dbPath = path.join(app.getPath('userData'), 'leadhunter.db')
  
  _dataSource = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    synchronize: true, // Auto-create schema for local development
    entities: [
      LeadEntity,
      SettingsEntity,
      OutreachEntity,
      NoteEntity,
      ActivityEntity,
      ScrapeJobEntity
    ],
  })

  await _dataSource.initialize()
  
  // Apply pragmas
  await _dataSource.query('PRAGMA journal_mode = WAL;')
  await _dataSource.query('PRAGMA foreign_keys = ON;')

  return _dataSource
}

export function getDataSource(): DataSource {
  if (!_dataSource || !_dataSource.isInitialized) {
    throw new Error('Database not initialized! Call initDb() first.')
  }
  return _dataSource
}
