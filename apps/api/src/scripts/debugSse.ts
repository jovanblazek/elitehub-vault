import process from 'node:process'
import { env } from '../env.js'

type CliOptions = {
  baseUrl: string
  path: string
  apiKey: string | null
  eventType: string | null
  powerIds: string[]
  systemIds: string[]
  extraParams: Array<[string, string]>
  showComments: boolean
  raw: boolean
}

const printUsage = () => {
  console.log(`Usage:
  pnpm debug:sse -- --eventType systemPowerplayUpdated --powerId p1 [--powerId p2] [options]

Options:
  --baseUrl <url>         Base URL (default: http://localhost:${env.PORT})
  --path <path>           SSE path (default: /realtime/sse)
  --apiKey <key>          API key for X-API-Key header (default: SSE_API_KEY or API_KEY env)
  --eventType <value>     eventType query param
  --powerId <id>          Repeatable powerId query param
  --systemId <id>         Repeatable systemId query param
  --param <k=v>           Repeatable generic query param for any event type
  --showComments          Print SSE comment frames (heartbeats)
  --raw                   Print raw SSE frames instead of parsed output
  --help                  Show help

Examples:
  pnpm debug:sse -- --eventType systemPowerplayUpdated --powerId aisling --apiKey dev-key
  pnpm debug:sse -- --eventType systemPowerplayUpdated --powerId p1 --systemId s1 --systemId s2
  pnpm debug:sse -- --param eventType=systemPowerplayUpdated --param powerId=aisling --apiKey dev-key
`)
}

const requireArgValue = (args: string[], index: number, name: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for --${name}`)
  }
  return value
}

const parseCliArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    baseUrl: `http://localhost:${env.PORT}`,
    path: '/realtime/sse',
    apiKey: env.SSE_API_KEY ?? env.API_KEY ?? null,
    eventType: null,
    powerIds: [],
    systemIds: [],
    extraParams: [],
    showComments: false,
    raw: false,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--') {
      continue
    }

    switch (arg) {
      case '--help':
        printUsage()
        process.exit(0)
      case '--baseUrl':
        options.baseUrl = requireArgValue(args, i, 'baseUrl')
        i += 1
        break
      case '--path':
        options.path = requireArgValue(args, i, 'path')
        i += 1
        break
      case '--apiKey':
        options.apiKey = requireArgValue(args, i, 'apiKey')
        i += 1
        break
      case '--eventType':
        options.eventType = requireArgValue(args, i, 'eventType')
        i += 1
        break
      case '--powerId':
        options.powerIds.push(requireArgValue(args, i, 'powerId'))
        i += 1
        break
      case '--systemId':
        options.systemIds.push(requireArgValue(args, i, 'systemId'))
        i += 1
        break
      case '--param': {
        const rawParam = requireArgValue(args, i, 'param')
        const eqIndex = rawParam.indexOf('=')
        if (eqIndex <= 0 || eqIndex === rawParam.length - 1) {
          throw new Error(`Invalid --param format: ${rawParam}. Expected key=value`)
        }

        const key = rawParam.slice(0, eqIndex)
        const value = rawParam.slice(eqIndex + 1)
        options.extraParams.push([key, value])
        i += 1
        break
      }
      case '--showComments':
        options.showComments = true
        break
      case '--raw':
        options.raw = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

type SseFrame = {
  id?: string
  event?: string
  data?: string
  comments: string[]
}

const parseSseFrame = (rawFrame: string): SseFrame => {
  const frame: SseFrame = { comments: [] }

  for (const line of rawFrame.split('\n')) {
    if (!line) {
      continue
    }

    if (line.startsWith(':')) {
      frame.comments.push(line.slice(1).trim())
      continue
    }

    const separatorIndex = line.indexOf(':')
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    const rawValue = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1)
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'id') {
      frame.id = value
      continue
    }

    if (field === 'event') {
      frame.event = value
      continue
    }

    if (field === 'data') {
      frame.data = frame.data ? `${frame.data}\n${value}` : value
    }
  }

  return frame
}

const streamSse = async () => {
  const options = parseCliArgs(process.argv.slice(2))

  const endpoint = new URL(options.path, options.baseUrl)
  if (options.eventType) {
    endpoint.searchParams.append('eventType', options.eventType)
  }

  for (const powerId of options.powerIds) {
    endpoint.searchParams.append('powerId', powerId)
  }

  for (const systemId of options.systemIds) {
    endpoint.searchParams.append('systemId', systemId)
  }

  for (const [key, value] of options.extraParams) {
    endpoint.searchParams.append(key, value)
  }

  const headers = new Headers({
    Accept: 'text/event-stream',
  })

  if (options.apiKey) {
    headers.set('X-API-Key', options.apiKey)
  }

  console.log(`[debug-sse] Connecting to: ${endpoint.toString()}`)
  if (!options.apiKey) {
    console.warn(
      '[debug-sse] Warning: no API key provided (use --apiKey or SSE_API_KEY/API_KEY env)'
    )
  }

  const abortController = new AbortController()
  process.on('SIGINT', () => {
    console.log('\n[debug-sse] Closing stream...')
    abortController.abort()
  })

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
    signal: abortController.signal,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status} ${response.statusText}\n${body}`)
  }

  if (!response.body) {
    throw new Error('Response body is empty')
  }

  console.log('[debug-sse] Connected. Waiting for events...')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    // oxlint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const rawFrame = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      if (rawFrame.length > 0) {
        if (options.raw) {
          console.log(`\n--- RAW FRAME ---\n${rawFrame}\n---------------`)
        } else {
          const parsed = parseSseFrame(rawFrame)

          if (parsed.comments.length > 0 && options.showComments) {
            for (const comment of parsed.comments) {
              console.log(`[comment] ${comment}`)
            }
          }

          if (parsed.data) {
            let dataOutput: unknown = parsed.data
            try {
              dataOutput = JSON.parse(parsed.data)
            } catch {
              // Leave as raw string.
            }

            const prefix = `[event=${parsed.event ?? 'message'} id=${parsed.id ?? '-'}]`
            console.log(prefix, dataOutput)
          }
        }
      }

      separatorIndex = buffer.indexOf('\n\n')
    }
  }

  console.log('[debug-sse] Stream ended.')
}

void streamSse().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[debug-sse] ${message}`)
  process.exit(1)
})
