import { PASSWORD_RULES, isPasswordValid, getPasswordStrength } from './PasswordStrengthChecker';

// These rules are deliberately duplicated from
// backend/src/validators/auth.validator.ts's registerSchema — one copy runs
// in the browser for live feedback, one runs in the Zod schema as the real
// gate. If the two ever drift apart, the UI could show "all requirements
// met" for a password the server then rejects, or vice versa. This suite
// pins both the rule set and the strength thresholds so that drift shows up
// here first.

describe('isPasswordValid', () => {
  it('rejects a password shorter than 8 characters', () => {
    expect(isPasswordValid('Ab1!')).toBe(false);
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(isPasswordValid('lowercase1!')).toBe(false);
  });

  it('rejects a password missing a lowercase letter', () => {
    expect(isPasswordValid('UPPERCASE1!')).toBe(false);
  });

  it('rejects a password missing a number', () => {
    expect(isPasswordValid('NoNumbers!')).toBe(false);
  });

  it('rejects a password missing a special character', () => {
    expect(isPasswordValid('NoSpecial1')).toBe(false);
  });

  it('rejects a password containing a space', () => {
    expect(isPasswordValid('Has Space1!')).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    const tooLong = 'Aa1!' + 'a'.repeat(126); // 130 chars total
    expect(tooLong.length).toBeGreaterThan(128);
    expect(isPasswordValid(tooLong)).toBe(false);
  });

  it('accepts a password that satisfies every rule', () => {
    expect(isPasswordValid('TestPass123!')).toBe(true);
  });

  it('exposes exactly the 7 rules the backend validator enforces', () => {
    expect(PASSWORD_RULES.map(r => r.id).sort()).toEqual(
      ['lowercase', 'maxLength', 'minLength', 'noSpaces', 'number', 'special', 'uppercase'].sort()
    );
  });
});

describe('getPasswordStrength', () => {
  it('returns 0 for an empty password', () => {
    expect(getPasswordStrength('')).toBe(0);
  });

  it('returns 1 (Weak) for a password that only trivially passes maxLength/special', () => {
    // A single space: fails minLength, uppercase, lowercase, number, and
    // noSpaces — but a space itself matches the "special character" rule,
    // and trivially satisfies maxLength. That's 2 of 7 rules passing,
    // which is the Weak boundary (<=2).
    expect(getPasswordStrength(' ')).toBe(1);
  });

  it('returns 2 (Fair) when 3–4 rules pass', () => {
    // 'testpass': minLength, maxLength, lowercase, noSpaces pass (4) —
    // no uppercase, number, or special character.
    expect(getPasswordStrength('testpass')).toBe(2);
  });

  it('returns 3 (Good) when exactly 5 rules pass', () => {
    // 'testpass123': adds "number" to the Fair example above (5 total) —
    // still missing uppercase and a special character.
    expect(getPasswordStrength('testpass123')).toBe(3);
  });

  it('returns 4 (Strong) when every rule passes', () => {
    expect(getPasswordStrength('TestPass123!')).toBe(4);
  });
});
