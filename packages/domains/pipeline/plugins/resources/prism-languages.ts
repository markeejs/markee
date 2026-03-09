const commonLanguages = [
  'css',
  'javascript',
  'typescript',
  'python',
  'go',
  'bash',
  'json',
  'yaml',
  'hcl',
  'html',
  'markdown',
  'jsx',
  'tsx',
  'c',
  'cpp',
  'csharp',
]

export async function loadLanguage(lang: string) {
  await import('./prism-languages.common.js')
  if (!commonLanguages.includes(lang))
    await import('./prism-languages.others.js')
}
