# Babydol Version Tracker

A tool to track `babydol` package versions across multiple repositories in a GitHub Enterprise instance. This tool helps maintain visibility of package versions used across different projects.

## Features

- Scans all repositories in a GitHub Enterprise organization
- Targets specific branch (default: `develop`)
- Checks for the `babydol` package in various package.json locations
- Generates detailed JSON reports with version information
- Creates HTML visualization of version distribution
- Easy to run manually or as a scheduled Jenkins job
- Containerized for consistent execution across environments

## Requirements

- Node.js 18+ (for local execution)
- Docker and Docker Compose (for containerized execution)
- GitHub Enterprise instance
- Personal access token with `repo` scope

## Project Structure

```
babydol-tracker/
├── Dockerfile                  # Container definition
├── docker-compose.yml         # Docker Compose configuration
├── index.js                   # Main tracking script
├── package.json               # Node.js dependencies and scripts
├── package-lock.json          # Dependency lock file (generated)
├── run.sh                     # Shell script to run the tracker manually
├── Jenkinsfile                # Jenkins pipeline definition
├── .env                       # Default environment variables (committed)
├── .env.local                 # Local environment variables (not committed)
├── .gitignore                 # Git ignore patterns
└── output/                    # Directory for output files (generated)
    └── babydol-versions.json  # Generated JSON results
```

## Configuration

This project uses environment variables for configuration. Create a `.env.local` file based on the provided `.env` file with your specific settings:

```
# Required variables
GH_TOKEN=your-github-token-here
GH_ORG=your-organization-name
```

See [Environment Variables Documentation](README-env.md) for all available settings.

## Running the tool

### Local Execution

```bash
# Install dependencies
npm install

# Run the tracker
npm start
```

### Docker Execution

```bash
# Using the run script
./run.sh

# Or manually with Docker Compose
docker-compose up
```

### Jenkins Integration

1. Create a new Jenkins Pipeline job
2. Configure it to use SCM to fetch this repository
3. Set up credentials for GitHub Enterprise
4. The job will automatically run according to the schedule in the Jenkinsfile (default: 2 AM daily)

## Output Format

The tool generates a JSON file with the following structure:

```json
{
  "metadata": {
    "generatedAt": "2025-03-25T10:00:00.000Z",
    "packageName": "babydol",
    "targetBranch": "develop",
    "organization": "your-organization-name",
    "totalRepositoriesScanned": 42
  },
  "repositories": [
    {
      "repository": "org/repo-name",
      "branch": "develop",
      "packageFile": "package.json",
      "dependencyType": "dependencies",
      "version": "1.2.3",
      "hasError": false
    },
    // ...more repositories
  ]
}
```

## HTML Report

When run in Jenkins, an HTML report is generated with:

- Summary of scan results
- Version distribution across repositories
- Detailed table of all repositories and versions
- Highlighted errors and warnings

## Customization

### Scanning Different Package Files

Edit the `SCAN_PACKAGE_FILES` environment variable in `.env` to include additional paths:

```
SCAN_PACKAGE_FILES=package.json,frontend/package.json,client/package.json,ui/package.json,apps/*/package.json
```

### Tracking Different Packages

Change the `PACKAGE_NAME` environment variable:

```
PACKAGE_NAME=different-package-name
```

### Scanning Different Branches

Change the `TARGET_BRANCH` environment variable:

```
TARGET_BRANCH=main
```

## Troubleshooting

### Authentication Issues

- Ensure your GitHub token has `repo` scope
- Verify the token is properly set in `.env.local` or passed as an environment variable
- Check that the GitHub Enterprise URL is correct

### No Results Found

- Verify the organization name is correct
- Check that repositories contain package.json files
- Ensure the branch exists in the repositories

### Docker Issues

- Run `docker-compose build --no-cache` to rebuild the image from scratch
- Ensure the output directory has proper permissions

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request