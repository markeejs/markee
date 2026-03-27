:::markee-header-section
::markee-mobile-navigation{data-root-segments=2}

# [Markee](/)

:::

:::markee-header-section
::markee-contribute{data-root data-label="Contribute"}
::markee-search{data-label="Search"}
::markee-color-scheme-manager
:::

<script type="module">
import { state } from '@markee/runtime'

state.$config.subscribe((config) => {
    if (config?.title) {
        document.querySelector('h1 > a').textContent = config.title
    }
})
</script>

<style>
h1 {
  font-size: 1.5rem;

  a {
    color: inherit;
    text-decoration: none;
  }
}
</style>
