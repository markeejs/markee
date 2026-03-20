import { describe, expect, it, vi } from 'vitest'

async function importMain() {
  vi.resetModules()

  const registerDiagramElement = vi.fn()
  const registerDiagramsRemark = vi.fn()

  vi.doMock('./element.js', () => ({
    registerDiagramElement,
  }))
  vi.doMock('./remark.js', () => ({
    registerDiagramsRemark,
  }))

  await import('./main.js')

  return { registerDiagramElement, registerDiagramsRemark }
}

describe('@markee/diagrams main', () => {
  it('registers the diagram element and remark plugin on import', async () => {
    const { registerDiagramElement, registerDiagramsRemark } =
      await importMain()

    expect(registerDiagramElement).toHaveBeenCalledTimes(1)
    expect(registerDiagramsRemark).toHaveBeenCalledTimes(1)
  })
})
