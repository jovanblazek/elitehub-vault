import { anonymousApiConsumer, type ApiConsumer } from '../auth/apiConsumer.js'

export const getApiConsumerFromRequestContext = (
  requestContext: Partial<Grafast.RequestContext>
): ApiConsumer => {
  const ctx = requestContext.koav2?.ctx as
    | {
        state?: {
          apiConsumer?: ApiConsumer
        }
      }
    | undefined

  return ctx?.state?.apiConsumer ?? anonymousApiConsumer
}
