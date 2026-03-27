import type { Processor } from 'unified'
import remarkMath from 'remark-math'
import rehypeMathJax from 'rehype-mathjax'
import { extend } from '@markee/runtime'

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

extend.markdownPipeline.rehype('markee-mathjax-rehype', rehypeMathJax)
