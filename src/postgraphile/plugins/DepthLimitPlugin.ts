import { depthLimit } from '@graphile/depth-limit'
import { addValidationRules } from '../utils/validationRulesPluginTemplate.js'

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

export const DepthLimitPlugin = addValidationRules(
  'DepthLimitPlugin',
  depthLimit({
    maxListDepth: 3,
    maxDepth: 10,
    maxDepthByFieldCoordinates: {
      '__Type.ofType': 9,
    },
    maxIntrospectionDepth: 14,
    revealDetails: IS_DEVELOPMENT,
  })
)
