import { describe, it, expect } from 'bun:test';
import { matchesPatternSpec } from '../src/backend/core/ExcludeService';

describe('Exclude Service Pattern Matching', () => {
  it('matches prefix patterns with star suffix', () => {
    expect(matchesPatternSpec('Archive*', 'Archive')).toBe(true);
    expect(matchesPatternSpec('Archive*', 'Archive_2024')).toBe(true);
    expect(matchesPatternSpec('Archive*', 'OldArchive')).toBe(false);
  });

  it('matches suffix patterns with star prefix', () => {
    expect(matchesPatternSpec('*Temp', 'Temp')).toBe(true);
    expect(matchesPatternSpec('*Temp', 'Project_Temp')).toBe(true);
    expect(matchesPatternSpec('*Temp', 'Temp_Project')).toBe(false);
  });

  it('matches contains patterns with star prefix and suffix', () => {
    expect(matchesPatternSpec('*Draft*', 'Draft')).toBe(true);
    expect(matchesPatternSpec('*Draft*', 'Project_Draft_v1')).toBe(true);
    expect(matchesPatternSpec('*Draft*', 'Published')).toBe(false);
  });

  it('matches regex patterns starting with {regex}', () => {
    expect(matchesPatternSpec('{regex}^[0-9]{4}-[0-9]{2}$', '2026-09')).toBe(true);
    expect(matchesPatternSpec('{regex}^[0-9]{4}-[0-9]{2}$', 'September-2026')).toBe(false);
  });

  it('handles invalid or empty regex gracefully', () => {
    expect(matchesPatternSpec('{regex}[invalid(', 'test')).toBe(false);
    expect(matchesPatternSpec('{regex}', 'test')).toBe(false);
    expect(matchesPatternSpec('', 'test')).toBe(false);
    expect(matchesPatternSpec(undefined, 'test')).toBe(false);
  });
});
