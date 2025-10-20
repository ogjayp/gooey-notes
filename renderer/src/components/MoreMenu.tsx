import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';

export default function MoreMenu({ onDelete, onClose }: { onDelete?: () => void; onClose?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 p-0 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800">{"⋯"}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onClose ? (
          <DropdownMenuItem onClick={onClose}>
            Close
          </DropdownMenuItem>
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


