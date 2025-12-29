import {
  createComplexityRule,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity'
import { addValidationRules } from '../utils/validationRulesPluginTemplate.js'

export const ComplexityPlugin = addValidationRules(
  'ComplexityPlugin',
  createComplexityRule({
    // 1. Set your Maximum Complexity
    maximumComplexity: 10000,

    // 2. Define how complexity is calculated
    estimators: [
      // Look for "complexity" in field extensions (allows custom overrides)
      fieldExtensionsEstimator(),

      // Fallback: Default complexity is 1 per field
      simpleEstimator({ defaultComplexity: 1 }),
    ],

    // 3. Handle the error when complexity is exceeded
    onComplete: (complexity) => {
      // Optional: Log the complexity for monitoring
      console.log(`Query Complexity: ${complexity}`)
    },

    // createError: (max, actual) => {
    //   return new GraphQLError(`Query is too complex: ${actual}. Maximum allowed is ${max}.`)
    // },
  })
)
