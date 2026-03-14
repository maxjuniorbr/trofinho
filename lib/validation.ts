const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9-]+$/;

export const MAX_EMAIL_LENGTH = 254;

export function isValidEmail(email: string): boolean {
  const value = email.trim();

  if (!value || value.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  const parts = value.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain || localPart.length > 64) {
    return false;
  }

  if (!LOCAL_PART_PATTERN.test(localPart)) {
    return false;
  }

  if (
    !domain.includes('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..')
  ) {
    return false;
  }

  return domain.split('.').every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      DOMAIN_LABEL_PATTERN.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
    );
  });
}
