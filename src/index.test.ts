import { describe, expect, it } from 'vitest';

import * as node from './node';

import * as universal from '.';

// Guards the public surface: removing or renaming an export is a breaking change.
const UNIVERSAL_EXPORTS = [
  'DotvarError',
  'EnvParseError',
  'EnvValidationError',
  'REDACTED',
  'boolean',
  'createEnv',
  'email',
  'integer',
  'json',
  'list',
  'makeSpec',
  'number',
  'oneOf',
  'parse',
  'port',
  'string',
  'url',
].sort();

describe('public API', () => {
  it('dotvar exports exactly the universal API', () => {
    expect(Object.keys(universal).sort()).toEqual(UNIVERSAL_EXPORTS);
  });

  it('dotvar/node adds load and read', () => {
    expect(Object.keys(node).sort()).toEqual(
      [...UNIVERSAL_EXPORTS, 'load', 'read'].sort(),
    );
  });

  it('works end to end: parse → createEnv', () => {
    const source = universal.parse('PORT=3000\nFEATURES=a,b');
    const env = universal.createEnv({
      source,
      schema: { PORT: universal.port(), FEATURES: universal.list() },
    });
    expect(env).toEqual({ PORT: 3000, FEATURES: ['a', 'b'] });
  });
});
