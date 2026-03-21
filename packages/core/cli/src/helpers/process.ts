import {
  execFile as nodeExecFile,
  execFileSync as nodeExecFileSync,
} from 'node:child_process'

type ProcessStdio = 'pipe' | 'ignore'

type ProcessOptions = {
  cwd?: string
  stdin?: ProcessStdio
  stdout?: ProcessStdio
  stderr?: ProcessStdio
  acceptExitCode?: (exitCode: number) => boolean
}

type ProcessResult = {
  stdout: string
  stderr: string
  exitCode: number
}

type BunSpawnedProcess = {
  stdout?: ReadableStream<Uint8Array> | null
  stderr?: ReadableStream<Uint8Array> | null
  exited: Promise<number>
}

type BunSyncProcessResult = {
  stdout?: Uint8Array | string | null
  stderr?: Uint8Array | string | null
  exitCode: number
}

type BunRuntime = {
  spawn?: (
    cmd: string[],
    options?: {
      cwd?: string
      stdin?: ProcessStdio
      stdout?: ProcessStdio
      stderr?: ProcessStdio
    },
  ) => BunSpawnedProcess
  spawnSync?: (
    cmd: string[],
    options?: {
      cwd?: string
      stdin?: ProcessStdio
      stdout?: ProcessStdio
      stderr?: ProcessStdio
    },
  ) => BunSyncProcessResult
}

function getBunRuntime() {
  return (globalThis as typeof globalThis & { Bun?: BunRuntime }).Bun
}

function toText(output?: Uint8Array | string | null) {
  if (output == null) return ''
  if (typeof output === 'string') return output
  return Buffer.from(output).toString('utf8')
}

async function streamToText(stream?: ReadableStream<Uint8Array> | null) {
  if (!stream) return ''
  return await new Response(stream).text()
}

function buildError(file: string, args: string[], result: ProcessResult) {
  return Object.assign(
    new Error(
      result.stderr || `${file} exited with status code ${result.exitCode}`,
    ),
    result,
    {
      command: [file, ...args],
    },
  )
}

function didProcessSucceed(exitCode: number, options: ProcessOptions) {
  return options.acceptExitCode?.(exitCode) ?? exitCode === 0
}

export const ProcessHelpers = {
  async execFile(
    file: string,
    args: string[],
    options: ProcessOptions = {},
  ): Promise<ProcessResult> {
    const bun = getBunRuntime()

    if (bun?.spawn) {
      const child = bun.spawn([file, ...args], options)
      const [stdout, stderr, exitCode] = await Promise.all([
        streamToText(child.stdout),
        streamToText(child.stderr),
        child.exited,
      ])
      const result = { stdout, stderr, exitCode }

      if (!didProcessSucceed(exitCode, options))
        throw buildError(file, args, result)
      return result
    }

    return await new Promise((resolve, reject) => {
      nodeExecFile(
        file,
        args,
        {
          cwd: options.cwd,
          encoding: 'utf8',
        },
        (error, stdout = '', stderr = '') => {
          const result = {
            stdout,
            stderr,
            exitCode:
              typeof (error as { code?: unknown } | null)?.code === 'number'
                ? (error as { code: number }).code
                : error
                  ? 1
                  : 0,
          }

          if (error) {
            if (didProcessSucceed(result.exitCode, options)) {
              resolve(result)
              return
            }
            reject(Object.assign(error, result, { command: [file, ...args] }))
            return
          }

          resolve(result)
        },
      )
    })
  },

  execFileSync(
    file: string,
    args: string[],
    options: ProcessOptions = {},
  ): ProcessResult {
    const bun = getBunRuntime()

    if (bun?.spawnSync) {
      const result = bun.spawnSync([file, ...args], options)
      const output = {
        stdout: toText(result.stdout),
        stderr: toText(result.stderr),
        exitCode: result.exitCode,
      }

      if (!didProcessSucceed(output.exitCode, options))
        throw buildError(file, args, output)
      return output
    }

    try {
      const stdout = nodeExecFileSync(file, args, {
        cwd: options.cwd,
        encoding: 'utf8',
        stdio: [
          options.stdin ?? 'pipe',
          options.stdout ?? 'pipe',
          options.stderr ?? 'pipe',
        ],
      })

      return {
        stdout,
        stderr: '',
        exitCode: 0,
      }
    } catch (error) {
      const result = {
        stdout: toText(
          (error as { stdout?: Uint8Array | string | null }).stdout,
        ),
        stderr: toText(
          (error as { stderr?: Uint8Array | string | null }).stderr,
        ),
        exitCode:
          typeof (error as { status?: unknown }).status === 'number'
            ? (error as { status: number }).status
            : 1,
      }

      if (didProcessSucceed(result.exitCode, options)) {
        return result
      }

      throw Object.assign(error as Error, result, { command: [file, ...args] })
    }
  },
}
