import { splice } from 'micromark-util-chunked'
import { classifyCharacter } from 'micromark-util-classify-character'
import { resolveAll } from 'micromark-util-resolve-all'
import { codes, constants, types } from 'micromark-util-symbol'
import type {
  Code,
  Tokenizer,
  Resolver,
  TokenTypeMap,
} from 'micromark-util-types'

interface GenericTagMicromarkOptions {
  character: keyof typeof codes
  name: string
}

/**
 * Create an extension for `micromark` to enable custom generic tag syntax.
 *
 * @param [options={}]
 *   Configuration.
 * @returns
 *   Extension for `micromark` that can be passed in `extensions`, to
 *   enable custom generic tag syntax.
 */
export function micromarkGenericTag(options: GenericTagMicromarkOptions) {
  const name = options.name

  const resolveAllGenericTag: Resolver = function (events, context) {
    let index = -1

    // Walk through all events.
    while (++index < events.length) {
      // Find a token that can close.
      if (
        events[index][0] === 'enter' &&
        events[index][1].type === name + 'SequenceTemporary' &&
        events[index][1]._close
      ) {
        let open = index

        // Now walk back to find an opener.
        while (open--) {
          // Find a token that can open the closer.
          if (
            events[open][0] === 'exit' &&
            events[open][1].type === name + 'SequenceTemporary' &&
            events[open][1]._open &&
            // If the sizes are the same:
            events[index][1].end.offset - events[index][1].start.offset ===
              events[open][1].end.offset - events[open][1].start.offset
          ) {
            events[index][1].type = (name + 'Sequence') as keyof TokenTypeMap
            events[open][1].type = (name + 'Sequence') as keyof TokenTypeMap

            /** @type {Token} */
            const genericTag = {
              type: name + '',
              start: Object.assign({}, events[open][1].start),
              end: Object.assign({}, events[index][1].end),
            }

            /** @type {Token} */
            const text = {
              type: name + 'Text',
              start: Object.assign({}, events[open][1].end),
              end: Object.assign({}, events[index][1].start),
            }

            // Opening.
            /** @type {Array<Event>} */
            const nextEvents = [
              ['enter', genericTag, context],
              ['enter', events[open][1], context],
              ['exit', events[open][1], context],
              ['enter', text, context],
            ]

            const insideSpan = context.parser.constructs.insideSpan.null

            if (insideSpan) {
              // Between.
              splice(
                nextEvents,
                nextEvents.length,
                0,
                resolveAll(insideSpan, events.slice(open + 1, index), context),
              )
            }

            // Closing.
            splice(nextEvents, nextEvents.length, 0, [
              ['exit', text, context],
              ['enter', events[index][1], context],
              ['exit', events[index][1], context],
              ['exit', genericTag, context],
            ])

            splice(events, open - 1, index - open + 3, nextEvents)

            index = open + nextEvents.length - 2
            break
          }
        }
      }
    }

    index = -1

    while (++index < events.length) {
      if (events[index][1].type === name + 'SequenceTemporary') {
        events[index][1].type = types.data
      }
    }

    return events
  }

  const tokenizeGenericTag: Tokenizer = function (effects, ok, nok) {
    const previous = this.previous
    const events = this.events
    let size = 0

    return start

    /** @type {State} */
    function start(code: Code) {
      if (
        previous === codes[options.character] &&
        events[events.length - 1][1].type !== types.characterEscape
      ) {
        return nok(code)
      }

      effects.enter((name + 'SequenceTemporary') as keyof TokenTypeMap)
      return more(code)
    }

    /** @type {State} */
    function more(code: Code) {
      const before = classifyCharacter(previous)

      if (code === codes[options.character]) {
        // If this is the third marker, exit.
        if (size > 1) return nok(code)
        effects.consume(code)
        size++
        return more
      }

      if (size < 2) return nok(code)
      const token = effects.exit(
        (name + 'SequenceTemporary') as keyof TokenTypeMap,
      )
      const after = classifyCharacter(code)
      token._open =
        !after || (after === constants.attentionSideAfter && Boolean(before))
      token._close =
        !before || (before === constants.attentionSideAfter && Boolean(after))
      return ok(code)
    }
  }

  const tokenizer = {
    tokenize: tokenizeGenericTag,
    resolveAll: resolveAllGenericTag,
  }

  return {
    text: { [codes[options.character] as unknown as string]: tokenizer },
    insideSpan: { null: [tokenizer] },
    attentionMarkers: { null: [codes[options.character]] },
  }
}
