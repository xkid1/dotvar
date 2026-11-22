/**
 * dotvar — universal entry point.
 *
 * Runs everywhere (browsers, workers, React Native, Electron, Node, Bun, Deno): it never
 * imports `node:*` modules. For loading `.env` files from disk use `dotvar/node`.
 *
 * @packageDocumentation
 */
export {
  boolean,
  createEnv,
  DotvarError,
  email,
  EnvParseError,
  EnvValidationError,
  integer,
  json,
  list,
  makeSpec,
  number,
  oneOf,
  parse,
  port,
  string,
  url,
} from '@libs';
export { REDACTED } from '@utils';

export type {
  BooleanOptions,
  CreateEnvOptions,
  DotvarErrorCode,
  EmailOptions,
  EnvIssue,
  EnvSource,
  InferEnv,
  JsonOptions,
  ListOptions,
  NumberOptions,
  OneOfOptions,
  ParsedEnv,
  ParseOptions,
  ParseResult,
  Schema,
  Spec,
  SpecOptions,
  SpecOutput,
  StringOptions,
  UrlOptions,
} from '@types';
