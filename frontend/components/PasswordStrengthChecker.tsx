// src/components/PasswordStrengthChecker.tsx
'use client';

// ── Rules match auth.validator.ts EXACTLY ────────────────────────────────────
export interface PasswordRule {
  id:    string;
  label: string;
  test:  (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id:    'minLength',
    label: 'At least 8 characters',
    test:  (p) => p.length >= 8,
  },
  {
    id:    'maxLength',
    label: 'No more than 128 characters',
    test:  (p) => p.length <= 128,
  },
  {
    id:    'uppercase',
    label: 'At least one uppercase letter (A–Z)',
    test:  (p) => /[A-Z]/.test(p),
  },
  {
    id:    'lowercase',
    label: 'At least one lowercase letter (a–z)',
    test:  (p) => /[a-z]/.test(p),
  },
  {
    id:    'number',
    label: 'At least one number (0–9)',
    test:  (p) => /[0-9]/.test(p),
  },
  {
    id:    'special',
    label: 'At least one special character (!@#$...)',
    test:  (p) => /[^A-Za-z0-9]/.test(p),
  },
  {
    id:    'noSpaces',
    label: 'No spaces',
    test:  (p) => !/\s/.test(p),
  },
];

/**
 * Returns true only if ALL rules pass — use this to gate form submission
 */
export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

/**
 * Password strength score 0–4
 */
export function getPasswordStrength(password: string): number {
  if (password.length === 0) return 0;
  const passed = PASSWORD_RULES.filter(r => r.test(password)).length;
  if (passed <= 2) return 1; // Weak
  if (passed <= 4) return 2; // Fair
  if (passed <= 5) return 3; // Good
  return 4;                  // Strong
}

const STRENGTH_CONFIG = [
  { label: '',       color: '#E5E7EB', bg: '#E5E7EB' },
  { label: 'Weak',   color: '#EF4444', bg: '#FEE2E2' },
  { label: 'Fair',   color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Good',   color: '#3B82F6', bg: '#DBEAFE' },
  { label: 'Strong', color: '#10B981', bg: '#D1FAE5' },
];

interface Props {
  password: string;
  show:     boolean; // only show when field has been touched
}

export default function PasswordStrengthChecker({ password, show }: Props) {
  if (!show) return null;

  const strength = getPasswordStrength(password);
  const config   = STRENGTH_CONFIG[strength];

  return (
    <div
      role="region"
      aria-label="Password requirements"
      style={{
        marginTop:    12,
        background:   '#FDFAF6',
        border:       '1px solid #EDE6DC',
        borderRadius: 6,
        padding:      '16px 18px',
        fontFamily:   "'Jost', sans-serif",
      }}
    >
      {/* Strength bar */}
      {password.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9E968E' }}>
              Password strength
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: config.color }}>
              {config.label}
            </span>
          </div>
          {/* 4 segment bar */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  flex:         1,
                  height:       4,
                  borderRadius: 2,
                  background:   i <= strength ? config.color : '#EDE6DC',
                  transition:   'background .3s',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9E968E', marginBottom: 10 }}>
        Requirements
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {PASSWORD_RULES.map(rule => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.id}
              style={{ display: 'flex', alignItems: 'center', gap: 9 }}
              aria-label={`${rule.label}: ${passed ? 'met' : 'not met'}`}
            >
              {/* Icon */}
              <span
                style={{
                  width:        18,
                  height:       18,
                  borderRadius: '50%',
                  flexShrink:   0,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  background:   passed ? '#D1FAE5' : '#F3F4F6',
                  border:       `1px solid ${passed ? '#6EE7B7' : '#E5E7EB'}`,
                  transition:   'all .2s',
                }}
              >
                {passed ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <circle cx="4" cy="4" r="3" stroke="#D1D5DB" strokeWidth="1.5"/>
                  </svg>
                )}
              </span>
              {/* Label */}
              <span style={{
                fontSize:   13,
                fontWeight: 300,
                color:      passed ? '#065F46' : '#6B7280',
                transition: 'color .2s',
              }}>
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
