/**
 * Edge case tests for LoginDialog component
 * Covers: session expiry, network errors, malformed inputs, security scenarios
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginDialog } from './login-dialog';
import { useAuth } from '@/lib/auth-context';

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('LoginDialog - Edge Cases', () => {
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Expiry', () => {
    it('should handle session expiry and prompt for re-authentication', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    });

    it('should handle sudden logout during interaction', async () => {
      const { rerender } = render(<LoginDialog />);

      // Initially authenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: 'valid-key',
      });

      rerender(<LoginDialog />);

      // Simulate session expiry
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      rerender(<LoginDialog />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      });
    });

    it('should clear any in-progress operations on session expiry', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {})); // Never resolves
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      const { rerender } = render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      // Simulate session change during authentication
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: 'new-key',
      });

      rerender(<LoginDialog />);

      // Dialog should close when authenticated
      const container = document.body;
      await waitFor(() => {
        expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      });
    });
  });

  describe('Network Errors', () => {
    it('should handle network timeout', async () => {
      mockLogin.mockRejectedValue(new Error('Network request timed out'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network request timed out')).toBeInTheDocument();
      });
    });

    it('should handle connection refused error', async () => {
      mockLogin.mockRejectedValue(new Error('Connection refused'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Connection refused')).toBeInTheDocument();
      });
    });

    it('should handle CORS errors gracefully', async () => {
      mockLogin.mockRejectedValue(new Error('CORS policy blocked'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('CORS policy blocked')).toBeInTheDocument();
      });
    });

    it('should handle offline scenario', async () => {
      mockLogin.mockRejectedValue(new Error('Failed to fetch'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      });
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle empty API key submission', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const submitButton = screen.getByRole('button', { name: /login/i });
      fireEvent.click(submitButton);

      // Form validation should prevent submission
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle API key with only whitespace', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: '    ' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should trim and result in empty string
        expect(mockLogin).toHaveBeenCalledWith('');
      });
    });

    it('should handle very long API keys', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });
      const longKey = 'x'.repeat(1000);

      fireEvent.change(input, { target: { value: longKey } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(longKey);
      });
    });

    it('should handle API keys with special characters', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });
      const specialKey = 'key-with-!@#$%^&*()_+={}[]|\\:;"<>?,./~`';

      fireEvent.change(input, { target: { value: specialKey } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(specialKey);
      });
    });

    it('should handle API keys with unicode characters', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });
      const unicodeKey = 'key-with-émojis-🔑-中文';

      fireEvent.change(input, { target: { value: unicodeKey } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(unicodeKey);
      });
    });

    it('should handle newlines and tabs in API key', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'key\nwith\ttabs\rand\nnewlines' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should preserve internal whitespace but trim edges
        expect(mockLogin).toHaveBeenCalledWith('key\nwith\ttabs\rand\nnewlines');
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle rate limit error', async () => {
      mockLogin.mockRejectedValue(new Error('Too many requests. Please try again later.'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Too many requests/i)).toBeInTheDocument();
      });
    });

    it('should handle multiple rapid login attempts', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });

      // Try to submit multiple times rapidly
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      // Should only call login once due to disabled state during loading
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle unauthorized error (401)', async () => {
      mockLogin.mockRejectedValue(new Error('Unauthorized'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'invalid-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should handle forbidden error (403)', async () => {
      mockLogin.mockRejectedValue(new Error('Forbidden: Account suspended'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'suspended-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Forbidden: Account suspended/i)).toBeInTheDocument();
      });
    });
  });

  describe('Server Errors', () => {
    it('should handle 500 Internal Server Error', async () => {
      mockLogin.mockRejectedValue(new Error('Internal Server Error'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
      });
    });

    it('should handle 503 Service Unavailable', async () => {
      mockLogin.mockRejectedValue(new Error('Service temporarily unavailable'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Service temporarily unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle malformed server response', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid response format'));
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      fireEvent.change(input, { target: { value: 'test-api-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid response format')).toBeInTheDocument();
      });
    });
  });

  describe('Browser Edge Cases', () => {
    it('should work with autofill/password managers', async () => {
      mockLogin.mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      render(<LoginDialog />);

      const input = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: /login/i });

      // Simulate autofill
      Object.defineProperty(input, 'value', {
        writable: true,
        value: 'autofilled-key',
      });

      fireEvent.change(input, { target: { value: 'autofilled-key' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('autofilled-key');
      });
    });

    it('should handle rapid component mount/unmount', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      const { unmount, rerender } = render(<LoginDialog />);
      unmount();

      const { unmount: unmount2 } = render(<LoginDialog />);
      unmount2();

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should preserve input during re-renders', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
        apiKey: null,
      });

      const { rerender } = render(<LoginDialog />);

      const input = screen.getByLabelText('API Key') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test-key' } });

      expect(input.value).toBe('test-key');

      rerender(<LoginDialog />);

      const inputAfterRerender = screen.getByLabelText('API Key') as HTMLInputElement;
      expect(inputAfterRerender.value).toBe('test-key');
    });
  });
});
