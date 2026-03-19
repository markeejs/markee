import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeState = ((globalThis as any).__markeeContributeRuntimeState ??= {
  config: null,
  currentFile: null,
})

const { state } = await import('@markee/runtime')
const { MarkeeContribute } = await import('./markee-contribute')

beforeEach(() => {
  runtimeState.config = null
  runtimeState.currentFile = null
  vi.restoreAllMocks()
  vi.spyOn(state.$config, 'get').mockImplementation(
    () => runtimeState.config as any,
  )
  vi.spyOn(state.$config, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$currentFile, 'get').mockImplementation(
    () => runtimeState.currentFile as any,
  )
  vi.spyOn(state.$currentFile, 'subscribe').mockImplementation(() => () => {})
})

describe('markee-contribute', () => {
  it('renders nothing when no repository is configured', async () => {
    const element = new MarkeeContribute()
    document.body.append(element)

    await element.updateComplete

    expect(element.children).toHaveLength(0)
  })

  it('captures initial innerHTML as custom content in the constructor', async () => {
    const innerHtmlGet = vi
      .spyOn(Element.prototype, 'innerHTML', 'get')
      .mockReturnValue('<strong>Custom</strong>')

    const element = new MarkeeContribute()
    innerHtmlGet.mockRestore()

    runtimeState.config = {
      repository: 'https://github.com/acme/docs/',
      repositoryRoot: '/content/',
    }
    runtimeState.currentFile = { key: 'guide/page.md' }
    document.body.append(element)

    await (element as any).updateComplete

    const link = element.querySelector('a')
    expect(link?.getAttribute('data-default')).toBeNull()
    expect(link?.innerHTML).toContain('<strong>Custom</strong>')
    expect(link?.getAttribute('href')).toBe(
      'https://github.com/acme/docs/contentguide/page.md',
    )
  })

  it('renders a file edit link with default content and default root/file fallbacks', async () => {
    runtimeState.config = {
      repository: 'https://github.com/acme/docs',
    }

    const element = new MarkeeContribute()
    element.hint = 'Change this page'
    element.icon = 'fa fa-pencil'
    document.body.append(element)

    await element.updateComplete

    const link = element.querySelector('a')
    expect(link?.getAttribute('data-default')).toBe('')
    expect(link?.getAttribute('title')).toBe('Change this page')
    expect(link?.getAttribute('href')).toBe('https://github.com/acme/docs')
    expect(link?.querySelector('i')?.className).toBe('fa fa-pencil')
  })

  it('renders a root link with default label and custom root normalization', async () => {
    runtimeState.config = {
      repository: 'https://github.com/acme/docs/',
      repositoryRoot: 'website',
    }

    const element = new MarkeeContribute()
    element.dataset.root = ''
    element.hint = 'Contribute here'
    document.body.append(element)

    await element.updateComplete

    const link = element.querySelector('a')
    expect(link?.getAttribute('data-default')).toBe('')
    expect(link?.getAttribute('title')).toBe('Contribute here')
    expect(link?.getAttribute('href')).toBe(
      'https://github.com/acme/docs/website',
    )
    expect(link?.querySelector('i')?.className).toBe('si si-github')
    expect(link?.querySelector('span')?.textContent).toBe(
      'https://github.com/acme/docs/website',
    )
  })

  it('renders a root link with custom content and label/icon overrides', async () => {
    runtimeState.config = {
      repository: 'https://github.com/acme/docs',
      repositoryRoot: '/',
    }

    const element = new MarkeeContribute()
    element.dataset.root = ''
    element.label = 'Contribute'
    element.icon = 'fa fa-code'
    element.content = '<em>Open repo</em>'
    document.body.append(element)

    await element.updateComplete

    const link = element.querySelector('a')
    expect(link?.getAttribute('data-default')).toBeNull()
    expect(link?.innerHTML).toContain('<em>Open repo</em>')
    expect(link?.getAttribute('href')).toBe('https://github.com/acme/docs/')
  })

  it('renders file links with normalized paths and default fallbacks', async () => {
    const fileRender = new MarkeeContribute()
    runtimeState.config = {
      repository: 'https://github.com/acme/docs/',
      repositoryRoot: '/src/',
    }
    runtimeState.currentFile = { key: 'page.md' }
    document.body.append(fileRender)

    await fileRender.updateComplete

    expect(fileRender.querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/acme/docs/srcpage.md',
    )
  })

  it('renders file links when the repository root has no surrounding slashes', async () => {
    runtimeState.config = {
      repository: 'https://github.com/acme/docs',
      repositoryRoot: 'src',
    }
    runtimeState.currentFile = { key: 'guide.md' }

    const element = new MarkeeContribute()
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/acme/docs/srcguide.md',
    )
  })
})
