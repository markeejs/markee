---
plugins:
  tabbedContent:
    linkTabs: false
---

# LikeC4

The `@markee/likec4` extension renders LikeC4 diagrams from fenced code blocks.

Code fences tagged as `likec4` or `c4` are converted to interactive LikeC4 views at runtime.

## Usage

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/likec4'
```

Then write a LikeC4 model in a code fence:

:::tab[Example: LikeC4]

```likec4
specification {
  element actor {
    style {
      shape person
      color indigo
      icon bootstrap:person
      iconPosition top
      iconSize xl
    }
  }
  element external {
    style {
      color gray
      icon bootstrap:cloud
      iconPosition top
    }
  }
  element system {
    style {
      shape browser
      color primary
      icon bootstrap:house
      iconPosition top
    }
  }
  element service {
    style {
      shape component
      color secondary
      icon bootstrap:gear
      iconPosition top
      iconSize lg
    }
  }
  element database {
    style {
      shape cylinder
      color green
      icon tech:postgresql
      iconPosition top
    }
  }
  element queue {
    style {
      shape queue
      color amber
      icon bootstrap:gear-wide-connected
      iconPosition top
    }
  }
}
model {
  customer = actor 'Customer'
  support = actor 'Support Engineer'

  storefront = system 'Storefront'
  catalog = service 'Catalog API'
  checkout = service 'Checkout API'
  payments = service 'Payments Adapter'
  orders = service 'Order Processor'
  postgres = database 'Orders DB'
  events = queue 'Order Events'
  stripe = external 'Stripe'
  crm = external 'CRM'

  customer -> storefront 'browse and purchase'
  support -> crm 'manage tickets'
  storefront -> catalog 'search products'
  storefront -> checkout 'submit cart'
  checkout -> payments 'authorize payment'
  payments -> stripe 'charge card'
  checkout -> events 'publish order accepted'
  events -> orders 'trigger fulfillment'
  orders -> postgres 'store order state'
  orders -> crm 'sync customer timeline'
}
views {
  view landscape {
    include *
  }
}
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: LikeC4]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

---

The same works with `c4` as the language:

:::tab[Example: C4]

```c4
specification {
  element actor {
    style {
      shape person
      color indigo
      icon bootstrap:person
      iconPosition top
    }
  }
  element system {
    style {
      shape browser
      color primary
      icon bootstrap:house
      iconPosition top
    }
  }
  element service {
    style {
      shape component
      color secondary
      icon bootstrap:gear
      iconPosition top
    }
  }
  element database {
    style {
      shape cylinder
      color green
      icon tech:postgresql
      iconPosition top
    }
  }
}
model {
  customer = actor 'Customer'
  web = system 'Web App'
  api = service 'Public API'
  billing = service 'Billing Service'
  postgres = database 'Billing DB'

  customer -> web 'interacts with'
  web -> api 'calls'
  api -> billing 'creates invoices'
  billing -> postgres 'stores invoices'
}
views {
  view landscape {
    include *
  }
}
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: C4]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

These styling blocks use standard LikeC4 DSL features, so you can match the richer card style shown in the official LikeC4 demos.

## Selecting a view

If a fence defines multiple views, the extension renders the first one by default.

You can pick a specific view by adding `view=<id>` in fence meta:

To label entries in the LikeC4 control panel, set a `title` inside each view block.

:::tab[Example: Select view]

```likec4 view=overview
specification {
  element actor {
    style {
      shape person
      color indigo
      icon bootstrap:person
      iconPosition top
    }
  }
  element system {
    style {
      shape browser
      color primary
      icon bootstrap:house
      iconPosition top
    }
  }
  element service {
    style {
      shape component
      color secondary
      icon bootstrap:gear
      iconPosition top
    }
  }
  element queue {
    style {
      shape queue
      color amber
      icon bootstrap:gear-wide-connected
      iconPosition top
    }
  }
  element database {
    style {
      shape cylinder
      color green
      icon tech:postgresql
      iconPosition top
    }
  }
}
model {
  customer = actor 'Customer'
  web = system 'Web'
  api = service 'API'
  worker = service 'Worker'
  jobs = queue 'Jobs'
  db = database 'Main DB'

  customer -> web 'uses'
  web -> api 'calls'
  api -> db 'reads and writes'
  api -> jobs 'publishes jobs'
  jobs -> worker 'consumes'
  worker -> db 'updates state'
}
views {
  view overview {
    title 'Overview'
    include customer
    include web
    include api
  }
  view operations {
    title 'Operations'
    include api
    include worker
    include jobs
    include db
  }
}
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: Select view]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Interaction options

Zoom and pan are disabled by default.

Enable them per diagram with fence attributes:

When Lightbox is enabled, inline diagrams are intentionally non-interactive.
To use `zoom` and `pan`, disable Lightbox for that fence with `lightbox=false`.

:::tab[Example: Zoom and pan]

```likec4 view=overview zoom=true pan=true lightbox=false
specification {
  element actor {
    style {
      shape person
      color indigo
      icon bootstrap:person
      iconPosition top
    }
  }
  element system {
    style {
      shape browser
      color primary
      icon bootstrap:house
      iconPosition top
    }
  }
}
model {
  customer = actor 'Customer'
  app = system 'App'
  customer -> app 'uses'
}
views {
  view overview {
    include *
  }
}
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: Zoom and pan]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

---

You can also configure the rendered height limit per fence:

:::tab[Example: Max height]

```likec4 view=overview max-height='24rem'
specification {
  element actor {
    style {
      shape person
      color indigo
      icon bootstrap:person
      iconPosition top
    }
  }
  element system {
    style {
      shape browser
      color primary
      icon bootstrap:house
      iconPosition top
    }
  }
}
model {
  customer = actor 'Customer'
  app = system 'App'
  customer -> app 'uses'
}
views {
  view overview {
    include *
  }
}
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: Max height]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Notes

- No build-time preloading is required.
- Parsing and layout happen client-side when the page is rendered.
- `max-height` accepts CSS length values such as `24rem`, `480px`, `60vh`, `80%`.
