/**
 * Pure validation for the family-creation step of admin onboarding.
 *
 * Extracted from `app/(auth)/onboarding.tsx` so it can be unit-tested and
 * property-tested without rendering React components.
 */

export interface FamilyCreationInput {
  familyName: string;
  adminName: string;
}

/**
 * Validates the family-creation form fields.
 *
 * - Rejects empty strings or strings composed only of whitespace.
 * - Returns the first validation error found (familyName checked first).
 * - Returns `null` when both fields are valid.
 */
export function validateFamilyCreation({ familyName, adminName }: FamilyCreationInput): string | null {
  if (!familyName.trim()) return 'Informe o nome da família.';
  if (!adminName.trim()) return 'Informe seu nome.';
  return null;
}
