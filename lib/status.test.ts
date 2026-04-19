import { describe, expect, it } from 'vitest';
import {
  getAssignmentStatusLabel,
  getAssignmentStatusColor,
  getAssignmentStatusTone,
  getRedemptionStatusLabel,
  getRedemptionStatusColor,
} from './status';

const mockColors = {
  semantic: {
    success: '#00C853',
    successBg: '#E8F5E9',
    error: '#FF1744',
    errorBg: '#FFEBEE',
    warning: '#FFB300',
    warningBg: '#FFF8E1',
    info: '#2979FF',
    infoBg: '#E3F2FD',
    successText: '#1B5E20',
    errorText: '#B71C1C',
    warningText: '#E65100',
    infoText: '#0D47A1',
  },
} as const;

describe('getAssignmentStatusLabel', () => {
  it.each([
    ['pendente', 'Pendente'],
    ['aguardando_validacao', 'Aguardando validação'],
    ['aprovada', 'Aprovada'],
    ['rejeitada', 'Rejeitada'],
  ] as const)('returns %s for status %s', (status, expected) => {
    expect(getAssignmentStatusLabel(status)).toBe(expected);
  });
});

describe('getAssignmentStatusColor', () => {
  it.each([
    ['pendente', '#FFB300'],
    ['aguardando_validacao', '#2979FF'],
    ['aprovada', '#00C853'],
    ['rejeitada', '#FF1744'],
  ] as const)('returns correct color for %s', (status, expected) => {
    expect(getAssignmentStatusColor(status, mockColors)).toBe(expected);
  });
});

describe('getAssignmentStatusTone', () => {
  it.each([
    ['pendente', { foreground: '#FFB300', background: '#FFF8E1', text: '#E65100' }],
    ['aguardando_validacao', { foreground: '#2979FF', background: '#E3F2FD', text: '#0D47A1' }],
    ['aprovada', { foreground: '#00C853', background: '#E8F5E9', text: '#1B5E20' }],
    ['rejeitada', { foreground: '#FF1744', background: '#FFEBEE', text: '#B71C1C' }],
  ] as const)('returns semantic tone for %s', (status, expected) => {
    expect(getAssignmentStatusTone(status, mockColors)).toEqual(expected);
  });
});

describe('getRedemptionStatusLabel', () => {
  it.each([
    ['pendente', 'Pendente'],
    ['confirmado', 'Confirmado'],
    ['cancelado', 'Cancelado'],
  ] as const)('returns %s for status %s', (status, expected) => {
    expect(getRedemptionStatusLabel(status)).toBe(expected);
  });
});

describe('getRedemptionStatusColor', () => {
  it.each([
    ['pendente', '#FFB300'],
    ['confirmado', '#00C853'],
    ['cancelado', '#FF1744'],
  ] as const)('returns correct color for %s', (status, expected) => {
    expect(getRedemptionStatusColor(status, mockColors)).toBe(expected);
  });
});
