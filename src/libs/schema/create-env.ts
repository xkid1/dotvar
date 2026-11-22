import { getOwn, getProcessEnv, isClientRuntime, isValidKey, redactValues } from '@utils';

import { DotvarError, EnvValidationError } from '../errors';

import type {
  CreateEnvOptions,
  EnvIssue,
  EnvSource,
  InferEnv,
  Schema,
  Spec,
} from '@types';

/** Own properties dotvar adds to the env object; schema keys may not use them. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['toJSON', 'toString']);

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

const CLIENT_SOURCE_HINT =
  'Hint: in browsers and React Native pass `source` explicitly (e.g. `source: import.meta.env`); ' +
  'bundlers only inline variables that are referenced literally.';

const optionError = (message: string): DotvarError =>
  new DotvarError('ERR_DOTVAR_OPTION', message);

const isSpec = (value: unknown): value is Spec<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { parse?: unknown }).parse === 'function' &&
  typeof (value as { kind?: unknown }).kind === 'string';

/** Validates options (also for plain-JS callers) and returns the schema entries. */
const schemaEntries = (
  options: CreateEnvOptions<Schema>,
): readonly (readonly [string, Spec<unknown>])[] => {
  const schema: unknown = options.schema;
  const { prefix } = options;
  if (typeof schema !== 'object' || schema === null) {
    throw optionError('"schema" must be an object');
  }
  if (prefix !== undefined && (prefix === '' || !isValidKey(`${prefix}X`))) {
    throw optionError('"prefix" must be a valid variable-name prefix');
  }
  return Object.entries(schema).map(([key, spec]: [string, unknown]) => {
    if (!isValidKey(key) || RESERVED_KEYS.has(key)) {
      throw optionError(`"${key}" is not a valid schema key`);
    }
    if (!isSpec(spec)) {
      throw optionError(
        `Schema key "${key}" must be a validator such as string() or number()`,
      );
    }
    return [key, spec] as const;
  });
};

const describe = (spec: Spec<unknown>, message: string): string =>
  spec.description ? `${message} (${spec.description})` : message;

type Outcome =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string; readonly missing: boolean };

/** Resolves one variable: missing → default / optional / error, present → validator. */
const resolveValue = (
  spec: Spec<unknown>,
  raw: unknown,
  emptyAsUndefined: boolean,
): Outcome => {
  if (raw === undefined || raw === null || (emptyAsUndefined && raw === '')) {
    if (spec.default !== undefined) return { ok: true, value: spec.default };
    if (spec.optional) return { ok: true, value: undefined };
    return {
      ok: false,
      message: describe(spec, 'is required but missing'),
      missing: true,
    };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: 'must be a string in the source', missing: false };
  }
  const result = spec.parse(raw);
  return result.ok
    ? result
    : { ok: false, message: describe(spec, result.message), missing: false };
};

const secretOnClientError = (sourceKey: string): DotvarError =>
  new DotvarError(
    'ERR_DOTVAR_SECRET_ON_CLIENT',
    `"${sourceKey}" is marked secret but is being read in a client runtime, where every ` +
      'value is public. Move it to server code or drop `secret: true`.',
  );

/** Attaches non-enumerable `toJSON`, `toString` and inspect hooks that redact secrets. */
const withRedaction = (
  values: Record<string, unknown>,
  secretKeys: ReadonlySet<string>,
): void => {
  const redacted = (): Record<string, unknown> => redactValues(values, secretKeys);
  Object.defineProperties(values, {
    toJSON: { value: redacted, enumerable: false },
    toString: { value: () => '[object Env]', enumerable: false },
    [INSPECT]: { value: redacted, enumerable: false },
  });
};

/**
 * Validates environment variables against a schema and returns a frozen, typed object.
 * All problems are reported together in one `EnvValidationError`; messages never contain
 * values. Secrets are redacted from `JSON.stringify`, `String()` and `console.log`.
 *
 * @example
 * const env = createEnv({
 *   schema: { PORT: port({ default: 3000 }), API_KEY: string({ secret: true }) },
 * });
 * env.PORT; // number
 */
export const createEnv = <const S extends Schema>(
  options: CreateEnvOptions<S>,
): InferEnv<S> => {
  const entries = schemaEntries(options);
  const { prefix = '', emptyAsUndefined = true } = options;
  const source: EnvSource = options.source ?? getProcessEnv() ?? {};
  const onClient = isClientRuntime();
  const blockSecrets = onClient && options.allowSecretsOnClient !== true;

  const values: Record<string, unknown> = {};
  const secretKeys = new Set<string>();
  const issues: EnvIssue[] = [];
  let anyMissing = false;

  for (const [key, spec] of entries) {
    const sourceKey = prefix + key;
    if (spec.secret) {
      if (blockSecrets) throw secretOnClientError(sourceKey);
      secretKeys.add(key);
    }
    const outcome = resolveValue(
      spec,
      getOwn<unknown>(source, sourceKey),
      emptyAsUndefined,
    );
    if (outcome.ok) {
      values[key] = outcome.value;
    } else {
      anyMissing ||= outcome.missing;
      issues.push({ key: sourceKey, message: outcome.message });
    }
  }

  if (issues.length > 0) {
    const needsHint = anyMissing && onClient && options.source === undefined;
    throw new EnvValidationError(issues, needsHint ? CLIENT_SOURCE_HINT : undefined);
  }

  withRedaction(values, secretKeys);
  return Object.freeze(values) as InferEnv<S>;
};
