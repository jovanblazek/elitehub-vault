# SSE Guide

This document is the detailed reference for the realtime SSE endpoint exposed by EliteHub Vault.

The SSE stream is intentionally lean by design. Events tell consumers that something relevant changed and include the minimum routing and change metadata needed to react quickly. If you need more details, call the GraphQL API to fetch the current complete data for the affected entity.

The stream is live-only. It does not provide event history and it does not pause while a consumer is disconnected. If a client drops the connection, any events emitted during that gap are missed and the client resumes from whatever is current after reconnecting.

## Endpoint

```text
GET /realtime/sse
```

Headers:

- `X-API-Key: <your-api-key>`
- `Accept: text/event-stream`

The response is a long-lived HTTP connection with `Content-Type: text/event-stream`.

## Subscription Model

Each SSE connection subscribes to exactly one `eventType`, plus one or more routing keys for that event type.

Supported event types:

- `systemPowerplayUpdated`
- `factionPresenceChanged`
- `factionStateChanged`
- `factionControlThreatChanged`

Search params:

| Param       | Required                         | Applies to                                                                     | Limits               | Description                                                         |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------- |
| `eventType` | yes                              | all subscriptions                                                              | 1 value              | Selects which event family the connection receives                  |
| `powerId`   | yes for `systemPowerplayUpdated` | `systemPowerplayUpdated`                                                       | 1-4 repeated values  | Subscribes to one or more power IDs                                 |
| `factionId` | yes for faction events           | `factionPresenceChanged`, `factionStateChanged`, `factionControlThreatChanged` | 1-20 repeated values | Subscribes to one or more faction IDs                               |
| `systemId`  | no                               | all subscriptions                                                              | 0-20 repeated values | Optional allowlist that narrows matching events to specific systems |

Behavior:

- Repeated params are allowed for `powerId`, `factionId`, and `systemId`.
- Duplicate values are deduplicated server-side.
- A connection can only subscribe to one `eventType` at a time.
- `systemId` is an extra filter, not a routing key.

## Quick Examples

Powerplay:

```bash
curl -N \
  -H "X-API-Key: your-api-key" \
  -H "Accept: text/event-stream" \
  "https://your-endpoint/realtime/sse?eventType=systemPowerplayUpdated&powerId=power-1&powerId=power-2"
```

Faction presence:

```bash
curl -N \
  -H "X-API-Key: your-api-key" \
  -H "Accept: text/event-stream" \
  "https://your-endpoint/realtime/sse?eventType=factionPresenceChanged&factionId=faction-1&systemId=system-1"
```

Faction state:

```bash
curl -N \
  -H "X-API-Key: your-api-key" \
  -H "Accept: text/event-stream" \
  "https://your-endpoint/realtime/sse?eventType=factionStateChanged&factionId=faction-1&factionId=faction-2"
```

Faction control threat:

```bash
curl -N \
  -H "X-API-Key: your-api-key" \
  -H "Accept: text/event-stream" \
  "https://your-endpoint/realtime/sse?eventType=factionControlThreatChanged&factionId=faction-1"
```

## SSE Wire Format

The stream uses standard SSE framing.

Typical opening frames:

```text
retry: 2000

: connected
```

Typical event frame:

```text
id: 1
event: systemPowerplayUpdated
data: {"event":"systemPowerplayUpdated","systemId":"<system-id>","powerId":"<power-id>","changedFields":["powerplayState"],"timestamp":"2026-02-07T00:00:00.000Z","metadata":{}}
```

Typical heartbeat frame:

```text
: keepalive
```

Notes:

- `retry: 2000` is a reconnect hint in milliseconds for SSE clients that support it.
- `id` is a per-connection incrementing integer starting at `1`.
- `event` always matches the subscribed event type.
- `data` is JSON serialized into a single SSE `data:` line.
- Heartbeat comments are sent periodically to keep the connection alive during idle periods.

## Event Reference

### `systemPowerplayUpdated`

Emitted when tracked powerplay fields for a system change for a subscribed power. Use it to detect that a system's powerplay state or progress values changed.

Subscription params:

- `eventType=systemPowerplayUpdated`
- `powerId=<id>` repeated `1-4` times
- optional `systemId=<id>` repeated up to `20` times

Payload:

```json
{
  "event": "systemPowerplayUpdated",
  "systemId": "uuid",
  "powerId": "uuid",
  "changedFields": [
    "powerplayState",
    "powerplayStateControlProgress",
    "powerplayStateReinforcement",
    "powerplayStateUndermining"
  ],
  "timestamp": "2026-02-07T00:00:00.000Z",
  "metadata": {}
}
```

Fields:

- `event`: always `systemPowerplayUpdated`
- `systemId`: affected system ID
- `powerId`: power ID the event was published for
- `changedFields`: subset of `powerplayState`, `powerplayStateControlProgress`, `powerplayStateReinforcement`, `powerplayStateUndermining`
- `timestamp`: ISO-8601 timestamp string
- `metadata`: additional event metadata object, may be empty

### `factionPresenceChanged`

Emitted when a subscribed faction enters or leaves a system. Use it to detect expansion into a system or loss of presence from a system.

Subscription params:

- `eventType=factionPresenceChanged`
- `factionId=<id>` repeated `1-20` times
- optional `systemId=<id>` repeated up to `20` times

Payload:

```json
{
  "event": "factionPresenceChanged",
  "factionId": "uuid",
  "systemId": "uuid",
  "change": "entered",
  "timestamp": "2026-02-07T00:00:00.000Z"
}
```

Fields:

- `event`: always `factionPresenceChanged`
- `factionId`: affected faction ID
- `systemId`: affected system ID
- `change`: `entered` or `left`
- `timestamp`: ISO-8601 timestamp string

### `factionStateChanged`

Emitted when a subscribed faction's local state or conflict lifecycle changes in a system. Use it to detect new, active, or ended BGS state transitions and conflict updates.

Subscription params:

- `eventType=factionStateChanged`
- `factionId=<id>` repeated `1-20` times
- optional `systemId=<id>` repeated up to `20` times

Payload:

```json
{
  "event": "factionStateChanged",
  "factionId": "uuid",
  "systemId": "uuid",
  "stateKind": "state",
  "state": "Boom",
  "lifecycle": "active",
  "opponentFactionId": "uuid",
  "timestamp": "2026-02-07T00:00:00.000Z"
}
```

Fields:

- `event`: always `factionStateChanged`
- `factionId`: affected faction ID
- `systemId`: affected system ID
- `stateKind`: `state` or `conflict`
- `state`: state name
- `lifecycle`: `pending`, `active`, or `ended`
- `opponentFactionId`: optional opposing faction ID, present for some conflict-related events
- `timestamp`: ISO-8601 timestamp string

### `factionControlThreatChanged`

Emitted only for the faction currently controlling the system. The event compares that controlling faction against the highest-influence non-controlling faction in the same system. A control threat is active when the influence gap between them is `0.10` or less. `entered` is emitted when the top challenger moves to within `0.10` influence points of the controller, and `cleared` is emitted when the gap rises back above `0.10`.

Subscription params:

- `eventType=factionControlThreatChanged`
- `factionId=<id>` repeated `1-20` times
- optional `systemId=<id>` repeated up to `20` times

Payload:

```json
{
  "event": "factionControlThreatChanged",
  "factionId": "uuid",
  "systemId": "uuid",
  "status": "entered",
  "challengerFactionId": "uuid",
  "gap": 0.08,
  "threshold": 0.1,
  "timestamp": "2026-02-07T00:00:00.000Z"
}
```

Fields:

- `event`: always `factionControlThreatChanged`
- `factionId`: controlling faction ID
- `systemId`: affected system ID
- `status`: `entered` or `cleared`
- `challengerFactionId`: faction ID of the challenger
- `gap`: influence gap between the controlling faction and the top challenger
- `threshold`: threshold value used for the threat calculation, currently `0.10`
- `timestamp`: ISO-8601 timestamp string

## Consumer Guidance

Node.js example:

```js
const response = await fetch(
  'https://your-endpoint/realtime/sse?eventType=factionStateChanged&factionId=faction-1',
  {
    headers: {
      'X-API-Key': 'your-api-key',
      Accept: 'text/event-stream',
    },
  }
)

if (!response.ok || !response.body) {
  throw new Error(`HTTP ${response.status}`)
}

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })

  let frameEnd = buffer.indexOf('\n\n')
  while (frameEnd !== -1) {
    const frame = buffer.slice(0, frameEnd)
    buffer = buffer.slice(frameEnd + 2)

    const event = frame.match(/^event: (.+)$/m)?.[1]
    const data = frame.match(/^data: (.+)$/m)?.[1]

    if (event && data) {
      console.log(event, JSON.parse(data))
    }

    frameEnd = buffer.indexOf('\n\n')
  }
}
```

Browser note:

- Native browser `EventSource` does not let you set `X-API-Key` directly.
- For browser consumers, use a server-side proxy or an SSE client approach that can attach custom headers.
- Server and CLI consumers can use `fetch`, `curl`, or any SSE-capable library that supports custom headers.

## Error Responses

Common HTTP responses before the stream opens:

- `400 Bad Request`: missing or invalid query params
- `401 Unauthorized`: missing or invalid API key
- `429 Too Many Requests`: max concurrent SSE connections reached for the API key

Example `400` response body:

```json
{
  "error": "Bad Request",
  "message": "powerId: Too small: expected array to have >=1 items"
}
```

Example `429` response body:

```json
{
  "error": "Too Many Requests",
  "message": "Max concurrent SSE connections reached for this API key"
}
```

## Runtime Notes

- The endpoint is a continuous live stream, not a replay or catch-up feed.
- The server emits a reconnect hint of `2000` ms.
- Keepalive comment frames are emitted every 15 seconds.
- Slow consumers can be disconnected under backpressure.
- Concurrent SSE connections are limited per API key by `maxSseConnections` and default to `3`.
- Event IDs are connection-local and should not be treated as a durable replay cursor or history checkpoint.
