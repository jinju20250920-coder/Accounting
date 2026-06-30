'use client';

import { useState } from 'react';
import { Database, HardDrive, Download, Upload, Save, Database as DatabaseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { setDatabaseType, getDatabaseType, DatabaseType, getCurrentManager } from '@/lib/database';

export function DatabaseSwitcher() {
  const [currentDb, setCurrentDb] = useState<DatabaseType>(() => getDatabaseType());
  const [isOpen, setIsOpen] = useState(false);

  const handleSwitchDb = async (type: DatabaseType) => {
    setDatabaseType(type);
    setCurrentDb(type);
    // Initialize the new database
    await getCurrentManager().init();
    setIsOpen(false);
    // Reload the page to refresh all stores
    window.location.reload();
  };

  const handleExportSqlite = async () => {
    try {
      const manager = getCurrentManager() as any;
      if (manager.exportDatabase) {
        const data = await manager.exportDatabase();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance-assistant-${new Date().toISOString().split('T')[0]}.db`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImportSqlite = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const manager = getCurrentManager() as any;
      if (manager.importDatabase) {
        await manager.importDatabase(uint8Array);
        alert('Database imported successfully! The page will reload.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the console for details.');
    }
  };

  const dbName = currentDb === 'sqlite' ? 'SQLite' : 'IndexedDB';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {currentDb === 'sqlite' ? (
            <DatabaseIcon className="h-4 w-4" />
          ) : (
            <HardDrive className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{dbName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Database Settings</DialogTitle>
          <DialogDescription>
            Choose your database type and manage database files.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="database">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="database">Database Type</TabsTrigger>
            <TabsTrigger value="files">File Management</TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="space-y-4 pt-4">
            <div className="grid gap-4">
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  currentDb === 'indexeddb'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => handleSwitchDb('indexeddb')}
              >
                <div className="flex items-start gap-3">
                  <HardDrive className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium">IndexedDB</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Browser-native database. Good for testing and simple use cases.
                      Data is stored in your browser profile.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  currentDb === 'sqlite'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => handleSwitchDb('sqlite')}
              >
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium">SQLite</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Full SQL database with export/import capabilities.
                      Better for advanced queries and data portability.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-4 pt-4">
            <div className="grid gap-4">
              {currentDb === 'sqlite' && (
                <>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Export Database</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Download your SQLite database file for backup or transfer.
                    </p>
                    <Button onClick={handleExportSqlite} className="gap-2">
                      <Download className="h-4 w-4" />
                      Export .db File
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Import Database</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Load a previously exported SQLite database file.
                    </p>
                    <div>
                      <input
                        type="file"
                        accept=".db,.sqlite,.sqlite3"
                        onChange={handleImportSqlite}
                        className="hidden"
                        id="sqlite-import"
                      />
                      <Button className="gap-2" onClick={() => document.getElementById('sqlite-import')?.click()}>
                        <Upload className="h-4 w-4" />
                        Import .db File
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {currentDb === 'indexeddb' && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    File export/import is only available with SQLite.
                    <br />
                    Switch to SQLite to use these features.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
