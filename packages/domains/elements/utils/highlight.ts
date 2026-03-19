import { markApi } from './mark.js'

export function highlight(
  element: HTMLElement,
  search: string,
  complementary = true,
) {
  const markable = element.querySelectorAll('[data-markable]')
  const mark = markApi.create(markable)

  markable.forEach((e: any) => {
    e.innerHTML = e.content
  })

  mark.mark(
    search
      .split(' ')
      .filter((w) => w.length > 2)
      .join(' '),
    {
      diacritics: true,
      accuracy: complementary ? 'complementary' : 'partially',
      separateWordSearch: complementary,
      caseSensitive: false,
      exclude: ['.missing', '.missing del'],
      done() {
        mark.mark(
          search
            .split(' ')
            .filter((w) => w.length <= 2)
            .join(' '),
          {
            diacritics: true,
            accuracy: 'exactly',
            separateWordSearch: complementary,
            caseSensitive: false,
            exclude: ['.missing', '.missing del'],
          },
        )
      },
    },
  )
}
