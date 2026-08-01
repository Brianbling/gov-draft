import { createContext, useContext } from "react"

/**
 * Form model access for the recursive SchemaFormField tree. The provider holds
 * the working rule copy; fields read/write by dot path via these callbacks.
 */
export interface SchemaFormContextValue {
  getValue: (path: string) => unknown
  setValue: (path: string, value: unknown) => void
  /**
   * The pristine value at `path` from the builtin rule this one is based on, or
   * `undefined` when there is no baseline (rule authored from scratch, or the
   * path does not exist in the baseline). Drives the per-field reset control.
   */
  getBaseline: (path: string) => unknown
}

export const SchemaFormContext = createContext<SchemaFormContextValue | null>(
  null
)

export function useSchemaForm(): SchemaFormContextValue {
  const ctx = useContext(SchemaFormContext)
  if (!ctx) {
    throw new Error("useSchemaForm must be used within a SchemaFormContext")
  }
  return ctx
}
