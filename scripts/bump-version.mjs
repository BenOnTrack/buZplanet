#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Get the current version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
let currentVersion = packageJson.version;

// Parse version parts
const versionParts = currentVersion.split('.').map(Number);
let [major, minor, patch] = versionParts;

// Get command line argument for version bump type
const bumpType = process.argv[2] || 'patch';

// Increment version based on type
switch (bumpType) {
  case 'major':
    major += 1;
    minor = 0;
    patch = 0;
    break;
  case 'minor':
    minor += 1;
    patch = 0;
    break;
  case 'patch':
  default:
    patch += 1;
    break;
}

const newVersion = `${major}.${minor}.${patch}`;

// Update package.json
packageJson.version = newVersion;
writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Version bumped from ${currentVersion} to ${newVersion}`);
console.log(`📝 Updated package.json`);

// Try to create a git commit (if git is available and this is a git repo)
try {
  execSync('git add package.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
  console.log(`📦 Git commit created for version ${newVersion}`);
} catch (error) {
  console.log('ℹ️  Git commit skipped (not a git repo or git not available)');
}