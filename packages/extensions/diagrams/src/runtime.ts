type MermaidModule = typeof import('mermaid')

export type DiagramRuntime = {
  dbmlRun: (source: string, format: any) => string
  select: (element: HTMLElement) => any
}

let mermaidPromise: Promise<MermaidModule['default']> | null = null
let diagramRuntimePromise: Promise<DiagramRuntime> | null = null

export function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((runtime) => {
      runtime.default.initialize({ startOnLoad: false })
      return runtime.default
    })
  }
  return mermaidPromise
}

export function loadDiagramRuntime() {
  if (!diagramRuntimePromise) {
    diagramRuntimePromise = Promise.all([
      import('@softwaretechnik/dbml-renderer'),
      import('d3-selection'),
      import('d3-graphviz'),
    ]).then(([dbmlRenderer, d3Selection]) => {
      const d3Module = d3Selection as any
      const d3 = d3Module.select ? d3Module : d3Module.default
      if (!d3 || typeof d3.select !== 'function') {
        throw new Error('Could not load d3-selection runtime.')
      }
      return {
        dbmlRun: dbmlRenderer.run as DiagramRuntime['dbmlRun'],
        select: d3.select,
      }
    })
  }
  return diagramRuntimePromise
}
