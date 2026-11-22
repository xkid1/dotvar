import type { EnvSource } from '@types';

interface RuntimeGlobals {
  readonly process?: {
    readonly env?: unknown;
    readonly versions?: { readonly node?: unknown };
  };
  readonly document?: unknown;
  readonly navigator?: { readonly product?: unknown };
}

const runtimeGlobals = (): RuntimeGlobals => globalThis as RuntimeGlobals;

/**
 * `process.env` when the runtime has one (Node, Bun, Deno, Electron main, webpack shims),
 * otherwise `undefined`. Never throws, even where `process` is not defined.
 */
export const getProcessEnv = (): EnvSource | undefined => {
  const env = runtimeGlobals().process?.env;
  return typeof env === 'object' && env !== null ? (env as EnvSource) : undefined;
};

/**
 * True when code runs somewhere its bundle is visible to end users: a browser page,
 * a web worker, an Electron renderer or a React Native app.
 */
export const isClientRuntime = (): boolean => {
  const globals = runtimeGlobals();
  if (globals.navigator?.product === 'ReactNative') return true;
  if (typeof globals.document === 'object' && globals.document !== null) return true;
  // Web / service workers: no document, but `importScripts` and no Node.
  return (
    typeof (globalThis as { importScripts?: unknown }).importScripts === 'function' &&
    globals.process?.versions?.node === undefined
  );
};
