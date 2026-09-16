import { render, screen } from '@testing-library/react';
import PasswordStrengthChecker from './PasswordStrengthChecker';

// Unlike PasswordStrengthChecker.test.ts (which pins the pure isPasswordValid /
// getPasswordStrength logic), this suite renders the actual component to
// catch regressions in what the USER sees: does the right label show, do the
// right requirement rows flip to "met", does the component hide itself when
// it's supposed to. The two suites are deliberately complementary, not
// overlapping — logic bugs surface in the .test.ts file, wiring/render bugs
// surface here.

describe('<PasswordStrengthChecker />', () => {
  it('renders nothing when show is false', () => {
    render(<PasswordStrengthChecker password="anything" show={false} />);
    expect(screen.queryByRole('region', { name: 'Password requirements' })).not.toBeInTheDocument();
  });

  it('renders the requirements checklist when show is true', () => {
    render(<PasswordStrengthChecker password="" show={true} />);
    expect(screen.getByRole('region', { name: 'Password requirements' })).toBeInTheDocument();
  });

  it('hides the strength bar entirely for an empty password', () => {
    render(<PasswordStrengthChecker password="" show={true} />);
    // The strength bar + label only render when password.length > 0.
    expect(screen.queryByText('Password strength')).not.toBeInTheDocument();
  });

  it('marks only maxLength and noSpaces as met for an empty password', () => {
    render(<PasswordStrengthChecker password="" show={true} />);
    // An empty string trivially satisfies "<=128 chars" and "no spaces",
    // but fails minLength, uppercase, lowercase, number, and special.
    expect(screen.getByLabelText('No more than 128 characters: met')).toBeInTheDocument();
    expect(screen.getByLabelText('No spaces: met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least 8 characters: not met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one uppercase letter (A–Z): not met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one lowercase letter (a–z): not met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one number (0–9): not met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one special character (!@#$...): not met')).toBeInTheDocument();
  });

  it('shows the Weak label for a password that only passes 2 rules', () => {
    // A single space: passes maxLength + special (a space matches the
    // special-character regex), fails everything else — 2 of 7 rules,
    // which is the Weak boundary.
    render(<PasswordStrengthChecker password=" " show={true} />);
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('shows the Strong label and marks every requirement met for a fully valid password', () => {
    render(<PasswordStrengthChecker password="TestPass123!" show={true} />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByLabelText('At least 8 characters: met')).toBeInTheDocument();
    expect(screen.getByLabelText('No more than 128 characters: met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one uppercase letter (A–Z): met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one lowercase letter (a–z): met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one number (0–9): met')).toBeInTheDocument();
    expect(screen.getByLabelText('At least one special character (!@#$...): met')).toBeInTheDocument();
    expect(screen.getByLabelText('No spaces: met')).toBeInTheDocument();
  });

  it('updates the strength label as the password improves', () => {
    const { rerender } = render(<PasswordStrengthChecker password="testpass" show={true} />);
    expect(screen.getByText('Fair')).toBeInTheDocument(); // 4 of 7 rules

    rerender(<PasswordStrengthChecker password="testpass123" show={true} />);
    expect(screen.getByText('Good')).toBeInTheDocument(); // 5 of 7 rules
  });
});
