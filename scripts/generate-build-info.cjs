#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function gitCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

const info = {
  commit: gitCommit(),
  builtAt: new Date().toISOString(),
  version: require('../package.json').version,
};
fs.writeFileSync(path.join(__dirname, '..', 'public', 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`Build info: ${info.commit.slice(0, 12)} at ${info.builtAt}`);

