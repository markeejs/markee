import type { Processor } from 'unified'
import { extend } from '@markee/runtime'
import remarkMath from 'remark-math'

extend.markdownPipeline.remark(
  'markee-mathjax-remark',
  function (this: Processor) {
    const { pluginConfig } = this.data()
    return remarkMath.bind(this)({
      singleDollarTextMath:
        pluginConfig<{ singleDollar?: boolean }>('math')?.singleDollar ?? false,
    })
  },
)

let rehypeMathJaxModule: Promise<typeof import('rehype-mathjax')> | undefined

function loadRehypeMathJax() {
  rehypeMathJaxModule ??= import('rehype-mathjax')
  return rehypeMathJaxModule
}

extend.markdownPipeline.rehype(
  'markee-mathjax-rehype',
  function (this: Processor) {
    const { content } = this.data()
    if (!content.includes('$')) return () => {}

    let transformPromise: Promise<any> | undefined

    return async (tree, file) => {
      transformPromise ??= loadRehypeMathJax().then(
        ({ default: rehypeMathJax }) => rehypeMathJax.call(this),
      )

      const transform = await transformPromise
      return transform?.(tree, file)
    }
  },
)
