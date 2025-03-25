# GitHub React Version Scanner

A command-line tool to scan GitHub repositories within an organization and identify React versions used across all projects.

## Features

- Scans all repositories within a GitHub organization
- Detects React, React DOM, Next.js, and Gatsby versions
- Works with GitHub Enterprise and GitHub.com
- Generates a detailed Markdown report
- Provides version usage statistics and summaries
- Supports scanning private repositories (with proper authentication)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/github-react-scanner.git
   cd github-react-scanner
   ```

2. Install dependencies:
   ```bash
   npm install @octokit/rest
   ```

## Usage

### Basic Usage

```bash
node github-react-scanner.js --org your-organization-name
```

### Command Line Options

```
Options:
  --org, -o        GitHub organization name (required)
  --token, -t      GitHub personal access token
  --url, -u        GitHub Enterprise URL (e.g., https://github.your-company.com)
  --output, -f     Output file path (default: ./react-versions-report.md)
  --help, -h       Show this help message
```

### Environment Variables

You can also configure the tool using environment variables:

```
GITHUB_ORG               GitHub organization name
GITHUB_TOKEN             GitHub personal access token
GITHUB_ENTERPRISE_URL    GitHub Enterprise URL
```

### Examples

**Scan an organization on GitHub.com:**
```bash
node github-react-scanner.js --org acme-corp --token ghp_your_token
```

**Scan an organization on GitHub Enterprise:**
```bash
node github-react-scanner.js --org acme-corp --token ghp_your_token --url https://github.your-company.com
```

**Save the report to a custom location:**
```bash
node github-react-scanner.js --org acme-corp --output ./reports/react-$(date +%Y%m%d).md
```

## GitHub Token Permissions

To properly scan repositories, your token needs the following permissions:
- `repo` scope for accessing private repositories
- `read:org` scope for listing organization repositories

## Report Example

The generated report includes:

1. **Summary Statistics:**
   - Total repositories scanned
   - Total repositories using React
   - Distribution of React versions

2. **Detailed Repository Information:**
   - Repository name and URL
   - Repository privacy status (public/private)
   - React and React DOM versions
   - Next.js and Gatsby versions (if applicable)
   - Last update date
   - Default branch

## Troubleshooting

### Rate Limiting
If you encounter rate limiting issues, ensure you're using a GitHub token with the correct permissions.

### Permission Errors
If you get 401 or 403 errors, verify that your token has access to the organization and its repositories.

### Missing Repositories
The tool only detects React in repositories with a `package.json` file at the root level. Monorepos or repositories with non-standard structures might not be correctly identified.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.