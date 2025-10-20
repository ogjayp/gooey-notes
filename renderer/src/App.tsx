import React, { useEffect, useState } from 'react';
import { ScrollArea } from './components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './components/ui/alert-dialog';
import { Input } from './components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { PlusIcon, SettingsIcon } from 'lucide-react';
import { Switch } from './components/ui/switch';

type NoteListItem = { id: number; title: string; createdAt: string; updatedAt: string };
type Folder = { id: number; name: string; createdAt: string; updatedAt: string };

export default function App() {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [eMode, setEMode] = useState<boolean>(false);

  useEffect(() => { refreshFolders(); refresh(); }, []);
  useEffect(() => {
    const saved = localStorage.getItem('eMode');
    setEMode(saved === 'true');
  }, []);

  useEffect(() => {
    const off = window.api.notes.onChanged(() => {
      // Refresh the list whenever a note changes (create/update/delete)
      refreshFolders();
      refresh(query);
    });
    return () => off();
  }, [query, selectedFolderId]);

  async function refreshFolders() {
    const rows = await window.api.folders?.list?.();
    if (rows) setFolders(rows);
  }

  async function refresh(nextQuery?: string, nextFolderId?: number | null) {
    const qv = (nextQuery ?? query).trim();
    const folderId = nextFolderId === undefined ? selectedFolderId : nextFolderId;
    // Always use folder-aware APIs; pass null to mean "All notes"
    const rows = qv
      ? await window.api.notes.searchInFolder(qv, folderId ?? null)
      : await window.api.notes.listByFolder(folderId ?? null);
    setNotes(rows);
  }

  async function openNote(id: number) {
    await window.api.sticky.open(id);
  }

  async function create() {
    let id: number;
    if (selectedFolderId) {
      id = await window.api.notes.createInFolder(selectedFolderId, 'Untitled');
    } else {
      id = await window.api.notes.create('Untitled');
    }
    await refresh();
    await openNote(id);
  }

  function newFolder() {
    setFolderName('');
    setIsCreateOpen(true);
  }

  async function handleCreateFolderSubmit() {
    const name = folderName.trim();
    if (!name) return;
    await window.api.folders?.create?.(name);
    await refreshFolders();
    setIsCreateOpen(false);
    setFolderName('');
  }

  function renameFolder() {
    if (!selectedFolderId) return;
    const current = folders.find(f => f.id === selectedFolderId)?.name ?? '';
    setFolderName(current);
    setIsRenameOpen(true);
  }

  async function handleRenameFolderSubmit() {
    if (!selectedFolderId) return;
    const name = folderName.trim();
    if (!name) return;
    await window.api.folders?.rename?.(selectedFolderId, name);
    await refreshFolders();
    setIsRenameOpen(false);
  }

  function deleteFolder() {
    if (!selectedFolderId) return;
    setIsDeleteOpen(true);
  }

  async function handleDeleteFolderConfirm() {
    if (!selectedFolderId) return;
    await window.api.folders?.delete?.(selectedFolderId);
    setSelectedFolderId(null);
    await refreshFolders();
    await refresh(undefined, null);
    setIsDeleteOpen(false);
  }

  function handleToggleEMode(next: boolean) {
    setEMode(next);
    try { localStorage.setItem('eMode', String(next)); } catch (_) {}
  }

  return (
    <div className="h-screen bg-neutral-900 text-neutral-200 flex flex-col">
      {/* Top padding only; menubar removed in favor of settings dropdown */}
      <div className="px-2 py-1" />
      <div className="p-4">
        <div className="mx-auto w-full max-w-[900px] flex gap-2">
          {/* Settings dropdown + Folder select */}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800">
                  <SettingsIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => setIsPrefsOpen(true)}>Preferences</DropdownMenuItem>
                <DropdownMenuItem onClick={newFolder}>New folder</DropdownMenuItem>
                <DropdownMenuItem disabled={!selectedFolderId} onClick={renameFolder}>Rename</DropdownMenuItem>
                <DropdownMenuItem disabled={!selectedFolderId} onClick={deleteFolder} className="text-red-500 focus:text-red-500">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Select
              value={selectedFolderId ? String(selectedFolderId) : 'all'}
              onValueChange={(v) => {
                const next = v === 'all' ? null : Number(v);
                setSelectedFolderId(next);
                // Refresh with explicit selected folder to avoid stale state
                refresh(undefined, next);
              }}
            >
              <SelectTrigger className="w-[160px] bg-neutral-800 border-neutral-700 text-sm">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All notes</SelectItem>
                {folders.map(f => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Search"
            value={query}
            onChange={e => { const v = e.target.value; setQuery(v); refresh(v, selectedFolderId); }}
            className="flex-1 bg-neutral-800 border-neutral-700"
          />
          <Button onClick={create} size="icon" variant="secondary" aria-label="New note" className="shrink-0">
            <PlusIcon />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="mx-auto w-full max-w-[900px] rounded-md border border-neutral-800 bg-neutral-900">
            {notes.map(n => (
              <div
                key={n.id}
                onClick={() => openNote(n.id)}
                className={"cursor-pointer border-b border-neutral-800 px-3 py-2 hover:bg-neutral-850"}
              >
                <div className="truncate">{n.title}</div>
                <div className="mt-0.5 text-[11px] text-neutral-400">Updated {new Date(n.updatedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      {/* New Folder Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolderSubmit}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameFolderSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirm */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteFolderConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preferences Dialog */}
      <Dialog open={isPrefsOpen} onOpenChange={setIsPrefsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preferences</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">e-mode</div>
              <div className="text-xs text-neutral-400">only for betas</div>
            </div>
            <Switch checked={eMode} onCheckedChange={handleToggleEMode} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrefsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
