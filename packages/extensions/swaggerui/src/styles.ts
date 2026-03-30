const SWAGGER_UI_STYLE_ID = 'markee-swaggerui-styles'

export async function loadSwaggerUiStyles() {
  if (document.getElementById(SWAGGER_UI_STYLE_ID)) return

  const [swaggerUi, local] = await Promise.all([
    // @ts-ignore
    import('swagger-ui-dist/swagger-ui.css?raw'),
    // @ts-ignore
    import('./index.css?raw'),
  ])

  if (document.getElementById(SWAGGER_UI_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = SWAGGER_UI_STYLE_ID
  style.innerHTML = [swaggerUi.default, local.default].join('\n')
  document.head.append(style)
}
