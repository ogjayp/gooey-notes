import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow, ipcMain, Menu, nativeImage } from 'electron';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './db/schema';
import { and, desc, eq, like, or } from 'drizzle-orm';

function getDbPath(): string {
  const fileName = 'notes.db';
  return path.join(app.getPath('userData'), fileName);
}

function createDb() {
  const sqlite = new Database(getDbPath());
  try { sqlite.pragma('foreign_keys = ON'); } catch (_) {}
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

async function runMigrations(db: ReturnType<typeof drizzle>, sqlite: Database.Database) {
  const migrationsFolder = path.join(__dirname, '..', 'drizzle', 'migrations');
  await migrate(db, { migrationsFolder });
  try {
    // Safety net to ensure new structures exist even if meta journal wasn't updated
    sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    // Ensure notes.folder_id exists; some SQLite builds don't support IF NOT EXISTS on ADD COLUMN
    const cols = sqlite.prepare('PRAGMA table_info(notes);').all() as Array<{ name: string }>;
    const hasFolderId = Array.isArray(cols) && cols.some(c => String(c.name).toLowerCase() === 'folder_id');
    if (!hasFolderId) {
      sqlite.exec(`ALTER TABLE notes ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;`);
    }
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);`);
  } catch (_) { /* ignore safety migration errors */ }
}

function getAppIconPath(): string | undefined {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    candidates.push(path.join(base, 'assets', 'icon.ico'));
    // Fallbacks
    candidates.push(path.join(base, 'assets', 'favicon.ico'));
    candidates.push(path.join(base, 'assets', 'favicon-16x16.png'));
    candidates.push(path.join(base, 'assets', 'icon-512.png'));
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(base, 'assets', 'AppIcon.icns'));
    // Fallbacks
    candidates.push(path.join(base, 'assets', 'icon.icns'));
    candidates.push(path.join(base, 'assets', 'icon-512.png'));
  } else {
    // Linux and others
    candidates.push(path.join(base, 'assets', 'icon.png'));
    candidates.push(path.join(base, 'assets', 'icon-512.png'));
    candidates.push(path.join(base, 'assets', 'favicon-16x16.png'));
    candidates.push(path.join(base, 'assets', 'favicon.ico'));
  }
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return undefined;
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 560,
    height: 520,
    minWidth: 480,
    minHeight: 420,
    useContentSize: true,
    center: true,
    show: true,
    backgroundColor: '#1e1e1e',
    title: 'Gooey Notes',
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show native app menu and add a simple DevTools toggle
  try {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          {
            label: 'Toggle Developer Tools',
            accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
            click: () => {
              const focused = BrowserWindow.getFocusedWindow();
              if (focused) {
                if (focused.webContents.isDevToolsOpened()) focused.webContents.closeDevTools();
                else focused.webContents.openDevTools({ mode: 'detach' });
              }
            }
          }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    mainWindow.setMenuBarVisibility(true);
  } catch (_) {}

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

// --- Window state persistence for sticky note windows ---
type NoteWindowState = { x: number; y: number; width: number; height: number; isOpen?: boolean };
type WindowStateFile = Record<string, NoteWindowState>;

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowStateFile {
  try {
    const p = getWindowStatePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (_) {}
  return {};
}

function saveWindowStateFile(state: WindowStateFile) {
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2), 'utf-8');
  } catch (_) {}
}

const noteIdToWindow = new Map<number, BrowserWindow>();
let windowStateCache: WindowStateFile = {};

function getSavedBounds(noteId: number): Electron.BrowserWindowConstructorOptions {
  const s = windowStateCache[String(noteId)];
  const defaults = { width: 420, height: 360 };
  if (!s) return defaults;
  return { x: s.x, y: s.y, width: s.width, height: s.height };
}

function broadcastNotesChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send('notes:changed'); } catch (_) {}
  }
}

function bumpZToFront(win: BrowserWindow) {
  const anyWin: any = win as any;
  if (typeof anyWin.moveTop === 'function') {
    try { anyWin.moveTop(); return; } catch (_) {}
  }
  // Fallback: toggle alwaysOnTop to raise z-order without keeping it pinned
  try {
    win.setAlwaysOnTop(true);
    setTimeout(() => { try { win.setAlwaysOnTop(false); } catch (_) {} }, 0);
  } catch (_) {}
}

function createNoteWindow(db: ReturnType<typeof drizzle>, noteId: number) {
  const existing = noteIdToWindow.get(noteId);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    bumpZToFront(existing);
    return existing;
  }

  const bounds = getSavedBounds(noteId);
  const win = new BrowserWindow({
    width: bounds.width ?? 420,
    height: bounds.height ?? 360,
    minWidth: 360,
    minHeight: 300,
    x: bounds.x,
    y: bounds.y,
    backgroundColor: '#202020',
    title: 'Sticky Note',
    show: true,
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const urlSearch = `?noteId=${encodeURIComponent(String(noteId))}`;
  if (process.env.NODE_ENV === 'development') {
    win.loadURL(`http://localhost:5173/${urlSearch}`);
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { search: urlSearch });
  }

  noteIdToWindow.set(noteId, win);

  const persistBounds = () => {
    const b = win.getBounds();
    windowStateCache[String(noteId)] = { x: b.x, y: b.y, width: b.width, height: b.height, isOpen: true };
    saveWindowStateFile(windowStateCache);
  };

  win.on('move', persistBounds);
  win.on('resize', persistBounds);
  win.on('focus', () => {
    bumpZToFront(win);
  });
  win.on('closed', () => {
    const prev = windowStateCache[String(noteId)];
    if (prev) {
      prev.isOpen = false;
      windowStateCache[String(noteId)] = prev;
      saveWindowStateFile(windowStateCache);
    }
    noteIdToWindow.delete(noteId);
  });

  // Initial persist after first show
  win.once('ready-to-show', () => {
    persistBounds();
  });

  return win;
}

async function registerIpcHandlers(db: ReturnType<typeof drizzle>, sqlite?: Database.Database) {
  const { notes, folders } = schema;

  ipcMain.handle('notes:list', async () => {
    const rows = db
      .select({ id: notes.id, title: notes.title, createdAt: notes.createdAt, updatedAt: notes.updatedAt })
      .from(notes)
      .orderBy(desc(notes.updatedAt))
      .all();
    return rows;
  });

  ipcMain.handle('notes:get', async (_event, noteId: number) => {
    const row = db.select().from(notes).where(eq(notes.id, noteId)).get();
    return row ?? null;
  });

  ipcMain.handle('notes:create', async (_event, title: string) => {
    const now = new Date().toISOString();
    const result = db
      .insert(notes)
      .values({ title: title?.trim() || 'Untitled', content: '', createdAt: now, updatedAt: now })
      .returning({ id: notes.id })
      .all();
    const id = result[0]?.id;
    broadcastNotesChanged();
    return id;
  });

  ipcMain.handle('notes:createInFolder', async (_event, folderId: number, title: string) => {
    const now = new Date().toISOString();
    const result = db
      .insert(notes)
      .values({ title: title?.trim() || 'Untitled', content: '', createdAt: now, updatedAt: now, folderId })
      .returning({ id: notes.id })
      .all();
    const id = result[0]?.id;
    broadcastNotesChanged();
    return id;
  });

  ipcMain.handle('notes:update', async (_event, noteId: number, updates: { title?: string; content?: string }) => {
    const nextTitle = typeof updates?.title === 'string' && updates.title.trim().length > 0 ? updates.title.trim() : undefined;
    const nextContent = typeof updates?.content === 'string' ? updates.content : undefined;
    const setter: Partial<typeof notes.$inferInsert> = {};
    if (nextTitle !== undefined) setter.title = nextTitle;
    if (nextContent !== undefined) setter.content = nextContent;
    setter.updatedAt = new Date().toISOString();
    if (Object.keys(setter).length === 1) return null; // only updatedAt

    db.update(notes).set(setter).where(eq(notes.id, noteId)).run();
    const row = db.select().from(notes).where(eq(notes.id, noteId)).get();
    if (row) broadcastNotesChanged();
    return row ?? null;
  });

  ipcMain.handle('notes:delete', async (_event, noteId: number) => {
    const result = db.delete(notes).where(eq(notes.id, noteId)).run();
    const ok = (result.changes ?? 0) > 0;
    if (ok) broadcastNotesChanged();
    return ok;
  });

  ipcMain.handle('notes:search', async (_event, query: string) => {
    const q = (query || '').toLowerCase();
    if (!q) return db.select({ id: notes.id, title: notes.title, createdAt: notes.createdAt, updatedAt: notes.updatedAt }).from(notes).orderBy(desc(notes.updatedAt)).all();
    const rows = db
      .select()
      .from(notes)
      .where(or(like(notes.title, `%${q}%`), like(notes.content, `%${q}%`)))
      .orderBy(desc(notes.updatedAt))
      .all();
    return rows.map(n => ({ id: n.id, title: n.title, createdAt: n.createdAt, updatedAt: n.updatedAt }));
  });

  // --- Folders ---
  ipcMain.handle('folders:list', async () => {
    const rows = db.select().from(folders).orderBy(desc(folders.updatedAt)).all();
    return rows;
  });

  ipcMain.handle('folders:create', async (_event, name: string) => {
    const now = new Date().toISOString();
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return null;
    const result = db.insert(folders).values({ name: trimmed, createdAt: now, updatedAt: now }).returning({ id: folders.id }).all();
    const id = result[0]?.id ?? null;
    broadcastNotesChanged();
    return id;
  });

  ipcMain.handle('folders:rename', async (_event, id: number, name: string) => {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return false;
    const now = new Date().toISOString();
    db.update(folders).set({ name: trimmed, updatedAt: now }).where(eq(folders.id, id)).run();
    broadcastNotesChanged();
    return true;
  });

  ipcMain.handle('folders:delete', async (_event, id: number) => {
    // Clear associations for robustness (in case FKs are disabled in some env)
    db.update(notes).set({ folderId: null }).where(eq(notes.folderId, id)).run();
    const result = db.delete(folders).where(eq(folders.id, id)).run();
    const ok = (result.changes ?? 0) > 0;
    if (ok) broadcastNotesChanged();
    return ok;
  });

  // Notes: folder-aware listing/search
  ipcMain.handle('notes:listByFolder', async (_event, folderId?: number | null) => {
    const sel = db.select({ id: notes.id, title: notes.title, createdAt: notes.createdAt, updatedAt: notes.updatedAt }).from(notes);
    const rows = folderId
      ? sel.where(eq(notes.folderId, folderId)).orderBy(desc(notes.updatedAt)).all()
      : sel.orderBy(desc(notes.updatedAt)).all();
    return rows;
  });

  ipcMain.handle('notes:searchInFolder', async (_event, query: string, folderId?: number | null) => {
    const q = (query || '').toLowerCase();
    if (!q && !folderId) {
      return db.select({ id: notes.id, title: notes.title, createdAt: notes.createdAt, updatedAt: notes.updatedAt }).from(notes).orderBy(desc(notes.updatedAt)).all();
    }
    const whereLike = or(like(notes.title, `%${q}%`), like(notes.content, `%${q}%`));
    const rows = folderId
      ? db.select().from(notes).where(and(eq(notes.folderId, folderId), whereLike)).orderBy(desc(notes.updatedAt)).all()
      : db.select().from(notes).where(whereLike).orderBy(desc(notes.updatedAt)).all();
    return rows.map(n => ({ id: n.id, title: n.title, createdAt: n.createdAt, updatedAt: n.updatedAt }));
  });

  // Sticky windows API
  ipcMain.handle('sticky:open', async (_event, noteId: number) => {
    createNoteWindow(db, noteId);
    return true;
  });
  ipcMain.handle('sticky:close', async (_event, noteId: number) => {
    const win = noteIdToWindow.get(noteId);
    if (win && !win.isDestroyed()) {
      win.close();
      return true;
    }
    return false;
  });
  ipcMain.handle('sticky:closeSelf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
      return true;
    }
    return false;
  });

  // Diagnostics: report whether folders table and notes.folder_id exist
  ipcMain.handle('diagnostics:schema', async () => {
    try {
      const hasFoldersTable = !!sqlite?.prepare('SELECT name FROM sqlite_master WHERE type = ? AND name = ?').get('table', 'folders');
      const cols = (sqlite?.prepare('PRAGMA table_info(notes);').all() as Array<{ name: string }>) ?? [];
      const hasNotesFolderId = cols.some(c => String(c.name).toLowerCase() === 'folder_id');
      return { hasFoldersTable, hasNotesFolderId, noteColumns: cols.map(c => c.name) };
    } catch (e) {
      return { error: String(e) };
    }
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron.notes');
  }
  if (process.platform === 'darwin') {
    const iconPath = getAppIconPath();
    if (iconPath) {
      try { app.dock?.setIcon(nativeImage.createFromPath(iconPath)); } catch (_) {}
    }
  }
  windowStateCache = loadWindowState();
  const { db, sqlite } = createDb();
  await runMigrations(db, sqlite);
  await registerIpcHandlers(db, sqlite);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


