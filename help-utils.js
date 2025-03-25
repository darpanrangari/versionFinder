/**
 * Help utilities for GitHub React Version Scanner
 * Contains functions related to displaying help and usage information
 */

/**
 * Display help information for the GitHub React Version Scanner
 */
export function showHelp() {
    console.log(`
  GitHub React Version Scanner
  
  Usage: node github-react-scanner.js [options]
  
  Options:
    --org, -o        GitHub organization name (required)
    --token, -t      GitHub personal access token
    --url, -u        GitHub Enterprise URL (e.g., https://github.your-company.com)
    --output, -f     Output file path (default: ./react-versions-report.md)
    --help, -h       Show this help message
  
  Environment Variables:
    GITHUB_ORG               GitHub organization name
    GITHUB_TOKEN             GitHub personal access token
    GITHUB_ENTERPRISE_URL    GitHub Enterprise URL
  
  Example:
    node github-react-scanner.js --org your-org --token ghp_abc123 --url https://github.your-company.com
  
  Note:
    A personal access token with 'repo' and 'read:org' scopes is recommended for accessing private repositories.
    `);
    process.exit(0);
  }
  
  /**
   * Check if help flag is present in command line arguments
   * @returns {boolean} True if help flag is present
   */
  export function isHelpRequested() {
    return process.argv.includes('--help') || process.argv.includes('-h');
  }
  
  /**
   * Parse command line arguments
   * @returns {Object} Parsed command line arguments
   */
  export function parseCommandLineArgs() {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    // Command line options
    const options = {
      orgName: '',
      token: '',
      enterpriseUrl: '',
      outputPath: './react-versions-report.md'
    };
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--org' || arg === '-o') {
        if (i + 1 < args.length) {
          options.orgName = args[i + 1];
          i++;
        }
      } else if (arg === '--token' || arg === '-t') {
        if (i + 1 < args.length) {
          options.token = args[i + 1];
          i++;
        }
      } else if (arg === '--url' || arg === '-u') {
        if (i + 1 < args.length) {
          options.enterpriseUrl = args[i + 1];
          i++;
        }
      } else if (arg === '--output' || arg === '-f') {
        if (i + 1 < args.length) {
          options.outputPath = args[i + 1];
          i++;
        }
      }
    }
    
    // Apply environment variables for missing options
    options.orgName = options.orgName || process.env.GITHUB_ORG || '';
    options.token = options.token || process.env.GITHUB_TOKEN || '';
    options.enterpriseUrl = options.enterpriseUrl || process.env.GITHUB_ENTERPRISE_URL || '';
    
    return options;
  }
  
  /**
   * Validate required command line options
   * @param {Object} options - Parsed command line options
   * @returns {boolean} True if all required options are provided
   */
  export function validateOptions(options) {
    if (!options.orgName) {
      console.error('❌ Error: Organization name is required');
      showHelp();
      return false;
    }
    
    if (!options.token) {
      console.warn('⚠️  Warning: No GitHub token provided. API rate limits may apply.');
    }
    
    return true;
  }
  
  /**
   * Display the configuration being used
   * @param {Object} options - Parsed command line options
   */
  export function displayConfig(options) {
    console.log(`
  Using configuration:
    - GitHub Enterprise URL: ${options.enterpriseUrl || 'Not specified (using GitHub.com)'}
    - Organization: ${options.orgName}
    - Token: ${options.token ? '✅ Provided' : '❌ Not provided (may hit rate limits)'}
    - Output Path: ${options.outputPath}
  `);
  }