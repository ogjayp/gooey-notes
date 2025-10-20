import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const TextEditor = React.lazy(() => import('@/components/TextEditor'));
const MoreMenu = React.lazy(() => import('@/components/MoreMenu'));

function StickyNoteWindow() {
  const search = new URLSearchParams(window.location.search);
  const noteId = Number(search.get('noteId'));
  const [note, setNote] = React.useState<{ id: number; title: string; content: string; updatedAt: string; folderId?: number | null } | null>(null);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    if (!Number.isFinite(noteId)) return;
    (async () => {
      const n = await window.api.notes.get(noteId);
      if (n) {
        setNote(n);
        setTitle(n.title);
        setContent(n.content);
        setStatus(`Updated ${new Date(n.updatedAt).toLocaleString()}`);
      }
    })();
  }, [noteId]);

  React.useEffect(() => {
    if (!note) return;
    const t = setTimeout(async () => {
      setStatus('Saving…');
      const updated = await window.api.notes.update(note.id, { title, content });
      if (updated) setStatus(`Updated ${new Date(updated.updatedAt).toLocaleString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [title, content, note?.id]);

  if (!note) return <div className="p-3 text-neutral-400">Loading…</div>;
  const eMode = typeof window !== 'undefined' && localStorage.getItem('eMode') === 'true';
  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] bg-neutral-900 text-neutral-200">
      <div className="flex items-center gap-2 p-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2 text-base outline-none placeholder-neutral-500 focus:outline-none focus:ring-0 border-0"
        />
        <React.Suspense fallback={null}>
          <MoreMenu
            noteId={note.id}
            currentFolderId={note.folderId ?? null}
            onMoved={(folderId) => {
              setNote(n => n ? { ...n, folderId } : n);
            }}
            onClose={() => window.api.sticky.closeSelf()}
            onDelete={async () => {
              if (!note) return;
              const ok = window.confirm('Delete this note? This cannot be undone.');
              if (!ok) return;
              await window.api.notes.delete(note.id);
              await window.api.sticky.closeSelf();
            }}
          />
        </React.Suspense>
      </div>
      <div
        className="relative min-h-0 h-full w-full"
        style={eMode ? {
          backgroundImage: "url('./eboy-waifu.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : undefined}
      >
        {eMode ? (
          <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} />
        ) : null}
        <React.Suspense fallback={<div className="px-3 py-3 text-neutral-500">Loading editor…</div>}>
          <TextEditor value={content} onChange={setContent} />
        </React.Suspense>
      </div>
      <div className="border-t border-neutral-800 px-3 py-2 text-xs text-neutral-400">{status}</div>
    </div>
  );
}

const isSticky = new URLSearchParams(window.location.search).has('noteId');
createRoot(document.getElementById('root')!).render(isSticky ? <StickyNoteWindow /> : <App />);
