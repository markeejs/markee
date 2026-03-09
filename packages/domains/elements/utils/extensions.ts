export function safelyRun<T>(fn: () => T, fallback: T) {
  try {
    return fn()
  } catch (err: any) {
    if ('stack' in err) {
      const stack = err.stack.split('\n')
      const fnLine = stack.find((line: string) => line.includes('extend.'))
      const [, fn] = fnLine.match(/extend\.([^ ]*)/)
      console.log(
        `An error occurred in the provided \x1B[1m${fn}\x1B[m extension function`,
      )
    } else {
      console.log('An error occurred in a provided extension function')
    }
    console.error(err)
  }

  return fallback
}
