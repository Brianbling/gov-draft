/** Matches `::: some-text` (opening sugar marker with a non-empty descriptor). */
export const SUGAR_OPEN_PATTERN = /^\s*:::\s+\S/

/** Matches `:::` with optional trailing whitespace (closing sugar marker). */
export const SUGAR_CLOSE_PATTERN = /^\s*:::\s*$/
