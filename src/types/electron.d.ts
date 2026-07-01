/**
 * Electron API 类型定义
 */
declare global {
  interface Window {
    electronAPI: {
      selectDbFile: () => Promise<string | null>;
      createDbFile: () => Promise<string | null>;
      saveDb: (data: Uint8Array) => Promise<string | null>;
      loadDb: () => Promise<number[] | null>;
      getDbPath: () => Promise<string | null>;
      setDbPath: (path: string) => Promise<boolean>;
      getDefaultDbPath: () => Promise<string>;
      fileExists: (path: string) => Promise<boolean>;
      isElectron: () => boolean;
    };

    // File System Access API 类型声明
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }

  interface SaveFilePickerOptions {
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }

  interface OpenFilePickerOptions {
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }
}

/**
 * OPFS (Origin Private File System) 类型定义
 */
interface OPFSFileHandle extends FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  sync?: () => Promise<void>;
}

interface StorageManager {
  getDirectory(): Promise<FileSystemDirectoryHandle>;
  estimate?: () => Promise<{
    usage: number;
    quota: number;
  }>;
}

interface Navigator {
  storage?: StorageManager;
}

export {};
