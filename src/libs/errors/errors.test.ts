import { describe, expect, it } from 'vitest';

import { DotvarError, EnvParseError, EnvValidationError } from './errors';

describe('errors', () => {
  it('DotvarError carries a code and name', () => {
    const error = new DotvarError('ERR_DOTVAR_OPTION', 'bad');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'DotvarError',
      code: 'ERR_DOTVAR_OPTION',
      message: 'bad',
    });
  });

  it('EnvParseError formats the location', () => {
    expect(new EnvParseError('Oops', 3).message).toBe('Oops (line 3)');
    const withFile = new EnvParseError('Oops', 3, {
      file: '/app/.env',
      code: 'ERR_DOTVAR_LIMIT',
    });
    expect(withFile).toMatchObject({
      message: 'Oops (/app/.env:3)',
      reason: 'Oops',
      line: 3,
      file: '/app/.env',
      code: 'ERR_DOTVAR_LIMIT',
    });
    expect(withFile).toBeInstanceOf(DotvarError);
  });

  it('EnvValidationError lists issues and an optional hint', () => {
    const error = new EnvValidationError(
      [{ key: 'A', message: 'is required but missing' }],
      'Hint: x',
    );
    expect(error.message).toBe(
      'Invalid environment variables:\n  - A: is required but missing\nHint: x',
    );
    expect(error.name).toBe('EnvValidationError');
  });
});
