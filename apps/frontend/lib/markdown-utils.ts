/**
 * Utility functions for markdown processing
 */

/**
 * Strip markdown syntax from text for TTS/voice output
 * Converts markdown to plain text that sounds natural when spoken
 */
export function stripMarkdownForSpeech(markdown: string): string {
  if (!markdown) return ""

  let text = markdown

  // Remove code blocks (```code```)
  text = text.replace(/```[\s\S]*?```/g, " ")
  text = text.replace(/`[^`]+`/g, " ")

  // Remove headers (# ## ###)
  text = text.replace(/^#{1,6}\s+/gm, "")

  // Remove bold/italic (**bold**, *italic*, __bold__, _italic_)
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2")
  text = text.replace(/(\*|_)(.*?)\1/g, "$2")

  // Remove strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, "$1")

  // Remove links but keep text [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")

  // Remove images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "")

  // Remove blockquotes (>)
  text = text.replace(/^>\s+/gm, "")

  // Remove horizontal rules (--- or ***)
  text = text.replace(/^[-*_]{3,}\s*$/gm, "")

  // Remove list markers (-, *, +, 1.)
  text = text.replace(/^[\s]*[-*+]\s+/gm, "")
  text = text.replace(/^[\s]*\d+\.\s+/gm, "")

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "")

  // Remove extra whitespace and newlines
  text = text.replace(/\n{3,}/g, "\n\n")
  text = text.replace(/\s{2,}/g, " ")

  // Trim
  text = text.trim()

  return text
}

/**
 * Test cases for stripMarkdownForSpeech
 */
export function testStripMarkdown() {
  const testCases = [
    {
      input: "**Hello** world",
      expected: "Hello world",
    },
    {
      input: "# Heading\nSome text",
      expected: "Heading\nSome text",
    },
    {
      input: "Check this `code` block",
      expected: "Check this   block",
    },
    {
      input: "[Link text](https://example.com)",
      expected: "Link text",
    },
    {
      input: "- Item 1\n- Item 2",
      expected: "Item 1\nItem 2",
    },
  ]

  testCases.forEach(({ input, expected }) => {
    const result = stripMarkdownForSpeech(input)
    console.log(`Input: "${input}"`)
    console.log(`Expected: "${expected}"`)
    console.log(`Result: "${result}"`)
    console.log(`Match: ${result === expected ? "✅" : "❌"}`)
    console.log("---")
  })
}
