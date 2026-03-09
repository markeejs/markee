# @markee/diagrams

Markee extension for Mermaid and DBML diagrams.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/diagrams
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/diagrams'
```

Then write diagrams in fenced code blocks. The documented built-in fence languages are `mermaid` and `dbml`:

```mermaid
flowchart LR
  User --> Docs
  Docs --> Search
```

```dbml
Table users {
  id integer [pk]
  username varchar
}
```

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the runtime assets needed to render Mermaid and DBML diagrams in the browser.
