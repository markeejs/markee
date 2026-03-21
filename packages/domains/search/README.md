# @markee/search

Client-side search indexer for Markee.

Full Markee documentation at https://markee.dev/

## Introduction

`@markee/search` exports `MarkeeSearchIndexer` and the related search, filter, and indexing types used to build ranked in-browser search experiences.

The indexer supports:

- weighted text fields
- fuzzy matching
- phrase and proximity boosts
- predicate filters
- optional prefilter indexes for faster filtering on large datasets

## Example

```ts
import { MarkeeSearchIndexer } from '@markee/search'

const index = new MarkeeSearchIndexer(
  [
    {
      id: 'intro',
      title: 'Getting Started',
      body: 'Install Markee and run the development server',
      tags: ['docs', 'guide'],
    },
  ],
  {
    textFields: {
      title: { weight: 3, exactMatchBoost: 1.2 },
      body: { weight: 1, proximityBoost: true },
    },
    prefilterIndexes: {
      tags: { normalize: 'fold' },
    },
  },
)

const docsOnly = index.anyOf('tags', ['docs'])
const results = index.search('getting started', {
  filters: [docsOnly],
  limit: 10,
})
```

## Notes

This is an internal package used by `@markee/client`.

It is not intended to be used outside of `@markee/client`.
