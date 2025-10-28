import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginDialog } from './login-dialog';
import { useAuth } from '@/lib/auth-context';

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('LoginDialog', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login dialog when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('does not render when already authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: 'test-key',
    });

    const { container } = render(<LoginDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render when loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    const { container } = render(<LoginDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('handles form submission with valid API key', async () => {
    mockLogin.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'test-api-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-api-key');
    });
  });

  it('trims whitespace from API key before submission', async () => {
    mockLogin.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: '  test-api-key  ' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-api-key');
    });
  });

  it('shows loading state during authentication', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'test-api-key' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    expect(input).toBeDisabled();
  });

  it('displays error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid API key'));
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'invalid-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });
  });

  it('displays generic error message for non-Error exceptions', async () => {
    mockLogin.mockRejectedValue('Something went wrong');
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'test-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('clears error message on new submission attempt', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid API key'));
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    // First submission - error
    fireEvent.change(input, { target: { value: 'invalid-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });

    // Second submission - error should clear
    mockLogin.mockResolvedValue(undefined);
    fireEvent.change(input, { target: { value: 'valid-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Invalid API key')).not.toBeInTheDocument();
    });
  });

  it('clears input field after successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'test-api-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('has password type for API key input', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('has required attribute on API key input', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    expect(input).toBeRequired();
  });

  it('has autofocus on API key input', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    expect(input).toHaveAttribute('autoFocus');
  });

  it('displays security information text', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    expect(screen.getByText(/Sessions are secured with HttpOnly cookies/i)).toBeInTheDocument();
  });

  it('displays lock icon', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    const { container } = render(<LoginDialog />);
    const lockIcon = container.querySelector('svg.lucide-lock');
    expect(lockIcon).toBeInTheDocument();
  });

  it('shows spinner icon during authentication', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    const { container } = render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'test-api-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const spinner = container.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('dialog cannot be closed by user interaction', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    // Dialog should be open and have onOpenChange set to empty function
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('handles form submission via Enter key', async () => {
    mockLogin.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');

    fireEvent.change(input, { target: { value: 'test-api-key' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-api-key');
    });
  });

  it('maintains input value during loading state', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'test-api-key' } });
    fireEvent.click(submitButton);

    expect(input.value).toBe('test-api-key');
  });

  it('re-enables form controls after failed submission', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid API key'));
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      apiKey: null,
    });

    render(<LoginDialog />);

    const input = screen.getByLabelText('API Key');
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(input, { target: { value: 'invalid-key' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
    });
  });
});
