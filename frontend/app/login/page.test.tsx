import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// LoginPage pulls in three things that don't work as-is under Jest/jsdom:
// AuthContext (real one hits a live api client), next/navigation's router
// (needs an App Router context LoginPage doesn't provide in isolation), and
// next/image (throws off unrelated warnings for a decorative slideshow this
// suite doesn't care about). All three are mocked so the test targets only
// what this page is actually responsible for: taking email/password, calling
// login(), and reacting to success/failure.

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
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

const mockUseAuth   = useAuth as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('<LoginPage />', () => {
  let mockLogin: jest.Mock;
  let mockPush: jest.Mock;

  beforeEach(() => {
    mockLogin = jest.fn();
    mockPush  = jest.fn();

    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });

    mockUseRouter.mockReturnValue({ push: mockPush });
  });

  it('renders the email field, password field, and submit button', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('toggles the password field between hidden and visible text', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput.type).toBe('text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput.type).toBe('password');
  });

  it('logs in with the entered credentials and redirects home on success', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'CorrectHorse123!');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'CorrectHorse123!');
    });
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows the error message and does not redirect when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPassword1!');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables the submit button and shows a loading label while the request is in flight', async () => {
    let resolveLogin: () => void;
    mockLogin.mockReturnValue(new Promise<void>(resolve => { resolveLogin = resolve; }));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'CorrectHorse123!');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    const pendingButton = await screen.findByRole('button', { name: 'Signing in...' });
    expect(pendingButton).toBeDisabled();

    resolveLogin!();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });
});
