import type { z } from "zod"
import {
  CssColorSchema,
  CssLengthSchema,
  CssLineHeightSchema,
  CssParagraphSpacingSchema,
  FontWeightValueSchema,
} from "./primitives"

export type SchemaFieldType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "cssLength"
  | "cssColor"
  | "fontWeight"
  | "object"
  | "array"
  | "record"
  | "unknown"

export interface SchemaFieldDescriptor {
  path: string
  fieldType: SchemaFieldType
  required: boolean
  defaultValue?: unknown
  enumValues?: string[]
  children?: SchemaFieldDescriptor[]
  hasCatchall?: boolean
  catchallDescriptor?: SchemaFieldDescriptor
}

/**
 * ZOD INTERNAL API — isolated access point for Zod's internal type descriptor.
 *
 * WARNING: This uses `_zod.def` which is NOT part of Zod's public API.
 * It works in zod 4.3.6. If a Zod upgrade breaks this, see the
 * version-pin test in schema-traversal.test.ts for the expected failure.
 *
 * A public-API alternative does not currently exist: `z.toJSONSchema()`
 * loses schema identity (e.g. CssLengthSchema vs. CssColorSchema),
 * which breaks the KNOWN_LEAF_SCHEMAS identity-based type resolution.
 */
type ZodDef = { type: string; [k: string]: unknown }
type ZodInternal = { _zod: { def: ZodDef; values?: Iterable<unknown> } }

function getDef(schema: z.ZodTypeAny): ZodDef {
  const internal = schema as unknown as ZodInternal
  const def = internal._zod?.def
  if (!def) {
    throw new Error(
      `Zod internal API (_zod.def) is no longer available. ` +
        `The schema-traversal module must be updated for the current zod version. ` +
        `See schema-traversal.test.ts for the version-pin test.`
    )
  }
  return def
}

const KNOWN_LEAF_SCHEMAS = new Map<z.ZodTypeAny, SchemaFieldType>([
  [CssLengthSchema, "cssLength"],
  [CssLineHeightSchema, "cssLength"],
  [CssParagraphSpacingSchema, "cssLength"],
  [CssColorSchema, "cssColor"],
  [FontWeightValueSchema, "fontWeight"],
])

function resolveLeafType(schema: z.ZodTypeAny): SchemaFieldType | null {
  return KNOWN_LEAF_SCHEMAS.get(schema) ?? null
}

function unwrapSchema(schema: z.ZodTypeAny): {
  inner: z.ZodTypeAny
  required: boolean
  defaultValue?: unknown
} {
  const def = getDef(schema)

  if (def.type === "optional") {
    const inner = unwrapSchema(def.innerType as z.ZodTypeAny)
    return { ...inner, required: false }
  }

  if (def.type === "default") {
    const inner = unwrapSchema(def.innerType as z.ZodTypeAny)
    return { ...inner, required: false, defaultValue: def.defaultValue }
  }

  if (def.type === "nullable") {
    const inner = unwrapSchema(def.innerType as z.ZodTypeAny)
    return { ...inner, required: false }
  }

  return { inner: schema, required: true }
}

function extractEnumValues(schema: z.ZodTypeAny): string[] {
  const internal = schema as unknown as ZodInternal
  if (internal._zod.values) {
    return [...internal._zod.values] as string[]
  }
  return []
}

function traverseField(
  schema: z.ZodTypeAny,
  path: string
): SchemaFieldDescriptor {
  const knownType = resolveLeafType(schema)
  if (knownType) {
    return { path, fieldType: knownType, required: true }
  }

  const { inner, required, defaultValue } = unwrapSchema(schema)

  const knownInnerType = resolveLeafType(inner)
  if (knownInnerType) {
    return { path, fieldType: knownInnerType, required, defaultValue }
  }

  const def = getDef(inner)

  if (def.type === "object") {
    const shape = def.shape as Record<string, z.ZodTypeAny>
    const children = Object.entries(shape).map(([key, childSchema]) =>
      traverseField(childSchema, path ? `${path}.${key}` : key)
    )
    const hasCatchall = !!def.catchall
    let catchallDescriptor: SchemaFieldDescriptor | undefined
    if (def.catchall) {
      catchallDescriptor = traverseField(def.catchall as z.ZodTypeAny, "")
    }
    return {
      path,
      fieldType: "object",
      required,
      defaultValue,
      children,
      hasCatchall,
      catchallDescriptor,
    }
  }

  if (def.type === "enum") {
    return {
      path,
      fieldType: "enum",
      required,
      defaultValue,
      enumValues: extractEnumValues(inner),
    }
  }

  if (def.type === "union") {
    const options = def.options as z.ZodTypeAny[]
    const allLiterals = options.every((opt) => getDef(opt).type === "literal")
    if (allLiterals) {
      const values = options.map((opt) => {
        const litDef = getDef(opt)
        return String((litDef.values as unknown[])[0])
      })
      const allNumeric = values.every((v) => /^\d+$/.test(v))
      if (allNumeric) {
        return {
          path,
          fieldType: "fontWeight",
          required,
          defaultValue,
          enumValues: values,
        }
      }
      return {
        path,
        fieldType: "enum",
        required,
        defaultValue,
        enumValues: values,
      }
    }
    return { path, fieldType: "string", required, defaultValue }
  }

  if (def.type === "boolean") {
    return { path, fieldType: "boolean", required, defaultValue }
  }

  if (def.type === "string") {
    return { path, fieldType: "string", required, defaultValue }
  }

  if (def.type === "number") {
    return { path, fieldType: "number", required, defaultValue }
  }

  if (def.type === "array") {
    return { path, fieldType: "array", required, defaultValue }
  }

  if (def.type === "record") {
    return { path, fieldType: "record", required, defaultValue }
  }

  if (def.type === "literal") {
    return { path, fieldType: "string", required, defaultValue }
  }

  return { path, fieldType: "unknown", required, defaultValue }
}

export function traverseSchema(
  schema: z.ZodTypeAny,
  basePath = ""
): SchemaFieldDescriptor[] {
  const root = traverseField(schema, basePath)
  return root.children ?? [root]
}

export function traverseSchemaAsRoot(
  schema: z.ZodTypeAny,
  basePath = ""
): SchemaFieldDescriptor {
  return traverseField(schema, basePath)
}
