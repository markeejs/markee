import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import { MarkeeVersionDropdown, MarkeeVersionWarning } from './markee-version'

const runtimeState = {
  navigation: {
    files: {} as Record<string, any>,
    folders: {} as Record<string, any>,
    tree: { getAncestorsForKey: () => [] as any[], reload: vi.fn() },
  },
  currentFile: null as any,
  currentLoader: { data: null, error: null, loading: false } as ReturnType<
    typeof state.$currentLoader.get
  >,
  router: {
    navigate: {
      open: vi.fn(),
      replace: vi.fn(),
    },
  } as ReturnType<typeof state.$router.get>,
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()

  runtimeState.navigation = {
    files: {},
    folders: {},
    tree: { getAncestorsForKey: () => [] as any[], reload: vi.fn() },
  }
  runtimeState.currentFile = null
  runtimeState.currentLoader = { data: null, error: null, loading: false }
  runtimeState.router = {
    navigate: {
      open: vi.fn(),
      replace: vi.fn(),
    },
  } as ReturnType<typeof state.$router.get>

  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => runtimeState.navigation as any,
  )
  vi.spyOn(state.$navigation, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$currentFile, 'get').mockImplementation(
    () => runtimeState.currentFile,
  )
  vi.spyOn(state.$currentFile, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$currentLoader, 'get').mockImplementation(
    () => runtimeState.currentLoader,
  )
  vi.spyOn(state.$currentLoader, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$router, 'get').mockImplementation(() => runtimeState.router)
})

function createVersionedState({
  currentVersionKey = 'docs/v1',
  currentLink = '/docs/v1/guide',
  latestLink = '/docs/v2/guide',
  latestFileExists = true,
  latestLabel,
}: {
  currentVersionKey?: string
  currentLink?: string
  latestLink?: string
  latestFileExists?: boolean
  latestLabel?: string
} = {}) {
  const parent = {
    key: 'docs',
    outdated: '/docs/latest',
    versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }],
  }
  const reload = vi.fn()

  runtimeState.navigation = {
    tree: {
      getAncestorsForKey: () => [parent],
      reload,
    },
    files: latestFileExists
      ? {
          'docs/v2': {
            link: latestLink,
            frontMatter: { version: { name: '2.x' } },
          },
        }
      : {},
    folders: {
      'docs': {
        version: { folder: true },
        versions: parent.versions,
      },
      'docs/v1': {
        link: '/docs/v1',
        title: 'Version 1',
      },
      'docs/v2': {
        link: '/docs/v2',
        inferredTitle: 'Version 2',
      },
    },
  }
  runtimeState.currentFile = {
    key: `${currentVersionKey}/guide.md`,
    link: currentLink,
  }

  const dropdown = new MarkeeVersionDropdown()
  if (latestLabel !== undefined) dropdown.titleLabel = latestLabel

  return { dropdown, parent, reload }
}

describe('markee-version-dropdown', () => {
  it('renders nothing when the current file is not inside a versioned parent', async () => {
    const element = new MarkeeVersionDropdown()
    document.body.append(element)

    await element.updateComplete

    expect(element.innerHTML).toBe('<!---->')
  })

  it('renders version options, persists the current version, and reloads the tree when it changes', async () => {
    const { dropdown, parent, reload } = createVersionedState()
    document.body.append(dropdown)

    await dropdown.updateComplete

    const options = [...dropdown.querySelectorAll('markee-option')]
    expect(options).toHaveLength(2)
    expect(options[0]?.getAttribute('value')).toBe('docs/v2')
    expect(options[0]?.textContent?.trim()).toBe('2.x (Latest)')
    expect(options[1]?.textContent?.trim()).toBe('Version 1')
    expect(
      sessionStorage.getItem(`marbles::versioned-content::${parent.key}`),
    ).toBe('docs/v1')
    expect(reload).toHaveBeenCalledOnce()

    const second = new MarkeeVersionDropdown()
    document.body.append(second)
    await second.updateComplete

    expect(reload).toHaveBeenCalledOnce()
  })

  it('omits the latest suffix when the title label is empty and navigates on selectable changes', async () => {
    const { dropdown } = createVersionedState({ latestLabel: '' })
    runtimeState.navigation.files['docs/v2'].frontMatter = {
      title: 'Latest docs',
    }
    document.body.append(dropdown)

    await dropdown.updateComplete

    expect(dropdown.querySelector('markee-option')?.textContent?.trim()).toBe(
      'Latest docs',
    )

    const select = dropdown.querySelector('markee-select') as HTMLElement & {
      value: string
    }
    select.value = 'docs/v2'
    select.dispatchEvent(new Event('change'))

    expect(runtimeState.router.navigate.open).toHaveBeenCalledWith(
      '/docs/v2/guide',
    )
  })

  it('does not navigate when a selected version is disabled', async () => {
    const { dropdown } = createVersionedState({ latestFileExists: false })
    document.body.append(dropdown)

    await dropdown.updateComplete

    const select = dropdown.querySelector('markee-select') as HTMLElement & {
      value: string
    }
    select.value = 'docs/v1'
    select.dispatchEvent(new Event('change'))

    expect(runtimeState.router.navigate.open).not.toHaveBeenCalled()
  })
})

describe('markee-version-warning', () => {
  it('renders nothing for the latest version or when no destination link exists', async () => {
    const latest = new MarkeeVersionWarning()
    runtimeState.navigation = {
      files: {},
      folders: {},
      tree: {
        getAncestorsForKey: () => [
          {
            key: 'docs',
            outdated: '/docs/latest',
            versions: [{ key: 'docs/v1' }],
          },
        ],
        reload: vi.fn(),
      },
    }
    runtimeState.currentFile = {
      key: 'docs/v1/guide.md',
      link: '/docs/v1/guide',
    }
    document.body.append(latest)
    await latest.updateComplete

    expect(latest.innerHTML).toBe('<!---->')

    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: () => [
          {
            key: 'docs',
            outdated: '/docs/latest',
            versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }],
          },
        ],
        reload: vi.fn(),
      },
      files: {},
      folders: {
        'docs': { versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }] },
        'docs/v1': { link: '/docs/v1' },
        'docs/v2': {},
      },
    }
    runtimeState.currentFile = {
      key: 'docs/v1/guide.md',
      link: '/docs/v1/guide',
    }

    const missingDestination = new MarkeeVersionWarning()
    document.body.append(missingDestination)
    await missingDestination.updateComplete

    expect(missingDestination.innerHTML).toBe('<!---->')
  })

  it('renders a warning with a link to the latest available version', async () => {
    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: () => [
          {
            key: 'docs',
            outdated: '/docs/latest',
            versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }],
          },
        ],
        reload: vi.fn(),
      },
      files: {
        'docs/v2': {
          link: '/docs/v2/guide',
          frontMatter: { version: { name: '2.x' } },
        },
      },
      folders: {
        'docs': {
          title: 'Docs',
          version: { folder: false },
          versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }],
        },
        'docs/v1': {
          title: 'Version 1',
        },
      },
    }
    runtimeState.currentFile = {
      key: 'docs/v1/guide.md',
      link: '/docs/v1/guide',
    }

    const element = new MarkeeVersionWarning()
    document.body.append(element)

    await element.updateComplete

    expect(element.textContent).toContain(
      'You are currently viewing this document in version',
    )
    expect(element.textContent).toContain('Version 1')
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/docs/v2/guide',
    )
    expect(element.textContent).toContain('2.x')
  })

  it('renders the outdated-file warning and optional title label when the latest file is missing', async () => {
    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: () => [
          {
            key: 'docs',
            outdated: '/docs/latest',
            versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }],
          },
        ],
        reload: vi.fn(),
      },
      files: {},
      folders: {
        'docs': {
          title: 'Docs',
          version: { folder: true },
          versions: [{ key: 'docs/v2' }, { key: 'docs/v1' }],
        },
        'docs/v1': {
          link: '/docs/v1',
          title: 'Version 1',
        },
        'docs/v2': {
          link: '/docs/v2',
          version: { name: 'Version 2' },
        },
      },
    }
    runtimeState.currentFile = {
      key: 'docs/v1/guide.md',
      link: '/docs/v1/guide',
    }

    const element = new MarkeeVersionWarning()
    element.titleLabel = 'Outdated'
    document.body.append(element)

    await element.updateComplete

    expect(
      element.querySelector('.mk-admonition-title')?.textContent?.trim(),
    ).toBe('Outdated')
    expect(element.textContent).toContain(
      'This file does not exist anymore on the latest version.',
    )
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/docs/latest',
    )
    expect(element.textContent).toContain('Version 2')
  })
})
