import { useEffect, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Box, Divider, IconButton, Stack, Typography } from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'

interface RichTextEditorProps {
  label?: string
  value: string
  onChange: (html: string) => void
  minHeight?: number
}

// Word'e benzer basit bir biçimlendirme araç çubuğu (kalın/italik/altı çizili, liste,
// geri al/ileri al) — teklif e-postasının mesaj gövdesi için. HTML çıktısı doğrudan
// e-posta gövdesi olarak kullanılır.
export function RichTextEditor({ label, value, onChange, minHeight = 160 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) return null

  const toolbarButtons: Array<{
    icon: ReactNode
    active?: boolean
    onClick: () => void
    label: string
  }> = [
    { icon: <FormatBoldIcon fontSize="small" />, active: editor.isActive('bold'), label: 'Kalın', onClick: () => editor.chain().focus().toggleBold().run() },
    { icon: <FormatItalicIcon fontSize="small" />, active: editor.isActive('italic'), label: 'İtalik', onClick: () => editor.chain().focus().toggleItalic().run() },
    { icon: <FormatUnderlinedIcon fontSize="small" />, active: editor.isActive('underline'), label: 'Altı Çizili', onClick: () => editor.chain().focus().toggleUnderline().run() },
  ]

  const listButtons: Array<{ icon: React.ReactNode; active?: boolean; onClick: () => void; label: string }> = [
    { icon: <FormatListBulletedIcon fontSize="small" />, active: editor.isActive('bulletList'), label: 'Madde İşaretli Liste', onClick: () => editor.chain().focus().toggleBulletList().run() },
    { icon: <FormatListNumberedIcon fontSize="small" />, active: editor.isActive('orderedList'), label: 'Numaralı Liste', onClick: () => editor.chain().focus().toggleOrderedList().run() },
  ]

  return (
    <Box>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ p: 0.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', alignItems: 'center' }}
        >
          {toolbarButtons.map((btn) => (
            <IconButton key={btn.label} size="small" onClick={btn.onClick} color={btn.active ? 'primary' : 'default'} title={btn.label}>
              {btn.icon}
            </IconButton>
          ))}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          {listButtons.map((btn) => (
            <IconButton key={btn.label} size="small" onClick={btn.onClick} color={btn.active ? 'primary' : 'default'} title={btn.label}>
              {btn.icon}
            </IconButton>
          ))}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <IconButton size="small" onClick={() => editor.chain().focus().undo().run()} title="Geri Al">
            <UndoIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => editor.chain().focus().redo().run()} title="İleri Al">
            <RedoIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box
          onClick={() => editor.chain().focus().run()}
          sx={{
            px: 1.5,
            py: 1,
            minHeight,
            cursor: 'text',
            '& .ProseMirror': { outline: 'none' },
            '& .ProseMirror p': { m: 0, mb: 0.75 },
            '& .ProseMirror ul, & .ProseMirror ol': { m: 0, mb: 0.75, pl: 3 },
          }}
        >
          <EditorContent editor={editor} />
        </Box>
      </Box>
    </Box>
  )
}
