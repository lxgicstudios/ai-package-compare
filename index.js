#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const OpenAI = require('openai');

program
  .name('ai-package-compare')
  .description('Compare npm packages side-by-side')
  .version('1.0.0')
  .argument('<packages...>', 'Packages to compare (space-separated)')
  .option('--no-ai', 'Skip AI recommendation')
  .option('-j, --json', 'Output as JSON')
  .parse(process.argv);

const opts = program.opts();
const packages = program.args;

async function fetchNpmData(packageName) {
  try {
    // Get package info from npm registry
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) return null;
    const data = await response.json();
    
    const latest = data['dist-tags']?.latest;
    const latestVersion = data.versions?.[latest];
    
    return {
      name: data.name,
      version: latest,
      description: data.description || 'No description',
      license: data.license || latestVersion?.license || 'Unknown',
      homepage: data.homepage,
      repository: data.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, ''),
      maintainers: data.maintainers?.length || 0,
      keywords: data.keywords?.slice(0, 5) || [],
      lastPublish: data.time?.[latest],
      created: data.time?.created,
      dependencies: Object.keys(latestVersion?.dependencies || {}).length,
      devDependencies: Object.keys(latestVersion?.devDependencies || {}).length,
      hasTypes: !!(latestVersion?.types || latestVersion?.typings || data.name.startsWith('@types/')),
    };
  } catch (err) {
    return null;
  }
}

async function fetchDownloads(packageName) {
  try {
    const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${packageName}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.downloads;
  } catch (err) {
    return null;
  }
}

async function fetchBundleSize(packageName) {
  try {
    const response = await fetch(`https://bundlephobia.com/api/size?package=${packageName}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      size: data.size,
      gzip: data.gzip,
      dependencyCount: data.dependencyCount,
    };
  } catch (err) {
    return null;
  }
}

function formatBytes(bytes) {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(num) {
  if (!num) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'today';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function calculateScore(pkg, downloads, bundle) {
  let score = 50; // Base score
  
  // Downloads (weekly)
  if (downloads > 10000000) score += 25;
  else if (downloads > 1000000) score += 20;
  else if (downloads > 100000) score += 15;
  else if (downloads > 10000) score += 10;
  else if (downloads > 1000) score += 5;
  
  // Bundle size (smaller is better)
  if (bundle?.gzip) {
    if (bundle.gzip < 5000) score += 15;
    else if (bundle.gzip < 20000) score += 10;
    else if (bundle.gzip < 50000) score += 5;
    else if (bundle.gzip > 100000) score -= 5;
  }
  
  // TypeScript support
  if (pkg.hasTypes) score += 10;
  
  // Recent updates
  if (pkg.lastPublish) {
    const daysSinceUpdate = Math.floor((new Date() - new Date(pkg.lastPublish)) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate < 30) score += 10;
    else if (daysSinceUpdate < 90) score += 5;
    else if (daysSinceUpdate > 365) score -= 10;
    else if (daysSinceUpdate > 730) score -= 20;
  }
  
  // Maintainers
  if (pkg.maintainers >= 3) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

async function getAIRecommendation(packageData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  
  const openai = new OpenAI({ apiKey });
  
  const summary = packageData.map(p => `
${p.name}:
- Weekly downloads: ${formatNumber(p.downloads)}
- Bundle size (gzip): ${formatBytes(p.bundle?.gzip)}
- Last updated: ${formatDate(p.pkg?.lastPublish)}
- TypeScript: ${p.pkg?.hasTypes ? 'Yes' : 'No'}
- Dependencies: ${p.pkg?.dependencies || 'Unknown'}
- Score: ${p.score}/100
- Description: ${p.pkg?.description?.slice(0, 100) || 'N/A'}
`).join('\n');

  const prompt = `Compare these npm packages and recommend which one to use:

${summary}

Provide a brief recommendation (3-4 sentences):
1. Which package to choose and why (be specific)
2. When you might choose the alternative(s)
3. Any important tradeoffs to consider

Be direct and practical. Don't hedge.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
    });
    return response.choices[0].message.content;
  } catch (err) {
    return null;
  }
}

async function main() {
  if (packages.length < 2) {
    console.error(chalk.red('Error: Please provide at least 2 packages to compare'));
    console.log(chalk.gray('Example: npx ai-package-compare lodash underscore ramda'));
    process.exit(1);
  }
  
  console.log(chalk.bold('\n📦 Package Compare\n'));
  
  const spinner = ora('Fetching package data...').start();
  
  // Fetch all data in parallel
  const packageData = await Promise.all(
    packages.map(async (name) => {
      const [pkg, downloads, bundle] = await Promise.all([
        fetchNpmData(name),
        fetchDownloads(name),
        fetchBundleSize(name),
      ]);
      
      if (!pkg) {
        return { name, notFound: true };
      }
      
      const score = calculateScore(pkg, downloads, bundle);
      
      return { name, pkg, downloads, bundle, score };
    })
  );
  
  spinner.succeed('Data fetched');
  
  // Check for not found packages
  const notFound = packageData.filter(p => p.notFound);
  if (notFound.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Not found: ${notFound.map(p => p.name).join(', ')}`));
  }
  
  const found = packageData.filter(p => !p.notFound);
  if (found.length < 2) {
    console.error(chalk.red('Error: Need at least 2 valid packages to compare'));
    process.exit(1);
  }
  
  // JSON output
  if (opts.json) {
    console.log(JSON.stringify(found, null, 2));
    return;
  }
  
  // Display comparison
  console.log(chalk.bold('\n📊 Comparison\n'));
  
  // Table header
  const colWidth = Math.max(20, ...found.map(p => p.name.length + 2));
  const headers = ['Metric', ...found.map(p => p.name)];
  console.log(chalk.bold(headers.map((h, i) => i === 0 ? h.padEnd(18) : h.padEnd(colWidth)).join('')));
  console.log(chalk.gray('─'.repeat(18 + colWidth * found.length)));
  
  // Rows
  const metrics = [
    ['Downloads/wk', p => formatNumber(p.downloads)],
    ['Bundle (gzip)', p => formatBytes(p.bundle?.gzip)],
    ['Bundle (raw)', p => formatBytes(p.bundle?.size)],
    ['Dependencies', p => p.bundle?.dependencyCount?.toString() || p.pkg?.dependencies?.toString() || 'N/A'],
    ['TypeScript', p => p.pkg?.hasTypes ? chalk.green('✓') : chalk.red('✗')],
    ['Last update', p => formatDate(p.pkg?.lastPublish)],
    ['Maintainers', p => p.pkg?.maintainers?.toString() || 'N/A'],
    ['License', p => p.pkg?.license || 'N/A'],
    ['Score', p => {
      const score = p.score;
      if (score >= 80) return chalk.green.bold(`${score}/100`);
      if (score >= 60) return chalk.yellow.bold(`${score}/100`);
      return chalk.red.bold(`${score}/100`);
    }],
  ];
  
  for (const [label, getValue] of metrics) {
    const values = found.map(getValue);
    console.log([label.padEnd(18), ...values.map(v => String(v).padEnd(colWidth))].join(''));
  }
  
  // Descriptions
  console.log(chalk.bold('\n📝 Descriptions\n'));
  for (const p of found) {
    console.log(`${chalk.cyan(p.name)}: ${p.pkg?.description || 'No description'}`);
  }
  
  // Winner
  const sorted = [...found].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  
  console.log(chalk.bold('\n🏆 Winner by Score\n'));
  console.log(`${chalk.green.bold(winner.name)} with ${winner.score}/100`);
  
  // AI Recommendation
  if (opts.ai) {
    const aiSpinner = ora('Getting AI recommendation...').start();
    const recommendation = await getAIRecommendation(found);
    
    if (recommendation) {
      aiSpinner.succeed('AI Recommendation');
      console.log(chalk.gray('\n' + recommendation));
    } else {
      aiSpinner.warn('Set OPENAI_API_KEY for AI recommendation');
    }
  }
  
  console.log('');
}

main().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
