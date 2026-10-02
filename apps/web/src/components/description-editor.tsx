import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { messageOf, responseError } from '@/lib/api'

type Loaded = { description: string; version: number; session: number }

/**
 * WYSIWYG editor for the body text of a task. The text is stored as Markdown.
 *
 * Saving sends the version the text was edited from. If someone else saved in between, the server
 * refuses (409) instead of overwriting their text, and the person chooses whether to load theirs.
 * When someone else saves and there is nothing unsaved here, their text is loaded automatically.
 */
export function DescriptionEditor({
  taskId,
  description,
  version,
}: {
  taskId: string
  /** The latest saved text and its version, as last loaded from the server. */
  description: string
  version: number
}) {
  // What the editor was loaded with. `session` changes only when the editor has to start over
  // with text from the server, so saving your own text does not move the cursor.
  const [loaded, setLoaded] = useState<Loaded>({ description, version, session: 0 })
  const [dirty, setDirty] = useState(false)

  if (version > loaded.version && !dirty) {
    setLoaded({ description, version, session: loaded.session + 1 })
  }

  return (
    <EditorSession
      key={loaded.session}
      taskId={taskId}
      loaded={loaded}
      serverVersion={version}
      onDirtyChange={setDirty}
      onSaved={(saved) => setLoaded((current) => ({ ...current, ...saved }))}
      onAdopt={(latest) => {
        setDirty(false)
        setLoaded((current) => ({ ...latest, session: current.session + 1 }))
      }}
    />
  )
}

function EditorSession({
  taskId,
  loaded,
  serverVersion,
  onDirtyChange,
  onSaved,
  onAdopt,
}: {
  taskId: string
  loaded: Loaded
  serverVersion: number
  onDirtyChange: (dirty: boolean) => void
  onSaved: (saved: { description: string; version: number }) => void
  onAdopt: (latest: { description: string; version: number }) => void
}) {
  // The editor's own Markdown for the text it was loaded with. Comparing against it, rather than
  // against the stored text, keeps small formatting differences from counting as edits.
  const baseline = useRef(loaded.description)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')

  function track(current: string) {
    const changed = current !== baseline.current
    setDirty(changed)
    onDirtyChange(changed)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content: loaded.description,
    contentType: 'markdown',
    // The page is rendered on the server first, where there is no document to attach to.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'tiptap min-h-40 rounded-lg border bg-card px-4 py-3 text-sm outline-none focus:border-ring',
        'aria-label': '本文',
      },
    },
    onCreate: ({ editor: created }) => {
      baseline.current = created.getMarkdown()
    },
    onUpdate: ({ editor: updated }) => track(updated.getMarkdown()),
  })

  const outdated = conflict || serverVersion > loaded.version

  async function save() {
    if (!editor) return
    const text = editor.getMarkdown()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, descriptionVersion: loaded.version }),
      })
      if (response.status === 409) {
        setConflict(true)
        return
      }
      if (!response.ok) throw new Error(await responseError(response))
      const saved = (await response.json()) as { descriptionVersion: number }
      baseline.current = text
      setDirty(false)
      onDirtyChange(false)
      setConflict(false)
      onSaved({ description: text, version: saved.descriptionVersion })
    } catch (cause) {
      setError(messageOf(cause, '本文を保存できませんでした。'))
    } finally {
      setSaving(false)
    }
  }

  async function loadLatest() {
    setError('')
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`)
      if (!response.ok) throw new Error(await responseError(response))
      const latest = (await response.json()) as { description: string; descriptionVersion: number }
      onAdopt({ description: latest.description, version: latest.descriptionVersion })
    } catch (cause) {
      setError(messageOf(cause, '最新の本文を読み込めませんでした。'))
    }
  }

  return (
    <div className="grid gap-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />

      {dirty && outdated && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          <span>他の人が先に本文を変更しました。このままでは保存できません。</span>
          <Button size="sm" variant="outline" type="button" onClick={() => void loadLatest()}>
            最新を読み込む (自分の編集は消えます)
          </Button>
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? '保存中…' : '本文を保存'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {dirty ? '保存していない変更があります' : '保存済み'}
        </span>
      </div>
    </div>
  )
}

const TOOLS: { label: string; active: (e: Editor) => boolean; run: (e: Editor) => void }[] = [
  {
    label: '太字',
    active: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: '斜体',
    active: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: '取り消し線',
    active: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    label: '見出し',
    active: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: '箇条書き',
    active: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: '番号付き',
    active: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'チェックリスト',
    active: (e) => e.isActive('taskList'),
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    label: '引用',
    active: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: 'コード',
    active: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
]

function Toolbar({ editor }: { editor: Editor | null }) {
  // Re-render when the selection moves, so the pressed state stays right.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const refresh = () => setTick((tick) => tick + 1)
    editor.on('selectionUpdate', refresh)
    editor.on('transaction', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('transaction', refresh)
    }
  }, [editor])

  if (!editor) return null
  return (
    <div className="flex flex-wrap gap-1" role="toolbar" aria-label="書式">
      {TOOLS.map((tool) => (
        <Button
          key={tool.label}
          type="button"
          size="sm"
          variant={tool.active(editor) ? 'secondary' : 'ghost'}
          aria-pressed={tool.active(editor)}
          onClick={() => tool.run(editor)}
        >
          {tool.label}
        </Button>
      ))}
    </div>
  )
}
