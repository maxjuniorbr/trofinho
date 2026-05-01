import { describe, expect, it } from 'vitest';
import { validateFamilyCreation } from './onboarding-validation';

describe('validateFamilyCreation', () => {
  it('returns null when both fields are valid', () => {
    expect(validateFamilyCreation({ familyName: 'Silva', adminName: 'João' })).toBeNull();
  });

  it('returns error when familyName is empty', () => {
    expect(validateFamilyCreation({ familyName: '', adminName: 'João' })).toBe(
      'Informe o nome da família.',
    );
  });

  it('returns error when adminName is empty', () => {
    expect(validateFamilyCreation({ familyName: 'Silva', adminName: '' })).toBe(
      'Informe seu nome.',
    );
  });

  it('returns error for whitespace-only familyName', () => {
    expect(validateFamilyCreation({ familyName: '   ', adminName: 'João' })).toBe(
      'Informe o nome da família.',
    );
  });

  it('returns error for whitespace-only adminName', () => {
    expect(validateFamilyCreation({ familyName: 'Silva', adminName: '\t\n ' })).toBe(
      'Informe seu nome.',
    );
  });

  it('reports invalid familyName before invalid adminName', () => {
    expect(validateFamilyCreation({ familyName: '', adminName: '' })).toBe(
      'Informe o nome da família.',
    );
    expect(validateFamilyCreation({ familyName: '  ', adminName: '  ' })).toBe(
      'Informe o nome da família.',
    );
  });
});
