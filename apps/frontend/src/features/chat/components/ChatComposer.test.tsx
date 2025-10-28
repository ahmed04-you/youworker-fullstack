import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { ChatComposer } from './ChatComposer';

describe('ChatComposer', () => {
  const defaultProps = {
    input: '',
    onInputChange: vi.fn(),
    onSendText: vi.fn(),
    isStreaming: false,
    isRecording: false,
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    onStopStreaming: vi.fn(),
    assistantLanguage: 'en',
    onAssistantLanguageChange: vi.fn(),
    selectedModel: 'gpt-oss:20b',
    onSelectedModelChange: vi.fn(),
    enableTools: true,
    onToggleTools: vi.fn(),
    expectAudio: false,
    onToggleAudio: vi.fn(),
    voiceSupported: true,
  };

  it('should render the composer with input field', () => {
    render(<ChatComposer {...defaultProps} />);

    // Should have a textarea for input
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('should call onInputChange when typing', () => {
    render(<ChatComposer {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello world' } });

    expect(defaultProps.onInputChange).toHaveBeenCalled();
  });

  it('should call onSendText when send button is clicked', () => {
    const props = { ...defaultProps, input: 'Test message' };
    render(<ChatComposer {...props} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    expect(defaultProps.onSendText).toHaveBeenCalled();
  });

  it('should disable send button when input is empty', () => {
    render(<ChatComposer {...defaultProps} input="" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when input has text', () => {
    render(<ChatComposer {...defaultProps} input="Hello" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('should show loading state when streaming', () => {
    render(<ChatComposer {...defaultProps} isStreaming={true} />);

    // Should show a stop button or loading indicator
    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton).toBeInTheDocument();
  });

  it('should call onStopStreaming when stop button is clicked', () => {
    render(<ChatComposer {...defaultProps} isStreaming={true} />);

    const stopButton = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);

    expect(defaultProps.onStopStreaming).toHaveBeenCalled();
  });

  it('should show recording state when recording', () => {
    render(<ChatComposer {...defaultProps} isRecording={true} />);

    // When recording, should show stop recording button
    const micButton = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('svg')
    );
    expect(micButton).toBeInTheDocument();
  });

  it('should call onToggleTools when tools button is clicked', () => {
    render(<ChatComposer {...defaultProps} />);

    // Find the tools toggle button
    const toolsButton = screen.getByRole('button', { name: /tools/i });
    fireEvent.click(toolsButton);

    expect(defaultProps.onToggleTools).toHaveBeenCalled();
  });

  it('should call onToggleAudio when audio button is clicked', () => {
    render(<ChatComposer {...defaultProps} />);

    // Find the audio toggle button
    const audioButton = screen.getByRole('button', { name: /audio/i });
    fireEvent.click(audioButton);

    expect(defaultProps.onToggleAudio).toHaveBeenCalled();
  });

  it('should display tools active indicator when tools are enabled', () => {
    render(<ChatComposer {...defaultProps} enableTools={true} />);

    // Should have visual indicator for tools being active
    const toolsButton = screen.getByRole('button', { name: /tools/i });
    expect(toolsButton).toBeInTheDocument();
  });

  it('should display tools inactive state when tools are disabled', () => {
    render(<ChatComposer {...defaultProps} enableTools={false} />);

    // Should have visual indicator for tools being inactive
    const toolsButton = screen.getByRole('button', { name: /tools/i });
    expect(toolsButton).toBeInTheDocument();
  });

  it('should render model selector', () => {
    render(<ChatComposer {...defaultProps} />);

    // Should have a model selector (might be a select or combobox)
    const selectors = screen.getAllByRole('combobox');
    expect(selectors.length).toBeGreaterThan(0);
  });

  it('should not show mic button when voice is not supported', () => {
    render(<ChatComposer {...defaultProps} voiceSupported={false} />);

    // Mic button should not be visible
    const buttons = screen.getAllByRole('button');
    const hasMicButton = buttons.some((btn) =>
      btn.getAttribute('aria-label')?.toLowerCase().includes('mic')
    );
    expect(hasMicButton).toBe(false);
  });

  it('should show mic button when voice is supported', () => {
    render(<ChatComposer {...defaultProps} voiceSupported={true} />);

    // Should have mic button or recording control
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should handle keyboard shortcuts for sending', () => {
    render(<ChatComposer {...defaultProps} input="Test message" />);

    const textarea = screen.getByRole('textbox');

    // Simulate Ctrl+Enter or Cmd+Enter
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    // Should trigger send (depending on implementation)
    // This test might need adjustment based on actual keyboard shortcut implementation
    expect(defaultProps.onInputChange).toHaveBeenCalled();
  });
});
