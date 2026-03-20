import { describe, expect, it, vi } from 'vitest'

const { remark, rehype, remarkMath, rehypeMathJax } = vi.hoisted(() => {
  return {
    remark: vi.fn(),
    rehype: vi.fn(),
    remarkMath: vi.fn(function (this: unknown, options: unknown) {
      return {
        context: this,
        options,
      }
    }),
    rehypeMathJax: vi.fn(),
  }
})

vi.mock('@markee/runtime', () => ({
  extend: {
    markdownPipeline: {
      remark,
      rehype,
    },
  },
}))
vi.mock('remark-math', () => ({
  default: remarkMath,
}))
vi.mock('rehype-mathjax', () => ({
  default: rehypeMathJax,
}))

await import('./main.js')

describe('@markee/mathjax', () => {
  it('registers remark and rehype plugins and forwards math config to remark-math', () => {
    expect(remark).toHaveBeenCalledTimes(1)
    expect(remark).toHaveBeenCalledWith(
      'markee-mathjax-remark',
      expect.any(Function),
    )
    expect(rehype).toHaveBeenCalledWith('markee-mathjax-rehype', rehypeMathJax)

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
})
