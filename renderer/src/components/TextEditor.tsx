import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { useEditor, EditorContent } from '@tiptap/react';
import { ListKit } from '@tiptap/extension-list';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';

type Props = {
  value: string;
  onChange: (text: string) => void;
};

// Using official TipTap ListKit to include list-related extensions

export default function TextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, ListKit, Placeholder.configure({ placeholder: 'uwu...' })],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <ScrollArea className="h-full w-full">
      <div className="relative h-full">
        <EditorContent editor={editor} className="note-editor tiptap h-full w-full px-3 py-3 text-neutral-100 outline-none overflow-auto" />
      </div>
    </ScrollArea>
  );
}

// TipTap-based editor with default StarterKit and list extensions


