export {};

declare global {
  interface Window {
    api: {
      notes: {
        list: () => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string; folderId?: number | null }>>;
        listByFolder: (
          folderId?: number | null
        ) => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string; folderId?: number | null }>>;
        get: (id: number) => Promise<{ id: number; title: string; content: string; createdAt: string; updatedAt: string; folderId?: number | null } | null>;
        create: (title: string) => Promise<number>;
        createInFolder: (folderId: number, title: string) => Promise<number>;
        update: (
          id: number,
          updates: { title?: string; content?: string }
        ) => Promise<{ id: number; title: string; content: string; createdAt: string; updatedAt: string } | null>;
        moveToFolder: (
          id: number,
          folderId: number | null
        ) => Promise<{ id: number; title: string; content: string; createdAt: string; updatedAt: string; folderId?: number | null } | null>;
        delete: (id: number) => Promise<boolean>;
        search: (query: string) => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string; folderId?: number | null }>>;
        searchInFolder: (
          query: string,
          folderId?: number | null
        ) => Promise<Array<{ id: number; title: string; createdAt: string; updatedAt: string; folderId?: number | null }>>;
        onChanged: (cb: () => void) => () => void;
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


