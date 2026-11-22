import { describe, expect, it } from 'vitest';

import { DotvarError, EnvParseError } from '../errors';

import { parse } from './parser';

const parseError = (source: string, options = {}): EnvParseError => {
  try {
    parse(source, options);
  } catch (error) {
    if (error instanceof EnvParseError) return error;
    throw error;
  }
  throw new Error('expected parse() to throw');
};

describe('parse: basic syntax', () => {
  it('parses KEY=value pairs', () => {
    expect(parse('A=1\nB=two')).toEqual({ A: '1', B: 'two' });
  });

  it('keeps "=" inside values', () => {
    expect(parse('URL=postgres://u:p@h/db?a=1&b=2')).toEqual({
      URL: 'postgres://u:p@h/db?a=1&b=2',
    });
  });

  it('skips blank lines and full-line comments', () => {
    expect(parse('\n  \n# comment\n\t# indented\nA=1\n')).toEqual({ A: '1' });
  });

  it('accepts spaces around "=" and an "export" prefix', () => {
    expect(parse('export A = 1\nexport\tB=2\n  C  =3')).toEqual({
      A: '1',
      B: '2',
      C: '3',
    });
  });

  it('treats "export" as a normal key when it is not a prefix', () => {
    expect(parse('export=1')).toEqual({ export: '1' });
  });

  it('allows dots and dashes in keys', () => {
    expect(parse('a.b-c_D=1')).toEqual({ 'a.b-c_D': '1' });
  });

  it('returns empty strings for empty values', () => {
    expect(parse('A=\nB=""\nC=\'\'')).toEqual({ A: '', B: '', C: '' });
  });

  it('lets the last duplicate win', () => {
    expect(parse('A=1\nA=2')).toEqual({ A: '2' });
  });

  it('handles CRLF, CR and a UTF-8 BOM', () => {
    expect(parse('\uFEFFA=1\r\nB=2\rC=3')).toEqual({ A: '1', B: '2', C: '3' });
  });

  it('returns an empty object for empty input', () => {
    expect(parse('')).toEqual({});
  });

  it('returns a frozen, prototype-free object', () => {
    const result = parse('A=1');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect((result as Record<string, unknown>).toString).toBeUndefined();
  });
});

describe('parse: unquoted values and comments', () => {
  it('trims surrounding whitespace', () => {
    expect(parse('A=   spaced value   ')).toEqual({ A: 'spaced value' });
  });

  it('starts an inline comment at "#" after whitespace', () => {
    expect(parse('A=value # comment\nB=value\t#c')).toEqual({ A: 'value', B: 'value' });
  });

  it('keeps "#" that is part of a word (URL fragments, passwords)', () => {
    expect(parse('A=https://x.io/#top\nB=pa#ss')).toEqual({
      A: 'https://x.io/#top',
      B: 'pa#ss',
    });
  });

  it('treats "= #…" as an empty value with a comment but "=#…" as a value', () => {
    expect(parse('A= #comment\nB=#value')).toEqual({ A: '', B: '#value' });
  });

  it('keeps quotes that are not at the start of the value', () => {
    expect(parse(`A=it's "fine"`)).toEqual({ A: `it's "fine"` });
  });

  it('keeps backslashes literally', () => {
    expect(parse('A=C:\\path\\n')).toEqual({ A: 'C:\\path\\n' });
  });
});

describe('parse: quoted values', () => {
  it('processes escapes in double quotes', () => {
    expect(parse('A="a\\nb\\rc\\td\\"e\\\\f\\$g\\qh"')).toEqual({
      A: 'a\nb\rc\td"e\\f$g\\qh',
    });
  });

  it('keeps single- and backtick-quoted values literal', () => {
    expect(parse("A='a\\nb ${X}'\nB=`it's \"x\"`")).toEqual({
      A: 'a\\nb ${X}',
      B: `it's "x"`,
    });
  });

  it('supports multi-line quoted values', () => {
    const pem = '-----BEGIN KEY-----\nabc\n-----END KEY-----';
    expect(parse(`KEY="${pem}"\nNEXT=1`)).toEqual({ KEY: pem, NEXT: '1' });
    expect(parse(`KEY='${pem}'\nNEXT=1`)).toEqual({ KEY: pem, NEXT: '1' });
  });

  it('allows a comment after the closing quote', () => {
    expect(parse('A="x" # c\nB=\'y\'   ')).toEqual({ A: 'x', B: 'y' });
  });

  it('keeps "#" inside quotes', () => {
    expect(parse('A="a # b"')).toEqual({ A: 'a # b' });
  });

  it('handles a trailing backslash before EOF as unterminated', () => {
    expect(parseError('A="abc\\').reason).toBe('Unterminated quoted value');
  });
});

describe('parse: errors', () => {
  it.each([
    ['A="unterminated', 'Unterminated quoted value', 1],
    ["A='unterminated\nB=1", 'Unterminated quoted value', 1],
    ['A="x" trailing', 'Unexpected characters after closing quote', 1],
    ['\n\nJUST_A_KEY', 'Expected "=" after variable name', 3],
    ['=value', 'Expected a variable name', 1],
    ['1A=x', 'Variable name must start with a letter or "_"', 1],
    ['A B=1', 'Expected "=" after variable name', 1],
  ])('rejects %j', (source, reason, line) => {
    const error = parseError(source);
    expect(error.reason).toBe(reason);
    expect(error.line).toBe(line);
    expect(error.code).toBe('ERR_DOTVAR_PARSE');
  });

  it('reports the line where a multi-line value started', () => {
    expect(parseError('A=1\nB="open\nstill open').line).toBe(2);
  });

  it('counts lines inside multi-line values', () => {
    expect(parseError('A="x\ny"\nB="x\\\ny"\nC=\'a\nb\'\n!').line).toBe(7);
  });

  it('never includes the offending content in the message', () => {
    const error = parseError('PASSWORD="hunter2 oops');
    expect(error.message).not.toContain('hunter2');
    expect(error.message).not.toContain('PASSWORD');
  });

  it('rejects non-string input', () => {
    expect(() => parse(42 as unknown as string)).toThrow(DotvarError);
  });
});

describe('parse: security', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('rejects the key %s', (key) => {
    expect(parseError(`${key}=polluted`).reason).toBe('Forbidden variable name');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('rejects "export __proto__"', () => {
    expect(parseError('export __proto__=1').reason).toBe('Forbidden variable name');
  });

  it('rejects NUL characters and reports their line', () => {
    const error = parseError('A=1\nB=x\0y');
    expect(error.reason).toBe('NUL characters are not allowed');
    expect(error.line).toBe(2);
  });

  it('rejects keys longer than 256 characters', () => {
    expect(parseError(`${'K'.repeat(257)}=1`).reason).toBe('Variable name is too long');
    expect(parse(`${'K'.repeat(256)}=1`)).toHaveProperty('K'.repeat(256));
  });

  it('enforces maxLength before parsing', () => {
    expect(() => parse('A=12345', { maxLength: 5 })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_LIMIT' }),
    );
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects maxLength %s', (maxLength) => {
    expect(() => parse('', { maxLength })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_OPTION' }),
    );
  });

  it('parses pathological input in linear time', () => {
    const inputs = [
      `A=${' '.repeat(200_000)}x`,
      `A=${'# '.repeat(100_000)}`,
      `A="${'\\\\'.repeat(100_000)}"`,
      `${'A=1\n'.repeat(50_000)}`,
      `A=${'${'.repeat(50_000)}`,
    ];
    const start = performance.now();
    for (const input of inputs) parse(input);
    parse(`A=1\nB=${'${A}'.repeat(200_000)}`, { expand: true });
    parse(`A=1\nB="${'${A}'.repeat(200_000)}"`, { expand: true });
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('parse: expansion', () => {
  const expand = (
    source: string,
    env?: Record<string, string>,
  ): Readonly<Record<string, string>> =>
    parse(source, env ? { expand: true, env } : { expand: true });

  it('is off by default', () => {
    expect(parse('A=1\nB=${A}')).toEqual({ A: '1', B: '${A}' });
  });

  it('expands references to earlier keys in unquoted and double-quoted values', () => {
    expect(expand('A=1\nB=${A}-x\nC="${A}${B}"')).toEqual({
      A: '1',
      B: '1-x',
      C: '11-x',
    });
  });

  it('never expands single- or backtick-quoted values', () => {
    expect(expand("A=1\nB='${A}'\nC=`${A}`")).toEqual({ A: '1', B: '${A}', C: '${A}' });
  });

  it('leaves a bare "$" alone', () => {
    expect(expand('PW=pa$$word$A')).toEqual({ PW: 'pa$$word$A' });
  });

  it('supports escaping with \\$', () => {
    expect(expand('A=1\nB="\\${A}"\nC=\\${A}')).toEqual({ A: '1', B: '${A}', C: '${A}' });
  });

  it('falls back to env, local values first', () => {
    expect(
      expand('A=local\nB=${A}-${HOME_DIR}', { A: 'env', HOME_DIR: '/home' }),
    ).toEqual({
      A: 'local',
      B: 'local-/home',
    });
  });

  it('ignores inherited properties of env', () => {
    expect(
      expand('A=${toString}', Object.create({ toString: 'x' }) as Record<string, string>),
    ).toEqual({
      A: '',
    });
  });

  it('resolves unknown references to an empty string', () => {
    expect(expand('A=${NOPE}')).toEqual({ A: '' });
  });

  it('supports ${X:-fallback} and ${X-fallback}', () => {
    expect(expand('E=\nA=${E:-f1}\nB=${E-f2}\nC=${UNSET-f3}\nD=${UNSET:-}')).toEqual({
      E: '',
      A: 'f1',
      B: '',
      C: 'f3',
      D: '',
    });
  });

  it('does not expand references inside fallbacks', () => {
    expect(expand('A=1\nB=${X:-${A}}')).toEqual({ A: '1', B: '${A}' });
  });

  it.each([
    ['A=${', 'Unterminated "${" reference'],
    ['A="${B\n}"', 'Unterminated "${" reference'],
    ['A=${1BAD}', 'Invalid variable name in "${…}" reference'],
    ['A=${}', 'Invalid variable name in "${…}" reference'],
    ['A=${__proto__}', 'Invalid variable name in "${…}" reference'],
  ])('rejects %j', (source, reason) => {
    expect(parseError(source, { expand: true }).reason).toBe(reason);
  });

  it('caps exponential expansion (billion laughs)', () => {
    const lines = ['A0=xxxxxxxxxxxxxxxx'];
    for (let i = 1; i <= 40; i++) lines.push(`A${i}=\${A${i - 1}}\${A${i - 1}}`);
    const error = parseError(lines.join('\n'), { expand: true, maxLength: 10_000 });
    expect(error.code).toBe('ERR_DOTVAR_LIMIT');
  });
});
