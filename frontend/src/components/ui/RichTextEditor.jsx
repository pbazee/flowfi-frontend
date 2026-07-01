import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
} from 'lucide-react'
import { useEffect } from 'react'
import clsx from 'clsx'

export default function RichTextEditor({ value, onChange, placeholder = 'Start typing...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary-600 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (like when loading initial data)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
  }, [value, editor])

  if (!editor) return null

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const toggleButton = (isActive, onClick, icon) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={clsx(
        'p-2 rounded hover:bg-gray-100 transition-colors',
        isActive && 'bg-gray-100 text-primary-600'
      )}
    >
      {icon}
    </button>
  )

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50/50 p-2 text-gray-600">
        {toggleButton(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={16} />)}
        {toggleButton(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={16} />)}
        {toggleButton(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 size={16} />)}
        
        <div className="w-px h-6 bg-gray-200 mx-1" />
        
        {toggleButton(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
        {toggleButton(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
        {toggleButton(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={16} />)}
        {toggleButton(editor.isActive('link'), setLink, <LinkIcon size={16} />)}

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {toggleButton(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={16} />)}
        {toggleButton(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />)}
        {toggleButton(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={16} />)}

        <div className="w-px h-6 bg-gray-200 mx-1" />
        
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50">
          <Undo size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50">
          <Redo size={16} />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
      `}} />

      <EditorContent editor={editor} className="bg-white" />
    </div>
  )
}
