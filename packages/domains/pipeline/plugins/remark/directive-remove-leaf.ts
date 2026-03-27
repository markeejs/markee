import type { Data, Processor } from 'unified'

type DirectiveProcessorData = Data & {
  micromarkExtensions: any[]
}

export function remarkDirectiveRemoveLeaf(this: Processor) {
  // This is a micromark extension, used to undo some changes done by remarkDirective

  // We start by getting the data from the processor, which contain micromark extensions
  const data = this.data() as DirectiveProcessorData
  const mmExts = data.micromarkExtensions

  // We then find the directive extension by finding the extension reacting to character `:`
  const directiveKey = `${':'.charCodeAt(0)}`
  const directiveExt = mmExts.find((ext) =>
    Object.keys(ext.flow ?? {}).includes(directiveKey),
  )!

  // We remove the extension's behavior on text (:inline construct)
  delete directiveExt.text
}
