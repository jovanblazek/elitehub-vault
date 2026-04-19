import type { ApiConsumer } from './auth/apiConsumer.js'

declare namespace Grafast {
  interface RequestContext {
    koav2?: {
      ctx?: {
        state?: {
          apiConsumer?: ApiConsumer
        }
      }
    }
  }

  interface Context {
    apiConsumer: ApiConsumer
  }
}
