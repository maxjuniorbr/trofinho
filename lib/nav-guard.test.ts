import { describe, expect, it } from 'vitest';
import { resolveNavDecision } from './nav-guard';
import type { UserProfile } from './auth';

const admin: UserProfile = {
  id: 'u1',
  familia_id: 'fam-1',
  papel: 'admin',
  nome: 'Max',
  avatarUrl: null,
};

const filho: UserProfile = {
  id: 'u2',
  familia_id: 'fam-1',
  papel: 'filho',
  nome: 'Ana',
  avatarUrl: null,
};

const noFamily: UserProfile = {
  id: 'u3',
  familia_id: '',
  papel: 'admin',
  nome: 'New',
  avatarUrl: null,
};

describe('resolveNavDecision', () => {
  describe('when not ready', () => {
    it('returns null regardless of profile or segments', () => {
      expect(resolveNavDecision(false, null, [])).toBeNull();
      expect(resolveNavDecision(false, admin, ['(admin)'])).toBeNull();
      expect(resolveNavDecision(false, undefined, [])).toBeNull();
    });
  });

  describe('when profile is undefined (loading)', () => {
    it('returns null — wait for profile resolution', () => {
      expect(resolveNavDecision(true, undefined, ['(admin)'])).toBeNull();
      expect(resolveNavDecision(true, undefined, [])).toBeNull();
    });
  });

  describe('when profile is null (signed out)', () => {
    it('redirects to login when not already in auth group', () => {
      expect(resolveNavDecision(true, null, ['(admin)'])).toBe('/(auth)/login');
      expect(resolveNavDecision(true, null, ['(child)'])).toBe('/(auth)/login');
      expect(resolveNavDecision(true, null, [])).toBe('/(auth)/login');
    });

    it('returns null when already in auth group (login or register)', () => {
      expect(resolveNavDecision(true, null, ['(auth)', 'login'])).toBeNull();
      expect(resolveNavDecision(true, null, ['(auth)', 'register'])).toBeNull();
    });

    it('returns null when signed out on onboarding (screen handles own exit)', () => {
      expect(resolveNavDecision(true, null, ['(auth)', 'onboarding'])).toBeNull();
    });
  });

  describe('when profile has no familia_id (onboarding)', () => {
    it('redirects to onboarding when not already there', () => {
      expect(resolveNavDecision(true, noFamily, ['(auth)', 'login'])).toBe('/(auth)/onboarding');
      expect(resolveNavDecision(true, noFamily, ['(admin)'])).toBe('/(auth)/onboarding');
      expect(resolveNavDecision(true, noFamily, [])).toBe('/(auth)/onboarding');
    });

    it('returns null when already on onboarding screen', () => {
      expect(resolveNavDecision(true, noFamily, ['(auth)', 'onboarding'])).toBeNull();
    });

    it('returns null when on register screen (mid-flow to onboarding)', () => {
      expect(resolveNavDecision(true, noFamily, ['(auth)', 'register'])).toBeNull();
    });

    it('returns null when on join-family screen (accepting invite code)', () => {
      expect(resolveNavDecision(true, noFamily, ['(auth)', 'join-family'])).toBeNull();
    });
  });

  describe('when authenticated admin user', () => {
    it('redirects to admin home when in auth group', () => {
      expect(resolveNavDecision(true, admin, ['(auth)', 'login'])).toBe('/(admin)/');
    });

    it('returns null when already in admin group', () => {
      expect(resolveNavDecision(true, admin, ['(admin)'])).toBeNull();
      expect(resolveNavDecision(true, admin, ['(admin)', 'tasks'])).toBeNull();
    });

    it('redirects to admin home when in child group (role mismatch)', () => {
      expect(resolveNavDecision(true, admin, ['(child)'])).toBe('/(admin)/');
    });

    it('redirects to admin home when on blank index route', () => {
      expect(resolveNavDecision(true, admin, [])).toBe('/(admin)/');
      expect(resolveNavDecision(true, admin, ['index'])).toBe('/(admin)/');
    });
  });

  describe('impersonation mode (admin viewing child screens)', () => {
    it('allows admin in child group when isImpersonating is true', () => {
      expect(resolveNavDecision(true, admin, ['(child)'], true)).toBeNull();
      expect(resolveNavDecision(true, admin, ['(child)', 'tasks'], true)).toBeNull();
      expect(resolveNavDecision(true, admin, ['(child)', 'balance'], true)).toBeNull();
    });

    it('redirects admin from child group when isImpersonating is false (default)', () => {
      expect(resolveNavDecision(true, admin, ['(child)'])).toBe('/(admin)/');
      expect(resolveNavDecision(true, admin, ['(child)', 'tasks'], false)).toBe('/(admin)/');
    });

    it('does not affect filho users — they access child group regardless of flag', () => {
      expect(resolveNavDecision(true, filho, ['(child)'], true)).toBeNull();
      expect(resolveNavDecision(true, filho, ['(child)'], false)).toBeNull();
    });

    it('does not allow filho to access admin group even with isImpersonating', () => {
      expect(resolveNavDecision(true, filho, ['(admin)'], true)).toBe('/(child)/');
    });
  });

  describe('when authenticated filho user', () => {
    it('redirects to child home when in auth group', () => {
      expect(resolveNavDecision(true, filho, ['(auth)', 'login'])).toBe('/(child)/');
    });

    it('returns null when already in child group', () => {
      expect(resolveNavDecision(true, filho, ['(child)'])).toBeNull();
      expect(resolveNavDecision(true, filho, ['(child)', 'tasks'])).toBeNull();
    });

    it('redirects to child home when in admin group (role mismatch)', () => {
      expect(resolveNavDecision(true, filho, ['(admin)'])).toBe('/(child)/');
    });

    it('redirects to child home when on blank index route', () => {
      expect(resolveNavDecision(true, filho, [])).toBe('/(child)/');
    });
  });
});
