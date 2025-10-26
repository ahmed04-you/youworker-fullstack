# Contributing to YouWorker.AI

Thank you for your interest in contributing to YouWorker.AI! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Issue Guidelines](#issue-guidelines)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to making participation in this project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment of any kind
- Trolling, insulting/derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When reporting bugs, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots** (if applicable)
- **Environment details**:
  - OS and version
  - Python/Node.js version
  - Docker version
  - GPU info (if relevant)

**Bug Report Template**:

```markdown
## Bug Description
Brief description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: Ubuntu 22.04
- Python: 3.11.5
- Docker: 24.0.5
- GPU: NVIDIA RTX 4090

## Additional Context
Any other relevant information.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues.

When suggesting enhancements, include:

- **Clear title and description**
- **Use case**: Why is this enhancement needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What other options did you think about?
- **Additional context**: Screenshots, mockups, etc.

**Enhancement Template**:

```markdown
## Enhancement Description
Brief description of the proposed feature.

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How should this feature work?

## Alternatives Considered
What other solutions did you consider?

## Additional Context
Screenshots, mockups, or examples.
```

### Pull Requests

Pull requests are welcome for:

- **Bug fixes**
- **Feature implementations**
- **Documentation improvements**
- **Test coverage**
- **Performance optimizations**
- **Code refactoring**

## Development Setup

See the [Development Guide](DEVELOPMENT.md) for complete setup instructions.

**Quick setup**:

```bash
# Clone repository
git clone <repository-url>
cd youworker-fullstack

# Setup Python environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Setup frontend
cd apps/frontend && npm install && cd ../..

# Configure environment
cp .env.example .env

# Start services
make compose-up
```

## Pull Request Process

### 1. Fork and Create Branch

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/your-username/youworker-fullstack.git
cd youworker-fullstack

# Add upstream remote
git remote add upstream https://github.com/original/youworker-fullstack.git

# Create feature branch
git checkout -b feature/my-feature
```

### 2. Make Changes

- Follow [coding guidelines](#coding-guidelines)
- Write/update tests
- Update documentation
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run tests
make test

# Check code style
make lint

# Format code
make format

# Test frontend
cd apps/frontend
npm test
npm run lint
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

See [commit message guidelines](#commit-messages) below.

### 5. Keep Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase on main
git rebase upstream/main

# Resolve conflicts if any
# Then continue rebase
git rebase --continue
```

### 6. Push and Create PR

```bash
# Push to your fork
git push origin feature/my-feature

# Create Pull Request on GitHub
```

### 7. PR Review

- Respond to review comments
- Make requested changes
- Push updates (rebase if needed)

### 8. PR Merge

Once approved, a maintainer will merge your PR.

## Coding Guidelines

### Python

**Style**:
- Follow PEP 8
- Use Black formatter (100 char line length)
- Use Ruff for linting
- Add type hints
- Write docstrings

**Example**:

```python
from typing import Optional

def process_text(
    text: str,
    max_length: Optional[int] = None,
) -> dict[str, str]:
    """
    Process input text and return result.
    
    Args:
        text: Input text to process
        max_length: Maximum output length
        
    Returns:
        Dictionary with processed text
        
    Raises:
        ValueError: If text is empty
    """
    if not text:
        raise ValueError("Text cannot be empty")
    
    # Processing logic
    return {"result": processed}
```

### TypeScript/JavaScript

**Style**:
- Use TypeScript strict mode
- Use ESLint + Prettier
- Use explicit types
- Use functional components (React)

**Example**:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}
```

### Testing

**Write tests for**:
- New features
- Bug fixes
- Edge cases
- Error handling

**Test structure**:

```python
import pytest

def test_feature_works_correctly():
    """Test that feature produces expected output."""
    # Arrange
    input_data = {"key": "value"}
    
    # Act
    result = process(input_data)
    
    # Assert
    assert result["status"] == "success"
    assert "output" in result
```

### Documentation

**Update documentation for**:
- New features
- API changes
- Configuration changes
- Breaking changes

**Documentation standards**:
- Clear and concise
- Include examples
- Link to related docs
- Update table of contents

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples

```bash
# Feature
feat(chat): add voice input support

# Bug fix
fix(api): handle null user in auth middleware

# Documentation
docs(setup): update GPU setup instructions

# Refactoring
refactor(agent): simplify tool execution loop

# Breaking change
feat(api)!: change chat endpoint response format

BREAKING CHANGE: Chat endpoint now returns structured
metadata object instead of flat response.
```

### Guidelines

- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Keep subject under 72 characters
- Explain **what** and **why** in body, not **how**

## Issue Guidelines

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for solutions
3. **Try latest version** to see if it's fixed
4. **Gather information** about your environment

### Issue Template

Use the appropriate template:

- **Bug Report**: For bugs and errors
- **Feature Request**: For new features
- **Documentation**: For doc improvements
- **Question**: For questions and discussions

### Issue Labels

We use labels to categorize issues:

**Type**:
- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation improvements
- `question`: Questions and discussions

**Priority**:
- `critical`: Blocks major functionality
- `high`: Important but not blocking
- `medium`: Nice to have
- `low`: Minor improvements

**Status**:
- `needs-triage`: Needs initial review
- `needs-info`: More information needed
- `in-progress`: Being worked on
- `blocked`: Blocked by other issues

**Component**:
- `api`: Backend API
- `frontend`: Frontend UI
- `mcp`: MCP servers
- `docs`: Documentation
- `ops`: Operations/deployment

## Community

### Getting Help

- **Documentation**: Check the [docs](README.md)
- **Issues**: Search existing issues
- **Discussions**: Join GitHub Discussions
- **Email**: Contact maintainers

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas, community
- **Pull Requests**: Code contributions

### Recognition

Contributors will be acknowledged in:

- GitHub contributors page
- Release notes
- Project README

## Development Resources

- [Development Guide](DEVELOPMENT.md)
- [Architecture Documentation](ARCHITECTURE.md)
- [API Documentation](API.md)
- [Frontend Guide](FRONTEND.md)
- [MCP Servers Guide](MCP_SERVERS.md)
- [Setup Guide](SETUP.md)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Questions?

If you have questions about contributing, please:

1. Check this guide and other documentation
2. Search existing issues and discussions
3. Create a new discussion or issue
4. Contact maintainers

Thank you for contributing to YouWorker.AI! 🎉