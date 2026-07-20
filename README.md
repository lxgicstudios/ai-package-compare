# ai-package-compare

Compare npm packages side-by-side. See size, downloads, maintenance, and get an AI recommendation.


## Works With

- 🤖 Claude / Claude Code
- 🔵 Cursor
- 💚 GPT / ChatGPT
- ⚡ Copilot
- 🧩 MCP servers

## Install

```bash
npx ai-package-compare lodash underscore
```

## What it does

- Compares bundle size (minified + gzipped)
- Shows weekly download counts
- Checks TypeScript support
- Tracks maintenance activity
- Calculates a quality score (0-100)
- AI-powered recommendation for which to choose

## Usage

```bash
# Compare two packages
npx ai-package-compare lodash underscore

# Compare multiple
npx ai-package-compare react preact solid-js

# State management
npx ai-package-compare zustand jotai redux

# HTTP clients
npx ai-package-compare axios ky got node-fetch

# Date libraries
npx ai-package-compare dayjs date-fns moment luxon

# Skip AI recommendation
npx ai-package-compare lodash underscore --no-ai

# Output as JSON
npx ai-package-compare lodash underscore -j
```

## Example Output

```
📦 Package Compare

✔ Data fetched

📊 Comparison

Metric            lodash              underscore
──────────────────────────────────────────────────
Downloads/wk      52.3M               6.8M
Bundle (gzip)     24.5 KB             7.2 KB
Bundle (raw)      72.5 KB             18.8 KB
Dependencies      0                   0
TypeScript        ✓                   ✗
Last update       2mo ago             8mo ago
Maintainers       3                   1
License           MIT                 MIT
Score             85/100              62/100

📝 Descriptions

lodash: Lodash modular utilities.
underscore: JavaScript's functional programming helper library.

🏆 Winner by Score

lodash with 85/100

✔ AI Recommendation

Go with lodash. It has 8x the downloads, better TypeScript support, 
and more active maintenance. The larger bundle size is offset by 
tree-shaking support - you only ship what you use. Pick underscore 
if you need the absolute smallest bundle and don't need TypeScript.
```

## Scoring Criteria

| Factor | Points |
|--------|--------|
| Downloads > 10M/week | +25 |
| Downloads > 1M/week | +20 |
| Bundle < 5KB gzip | +15 |
| TypeScript support | +10 |
| Updated < 30 days | +10 |
| 3+ maintainers | +5 |
| No updates > 1 year | -10 |

## Options

| Flag | Description |
|------|-------------|
| `--no-ai` | Skip AI recommendation |
| `-j, --json` | Output as JSON |

## AI Recommendation

Set `OPENAI_API_KEY` for personalized recommendations:

```bash
export OPENAI_API_KEY=your-key
npx ai-package-compare zustand jotai redux
```

## FAQ

### Where does the data come from?

Bundle sizes from Bundlephobia, download counts from npm registry, maintenance data from npms.io. All real-time.

### Can I compare packages from different registries?

Currently npm only. Support for other registries is planned.

### Why does the AI sometimes recommend the lower-scored package?

The score is objective metrics. The AI considers your use case, bundle size tradeoffs, and ecosystem fit. Sometimes smaller/newer is better.

### How often is pricing/bundle data updated?

Data is fetched live on each run. Bundle sizes update when packages publish new versions.

## License

MIT

---

Built by LXGIC Studios
🔗 [GitHub](https://github.com/lxgicstudios) · [Twitter](https://twitter.com/lxgicstudios)
💡 Want more free tools like this? We have 100+ on our GitHub: github.com/lxgicstudios
