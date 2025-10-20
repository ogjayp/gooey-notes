import { contextBridge, ipcRenderer } from 'electron';

function invoke(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('api', {
  notes: {
    list: () => invoke('notes:list'),
    listByFolder: (folderId?: number | null) => invoke('notes:listByFolder', folderId ?? null),
    get: (noteId: number) => invoke('notes:get', noteId),
    create: (title: string) => invoke('notes:create', title),
    createInFolder: (folderId: number, title: string) => invoke('notes:createInFolder', folderId, title),
    update: (noteId: number, updates: { title?: string; content?: string }) => invoke('notes:update', noteId, updates),
    moveToFolder: (noteId: number, folderId: number | null) => invoke('notes:moveToFolder', noteId, folderId),
    delete: (noteId: number) => invoke('notes:delete', noteId),
    search: (query: string) => invoke('notes:search', query),
    searchInFolder: (query: string, folderId?: number | null) => invoke('notes:searchInFolder', query, folderId ?? null),
    onChanged: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('notes:changed', listener);
      return () => ipcRenderer.removeListener('notes:changed', listener);
    },
  },
  folders: {
    list: () => invoke('folders:list'),
    create: (name: string) => invoke('folders:create', name),
    rename: (id: number, name: string) => invoke('folders:rename', id, name),
    delete: (id: number) => invoke('folders:delete', id),
  },
  sticky: {
    open: (noteId: number) => invoke('sticky:open', noteId),
    close: (noteId: number) => invoke('sticky:close', noteId),
    closeSelf: () => invoke('sticky:closeSelf'),
  },
  diagnostics: {
    schema: () => invoke('diagnostics:schema'),
  },
});


