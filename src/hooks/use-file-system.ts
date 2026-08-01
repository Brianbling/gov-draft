import { useCallback } from 'react'
import { useDocStore } from '@/stores/doc-store'
import { useRuleStore } from '@/stores/rule-store'

export function useFileSystem() {
  const setContent = useDocStore((s) => s.setContent)
  const content = useDocStore((s) => s.content)
  const title = useDocStore((s) => s.title)
  const html = useDocStore((s) => s.html)
  const getRuleCssText = useRuleStore((s) => s.getRuleCssText)

  const importFile = useCallback(
    async (file: File): Promise<string> => {
      if (!file.name.endsWith('.md') && !file.type.includes('markdown')) {
        throw new Error(`Unsupported format: ${file.name}`)
      }
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result
          if (typeof text === 'string') resolve(text)
          else reject(new Error('Failed to read file as text'))
        }
        reader.onerror = () => reject(new Error('File read error'))
        reader.readAsText(file, 'UTF-8')
      })
      setContent(content)
      return content
    },
    [setContent],
  )

  const exportMarkdown = useCallback(
    (filename = 'document.md') => {
      const finalName = filename.endsWith('.md') ? filename : `${filename}.md`
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      downloadBlob(blob, finalName)
    },
    [content],
  )

  const exportHtml = useCallback(
    (filename = 'document.html') => {
      const finalName = filename.endsWith('.html') ? filename : `${filename}.html`
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title || 'Document'}</title>
  <style>
${getRuleCssText()}
  </style>
</head>
<body>
  <article class="export-document">
${html}
  </article>
</body>
</html>`
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
      downloadBlob(blob, finalName)
    },
    [html, title, getRuleCssText],
  )

  const setupDropZone = useCallback(
    (
      dropZone: HTMLElement,
      onSuccess?: (content: string) => void,
      onError?: (error: Error) => void,
    ): (() => void) => {
      const handleDragOver = (e: DragEvent) => { e.preventDefault(); dropZone.classList.add('drag-over') }
      const handleDragLeave = () => { dropZone.classList.remove('drag-over') }
      const handleDrop = async (e: DragEvent) => {
        e.preventDefault()
        dropZone.classList.remove('drag-over')
        const file = e.dataTransfer?.files?.[0]
        if (!file) return
        try {
          const content = await importFile(file)
          onSuccess?.(content)
        } catch (err) {
          onError?.(err as Error)
        }
      }
      dropZone.addEventListener('dragover', handleDragOver)
      dropZone.addEventListener('dragleave', handleDragLeave)
      dropZone.addEventListener('drop', handleDrop)
      return () => {
        dropZone.removeEventListener('dragover', handleDragOver)
        dropZone.removeEventListener('dragleave', handleDragLeave)
        dropZone.removeEventListener('drop', handleDrop)
      }
    },
    [importFile],
  )

  return { importFile, exportMarkdown, exportHtml, setupDropZone }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
