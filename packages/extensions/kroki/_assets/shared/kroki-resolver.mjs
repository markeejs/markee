let queue = Promise.resolve()
export async function loadKrokiDiagram(engine, server, content) {
  const url = new URL(server)
  url.pathname = engine

  queue = queue
    .then(() =>
      fetch(url.toString(), {
        method: 'POST',
        body: JSON.stringify({
          diagram_source: content,
          output_format: 'svg',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'image/svg+xml',
        },
      }),
    )
    .catch((err) => ({
      text: () =>
        `<div class="markee-kroki-error">Error during rendering: ${err}</div>`,
    }))
    .then((res) => res.text())

  return queue
}
