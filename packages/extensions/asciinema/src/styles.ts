const ASCIINEMA_STYLE_ID = 'markee-asciinema-styles'

export async function loadAsciinemaStyles() {
  if (document.getElementById(ASCIINEMA_STYLE_ID)) return

  const [player, local] = await Promise.all([
    // @ts-ignore
    import('asciinema-player/dist/bundle/asciinema-player.css?raw'),
    // @ts-ignore
    import('./index.css?raw'),
  ])

  if (document.getElementById(ASCIINEMA_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = ASCIINEMA_STYLE_ID
  style.innerHTML = [player.default, local.default].join('\n')
  document.head.append(style)
}
