// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { bootstrapPins } from './bootstrap-pins';
import type { Db } from './import-confluence/load';

vi.mock('../src/lib/auth-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/auth-utils')>()),
  hashPIN: vi.fn(async (pin: string) => `hash(${pin})`),
}));

type Update = { set: Record<string, unknown>; where: string };

/** drizzle 트랜잭션의 update(...).set(...).where(...).returning()을 기록하는 가짜 DB */
function fakeDb(returned: { pins: number; admin: number }) {
  const updates: Update[] = [];
  const render = (cond: unknown) => new PgDialect().sqlToQuery(cond as SQL);
  const tx = {
    update: () => {
      const u = { set: {}, where: '' } as Update;
      updates.push(u);
      const builder = {
        set: (v: Record<string, unknown>) => { u.set = v; return builder; },
        where: (cond: unknown) => {
          const q = render(cond);
          u.where = `${q.sql} ${JSON.stringify(q.params)}`.toLowerCase();
          return builder;
        },
        returning: async () => Array.from({ length: updates.length === 1 ? returned.pins : returned.admin }, (_, i) => ({ id: String(i) })),
      };
      return builder;
    },
  };
  const db = { transaction: async (cb: (t: typeof tx) => unknown) => cb(tx) } as unknown as Db;
  return { db, updates };
}

describe('bootstrapPins', () => {
  it('PIN 없는 사용자에게만 초기 PIN(1234) + mustChangePin, 관리자 지정', async () => {
    const { db, updates } = fakeDb({ pins: 53, admin: 1 });

    expect(await bootstrapPins(db, 'youngyong.jo')).toEqual({ pinsAssigned: 53, adminSet: true });

    const [pins, admin] = updates;
    expect(pins.set).toMatchObject({ pinHash: 'hash(1234)', mustChangePin: true });
    expect(pins.where).toContain('"pin_hash" is null'); // 이미 PIN이 있는 회원은 건드리지 않음
    expect(admin.set).toMatchObject({ isAdmin: true });
    expect(admin.where).toContain('"username" = $1');
    expect(admin.where).toContain('youngyong.jo');
  });

  it('관리자 계정이 없으면 throw', async () => {
    const { db } = fakeDb({ pins: 0, admin: 0 });
    await expect(bootstrapPins(db, 'youngyong.jo')).rejects.toThrow('관리자 계정 없음: youngyong.jo');
  });
});
