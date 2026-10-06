# @markee/cli

Command-line interface for creating, developing, building, and previewing Markee sites.

Full Markee documentation at https://markee.dev/

## Install

```bash
npm add -D @markee/cli
pnpm add -D @markee/cli
bun add -d @markee/cli
```

For a new project, `create-markee` is usually the better starting point:

```bash
npm create markee
pnpm create markee
yarn create markee
bun create markee
```

## Commands

```bash
markee init
markee dev
markee build
markee serve
```

- `markee init` creates a `markee.yaml` and updates `package.json`. It is called by `create-markee`.
- `markee dev` starts the development server with file watching and hot reload.
- `markee build` emits the production site to `site/` by default.
- `markee serve` serves the built output for local preview.

Every build includes `/llms.txt`, linked from the generated HTML with
`rel="describedby"`. It points agents to `/_markee/llms.html` to discover Markdown
sources through `retrieval_url` links and cite the supplied `canonical_url` links.
The generated HTML body also includes a `<noscript>` message explaining that JavaScript
is required and linking AI agents parsing the HTML to `/_markee/llms.html`.
This plain HTML index excludes entries in `navigation.files` marked hidden or draft,
and files under `/_assets/`.
Each listed entry includes its title, description, canonical URL for citations, and a link
to its Markdown source. Links are explicitly labeled `canonical_url` and `retrieval_url`.
Both guidance files put citation requirements before discovery instructions: cite only
canonical URLs, never expose retrieval endpoints or `/_markee/` URLs, and check URLs
before answering. Wrong and correct citation examples use the first listed document’s URLs.
If you provide a custom `llms.txt` in `public/`, the build prepends
Markee guidance to it, followed by a `---` separator and your original content.

## Typical Package Scripts

```json
{
  "scripts": {
    "dev": "markee dev",
    "build": "markee build",
    "preview": "markee serve"
  }
}
```

## Configuration Files

The CLI looks for configuration in the project root, in this order:

- `markee.yaml`
- `markee.yml`
- `.markeerc`

## Usage Examples

```bash
npx markee dev
npx markee build
npx markee serve
npx markee init

pnpm exec markee dev
pnpm exec markee build
pnpm exec markee serve
pnpm exec markee init

bunx markee dev
bunx markee build
bunx markee serve
bunx markee init
```

When invoked through Bun, the published `markee` bin will use Bun as its runtime automatically.
