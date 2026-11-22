import type { DotvarErrorCode, EnvIssue } from '@types';

/**
 * Base class of every error dotvar throws. Messages never contain variable values,
 * so they are safe to log and to report to error trackers.
 */
export class DotvarError extends Error {
  readonly code: DotvarErrorCode;

  constructor(code: DotvarErrorCode, message: string) {
    super(message);
    this.name = 'DotvarError';
    this.code = code;
  }
}

/** The `.env` source is malformed. `line` is 1-based; the line's content is never included. */
export class EnvParseError extends DotvarError {
  readonly line: number;
  /** Absolute path of the file, when the source came from the Node loader. */
  readonly file: string | undefined;
  /** The message without the location suffix. */
  readonly reason: string;

  constructor(
    reason: string,
    line: number,
    options: { readonly code?: DotvarErrorCode; readonly file?: string } = {},
  ) {
    const location =
      options.file === undefined ? `line ${line}` : `${options.file}:${line}`;
    super(options.code ?? 'ERR_DOTVAR_PARSE', `${reason} (${location})`);
    this.name = 'EnvParseError';
    this.line = line;
    this.file = options.file;
    this.reason = reason;
  }
}

/** Every variable that failed validation, collected in one error. */
export class EnvValidationError extends DotvarError {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[], hint?: string) {
    const lines = issues.map((issue) => `  - ${issue.key}: ${issue.message}`);
    super(
      'ERR_DOTVAR_VALIDATION',
      ['Invalid environment variables:', ...lines, ...(hint ? [hint] : [])].join('\n'),
    );
    this.name = 'EnvValidationError';
    this.issues = Object.freeze([...issues]);
  }
}
