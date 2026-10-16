// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseArgs } from './cli';

describe('parseArgs', () => {
  it('기본값은 실제 import(리셋 없음)', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, reset: false, yes: false });
  });
  it('--dry-run', () => {
    expect(parseArgs(['--dry-run'])).toMatchObject({ dryRun: true });
  });
  it('--reset만 주면 실수 방지를 위해 거부', () => {
    expect(() => parseArgs(['--reset'])).toThrow('--reset requires --yes');
  });
  it('--reset --yes', () => {
    expect(parseArgs(['--reset', '--yes'])).toEqual({ dryRun: false, reset: true, yes: true });
  });
  it('알 수 없는 옵션은 거부', () => {
    expect(() => parseArgs(['--rest'])).toThrow('--rest');
  });
});
