// Babydol Package Version Tracker
// This script scans GitHub Enterprise repositories to identify versions of specified packages

import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables - different approach for ESM
// Since we're using ES modules, we need to use dynamic import for dotenv
let dotenvPromise;
try {
  dotenvPromise = import('dotenv');
} catch (error) {
  console.log('Dotenv not available, using environment variables as provided');
}

// Wait for dotenv to load if available
if (dotenvPromise) {
  try {
    const dotenv = await dotenvPromise;
    // Load .env first
    dotenv.config({ path: '.env' });
    // Then override with .env.local if it exists
    dotenv.config({ path: '.env.local', override: true });
    console.log('Loaded environment variables from .env and .env.local');
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
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
  outputFile: process.env.OUTPUT_FILE || 'package-versions.json',
  
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
  
  // Package names to search for (comma-separated)
  packageNames: process.env.PACKAGE_NAMES ? 
    process.env.PACKAGE_NAMES.split(',').map(pkg => pkg.trim()) : 
    ['babydol']
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
  
  console.log(`Fetching repositories for: ${config.org || config.username}...`);
  
  while (hasMoreRepos) {
    let response;
    
    try {
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
        console.log(`Fetched page ${page-1}, found ${response.data.length} repositories`);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      hasMoreRepos = false;
    }
  }
  
  console.log(`Total repositories found: ${repos.length}`);
  return repos;
}

// Process a single repository
async function processRepository(repo) {
  const repoFullName = repo.full_name;
  
  try {
    // Check in the target branch (develop) or fall back to default branch if not specified
    const branchToCheck = config.targetBranch || repo.default_branch;
    
    // Try to get the branch to see if it exists
    try {
      const [owner, repoName] = repoFullName.split('/');
      await octokit.repos.getBranch({
        owner,
        repo: repoName,
        branch: branchToCheck
      });
      
      // Branch exists, check package files
      await checkPackageFiles(repoFullName, branchToCheck);
    } catch (branchError) {
      if (branchError.status === 404) {
        // Branch doesn't exist, note this but don't treat as error
        console.log(`Branch '${branchToCheck}' doesn't exist in ${repoFullName}, skipping`);
      } else {
        // Other error, rethrow
        throw branchError;
      }
    }
  } catch (error) {
    console.error(`Error processing repository ${repoFullName}:`, error);
    // Only add to results as error if it's not a 404 (not found) error
    if (error.status !== 404) {
      results.push({
        repository: repoFullName,
        branch: 'ERROR',
        packageFile: 'ERROR',
        version: `Error: ${error.message}`,
        hasError: true
      });
    }
  }
}

// Check all configured package files in a repo branch
async function checkPackageFiles(repoFullName, branch) {
  const [owner, repo] = repoFullName.split('/');
  let packagesFound = {};
  
  // Initialize packagesFound object with all package names
  config.packageNames.forEach(pkgName => {
    packagesFound[pkgName] = false;
  });
  
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
        
        // Check for each package in dependencies, devDependencies, and peerDependencies
        const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
        
        // For each package we're looking for
        for (const packageName of config.packageNames) {
          // Check in each dependency type
          for (const depType of dependencyTypes) {
            if (packageJson[depType] && packageJson[depType][packageName]) {
              // Found the package!
              packagesFound[packageName] = true;
              results.push({
                repository: repoFullName,
                branch,
                packageFile,
                packageName,
                dependencyType: depType,
                version: packageJson[depType][packageName]
              });
              
              console.log(`Found ${packageName} in ${repoFullName} (${branch}): ${packageJson[depType][packageName]}`);
            }
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
  
  // Report packages not found
  const notFoundPackages = Object.entries(packagesFound)
    .filter(([_, found]) => !found)
    .map(([pkgName, _]) => pkgName);
    
  if (notFoundPackages.length > 0) {
    console.log(`Packages not found in ${repoFullName} (${branch}): ${notFoundPackages.join(', ')}`);
  }
}

// Write results to JSON file
function writeResults() {
  // Group results by package name
  const packageGroups = {};
  
  // Initialize groups for each package
  config.packageNames.forEach(packageName => {
    packageGroups[packageName] = {
      packageName,
      repositories: []
    };
  });
  
  // Group results by package
  results.forEach(result => {
    if (packageGroups[result.packageName]) {
      packageGroups[result.packageName].repositories.push({
        repository: result.repository,
        branch: result.branch,
        packageFile: result.packageFile,
        dependencyType: result.dependencyType || null,
        version: result.version,
        hasError: result.hasError || false
      });
    }
  });
  
  // Create summary of versions for each package
  const packageSummaries = {};
  Object.keys(packageGroups).forEach(packageName => {
    const versions = {};
    let errorCount = 0;
    
    packageGroups[packageName].repositories.forEach(repo => {
      if (repo.hasError) {
        errorCount++;
      } else {
        versions[repo.version] = (versions[repo.version] || 0) + 1;
      }
    });
    
    packageSummaries[packageName] = {
      totalRepositories: packageGroups[packageName].repositories.length,
      errorCount,
      versions: Object.entries(versions)
        .map(([version, count]) => ({ version, count }))
        .sort((a, b) => b.count - a.count)
    };
  });
  
  const outputData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      packageNames: config.packageNames,
      targetBranch: config.targetBranch,
      organization: config.org || config.username,
      totalRepositoriesScanned: results.length
    },
    summary: packageSummaries,
    packages: packageGroups
  };
  
  fs.writeFileSync(config.outputFile, JSON.stringify(outputData, null, 2));
}

// Start the scan
scanRepositories().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
