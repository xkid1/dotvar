import { createDict, getOwn, isForbiddenKey, isValidKey, MAX_KEY_LENGTH } from '@utils';

import { DotvarError, EnvParseError } from '../errors';
import { parseReference, resolveReference } from '../expand';

import type { ParsedEnv, ParseOptions, ReferenceLookup } from '@types';

/** Default `maxLength`: 1 MiB of text is far beyond any real `.env` file. */
export const DEFAULT_MAX_LENGTH = 1_048_576;

/** Expanded output may grow to at most this multiple of `maxLength`. */
const EXPANSION_FACTOR = 4;

const LF = 10;
const TAB = 9;
const SPACE = 32;
const HASH = 35;
const DOLLAR = 36;
const BACKSLASH = 92;
const OPEN_BRACE = 123;
const DOUBLE_QUOTE = 34;
const SINGLE_QUOTE = 39;
const BACKTICK = 96;
const EQUALS = 61;

const DOUBLE_QUOTE_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  'n': '\n',
  'r': '\r',
  't': '\t',
  '"': '"',
  '\\': '\\',
  '$': '$',
});

const isInlineSpace = (code: number): boolean => code === SPACE || code === TAB;

const isKeyChar = (code: number): boolean =>
  (code >= 48 && code <= 57) || // 0-9
  (code >= 65 && code <= 90) || // A-Z
  (code >= 97 && code <= 122) || // a-z
  code === 95 || // _
  code === 46 || // .
  code === 45; // -

/** Options for the internal scanner; `parse()` and the file loader fill them in. */
export interface ScanOptions {
  readonly expand: boolean;
  readonly lookup: ReferenceLookup;
  readonly maxLength: number;
}

/** Validates a size option: a positive safe integer. */
export const assertLimit = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DotvarError('ERR_DOTVAR_OPTION', `"${name}" must be a positive integer`);
  }
};

/**
 * Single-pass, linear-time scanner. It never evaluates anything: `${NAME}` references are
 * plain lookups, there is no command substitution, and the result has no prototype.
 */
class Scanner {
  private pos = 0;
  private line = 1;
  private expansionBudget: number;
  private readonly values = createDict<string>();
  private readonly src: string;
  private readonly options: ScanOptions;

  constructor(src: string, options: ScanOptions) {
    this.src = src;
    this.options = options;
    this.expansionBudget = options.maxLength * EXPANSION_FACTOR;
  }

  run(): ParsedEnv {
    const { src } = this;
    while (this.pos < src.length) {
      this.skipInlineSpace();
      if (this.pos >= src.length) break;
      const code = src.charCodeAt(this.pos);
      if (code === LF) {
        this.pos++;
        this.line++;
      } else if (code === HASH) {
        this.skipToLineEnd();
      } else {
        this.entry();
      }
    }
    return Object.freeze(this.values);
  }

  private fail(message: string, line = this.line): never {
    throw new EnvParseError(message, line);
  }

  private peek(offset = 0): number {
    return this.src.charCodeAt(this.pos + offset);
  }

  private skipInlineSpace(): void {
    while (this.pos < this.src.length && isInlineSpace(this.peek())) this.pos++;
  }

  private skipToLineEnd(): void {
    const end = this.src.indexOf('\n', this.pos);
    this.pos = end === -1 ? this.src.length : end;
  }

  private readKey(): string {
    const start = this.pos;
    while (this.pos < this.src.length && isKeyChar(this.peek())) this.pos++;
    const key = this.src.slice(start, this.pos);
    if (key.length === 0) this.fail('Expected a variable name');
    if (isForbiddenKey(key)) this.fail('Forbidden variable name');
    if (key.length > MAX_KEY_LENGTH) this.fail('Variable name is too long');
    if (!isValidKey(key)) this.fail('Variable name must start with a letter or "_"');
    return key;
  }

  private entry(): void {
    const entryLine = this.line;
    let key = this.readKey();
    if (key === 'export' && isInlineSpace(this.peek())) {
      this.skipInlineSpace();
      key = this.readKey();
    }
    this.skipInlineSpace();
    if (this.peek() !== EQUALS) this.fail('Expected "=" after variable name');
    this.pos++;
    const spaceBeforeValue = isInlineSpace(this.peek());
    this.skipInlineSpace();

    const quote = this.peek();
    let value: string;
    if (quote === DOUBLE_QUOTE) {
      value = this.readDoubleQuoted(entryLine);
      this.expectLineEnd();
    } else if (quote === SINGLE_QUOTE || quote === BACKTICK) {
      value = this.readLiteralQuoted(quote, entryLine);
      this.expectLineEnd();
    } else {
      value = this.readUnquoted(spaceBeforeValue);
    }
    this.values[key] = value;
  }

  /** After a closing quote only whitespace and a `# comment` may follow on the line. */
  private expectLineEnd(): void {
    this.skipInlineSpace();
    if (this.pos >= this.src.length || this.peek() === LF) return;
    if (this.peek() === HASH) {
      this.skipToLineEnd();
      return;
    }
    this.fail('Unexpected characters after closing quote');
  }

  private readLiteralQuoted(quote: number, entryLine: number): string {
    const end = this.src.indexOf(String.fromCharCode(quote), this.pos + 1);
    if (end === -1) this.fail('Unterminated quoted value', entryLine);
    const value = this.src.slice(this.pos + 1, end);
    this.line += countNewlines(value);
    this.pos = end + 1;
    return value;
  }

  private readDoubleQuoted(entryLine: number): string {
    const { src } = this;
    this.pos++; // opening quote
    let out = '';
    let chunk = this.pos;
    while (this.pos < src.length) {
      const code = this.peek();
      if (code === DOUBLE_QUOTE) {
        out += src.slice(chunk, this.pos);
        this.pos++;
        return out;
      }
      if (code === BACKSLASH && this.pos + 1 < src.length) {
        const next = src.charAt(this.pos + 1);
        out +=
          src.slice(chunk, this.pos) +
          (getOwn(DOUBLE_QUOTE_ESCAPES, next) ?? `\\${next}`);
        if (next === '\n') this.line++;
        this.pos += 2;
        chunk = this.pos;
      } else if (this.isReferenceStart(code)) {
        out += src.slice(chunk, this.pos) + this.readReference();
        chunk = this.pos;
      } else {
        if (code === LF) this.line++;
        this.pos++;
      }
    }
    return this.fail('Unterminated quoted value', entryLine);
  }

  private readUnquoted(spaceBeforeValue: boolean): string {
    const { src } = this;
    let out = '';
    let chunk = this.pos;
    let afterSpace = spaceBeforeValue;
    while (this.pos < src.length) {
      const code = this.peek();
      if (code === LF) break;
      // Like a shell, '#' starts a comment only at the start of a word.
      if (code === HASH && afterSpace) {
        out += src.slice(chunk, this.pos);
        this.skipToLineEnd();
        return out.trimEnd();
      }
      if (this.options.expand && code === BACKSLASH && this.peek(1) === DOLLAR) {
        out += `${src.slice(chunk, this.pos)}$`;
        this.pos += 2;
        chunk = this.pos;
      } else if (this.isReferenceStart(code)) {
        out += src.slice(chunk, this.pos) + this.readReference();
        chunk = this.pos;
      } else {
        this.pos++;
      }
      afterSpace = isInlineSpace(code);
    }
    out += src.slice(chunk, this.pos);
    return out.trimEnd();
  }

  private isReferenceStart(code: number): boolean {
    return this.options.expand && code === DOLLAR && this.peek(1) === OPEN_BRACE;
  }

  /** Reads `${…}` at the cursor and returns its replacement. */
  private readReference(): string {
    // Only the body is inspected for a newline, so a long line of references stays linear.
    const close = this.src.indexOf('}', this.pos + 2);
    const body = close === -1 ? '' : this.src.slice(this.pos + 2, close);
    if (close === -1 || body.includes('\n')) this.fail('Unterminated "${" reference');
    const reference = parseReference(body);
    if (!reference) this.fail('Invalid variable name in "${…}" reference');
    this.pos = close + 1;
    const value = resolveReference(reference, this.options.lookup, this.values);
    this.expansionBudget -= value.length;
    if (this.expansionBudget < 0) {
      throw new EnvParseError('Variable expansion produced too much output', this.line, {
        code: 'ERR_DOTVAR_LIMIT',
      });
    }
    return value;
  }
}

const countNewlines = (text: string): number => {
  let count = 0;
  let index = text.indexOf('\n');
  while (index !== -1) {
    count++;
    index = text.indexOf('\n', index + 1);
  }
  return count;
};

/** Removes a UTF-8 BOM and normalizes CRLF / CR line endings to LF. */
const normalize = (source: string): string =>
  (source.charCodeAt(0) === 0xfeff ? source.slice(1) : source).replace(/\r\n?/g, '\n');

/** Shared entry point for `parse()` and the file loader. */
export const scan = (source: string, options: ScanOptions): ParsedEnv => {
  if (typeof source !== 'string') {
    throw new DotvarError('ERR_DOTVAR_OPTION', 'The .env source must be a string');
  }
  if (source.length > options.maxLength) {
    throw new DotvarError(
      'ERR_DOTVAR_LIMIT',
      `The .env source exceeds the ${options.maxLength}-character limit`,
    );
  }
  const text = normalize(source);
  const nul = text.indexOf('\0');
  if (nul !== -1) {
    throw new EnvParseError(
      'NUL characters are not allowed',
      countNewlines(text.slice(0, nul)) + 1,
    );
  }
  return new Scanner(text, options).run();
};

/**
 * Parses `.env` text into a frozen, prototype-free object. Works in every runtime.
 *
 * Supported syntax: `KEY=value`, `export KEY=value`, `# comments`, inline comments after
 * whitespace, `"double"` (with `\n \r \t \" \\ \$` escapes, may span lines), `'single'` and
 * `` `backtick` `` (literal, may span lines), and `${NAME}` / `${NAME:-fallback}` expansion
 * when `expand` is on.
 *
 * @throws {EnvParseError} on malformed input (the message names the line, never its content).
 * @throws {DotvarError} `ERR_DOTVAR_LIMIT` when the input is larger than `maxLength`.
 */
export const parse = (source: string, options: ParseOptions = {}): ParsedEnv => {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  assertLimit('maxLength', maxLength);
  const { env } = options;
  const fallback = (name: string): string | undefined =>
    env ? getOwn<string | undefined>(env, name) : undefined;
  return scan(source, {
    expand: options.expand === true,
    maxLength,
    lookup: (name, local) => getOwn(local, name) ?? fallback(name),
  });
};
