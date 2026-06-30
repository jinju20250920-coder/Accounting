/* eslint-disable @typescript-eslint/no-require-imports -- Electron preload; CommonJS required by Electron runtime */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDbFile: () => ipcRenderer.invoke('select-db-file'),
    createDbFile: () => ipcRenderer.invoke('create-db-file'),
    saveDb: (data) => ipcRenderer.invoke('save-db', data),
    loadDb: () => ipcRenderer.invoke('load-db'),
    getDbPath: () => ipcRenderer.invoke('get-db-path'),
    setDbPath: (path) => ipcRenderer.invoke('set-db-path', path),
    getDefaultDbPath: () => ipcRenderer.invoke('get-default-db-path'),
    fileExists: (path) => ipcRenderer.invoke('file-exists', path),
    isElectron: () => true
});
