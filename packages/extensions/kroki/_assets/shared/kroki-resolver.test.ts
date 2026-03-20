import { describe, expect, it, vi } from 'vitest'

async function importResolver() {
  vi.resetModules()
  return await import('./kroki-resolver.mjs')
}

describe('@markee/kroki resolver', () => {
  it('posts kroki requests and returns the rendered svg text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue('<svg>ok</svg>'),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadKrokiDiagram } = await importResolver()
    await expect(
      loadKrokiDiagram('mermaid', 'https://kroki.io/', 'graph TD;A-->B'),
    ).resolves.toBe('<svg>ok</svg>')

    expect(fetchMock).toHaveBeenCalledWith('https://kroki.io/mermaid', {
      method: 'POST',
      body: JSON.stringify({
        diagram_source: 'graph TD;A-->B',
        output_format: 'svg',
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'image/svg+xml',
      },
    })
  })

  it('returns a formatted error block when rendering fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const { loadKrokiDiagram } = await importResolver()
    await expect(
      loadKrokiDiagram('blockdiag', 'https://kroki.io', 'x'),
    ).resolves.toContain('Error during rendering: Error: boom')
  })
})
