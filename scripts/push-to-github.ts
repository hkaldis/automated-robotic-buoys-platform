// Script to push the project to GitHub
import { getUncachableGitHubClient } from '../server/github';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'automated-robotic-buoys-platform';
const REPO_DESCRIPTION = 'Maritime control system for automated robotic buoys during sailing races and training events';

async function pushToGitHub() {
  try {
    console.log('Getting GitHub client...');
    const octokit = await getUncachableGitHubClient();
    
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);
    
    // Check if repo already exists
    let repoExists = false;
    try {
      await octokit.repos.get({
        owner: user.login,
        repo: REPO_NAME,
      });
      repoExists = true;
      console.log(`Repository ${REPO_NAME} already exists`);
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`Repository ${REPO_NAME} does not exist, creating...`);
    }
    
    // Create repo if it doesn't exist
    if (!repoExists) {
      await octokit.repos.createForAuthenticatedUser({
        name: REPO_NAME,
        description: REPO_DESCRIPTION,
        private: false,
        auto_init: false,
      });
      console.log(`Created repository: ${REPO_NAME}`);
    }
    
    // Get the access token for git operations
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;
    
    const connectionData = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken!
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);
    
    const accessToken = connectionData?.settings?.access_token || connectionData?.settings?.oauth?.credentials?.access_token;
    
    if (!accessToken) {
      throw new Error('Could not get access token for git push');
    }
    
    // Configure git remote with token
    const remoteUrl = `https://${accessToken}@github.com/${user.login}/${REPO_NAME}.git`;
    
    try {
      execSync('git remote remove github-push 2>/dev/null || true', { stdio: 'pipe' });
    } catch (e) {
      // Ignore errors
    }
    
    execSync(`git remote add github-push "${remoteUrl}"`, { stdio: 'pipe' });
    
    // Push to GitHub
    console.log('Pushing to GitHub...');
    execSync('git push -u github-push main --force', { stdio: 'inherit' });
    
    // Remove the remote with token for security
    execSync('git remote remove github-push', { stdio: 'pipe' });
    
    console.log(`\n✓ Successfully pushed to GitHub!`);
    console.log(`Repository URL: https://github.com/${user.login}/${REPO_NAME}`);
    
  } catch (error) {
    console.error('Error pushing to GitHub:', error);
    process.exit(1);
  }
}

pushToGitHub();
