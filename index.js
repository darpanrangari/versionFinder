// Babydol Package Version Tracker
// This script scans GitHub Enterprise repositories to identify versions of the 'babydol' package

import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from .env files if dotenv is available
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env' });
  dotenv.config({ path: '.env.local', override: true });
  console.log('Loaded environment variables from .env and .env.local');
} catch (error) {
  console.log('Dotenv not available, using environment variables as provided');
}

// Configuration from environment variables with defaults
const config = {
  // Your GitHub Enterprise URL (without trailing slash)
  baseUrl: process.env.GH_BASE_URL || 'https://github.yourdomain.com/api/v3',
  
  // Personal access token with repo access
  auth: process.env.GH_TOKEN,
  
  // Organization name (leave empty if scanning user repos)
  org: process.env.GH_ORG || '',
  
  // If org is empty, specify username to scan
  username: process.env.GH_USERNAME || '',
  
  // Output file path
  outputFile: process.env.OUTPUT_FILE || 'babydol-versions.json',
  
  // Search in these files (common package.json locations)
  packageFiles: process.env.SCAN_PACKAGE_FILES ? 
    process.env.SCAN_PACKAGE_FILES.split(',') : 
    [
      'package.json',
      'frontend/package.json',
      'client/package.json',
      'ui/package.json'
    ],
  
  // Target branch to search in
  targetBranch: process.env.TARGET_BRANCH || 'develop',
  
  // Package name to search for
  packageName: process.env.PACKAGE_NAME || 'babydol'
};

// Validate required configuration
if (!config.auth) {
  console.error('Error: GitHub token not provided. Set GH_TOKEN environment variable.');
  process.exit(1);
}

// Initialize Octokit with Enterprise URL
const octokit = new Octokit({
  baseUrl: config.baseUrl,
  auth: config.auth,
  previews: ['mercy-preview']
});

// Result array to store findings
const results = [];

// Main function
async function scanRepositories() {
  console.log('Starting scan for babydol package versions...');
  console.log(`Configuration: Target branch: ${config.targetBranch}, Package: ${config.packageName}, Organization: ${config.org || config.username}`);
  
  try {
    // Get list of repositories based on config
    const repositories = await getRepositoryList();
    console.log(`Found ${repositories.length} repositories to scan`);
    
    // Process each repository
    for (const repo of repositories) {
      console.log(`Scanning repository: ${repo.name}`);
      await processRepository(repo);
    }
    
    // Write results to CSV
    writeResults();
    
    console.log('Scan completed successfully!');
    console.log(`Results saved to ${config.outputFile}`);
    
  } catch (error) {
    console.error('Error during scanning:', error);
    process.exit(1);
  }
}

// Get list of repositories to scan
async function getRepositoryList() {
  const repos = [];
  let page = 1;
  let hasMoreRepos = true;
  
  while (hasMoreRepos) {
    let response;
    
    if (config.org) {
      // Get organization repositories
      response = await octokit.repos.listForOrg({
        org: config.org,
        per_page: 100,
        page
      });
    } else {
      // Get user repositories
      response = await octokit.repos.listForUser({
        username: config.username || (await octokit.users.getAuthenticated()).data.login,
        per_page: 100,
        page
      });
    }
    
    if (response.data.length === 0) {
      hasMoreRepos = false;
    } else {
      repos.push(...response.data);
      page++;
    }
  }
  
  return repos;
}

// Process a single repository
async function processRepository(repo) {
  const repoFullName = repo.full_name;
  
  try {
    // Check in the target branch (develop) or fall back to default branch if not specified
    const branchToCheck = config.targetBranch || repo.default_branch;
    await checkPackageFiles(repoFullName, branchToCheck);
  } catch (error) {
    console.error(`Error processing repository ${repoFullName}:`, error);
    // Add to results as error
    results.push({
      repository: repoFullName,
      branch: 'ERROR',
      packageFile: 'ERROR',
      version: `Error: ${error.message}`
    });
  }
}

// Check all configured package files in a repo branch
async function checkPackageFiles(repoFullName, branch) {
  const [owner, repo] = repoFullName.split('/');
  
  for (const packageFile of config.packageFiles) {
    try {
      // Get the file content
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: packageFile,
        ref: branch
      });
      
      // Skip directories and other non-files
      if (response.data.type !== 'file') continue;
      
      // Decode content from base64
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      
      try {
        // Parse JSON
        const packageJson = JSON.parse(content);
        
        // Check for the package in dependencies, devDependencies, and peerDependencies
        const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
        
        for (const depType of dependencyTypes) {
          if (packageJson[depType] && packageJson[depType][config.packageName]) {
            // Found the package!
            results.push({
              repository: repoFullName,
              branch,
              packageFile,
              dependencyType: depType,
              version: packageJson[depType][config.packageName]
            });
            
            console.log(`Found ${config.packageName} in ${repoFullName} (${branch}): ${packageJson[depType][config.packageName]}`);
          }
        }
      } catch (parseError) {
        console.error(`Error parsing JSON in ${repoFullName}/${packageFile}:`, parseError);
      }
    } catch (contentError) {
      // File likely doesn't exist in this repo, silently continue
      if (contentError.status !== 404) {
        console.error(`Error retrieving ${packageFile} from ${repoFullName}:`, contentError);
      }
    }
  }
}

// Write results to JSON file
function writeResults() {
  const outputData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      packageName: config.packageName,
      targetBranch: config.targetBranch,
      organization: config.org || config.username,
      totalRepositoriesScanned: results.length
    },
    repositories: results.map(result => ({
      repository: result.repository,
      branch: result.branch,
      packageFile: result.packageFile,
      dependencyType: result.dependencyType || null,
      version: result.version,
      hasError: result.branch === 'ERROR' || result.version.startsWith('Error:')
    }))
  };
  
  fs.writeFileSync(config.outputFile, JSON.stringify(outputData, null, 2));
}

// Start the scan
scanRepositories().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});