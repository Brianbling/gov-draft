import * as React from "react"
import { createRoot, type Root } from "react-dom/client"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error"

interface ToastItem {
  id: number
  variant: ToastVariant
  message: string
}

const TOAST_DURATION = 2500
const MAX_TOASTS = 3

/**
 * Module-level toast store, independent from the React tree so hooks
 * (`use-pdf-export`, `use-file-system`) can call it without a mounted provider.
 * The viewport mounts itself lazily on first use.
 */
let items: ToastItem[] = []
let nextId = 0
let root: Root | null = null
let container: HTMLDivElement | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ToastItem[] {
  return items
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id)
  emit()
}

function pushToast(variant: ToastVariant, message: string) {
  ensureViewport()
  nextId += 1
  const id = nextId
  items = [...items, { id, variant, message }].slice(-MAX_TOASTS)
  emit()
  window.setTimeout(() => dismiss(id), TOAST_DURATION)
}

function ensureViewport() {
  if (root && container && container.isConnected) return
  container = document.createElement("div")
  container.dataset.slot = "toast-root"
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(<ToastViewport />)
}

function ToastViewport() {
  const toasts = React.useSyncExternalStore(subscribe, getSnapshot)
  return (
    <div
      data-slot="toast-viewport"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2"
    >
      {toasts.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  )
}

function Toast({ item }: { item: ToastItem }) {
  const isSuccess = item.variant === "success"

  return (
    <div
      role="status"
      data-slot="toast"
      data-variant={item.variant}
      className={cn(
        "pointer-events-auto flex max-w-[80vw] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg",
        isSuccess
          ? "border-success/40 bg-card text-success-foreground"
          : "border-destructive/40 bg-card text-destructive"
      )}
    >
      <HugeiconsIcon
        icon={isSuccess ? CheckmarkCircle01Icon : AlertCircleIcon}
        strokeWidth={2}
        className="size-4 shrink-0"
      />
      <span className="min-w-0">{item.message}</span>
    </div>
  )
}

const toast = {
  success: (message: string) => pushToast("success", message),
  error: (message: string) => pushToast("error", message),
}

function useToast() {
  return toast
}

export { toast, useToast }
