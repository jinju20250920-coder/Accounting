import { databaseManager } from './manager';
import { databaseService } from './service';
import { sqliteManager } from './sqlite-manager';
import { sqliteService } from './sqlite-service';
import { accountSetDbManager } from './account-set-db-manager';

// Database type for switching
export type DatabaseType = 'indexeddb' | 'sqlite';

// Current database type - you can change this to switch databases
let currentDatabase: DatabaseType = 'sqlite';

// Get current database manager
// For SQLite, we use accountSetDbManager which supports multiple account sets
export function getCurrentManager() {
  return currentDatabase === 'sqlite' ? accountSetDbManager : databaseManager;
}

// Get current database service
export function getCurrentService() {
  return currentDatabase === 'sqlite' ? sqliteService : databaseService;
}

// Switch database type
export function setDatabaseType(type: DatabaseType) {
  currentDatabase = type;
}

// Get current database type
export function getDatabaseType(): DatabaseType {
  return currentDatabase;
}

// Re-export sqliteService for direct access (e.g., accountSetId sync)
export { sqliteService };
