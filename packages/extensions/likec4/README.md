# @markee/likec4

Markee extension for rendering LikeC4 diagrams.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/likec4
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/likec4'
```

Then write a LikeC4 model in a `likec4` or `c4` fence:

```likec4
specification {
  element actor
  element system
  element service
}
model {
  customer = actor 'Customer'
  app = system 'Web App'
  api = service 'API'

  customer -> app 'uses'
  app -> api 'calls'
}
views {
  view overview {
    include *
  }
}
```

If a fence defines multiple views, you can select one with fence meta such as `view=overview`.

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the client runtime required to render LikeC4 diagrams inside Markee pages.
