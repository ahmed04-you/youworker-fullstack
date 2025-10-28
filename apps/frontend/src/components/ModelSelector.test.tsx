import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from './ModelSelector';

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange && onValueChange('gpt-4')}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <div data-testid="select-item" data-value={value} {...props}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className, ...props }: any) => (
    <div data-testid="select-trigger" className={className} {...props}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('ModelSelector', () => {
  const mockModels = [
    {
      value: 'gpt-4',
      label: 'GPT-4',
      description: 'Most capable model, best for complex tasks',
    },
    {
      value: 'gpt-3.5-turbo',
      label: 'GPT-3.5 Turbo',
      description: 'Fast and efficient for most tasks',
    },
    {
      value: 'claude-3',
      label: 'Claude 3',
      description: 'Advanced reasoning and analysis',
    },
  ];

  const mockOnValueChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with models', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select')).toBeInTheDocument();
  });

  it('should display all models as options', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const items = screen.getAllByTestId('select-item');
    expect(items).toHaveLength(mockModels.length);
  });

  it('should display model labels correctly', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument();
    expect(screen.getByText('Claude 3')).toBeInTheDocument();
  });

  it('should have correct data-value attributes', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const items = screen.getAllByTestId('select-item');
    expect(items[0]).toHaveAttribute('data-value', 'gpt-4');
    expect(items[1]).toHaveAttribute('data-value', 'gpt-3.5-turbo');
    expect(items[2]).toHaveAttribute('data-value', 'claude-3');
  });

  it('should display custom placeholder', () => {
    render(
      <ModelSelector
        models={mockModels}
        value=""
        onValueChange={mockOnValueChange}
        placeholder="Choose a model..."
      />
    );

    expect(screen.getByText('Choose a model...')).toBeInTheDocument();
  });

  it('should display default placeholder', () => {
    render(
      <ModelSelector
        models={mockModels}
        value=""
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByText('Select model...')).toBeInTheDocument();
  });

  it('should render tooltip', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('should display tooltip content with selected model description', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const tooltipContent = screen.getAllByTestId('tooltip-content');
    expect(tooltipContent.length).toBeGreaterThan(0);
    // The main tooltip should show the description
    expect(tooltipContent[0]).toHaveTextContent('Most capable model, best for complex tasks');
  });

  it('should display default tooltip when no model is selected', () => {
    render(
      <ModelSelector
        models={mockModels}
        value=""
        onValueChange={mockOnValueChange}
      />
    );

    const tooltipContent = screen.getAllByTestId('tooltip-content');
    expect(tooltipContent[0]).toHaveTextContent('Select the AI model for your conversation');
  });

  it('should handle model without description', () => {
    const modelsWithoutDesc = [
      { value: 'model-1', label: 'Model 1' },
    ];

    render(
      <ModelSelector
        models={modelsWithoutDesc}
        value="model-1"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByText('Model 1')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
        className="custom-width"
      />
    );

    const trigger = screen.getByTestId('select-trigger');
    expect(trigger).toHaveClass('custom-width');
  });

  it('should have default width class', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const trigger = screen.getByTestId('select-trigger');
    expect(trigger).toHaveClass('w-[200px]');
  });

  it('should combine default and custom classes', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
        className="custom-class"
      />
    );

    const trigger = screen.getByTestId('select-trigger');
    expect(trigger.className).toContain('w-[200px]');
    expect(trigger.className).toContain('custom-class');
  });

  it('should render with empty models array', () => {
    render(
      <ModelSelector
        models={[]}
        value=""
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select')).toBeInTheDocument();
    expect(screen.queryAllByTestId('select-item')).toHaveLength(0);
  });

  it('should handle value not in models list', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="non-existent-model"
        onValueChange={mockOnValueChange}
      />
    );

    const select = screen.getByTestId('select');
    expect(select).toHaveAttribute('data-value', 'non-existent-model');
  });

  it('should display tooltip for each model option', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const tooltips = screen.getAllByTestId('tooltip');
    // One for the main trigger, plus one for each model option
    expect(tooltips.length).toBeGreaterThan(mockModels.length);
  });

  it('should render model descriptions in option tooltips', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const tooltipContents = screen.getAllByTestId('tooltip-content');

    // Check that model descriptions appear in tooltips
    const hasGpt4Description = Array.from(tooltipContents).some(
      el => el.textContent?.includes('Most capable model')
    );
    expect(hasGpt4Description).toBe(true);
  });

  it('should call onValueChange when model is selected', async () => {
    const user = userEvent.setup();
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-3.5-turbo"
        onValueChange={mockOnValueChange}
      />
    );

    const select = screen.getByTestId('select');
    await user.click(select);

    await waitFor(() => {
      expect(mockOnValueChange).toHaveBeenCalledWith('gpt-4');
    });
  });

  it('should handle rapid model changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    const select = screen.getByTestId('select');

    // Simulate rapid changes
    await user.click(select);

    rerender(
      <ModelSelector
        models={mockModels}
        value="gpt-3.5-turbo"
        onValueChange={mockOnValueChange}
      />
    );

    await user.click(select);

    rerender(
      <ModelSelector
        models={mockModels}
        value="claude-3"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'claude-3');
  });

  it('should maintain selected value across re-renders', () => {
    const { rerender } = render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'gpt-4');

    rerender(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'gpt-4');
  });

  it('should handle models with special characters in labels', () => {
    const specialModels = [
      { value: 'model-1', label: 'Model (Latest)', description: 'Test model' },
      { value: 'model-2', label: 'Model & Co.', description: 'Another test' },
    ];

    render(
      <ModelSelector
        models={specialModels}
        value="model-1"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByText('Model (Latest)')).toBeInTheDocument();
    expect(screen.getByText('Model & Co.')).toBeInTheDocument();
  });

  it('should handle long model descriptions', () => {
    const longDescModels = [
      {
        value: 'model-1',
        label: 'Model 1',
        description: 'This is a very long description that explains all the features and capabilities of this particular model in great detail.',
      },
    ];

    render(
      <ModelSelector
        models={longDescModels}
        value="model-1"
        onValueChange={mockOnValueChange}
      />
    );

    const tooltipContents = screen.getAllByTestId('tooltip-content');
    const hasLongDesc = Array.from(tooltipContents).some(
      el => el.textContent?.includes('This is a very long description')
    );
    expect(hasLongDesc).toBe(true);
  });

  it('should render select trigger', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select-trigger')).toBeInTheDocument();
  });

  it('should render select content', () => {
    render(
      <ModelSelector
        models={mockModels}
        value="gpt-4"
        onValueChange={mockOnValueChange}
      />
    );

    expect(screen.getByTestId('select-content')).toBeInTheDocument();
  });
});
