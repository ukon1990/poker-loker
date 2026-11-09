import type { PokerDb } from '@/db/schema';

const APP_ID = 'poker-loker';

/** Bump when the shape of stored rows changes, and migrate older files in `parseBackup`. */
export const BACKUP_VERSION = 1;

const TABLE_NAMES = [
  'profile',
  'settings',
  'lessonProgress',
  'skillMastery',
  'attempts',
  'dailyActivity',
  'playSessions',
  'handHistory',
] as const;

type TableName = (typeof TABLE_NAMES)[number];

export interface BackupFile {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export class BackupError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function exportBackup(db: PokerDb, now = new Date()): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const entries = await Promise.all(
      TABLE_NAMES.map(async (name) => [name, await db.table(name).toArray()] as const),
    );
    return {
      app: APP_ID,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      tables: Object.fromEntries(entries) as Record<TableName, unknown[]>,
    };
  });
}

export function parseBackup(raw: unknown): BackupFile {
  if (!isRecord(raw) || raw.app !== APP_ID) {
    throw new BackupError('This is not a Poker Loker backup file.');
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new BackupError(`Backup version ${String(raw.version)} is not supported.`);
  }
  const { tables } = raw;
  if (!isRecord(tables)) throw new BackupError('The backup file is damaged.');

  for (const name of TABLE_NAMES) {
    const rows = tables[name];
    if (!Array.isArray(rows) || !rows.every(isRecord)) {
      throw new BackupError('The backup file is damaged.');
    }
  }
  return raw as unknown as BackupFile;
}

/** Replaces all data with the backup. Any failure rolls back and leaves existing data intact. */
export async function importBackup(db: PokerDb, raw: unknown): Promise<void> {
  const backup = parseBackup(raw);
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(TABLE_NAMES.map((name) => db.table(name).clear()));
    await Promise.all(TABLE_NAMES.map((name) => db.table(name).bulkPut(backup.tables[name])));
  });
}
