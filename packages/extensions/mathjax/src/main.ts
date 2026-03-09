import remarkMath from 'remark-math'
import rehypeMathJax from 'rehype-mathjax'
import { extend } from '@markee/runtime'

extend.markdownPipeline.remark('markee-mathjax-remark', function () {
  return remarkMath.bind(this)({
    singleDollarTextMath:
      this.data().pluginConfig('math')?.singleDollar ?? false,
  })
})

extend.markdownPipeline.rehype('markee-mathjax-rehype', rehypeMathJax)
