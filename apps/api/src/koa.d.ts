import type { ApiConsumer } from './auth/apiConsumer.js'

declare module 'koa' {
  interface DefaultState {
    apiConsumer?: ApiConsumer
  }
}
