import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { queryKeys, STALE_TIMES } from '../query-keys';

// Feature: react-query-migration, Property 1: Query key hierarchy enables prefix invalidation
describe('Property 1: Query key hierarchy enables prefix invalidation', () => {
  const domainConfigs = [
    {
      name: 'tasks',
      all: queryKeys.tasks.all,
      keyFns: [
        { label: 'lists', fn: () => queryKeys.tasks.lists() },
        { label: 'details', fn: () => queryKeys.tasks.details() },
        { label: 'detail', fn: (id: string) => queryKeys.tasks.detail(id) },
        { label: 'pendingCount', fn: () => queryKeys.tasks.pendingCount() },
        { label: 'childAssignments', fn: () => queryKeys.tasks.childAssignments() },
        { label: 'childAssignment', fn: (id: string) => queryKeys.tasks.childAssignment(id) },
      ],
    },
    {
      name: 'balances',
      all: queryKeys.balances.all,
      keyFns: [
        { label: 'lists', fn: () => queryKeys.balances.lists() },
        { label: 'self', fn: () => queryKeys.balances.self() },
        { label: 'byChild', fn: (id: string) => queryKeys.balances.byChild(id) },
        { label: 'transactions', fn: (id: string) => queryKeys.balances.transactions(id) },
      ],
    },
    {
      name: 'children',
      all: queryKeys.children.all,
      keyFns: [
        { label: 'lists', fn: () => queryKeys.children.lists() },
        { label: 'detail', fn: (id: string) => queryKeys.children.detail(id) },
      ],
    },
    {
      name: 'prizes',
      all: queryKeys.prizes.all,
      keyFns: [
        { label: 'lists', fn: () => queryKeys.prizes.lists() },
        { label: 'detail', fn: (id: string) => queryKeys.prizes.detail(id) },
        { label: 'active', fn: () => queryKeys.prizes.active() },
        { label: 'pendingRedemptionCount', fn: () => queryKeys.prizes.pendingRedemptionCount() },
      ],
    },
    {
      name: 'redemptions',
      all: queryKeys.redemptions.all,
      keyFns: [
        { label: 'admin', fn: () => queryKeys.redemptions.admin() },
        { label: 'child', fn: () => queryKeys.redemptions.child() },
      ],
    },
    {
      name: 'profile',
      all: queryKeys.profile.all,
      keyFns: [
        { label: 'current', fn: () => queryKeys.profile.current() },
        { label: 'authUser', fn: () => queryKeys.profile.authUser() },
        { label: 'notificationPrefs', fn: () => queryKeys.profile.notificationPrefs() },
      ],
    },
    {
      name: 'family',
      all: queryKeys.family.all,
      keyFns: [{ label: 'detail', fn: (id: string) => queryKeys.family.detail(id) }],
    },
  ];

  for (const domain of domainConfigs) {
    for (const keyFn of domain.keyFns) {
      it(`${domain.name}.${keyFn.label} starts with ${domain.name}.all prefix`, () => {
        fc.assert(
          fc.property(fc.uuid(), (id) => {
            const key = keyFn.fn(id);
            const prefix = domain.all;
            for (let i = 0; i < prefix.length; i++) {
              expect(key[i]).toBe(prefix[i]);
            }
          }),
          { numRuns: 100 },
        );
      });
    }
  }
});

describe('STALE_TIMES', () => {
  it('has expected values per domain', () => {
    expect(STALE_TIMES.tasks).toBe(30_000);
    expect(STALE_TIMES.balances).toBe(10_000);
    expect(STALE_TIMES.profile).toBe(60_000);
    expect(STALE_TIMES.children).toBe(60_000);
    expect(STALE_TIMES.prizes).toBe(60_000);
    expect(STALE_TIMES.redemptions).toBe(60_000);
    expect(STALE_TIMES.family).toBe(60_000);
  });
});
