import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * GitHub React Version Scanner
 * 
 * This script scans all repositories for a specified GitHub user 
 * and identifies React versions in each repository's package.json.
 * Uses the official Octokit client for GitHub API interactions.
 */

class GitHubReactScanner {
  constructor(username, token = null) {
    this.username = username;
    this.token = token;
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'github-react-scanner'
    });
  }

  async fetchUserRepos() {
    try {
      console.log(`Fetching repositories for ${this.username}...`);
      
      const repos = [];
      let page = 1;
      let hasNextPage = true;
      
      // Handle pagination to get all repositories
      while (hasNextPage) {
        const response = await this.octokit.repos.listForUser({
          username: this.username,
          per_page: 100,
          page: page
        });
        
        if (response.data.length === 0) {
          hasNextPage = false;
        } else {
          repos.push(...response.data);
          page++;
        }
      }
      
      return repos;
    } catch (error) {
      console.error('Error fetching repositories:', error.message);
      return [];
    }
  }

  async fetchPackageJson(repo) {
    try {
      // First, try to get package.json from the default branch
      const response = await this.octokit.repos.getContent({
        owner: this.username,
        repo: repo.name,
        path: 'package.json'
      });
      
      // Decode content from base64
      const content = Buffer.from(response.data.content, 'base64').toString();
      return JSON.parse(content);
    } catch (error) {
      // If package.json doesn't exist at the root level
      if (error.status === 404) {
        return null;
      }
      console.error(`Error fetching package.json for ${repo.name}:`, error.message);
      return null;
    }
  }

  getReactVersion(packageJson) {
    if (!packageJson) return null;
    
    // Check dependencies and devDependencies for React
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    
    return {
      react: dependencies.react || devDependencies.react || null,
      reactDom: dependencies['react-dom'] || devDependencies['react-dom'] || null,
      nextJs: dependencies.next || devDependencies.next || null, // Check for Next.js too
      gatsbyJs: dependencies.gatsby || devDependencies.gatsby || null // Check for Gatsby too
    };
  }

  async scanAllRepos() {
    const repos = await this.fetchUserRepos();
    console.log(`Found ${repos.length} repositories`);
    
    const results = [];
    
    for (const repo of repos) {
      console.log(`Scanning ${repo.name}...`);
      const packageJson = await this.fetchPackageJson(repo);
      const reactVersion = this.getReactVersion(packageJson);
      
      if (reactVersion && (reactVersion.react || reactVersion.reactDom || reactVersion.nextJs || reactVersion.gatsbyJs)) {
        results.push({
          repository: repo.name,
          reactVersion: reactVersion.react,
          reactDomVersion: reactVersion.reactDom,
          nextJsVersion: reactVersion.nextJs,
          gatsbyJsVersion: reactVersion.gatsbyJs,
          repoUrl: repo.html_url,
          lastUpdated: repo.updated_at,
          defaultBranch: repo.default_branch
        });
      }
    }
    
    return results;
  }

  generateReport(results) {
    // Sort repositories by React version
    results.sort((a, b) => {
      if (!a.reactVersion) return 1;
      if (!b.reactVersion) return -1;
      return a.reactVersion.localeCompare(b.reactVersion, undefined, { numeric: true });
    });
    
    let report = '# React Version Report\n\n';
    report += `Generated on ${new Date().toLocaleDateString()}\n\n`;
    report += `Total repositories with React: ${results.length}\n\n`;
    
    // Create a version summary
    const versionCounts = {};
    results.forEach(result => {
      if (result.reactVersion) {
        versionCounts[result.reactVersion] = (versionCounts[result.reactVersion] || 0) + 1;
      }
    });
    
    report += '## Version Summary\n\n';
    report += '| React Version | Count |\n';
    report += '|---------------|-------|\n';
    
    Object.entries(versionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([version, count]) => {
        report += `| ${version} | ${count} |\n`;
      });
    
    report += '\n## Detailed Repository Information\n\n';
    report += '| Repository | React | React DOM | Next.js | Gatsby | Last Updated | Default Branch | URL |\n';
    report += '|------------|-------|-----------|---------|--------|--------------|---------------|-----|\n';
    
    for (const result of results) {
      const lastUpdated = new Date(result.lastUpdated).toLocaleDateString();
      report += `| ${result.repository} | ${result.reactVersion || 'N/A'} | ${result.reactDomVersion || 'N/A'} | ${result.nextJsVersion || 'N/A'} | ${result.gatsbyJsVersion || 'N/A'} | ${lastUpdated} | ${result.defaultBranch} | ${result.repoUrl} |\n`;
    }
    
    return report;
  }

  saveReport(report, outputPath = './react-versions-report.md') {
    fs.writeFileSync(outputPath, report);
    console.log(`Report saved to ${outputPath}`);
    return outputPath;
  }
}

// Main function
async function main() {
  // Built-in default parameters
  const DEFAULT_USERNAME = ''; // Replace with your actual GitHub username
  const DEFAULT_TOKEN = '';       // Replace with your actual GitHub token
  const DEFAULT_OUTPUT_PATH = './react-versions-report.md';
  
  // Get command line arguments (these will override the defaults if provided)
  const args = process.argv.slice(2);
  const username = args[0] || DEFAULT_USERNAME;
  const token = args[1] || DEFAULT_TOKEN;
  const outputPath = args[2] || DEFAULT_OUTPUT_PATH;
  
  if (username === 'your_github_username') {
    console.log('⚠️  Using default GitHub username. For a different user, run with: node github-react-scanner.js <github_username> [github_token] [output_path]');
  }
  
  const scanner = new GitHubReactScanner(username, token);
  
  try {
    console.log('Starting scan...');
    const results = await scanner.scanAllRepos();
    
    if (results.length === 0) {
      console.log('No repositories with React found');
      process.exit(0);
    }
    
    const report = scanner.generateReport(results);
    const reportPath = scanner.saveReport(report, outputPath);
    console.log(`✅ Scan completed successfully! Report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Error during scan:', error);
    process.exit(1);
  }
}

// Check if being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export default GitHubReactScanner;