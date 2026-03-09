import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import { state } from '@markee/runtime'
import { MarkeeElement } from '@markee/runtime'

import {
  getFileFromLink,
  getVersionedFolderFileLink,
} from '../utils/navigation.js'

import './markee-version.css'

function saveVersion(key: string, version: string) {
  const changed =
    sessionStorage.getItem('marbles::versioned-content::' + key) !== version
  sessionStorage.setItem('marbles::versioned-content::' + key, version)
  return changed
}

function getVersionName(
  folders: Record<string, PagesFile>,
  files: Record<string, MarkdownFile>,
  file: string,
) {
  return (
    files[file]?.frontMatter?.version?.name ??
    files[file]?.frontMatter?.title ??
    folders[file]?.version?.name ??
    folders[file]?.title ??
    folders[file]?.inferredTitle ??
    ''
  )
}

function getVersionInformation(latestLabel?: string) {
  const { folders, files, tree } = state.$navigation.get()
  const currentFile = state.$currentFile.get()

  const parent = tree
    .getAncestorsForKey(currentFile?.key ?? '')
    .reverse()
    .find((item) => 'versions' in item && item.versions?.length) as
    | TreeItem
    | undefined
  const currentVersion = parent?.versions?.find(
    (version) => currentFile?.key && currentFile.key.startsWith(version.key),
  )

  const versionInfo = parent?.versions?.map((version, i) => {
    let destinationLink = ''
    if (files[version.key]?.link) {
      destinationLink = files[version.key].link
    }

    if (folders[version.key]) {
      destinationLink = getVersionedFolderFileLink(
        folders[currentVersion?.key as string],
        folders[version.key],
        currentFile?.link as string,
      )
    }

    const disabled = !getFileFromLink(destinationLink)

    return {
      value: version.key,
      label:
        getVersionName(folders, files, version.key) +
        (i || latestLabel === '' ? '' : ` (${latestLabel ?? 'Latest'})`),
      disabled: !!i && disabled,
      destinationLink: disabled ? parent?.outdated : destinationLink,
    }
  })

  return {
    parent,
    currentVersion,
    currentFile,
    files,
    folders,
    versionInfo,
  }
}

@customElement('markee-version-dropdown')
export class MarkeeVersionDropdown extends MarkeeElement.with({
  stores: [state.$navigation, state.$currentLoader, state.$currentFile],
}) {
  @property({ type: String, attribute: 'data-title' })
  titleLabel?: string

  render() {
    const { tree } = state.$navigation.get()
    const { versionInfo, parent, currentVersion } = getVersionInformation(
      this.titleLabel,
    )

    if (
      parent &&
      currentVersion?.key &&
      saveVersion(parent?.key, currentVersion?.key)
    ) {
      tree.reload()
    }

    if (!parent) {
      return nothing
    }

    return html`
      <markee-select
        .value=${currentVersion?.key}
        @change=${(e: Event) => {
          const target = e.currentTarget as HTMLSelectElement
          const option = versionInfo?.find((v) => v.value === target.value)
          if (option?.destinationLink && !option.disabled) {
            state.$router.get().navigate.open(option.destinationLink)
          }
        }}
      >
        ${versionInfo?.map(
          (info) => html`
            <markee-option value=${info.value}>${info.label}</markee-option>
          `,
        )}
      </markee-select>
    `
  }
}

@customElement('markee-version-warning')
export class MarkeeVersionWarning extends MarkeeElement.with({
  stores: [state.$navigation, state.$currentLoader, state.$currentFile],
}) {
  @property({ type: String, attribute: 'data-title' })
  titleLabel?: string

  render() {
    const { parent, currentVersion, currentFile, files, folders } =
      getVersionInformation()
    const parentInfo = folders[parent?.key as string]
    const latestVersion = parent?.versions?.[0]

    if (!parent || currentVersion === latestVersion) {
      return nothing
    }

    const destinationLink = parentInfo?.version?.folder
      ? getVersionedFolderFileLink(
          folders[currentVersion?.key as string],
          folders[parentInfo?.versions?.[0]?.key as string],
          currentFile?.link as string,
        )
      : files[parentInfo?.versions?.[0]?.key as string]?.link
    const destinationFile = getFileFromLink(destinationLink)

    if (!destinationLink) {
      return nothing
    }

    return html`
      <div class="mk-admonition mk-warning">
        ${
          this.titleLabel
            ? html` <span class="mk-admonition-title">${this.titleLabel}</span> `
            : nothing
        }

        <div class="mk-admonition-content">
          You are currently viewing this document in version
          <strong>
            ${getVersionName(folders, files, currentVersion?.key as string)}
          </strong>
          .
          ${
            destinationFile &&
            html`
            The latest version is
            <a href=${destinationLink}>
              <strong>
                ${getVersionName(folders, files, latestVersion?.key as string)}
              </strong>
            </a>
            .
          `
          }
          ${
            !destinationFile
              ? html`
                <br />
                This file does not exist anymore on the latest version. Open
                <a href="${parent.outdated}">
                  <strong>
                    ${getVersionName(folders, files, latestVersion?.key as string)}
                  </strong>
                </a>
                .
              `
              : nothing
          }
        </div>
      </div>
    `
  }
}
