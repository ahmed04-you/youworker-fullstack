import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from './ExportButton';

// Mock toast helpers
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/toast-helpers', () => ({
  toastSuccess: (message: string) => mockToastSuccess(message),
  toastError: (message: string) => mockToastError(message),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: any) => (
    <button data-testid="dropdown-item" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
}));

describe('ExportButton', () => {
  let createObjectURLSpy: any;
  let revokeObjectURLSpy: any;
  let createElementSpy: any;
  let appendChildSpy: any;
  let removeChildSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock URL.createObjectURL and revokeObjectURL
    createObjectURLSpy = vi.fn(() => 'blob:mock-url');
    revokeObjectURLSpy = vi.fn();
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    // Mock document methods
    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      href: '',
      download: '',
    } as any);

    document.body.appendChild = appendChildSpy;
    document.body.removeChild = removeChildSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockData = {
    name: 'Test Item',
    value: 42,
    description: 'Test description',
  };

  const mockArrayData = [
    { id: 1, name: 'Item 1', count: 10 },
    { id: 2, name: 'Item 2', count: 20 },
  ];

  it('should render export button', () => {
    render(<ExportButton data={mockData} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should render with custom filename prop', () => {
    render(<ExportButton data={mockData} filename="custom-export" />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    render(<ExportButton data={mockData} className="custom-class" />);
    const button = screen.getByText('Export');
    expect(button).toHaveClass('custom-class');
  });

  it('should show tooltip', () => {
    render(<ExportButton data={mockData} />);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('should display dropdown menu', () => {
    render(<ExportButton data={mockData} />);
    expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
  });

  it('should render all format options by default', () => {
    render(<ExportButton data={mockData} />);
    const items = screen.getAllByTestId('dropdown-item');
    expect(items).toHaveLength(3); // JSON, CSV, TXT
  });

  it('should render only specified formats', () => {
    render(<ExportButton data={mockData} formats={['json', 'csv']} />);
    const items = screen.getAllByTestId('dropdown-item');
    expect(items).toHaveLength(2);
  });

  it('should render only JSON format when specified', () => {
    render(<ExportButton data={mockData} formats={['json']} />);
    const items = screen.getAllByTestId('dropdown-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Export as JSON');
  });

  it('should export as JSON when JSON option is clicked', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} filename="test-export" />);

    const jsonItem = screen.getAllByTestId('dropdown-item')[0]; // First item is JSON
    await user.click(jsonItem);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as JSON');
    });
  });

  it('should export as CSV when CSV option is clicked', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockArrayData} filename="test-export" />);

    const csvItem = screen.getAllByTestId('dropdown-item')[1]; // Second item is CSV
    await user.click(csvItem);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as CSV');
    });
  });

  it('should export as TXT when TXT option is clicked', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} filename="test-export" />);

    const txtItem = screen.getAllByTestId('dropdown-item')[2]; // Third item is TXT
    await user.click(txtItem);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as TXT');
    });
  });

  it('should handle CSV export with array data', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockArrayData} />);

    const csvItem = screen.getAllByTestId('dropdown-item')[1];
    await user.click(csvItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as CSV');
    });
  });

  it('should handle CSV export with empty array', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={[]} />);

    const csvItem = screen.getAllByTestId('dropdown-item')[1];
    await user.click(csvItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as CSV');
    });
  });

  it('should handle CSV export with values containing commas', async () => {
    const dataWithCommas = [
      { name: 'Item, with, commas', value: 10 },
    ];
    const user = userEvent.setup();
    render(<ExportButton data={dataWithCommas} />);

    const csvItem = screen.getAllByTestId('dropdown-item')[1];
    await user.click(csvItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as CSV');
    });
  });

  it('should handle CSV export with null/undefined values', async () => {
    const dataWithNulls = [
      { name: 'Item 1', value: null, description: undefined },
    ];
    const user = userEvent.setup();
    render(<ExportButton data={dataWithNulls} />);

    const csvItem = screen.getAllByTestId('dropdown-item')[1];
    await user.click(csvItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as CSV');
    });
  });

  it('should handle text export with array data', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockArrayData} />);

    const txtItem = screen.getAllByTestId('dropdown-item')[2];
    await user.click(txtItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as TXT');
    });
  });

  it('should handle text export with object data', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    const txtItem = screen.getAllByTestId('dropdown-item')[2];
    await user.click(txtItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as TXT');
    });
  });

  it('should handle text export with string data', async () => {
    const user = userEvent.setup();
    render(<ExportButton data="Simple string data" />);

    const txtItem = screen.getAllByTestId('dropdown-item')[2];
    await user.click(txtItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as TXT');
    });
  });

  it('should show "Exporting..." text during export', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    const jsonItem = screen.getAllByTestId('dropdown-item')[0];

    const clickPromise = user.click(jsonItem);

    // Check for "Exporting..." text immediately after click
    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });

    await clickPromise;
  });

  it('should disable button during export', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    const button = screen.getByText('Export');
    const jsonItem = screen.getAllByTestId('dropdown-item')[0];

    await user.click(jsonItem);

    // Check if button becomes disabled during export
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it('should handle export error gracefully', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Make JSON.stringify throw an error
    const circularData: any = {};
    circularData.self = circularData; // Creates circular reference

    render(<ExportButton data={circularData} />);

    const jsonItem = screen.getAllByTestId('dropdown-item')[0];
    await user.click(jsonItem);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to export as JSON');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should revoke object URL after download', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    const jsonItem = screen.getAllByTestId('dropdown-item')[0];
    await user.click(jsonItem);

    await waitFor(() => {
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  it('should append and remove link element from DOM', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    const jsonItem = screen.getAllByTestId('dropdown-item')[0];
    await user.click(jsonItem);

    await waitFor(() => {
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  it('should have correct aria-label', () => {
    render(<ExportButton data={mockData} />);
    const button = screen.getByLabelText('Export data');
    expect(button).toBeInTheDocument();
  });

  it('should display icons for each format option', () => {
    const { container } = render(<ExportButton data={mockData} />);
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('should handle multiple exports in sequence', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    // First export
    const jsonItem = screen.getAllByTestId('dropdown-item')[0];
    await user.click(jsonItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as JSON');
    });

    mockToastSuccess.mockClear();

    // Second export
    const csvItem = screen.getAllByTestId('dropdown-item')[1];
    await user.click(csvItem);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported as CSV');
    });
  });

  it('should disable menu items during export', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={mockData} />);

    const items = screen.getAllByTestId('dropdown-item');
    const jsonItem = items[0];

    await user.click(jsonItem);

    await waitFor(() => {
      items.forEach(item => {
        expect(item).toBeDisabled();
      });
    });
  });
});
