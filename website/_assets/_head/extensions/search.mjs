import { extend } from '@markee/runtime'

extend.search.getShardingKeys = () => {
  return ['^/docs', '^/blog', '^/pages']
}

extend.search.groupResults = (results) => {
  const inDocs = results.filter((res) => res.file.startsWith('/docs'))
  const inBlog = results.filter((res) => res.file.startsWith('/blog'))
  const inPages = results.filter((res) => res.file.startsWith('/pages'))

  return [
    { sectionName: 'Docs', results: inDocs },
    { sectionName: 'Blog', results: inBlog },
    { sectionName: 'Pages', results: inPages },
  ]
}
