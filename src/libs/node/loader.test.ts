import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DotvarError } from '../errors';

import { load, read } from './loader';

import type { EnvTarget } from '@types';

const IS_WINDOWS = process.platform === 'win32';

let dir: string;
const write = (name: string, content: string): string => {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dotvar-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('load', () => {
  it('loads .env into the target without overwriting existing values', () => {
    write('.env', 'A=from-file\nB=from-file');
    const target: EnvTarget = { A: 'existing' };
    const result = load({ cwd: dir, target, mode: '' });
    expect(target).toEqual({ A: 'existing', B: 'from-file' });
    expect(result.parsed).toEqual({ A: 'from-file', B: 'from-file' });
    expect(result.files).toEqual([join(dir, '.env')]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('overwrites existing values with override', () => {
    write('.env', 'A=from-file');
    const target: EnvTarget = { A: 'existing' };
    load({ cwd: dir, target, override: true, mode: '' });
    expect(target['A']).toBe('from-file');
  });

  it('loads the cascade in precedence order', () => {
    write('.env', 'A=env\nB=env\nC=env\nD=env');
    write('.env.local', 'B=local\nC=local\nD=local');
    write('.env.production', 'C=mode\nD=mode');
    write('.env.production.local', 'D=mode-local');
    const result = load({ cwd: dir, target: null, mode: 'production' });
    expect(result.parsed).toEqual({ A: 'env', B: 'local', C: 'mode', D: 'mode-local' });
    expect(result.files).toHaveLength(4);
  });

  it('skips .env.local in test mode', () => {
    write('.env', 'A=env');
    write('.env.local', 'A=local');
    write('.env.test', 'B=test');
    expect(load({ cwd: dir, target: null, mode: 'test' }).parsed).toEqual({
      A: 'env',
      B: 'test',
    });
  });

  it('uses NODE_ENV as the default mode', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    write('.env.staging', 'A=staging');
    expect(load({ cwd: dir, target: null }).parsed).toEqual({ A: 'staging' });
  });

  it('writes to process.env by default', () => {
    write('.env', 'DOTVAR_LOADER_TEST=1');
    vi.stubEnv('DOTVAR_LOADER_TEST', undefined);
    delete process.env['DOTVAR_LOADER_TEST'];
    load({ cwd: dir, mode: '' });
    expect(process.env['DOTVAR_LOADER_TEST']).toBe('1');
  });

  it('loads explicit paths (relative and absolute) in order', () => {
    write('a.env', 'A=1\nB=1');
    const absolute = write('b.env', 'B=2');
    expect(load({ cwd: dir, target: null, path: ['a.env', absolute] }).parsed).toEqual({
      A: '1',
      B: '2',
    });
    expect(load({ cwd: dir, target: null, path: 'a.env' }).parsed).toEqual({
      A: '1',
      B: '1',
    });
  });

  it('skips missing files unless required', () => {
    expect(load({ cwd: dir, target: null, mode: '' }).files).toEqual([]);
    expect(() => load({ cwd: dir, target: null, required: true, mode: '' })).toThrow(
      /No \.env file found/,
    );
    expect(() =>
      load({ cwd: dir, target: null, path: 'missing.env', required: true }),
    ).toThrow(/missing\.env does not exist/);
  });

  it('treats a path under a file as missing', () => {
    write('file', 'x');
    expect(load({ cwd: dir, target: null, path: 'file/.env' }).files).toEqual([]);
  });

  it('follows symlinks (Kubernetes secret volumes use them)', () => {
    if (IS_WINDOWS) return;
    const real = write('real.env', 'A=1');
    symlinkSync(real, join(dir, '.env'));
    expect(load({ cwd: dir, target: null, mode: '' }).parsed).toEqual({ A: '1' });
  });

  it('reports parse errors with the file and line', () => {
    write('.env', 'A=1\nB="open');
    const file = join(dir, '.env');
    expect(() => load({ cwd: dir, target: null, mode: '' })).toThrow(
      expect.objectContaining({
        name: 'EnvParseError',
        file,
        line: 2,
        message: `Unterminated quoted value (${file}:2)`,
      }),
    );
  });

  it('rethrows non-parse errors from the parser unchanged', () => {
    write('.env', 'A=1');
    expect(() => load({ cwd: dir, target: null, mode: '', maxBytes: 2 })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_LIMIT' }),
    );
  });
});

describe('load: expansion', () => {
  it('resolves references across files', () => {
    write('.env', 'HOST=localhost\nPORT=5432');
    write('.env.local', 'URL=postgres://${HOST}:${PORT}/app');
    expect(load({ cwd: dir, target: null, mode: '', expand: true }).parsed['URL']).toBe(
      'postgres://localhost:5432/app',
    );
  });

  it('prefers existing variables without override (they win in the end too)', () => {
    write('.env', 'HOST=file\nURL=http://${HOST}');
    const target: EnvTarget = { HOST: 'real' };
    load({ cwd: dir, target, mode: '', expand: true });
    expect(target['URL']).toBe('http://real');
  });

  it('prefers file values with override', () => {
    write('.env', 'HOST=file\nURL=http://${HOST}\nOTHER=${FROM_TARGET}');
    const target: EnvTarget = { HOST: 'real', FROM_TARGET: 't' };
    load({ cwd: dir, target, mode: '', expand: true, override: true });
    expect(target).toMatchObject({ HOST: 'file', URL: 'http://file', OTHER: 't' });
  });

  it('works without a target', () => {
    write('.env', 'A=${UNSET:-x}');
    expect(load({ cwd: dir, target: null, mode: '', expand: true }).parsed['A']).toBe(
      'x',
    );
  });
});

describe('load: security', () => {
  it.each(['../../etc/passwd', 'a/b', 'prod.local', 'x'.repeat(65), 'a b'])(
    'rejects mode %j (path traversal through NODE_ENV)',
    (mode) => {
      expect(() => load({ cwd: dir, target: null, mode })).toThrow(
        expect.objectContaining({ code: 'ERR_DOTVAR_OPTION' }),
      );
    },
  );

  it('rejects NUL bytes in paths', () => {
    expect(() => load({ cwd: dir, target: null, path: 'a\0b' })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_FILE' }),
    );
  });

  it.each([[[]], [''], [['ok', '']], [[1]]])('rejects path %j', (path) => {
    expect(() => load({ cwd: dir, target: null, path: path as never })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_OPTION' }),
    );
  });

  it('rejects directories', () => {
    mkdirSync(join(dir, '.env'));
    expect(() => load({ cwd: dir, target: null, mode: '' })).toThrow(
      /is not a regular file/,
    );
  });

  it('rejects FIFOs without blocking', () => {
    if (IS_WINDOWS) return;
    const fifo = join(dir, '.env');
    if (spawnSync('mkfifo', [fifo]).status !== 0) return;
    expect(() => load({ cwd: dir, target: null, mode: '' })).toThrow(
      /is not a regular file/,
    );
  });

  it('enforces maxBytes before reading', () => {
    write('.env', `A=${'x'.repeat(100)}`);
    expect(() => load({ cwd: dir, target: null, mode: '', maxBytes: 50 })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_LIMIT' }),
    );
    expect(() => load({ cwd: dir, target: null, maxBytes: 0 })).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_OPTION' }),
    );
  });

  it('warns about world-writable files', () => {
    if (IS_WINDOWS) return;
    const path = write('.env', 'A=1');
    chmodSync(path, 0o666);
    const { warnings } = load({ cwd: dir, target: null, mode: '' });
    expect(warnings).toEqual([
      `${path} is world-writable: any local user can change this configuration`,
    ]);
  });

  it('reports unreadable files without their content', () => {
    if (IS_WINDOWS || process.getuid?.() === 0) return;
    const path = write('.env', 'SECRET=1');
    chmodSync(path, 0o000);
    expect(() => load({ cwd: dir, target: null, mode: '' })).toThrow(
      expect.objectContaining({
        code: 'ERR_DOTVAR_FILE',
        message: `Cannot open ${path} (EACCES)`,
      }),
    );
  });

  it('never writes forbidden keys', () => {
    write('.env', '__proto__=x');
    expect(() => load({ cwd: dir, target: {}, mode: '' })).toThrow(DotvarError);
  });
});

describe('read (1.x compatibility)', () => {
  it('loads the default cascade into process.env', () => {
    write('.env', 'DOTVAR_READ_TEST=ok');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env['DOTVAR_READ_TEST'];
    read();
    expect(process.env['DOTVAR_READ_TEST']).toBe('ok');
    delete process.env['DOTVAR_READ_TEST'];
  });
});
