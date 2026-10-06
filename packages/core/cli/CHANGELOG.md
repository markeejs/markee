# @markee/cli

## 0.3.0

### Minor Changes

- eea6057: Generate /\_markee/llms.txt on every build and link it from the HTML head with rel="describedby" to help LLMs discover Markdown sources and cite canonical documentation pages.

### Patch Changes

- 758930a: Strengthen AI citation guidance and explicitly label retrieval and canonical URLs in the HTML documentation index.

  Publish guidance at /llms.txt, merging custom guidance after a separator, and exclude asset files from the HTML documentation index.

- ea2f225: Reduce the LLM HTML index to a discovery manifest with content_url and canonical_url links, omitting document titles, descriptions, and excerpts.
- 67356ff: Generate a plain HTML documentation index at /\_markee/llms.html and link to it from the noscript guidance for AI agents.
- 95d9112: Add a noscript message to built HTML explaining the JavaScript requirement and linking AI agents to /\_markee/llms.txt, alongside the existing describedby link in the head.
  - @markee/client@0.3.0
  - @markee/default@0.3.0
  - @markee/runtime@0.3.0
  - @markee/types@0.3.0

## 0.2.0

### Minor Changes

- f989196: Fix public files in broken links detection

  Fix dark theme when set to auto

### Patch Changes

- Updated dependencies [f989196]
  - @markee/client@0.2.0
  - @markee/runtime@0.2.0
  - @markee/default@0.2.0
  - @markee/types@0.2.0
