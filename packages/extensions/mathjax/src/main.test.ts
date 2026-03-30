import { describe, expect, it, vi } from 'vitest'

async function importMain() {
  vi.resetModules()

  const remark = vi.fn()
  const rehype = vi.fn()
  const remarkMath = vi.fn(function (this: unknown, options: unknown) {
    return {
      context: this,
      options,
    }
  })
  const rehypeTransform = vi.fn()
  const rehypeMathJax = vi.fn(function (this: unknown) {
    return rehypeTransform
  })

  let rehypeMathJaxImports = 0

  vi.doMock('@markee/runtime', () => ({
    extend: {
      markdownPipeline: {
        remark,
        rehype,
      },
    },
  }))
  vi.doMock('remark-math', () => ({
    default: remarkMath,
  }))
  vi.doMock('rehype-mathjax', () => {
    rehypeMathJaxImports += 1
    return {
      default: rehypeMathJax,
    }
  })

  await import('./main.js')

  return {
    remark,
    rehype,
    remarkMath,
    rehypeMathJax,
    rehypeTransform,
    getRehypeMathJaxImports: () => rehypeMathJaxImports,
  }
}

describe('@markee/mathjax', () => {
  it('registers remark and rehype plugins and forwards math config to remark-math', async () => {
    const { remark, rehype, remarkMath, getRehypeMathJaxImports } =
      await importMain()

    expect(remark).toHaveBeenCalledTimes(1)
    expect(remark).toHaveBeenCalledWith(
      'markee-mathjax-remark',
      expect.any(Function),
    )
    expect(rehype).toHaveBeenCalledTimes(1)
    expect(rehype).toHaveBeenCalledWith(
      'markee-mathjax-rehype',
      expect.any(Function),
    )
    expect(getRehypeMathJaxImports()).toBe(0)

    const factory = remark.mock.calls[0]?.[1] as Function
    const withSingleDollar = {
      data: () => ({
        pluginConfig: () => ({ singleDollar: true }),
      }),
    }
    const withoutSingleDollar = {
      data: () => ({
        pluginConfig: () => undefined,
      }),
    }

    expect(factory.call(withSingleDollar)).toEqual({
      context: withSingleDollar,
      options: { singleDollarTextMath: true },
    })
    expect(factory.call(withoutSingleDollar)).toEqual({
      context: withoutSingleDollar,
      options: { singleDollarTextMath: false },
    })
    expect(remarkMath).toHaveBeenNthCalledWith(1, {
      singleDollarTextMath: true,
    })
    expect(remarkMath).toHaveBeenNthCalledWith(2, {
      singleDollarTextMath: false,
    })
  })

  it('skips loading rehype-mathjax when the content has no math markers', async () => {
    const { rehype, rehypeMathJax, getRehypeMathJaxImports } =
      await importMain()

    const factory = rehype.mock.calls[0]?.[1] as Function
    const transform = factory.call({
      data: () => ({
        content: 'No math here.',
      }),
    }) as (tree: unknown, file: unknown) => unknown

    expect(transform).toEqual(expect.any(Function))
    expect(transform({}, {})).toBeUndefined()
    expect(getRehypeMathJaxImports()).toBe(0)
    expect(rehypeMathJax).not.toHaveBeenCalled()
  })

  it('lazy-loads rehype-mathjax when math markers are present and reuses the transform', async () => {
    const { rehype, rehypeMathJax, rehypeTransform, getRehypeMathJaxImports } =
      await importMain()

    const factory = rehype.mock.calls[0]?.[1] as Function
    const processor = {
      data: () => ({
        content: 'Euler wrote $e^{i\\pi} + 1 = 0$.',
      }),
    }
    const transform = factory.call(processor) as (
      tree: unknown,
      file: unknown,
    ) => Promise<unknown>
    const tree = { type: 'root' }
    const file = { path: '/doc.md' }

    await transform(tree, file)
    await transform(tree, file)

    expect(getRehypeMathJaxImports()).toBe(1)
    expect(rehypeMathJax).toHaveBeenCalledTimes(1)
    expect(rehypeMathJax.mock.contexts[0]).toBe(processor)
    expect(rehypeTransform).toHaveBeenCalledTimes(2)
    expect(rehypeTransform).toHaveBeenNthCalledWith(1, tree, file)
    expect(rehypeTransform).toHaveBeenNthCalledWith(2, tree, file)
  })
})
