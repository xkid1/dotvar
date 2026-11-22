// Type-level consumer test: compiled by e2e/run.mjs with NodeNext and Bundler resolution,
// without @types/node. Any `@ts-expect-error` that stops erroring fails the build.
import { createEnv, json, list, number, oneOf, parse, port, string, url } from 'dotvar';
import type { EnvValidationError, InferEnv, ParsedEnv, Spec } from 'dotvar';
import { load } from 'dotvar/node';
import type { LoadResult } from 'dotvar/node';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <T extends true>(): T => true as T;

const schema = {
  PORT: port({ default: 3000 }),
  RATIO: number({ optional: true }),
  NAME: string(),
  MODE: oneOf(['development', 'production']),
  URL: url({ protocols: ['https:'] }),
  TAGS: list({ default: [] }),
  CONFIG: json<{ retries: number }>({ optional: true }),
};
const env = createEnv({ source: {}, schema });

assertType<Equal<typeof env.PORT, number>>();
assertType<Equal<typeof env.RATIO, number | undefined>>();
assertType<Equal<typeof env.NAME, string>>();
assertType<Equal<typeof env.MODE, 'development' | 'production'>>();
assertType<Equal<typeof env.TAGS, readonly string[]>>();
assertType<Equal<typeof env.CONFIG, { retries: number } | undefined>>();
assertType<Equal<typeof env, InferEnv<typeof schema>>>();

// @ts-expect-error -- env is read-only
env.PORT = 1;
// @ts-expect-error -- unknown keys are a type error
void env.NOPE;

const parsed: ParsedEnv = parse('A=1');
const result: LoadResult = load({ target: null });
const spec: Spec<number> = port();
declare const error: EnvValidationError;
void [parsed, result, spec, error.issues[0]?.key];
