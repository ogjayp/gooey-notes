import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

type MoreMenuProps = {
  onDelete?: () => void;
  onClose?: () => void;
  noteId?: number;
  currentFolderId?: number | null;
  onMoved?: (folderId: number | null) => void;
};

export default function MoreMenu({ onDelete, onClose, noteId, currentFolderId = null, onMoved }: MoreMenuProps) {
  const [folders, setFolders] = React.useState<Array<{ id: number; name: string }>>([]);

  const loadFolders = React.useCallback(async () => {
    try {
      const rows = await window.api.folders?.list?.();
      setFolders(rows ?? []);
    } catch (_) {}
  }, []);

  React.useEffect(() => {
    // Fetch on mount and subscribe to changes (folders operations broadcast notes:changed)
    loadFolders();
    const off = window.api.notes.onChanged(() => { loadFolders(); });
    return () => { try { off?.(); } catch (_) {} };
  }, [loadFolders]);

  async function moveTo(folderId: number | null) {
    if (!noteId && noteId !== 0) return;
    try {
      const updated = await window.api.notes.moveToFolder(noteId, folderId);
      if (updated && onMoved) onMoved(folderId);
    } catch (_) {}
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 p-0 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800">{"⋯"}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onClose ? (
          <DropdownMenuItem onClick={onClose}>
            Close
          </DropdownMenuItem>
        ) : null}

        {noteId !== undefined ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              <DropdownMenuCheckboxItem checked={currentFolderId == null} onClick={() => moveTo(null)}>
                All notes
              </DropdownMenuCheckboxItem>
              {folders.length ? <DropdownMenuSeparator /> : null}
              {folders.map(f => (
                <DropdownMenuCheckboxItem
                  key={f.id}
                  checked={currentFolderId === f.id}
                  onClick={() => moveTo(f.id)}
                >
                  {f.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        {onDelete ? (
          <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500">
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


