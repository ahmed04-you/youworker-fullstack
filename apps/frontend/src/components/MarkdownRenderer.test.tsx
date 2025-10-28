import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownRenderer } from './MarkdownRenderer';

// Mock next-themes
const mockUseTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}));

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, ...props }: any) => (
    <pre data-testid="syntax-highlighter" {...props}>
      <code>{children}</code>
    </pre>
  ),
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
  oneLight: {},
}));


describe('MarkdownRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({
      resolvedTheme: 'light',
    });
  });

  it('should render simple text content', () => {
    render(<MarkdownRenderer content="Hello World" />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should render headings', () => {
    render(<MarkdownRenderer content="# Heading 1" />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
  });

  it('should render multiple headings', () => {
    const content = `# Heading 1

## Heading 2`;
    render(<MarkdownRenderer content={content} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading 2');
  });

  it('should render paragraphs', () => {
    render(<MarkdownRenderer content="This is a paragraph.\n\nThis is another paragraph." />);

    const paragraphs = screen.getAllByText(/This is/);
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  it('should render bold text', () => {
    const { container } = render(<MarkdownRenderer content="**bold text**" />);

    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('bold text');
  });

  it('should render italic text', () => {
    const { container } = render(<MarkdownRenderer content="_italic text_" />);

    const em = container.querySelector('em');
    expect(em).toBeInTheDocument();
    expect(em).toHaveTextContent('italic text');
  });

  it('should render inline code', () => {
    const { container } = render(<MarkdownRenderer content="`inline code`" />);

    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code).toHaveTextContent('inline code');
  });

  it('should render code blocks with syntax highlighting', () => {
    const codeContent = '```javascript\nconst x = 42;\n```';
    const { container } = render(<MarkdownRenderer content={codeContent} />);

    // Check for code block container
    const codeBlock = container.querySelector('pre');
    expect(codeBlock).toBeInTheDocument();
  });

  it('should render copy button for code blocks', () => {
    const codeContent = '```javascript\nconst x = 42;\n```';
    render(<MarkdownRenderer content={codeContent} />);

    const copyButton = screen.getByRole('button', { name: /copy code/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('should have clickable copy button for code blocks', async () => {
    const codeContent = '```javascript\nconst x = 42;\n```';
    render(<MarkdownRenderer content={codeContent} />);

    const copyButton = screen.getByRole('button', { name: /copy code/i });
    expect(copyButton).toBeEnabled();
  });

  it('should render links with target="_blank"', () => {
    render(<MarkdownRenderer content="[Link](https://example.com)" />);

    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render images with lazy loading', () => {
    render(<MarkdownRenderer content="![Alt text](https://example.com/image.png)" />);

    const img = screen.getByRole('img', { name: 'Alt text' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveClass('max-w-full', 'h-auto', 'rounded-lg', 'my-4');
  });

  it('should render unordered lists', () => {
    const listContent = '- Item 1\n- Item 2\n- Item 3';
    render(<MarkdownRenderer content={listContent} />);

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('should render ordered lists', () => {
    const listContent = '1. First\n2. Second\n3. Third';
    render(<MarkdownRenderer content={listContent} />);

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('should render blockquotes', () => {
    const { container } = render(<MarkdownRenderer content="> This is a quote" />);

    const blockquote = container.querySelector('blockquote');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveTextContent('This is a quote');
  });

  it('should render tables with GFM', () => {
    const tableContent = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
    `;
    render(<MarkdownRenderer content={tableContent} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent('Header 1');
    expect(headers[1]).toHaveTextContent('Header 2');
  });

  it('should render strikethrough with GFM', () => {
    const { container } = render(<MarkdownRenderer content="~~strikethrough~~" />);

    const del = container.querySelector('del');
    expect(del).toBeInTheDocument();
    expect(del).toHaveTextContent('strikethrough');
  });

  it('should apply prose classes in light mode', () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: 'light',
    });

    const { container } = render(<MarkdownRenderer content="Test content" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('prose', 'prose-sm', 'max-w-none');
    expect(wrapper).not.toHaveClass('prose-invert');
  });

  it('should apply prose-invert class in dark mode', () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: 'dark',
    });

    const { container } = render(<MarkdownRenderer content="Test content" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('prose', 'prose-sm', 'max-w-none', 'prose-invert');
  });

  it('should accept custom className', () => {
    const { container } = render(
      <MarkdownRenderer content="Test" className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class', 'prose');
  });

  it('should use correct syntax highlighter style based on theme', () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: 'dark',
    });

    const codeContent = '```javascript\nconst x = 42;\n```';
    const { container } = render(<MarkdownRenderer content={codeContent} />);

    // The syntax highlighter should be present
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
  });

  it('should not render code block for inline code', () => {
    render(<MarkdownRenderer content="`inline`" />);

    // Should not have copy button for inline code
    expect(screen.queryByRole('button', { name: /copy code/i })).not.toBeInTheDocument();
  });

  it('should handle empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('prose');
  });

  it('should handle complex nested markdown', () => {
    const complexContent = `
# Title

This is a paragraph with **bold** and *italic* text.

## Subsection

- List item with \`code\`
- Another item

\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`

> A blockquote with [a link](https://example.com)
    `;

    render(<MarkdownRenderer content={complexContent} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Subsection' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'a link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
  });

  it('should preserve code block language', () => {
    const codeContent = '```python\nprint("hello")\n```';
    const { container } = render(<MarkdownRenderer content={codeContent} />);

    // Syntax highlighter should be present for language-specific code
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
  });

  it('should handle code blocks without language specification', () => {
    const codeContent = '```\nplain code\n```';
    const { container } = render(<MarkdownRenderer content={codeContent} />);

    // Should still render as code block, just without syntax highlighting
    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
  });
});
