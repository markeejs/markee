export type LikeC4Runtime = {
  createElement: typeof import('react').createElement
  createRoot: typeof import('react-dom/client').createRoot
  fromSource: typeof import('@likec4/language-services/browser').fromSource
  LikeC4ModelProvider: typeof import('@likec4/diagram').LikeC4ModelProvider
  LikeC4View: typeof import('@likec4/diagram').LikeC4View
}

let runtimePromise: Promise<LikeC4Runtime> | null = null

export function loadLikeC4Runtime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@likec4/language-services/browser'),
      import('@likec4/diagram'),
    ]).then(([react, reactDom, languageServices, diagram]) => ({
      createElement: react.createElement,
      createRoot: reactDom.createRoot,
      fromSource: languageServices.fromSource,
      LikeC4ModelProvider: diagram.LikeC4ModelProvider,
      LikeC4View: diagram.LikeC4View,
    }))
  }

  return runtimePromise
}
