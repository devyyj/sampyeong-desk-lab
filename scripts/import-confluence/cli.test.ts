// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseArgs, filterMissingPhotos } from './cli';
import type { ParsedActivity } from './types';

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

describe('filterMissingPhotos', () => {
  const act = (photos: string[]): ParsedActivity => ({
    sourceKey: 'p1:1', seasonId: 1, date: '2025-12-19', type: 'LUNCH', title: 't', bodyMd: '', noteMd: null,
    photos: photos.map((fileName, position) => ({ pageId: 'p1', fileName, position })),
  });

  it('로컬에 없는 사진은 빼고 리포트, 남은 사진의 position은 원래 순서 유지', () => {
    const exists = (_: string, __: string, f: string) => (f === 'gone.png' ? null : `/x/${f}`);
    const { activities, missing } = filterMissingPhotos([act(['a.png', 'gone.png', 'b.png'])], exists);
    expect(activities[0].photos.map((p) => [p.fileName, p.position])).toEqual([['a.png', 0], ['b.png', 2]]);
    expect(missing).toEqual(['p1/gone.png']);
  });
});
