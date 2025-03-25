#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  showHelp, 
  isHelpRequested, 
  parseCommandLineArgs, 
  validateOptions,
  displayConfig 
} from './help-utils.js';

/**
 * GitHub React Version Scanner for Enterprise
 * 
 * This script scans all repositories within a GitHub Enterprise organization 
 * and identifies React versions in each repository's package.json.
 */

class GitHubReactScanner {
  constructor(orgName, token = null, options = {}) {
    this.orgName = orgName;
    this.token = token;
    this.enterpriseUrl = options.enterpriseUrl || null;
    
    // Configure Octokit for GitHub Enterprise if URL is provided
    const octokitOptions = {
      auth: token,
      userAgent: 'github-react-scanner'
    };
    
    // Add baseUrl if using GitHub Enterprise
    if (this.enterpriseUrl) {
      octokitOptions.baseUrl = `${this.enterpriseUrl}/api/v3`;
    }
    
    this.octokit = new Octokit(octokitOptions);
  }

  async fetchOrgRepos() {
    try {
      console.log(`Fetching repositories for organization "${this.orgName}" from ${this.enterpriseUrl || 'GitHub.com'}...`);
      
      const repos = [];
      let page = 1;
      let hasNextPage = true;
      
      // Handle pagination to get all repositories
      while (hasNextPage) {
        try {
          // Get repositories for the organization
          const response = await this.octokit.repos.listForOrg({
            org: this.orgName,
            per_page: 100,
            page: page,
            type: 'all' // Include all repositories: public, private, forks, sources, member
          });
          
          if (response.data.length === 0) {
            hasNextPage = false;
          } else {
            repos.push(...response.data);
            page++;
            console.log(`Fetched page ${page-1}, found ${response.data.length} repositories...`);
          }
        } catch (error) {
          console.error(`Error fetching organization repositories: ${error.message}`);
          // If we hit an error, stop pagination
          hasNextPage = false;
          
          // If unauthorized, provide helpful message
          if (error.status === 401 || error.status === 403) {
            console.error(`Make sure your token has sufficient permissions to access the "${this.orgName}" organization`);
          }
        }
      }
      
      console.log(`Total repositories found in "${this.orgName}": ${repos.length}`);
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
        owner: this.orgName,
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
    const repos = await this.fetchOrgRepos();
    console.log(`Found ${repos.length} repositories in the organization`);
    
    const results = [];
    let processedCount = 0;
    let reactReposCount = 0;
    
    for (const repo of repos) {
      processedCount++;
      console.log(`[${processedCount}/${repos.length}] Scanning ${repo.name}...`);
      const packageJson = await this.fetchPackageJson(repo);
      const reactVersion = this.getReactVersion(packageJson);
      
      if (reactVersion && (reactVersion.react || reactVersion.reactDom || reactVersion.nextJs || reactVersion.gatsbyJs)) {
        reactReposCount++;
        results.push({
          repository: repo.name,
          reactVersion: reactVersion.react,
          reactDomVersion: reactVersion.reactDom,
          nextJsVersion: reactVersion.nextJs,
          gatsbyJsVersion: reactVersion.gatsbyJs,
          repoUrl: repo.html_url,
          lastUpdated: repo.updated_at,
          defaultBranch: repo.default_branch,
          isPrivate: repo.private
        });
        console.log(`✅ Found React in "${repo.name}" (${reactVersion.react || 'N/A'})`);
      }
    }
    
    console.log(`Scan complete: Found React in ${reactReposCount} out of ${repos.length} repositories`);
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
    report += `Organization: ${this.orgName}\n`;
    report += `Total repositories with React: ${results.length}\n\n`;
    
    // Create a version summary
    const versionCounts = {};
    results.forEach(result => {
      if (result.reactVersion) {
        versionCounts[result.reactVersion] = (versionCounts[result.reactVersion] || 0) + 1;
      }
    });
    
    report += '## Version Summary\n\n';
    report += '| React Version | Count | Percentage |\n';
    report += '|---------------|-------|------------|\n';
    
    Object.entries(versionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([version, count]) => {
        const percentage = ((count / results.length) * 100).toFixed(1);
        report += `| ${version} | ${count} | ${percentage}% |\n`;
      });
    
    report += '\n## Detailed Repository Information\n\n';
    report += '| Repository | Privacy | React | React DOM | Next.js | Gatsby | Last Updated | Default Branch | URL |\n';
    report += '|------------|---------|-------|-----------|---------|--------|--------------|---------------|-----|\n';
    
    for (const result of results) {
      const lastUpdated = new Date(result.lastUpdated).toLocaleDateString();
      const privacy = result.isPrivate ? 'Private' : 'Public';
      report += `| ${result.repository} | ${privacy} | ${result.reactVersion || 'N/A'} | ${result.reactDomVersion || 'N/A'} | ${result.nextJsVersion || 'N/A'} | ${result.gatsbyJsVersion || 'N/A'} | ${lastUpdated} | ${result.defaultBranch} | ${result.repoUrl} |\n`;
    }
    
    return report;
  }

  saveReport(report, outputPath = './react-versions-report.md') {
    fs.writeFileSync(outputPath, report);
    console.log(`Report saved to ${outputPath}`);
    return outputPath;
  }
}

// Check for help flag first before anything else
if (isHelpRequested()) {
  showHelp();
}

// Main function to run the scanner
async function main() {
  // Parse command line arguments
  const options = parseCommandLineArgs();
  
  // Validate required parameters
  if (!validateOptions(options)) {
    return;
  }
  
  // Display configuration
  displayConfig(options);
  
  const scanner = new GitHubReactScanner(
    options.orgName, 
    options.token, 
    { enterpriseUrl: options.enterpriseUrl }
  );
  
  try {
    console.log('Starting scan...');
    const results = await scanner.scanAllRepos();
    
    if (results.length === 0) {
      console.log('No repositories with React found');
      process.exit(0);
    }
    
    const report = scanner.generateReport(results);
    const reportPath = scanner.saveReport(report, options.outputPath);
    console.log(`✅ Scan completed successfully! Report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Error during scan:', error);
    process.exit(1);
  }
}

// Run the script if it's being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}