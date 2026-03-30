const REVEAL_STYLE_ID = 'markee-revealjs-styles'

export async function loadRevealStyles() {
  if (document.getElementById(REVEAL_STYLE_ID)) return

  const [reveal, theme, local] = await Promise.all([
    // @ts-ignore
    import('reveal.js/dist/reveal.css?raw'),
    // @ts-ignore
    import('reveal.js/dist/theme/simple.css?raw'),
    // @ts-ignore
    import('./index.css?raw'),
  ])

  if (document.getElementById(REVEAL_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = REVEAL_STYLE_ID
  style.innerHTML = [reveal.default, theme.default, local.default].join('\n')
  document.head.append(style)
}
