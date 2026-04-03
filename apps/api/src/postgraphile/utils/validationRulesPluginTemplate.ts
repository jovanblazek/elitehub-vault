import { type ValidationRule } from 'postgraphile/graphql'

export function addValidationRules(
  name: string,
  newValidationRules: ValidationRule | ValidationRule[]
): GraphileConfig.Plugin {
  return {
    name,
    grafserv: {
      hooks: {
        init(info, event) {
          const { validationRules } = event
          if (Array.isArray(newValidationRules)) {
            validationRules.push(...newValidationRules)
          } else {
            validationRules.push(newValidationRules)
          }
        },
      },
    },
  }
}
