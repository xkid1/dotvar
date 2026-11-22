/**
 * Stable, machine-readable error codes. Changing or removing one is a breaking change.
 */
export type DotvarErrorCode =
  /** The `.env` source is malformed (bad key, unterminated quote, …). */
  | 'ERR_DOTVAR_PARSE'
  /** The `.env` source exceeds a configured size limit. */
  | 'ERR_DOTVAR_LIMIT'
  /** One or more variables failed schema validation. */
  | 'ERR_DOTVAR_VALIDATION'
  /** A secret variable was read in a client (browser / React Native) runtime. */
  | 'ERR_DOTVAR_SECRET_ON_CLIENT'
  /** A `.env` file could not be read safely. */
  | 'ERR_DOTVAR_FILE'
  /** An option passed to a dotvar function is invalid. */
  | 'ERR_DOTVAR_OPTION';

/** One failed variable in an `EnvValidationError`. Never contains the value. */
export interface EnvIssue {
  /** The variable name as read from the source (prefix included). */
  readonly key: string;
  /** Human-readable reason, safe to log: it never includes the variable's value. */
  readonly message: string;
}
