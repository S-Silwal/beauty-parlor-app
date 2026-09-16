import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './page';
import { api } from '@/lib/api';

// RegisterPage calls api.register() directly rather than going through
// AuthContext (unlike LoginPage) — see the comment in AuthContext.tsx: a
// fresh registration is never auto-logged-in because the backend requires
// email verification first. So here we mock the api client itself, plus
// next/image and next/link for the same reasons as the login page tests.

jest.mock('@/lib/api', () => ({
  api: { register: jest.fn() },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockRegister = api.register as jest.Mock;

describe('<RegisterPage />', () => {
  beforeEach(() => {
    mockRegister.mockReset();
  });

  it('renders the name, email, phone, and password fields plus the submit button', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('auto-formats the phone number as digits are typed', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement;
    await user.type(phoneInput, '3175550187');

    expect(phoneInput.value).toBe('(317) 555-0187');
  });

  it('flags a reserved area code once the phone field has been touched', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/phone number/i), '9115550187');

    expect(screen.getByText('Invalid area code')).toBeInTheDocument();
  });

  it('confirms a valid phone number once entered', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/phone number/i), '3175550187');

    expect(screen.getByText('✓ Valid US phone number')).toBeInTheDocument();
  });

  it('disables submit while the password fails requirements and enables it once valid', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    const passwordInput = screen.getByLabelText('Password');

    await user.type(passwordInput, 'weak');
    expect(submitButton).toBeDisabled();

    await user.clear(passwordInput);
    await user.type(passwordInput, 'TestPass123!');
    expect(submitButton).not.toBeDisabled();
  });

  it('shows a password error and blocks submission when the form is submitted with an empty password', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    // Password field is never focused/touched here, so the disabled-button
    // gate doesn't kick in — this exercises handleSubmit's own defensive
    // check, which is the only thing standing between an empty password and
    // a network call in that scenario.
    await user.type(screen.getByLabelText('Full Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please meet all password requirements below.'
    );
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers successfully and shows the check-your-email confirmation', async () => {
    mockRegister.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText('Full Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'TestPass123!');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Jane Doe', 'jane@example.com', 'TestPass123!', undefined);
    });
    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('passes the stripped phone digits through to api.register when a phone number is provided', async () => {
    mockRegister.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText('Full Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '3175550187');
    await user.type(screen.getByLabelText('Password'), 'TestPass123!');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Jane Doe', 'jane@example.com', 'TestPass123!', '3175550187');
    });
  });

  it('shows the server error message when registration fails', async () => {
    mockRegister.mockResolvedValueOnce({ success: false, message: 'Email already exists' });
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText('Full Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'TestPass123!');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already exists');
  });
});
