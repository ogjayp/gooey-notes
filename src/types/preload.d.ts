export {};

declare global {
  interface Window {
    api: {
      notes: {
        list: () => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string }>>;
        listByFolder: (folderId?: number | null) => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string }>>;
        get: (id: number) => Promise<{ id: number; title: string; content: string; createdAt: string; updatedAt: string } | null>;
        create: (title: string) => Promise<number>;
        createInFolder: (folderId: number, title: string) => Promise<number>;
        update: (id: number, updates: { title?: string; content?: string }) => Promise<{ id: number; title: string; content: string; createdAt: string; updatedAt: string } | null>;
        delete: (id: number) => Promise<boolean>;
        search: (query: string) => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string }>>;
        searchInFolder: (query: string, folderId?: number | null) => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string }>>;
        onChanged: (cb: () => void) => () => void;
      };
      diagnostics: {
        schema: () => Promise<{ hasFoldersTable?: boolean; hasNotesFolderId?: boolean; noteColumns?: string[]; error?: string }>;
      };
      folders: {
        list: () => Promise<Array<{ id: number; name: string; createdAt: string; updatedAt: string }>>;
        create: (name: string) => Promise<number | null>;
        rename: (id: number, name: string) => Promise<boolean>;
        delete: (id: number) => Promise<boolean>;
      };
      sticky: {
        open: (id: number) => Promise<boolean>;
        close: (id: number) => Promise<boolean>;
        closeSelf: () => Promise<boolean>;
      };
    };
  }
}


