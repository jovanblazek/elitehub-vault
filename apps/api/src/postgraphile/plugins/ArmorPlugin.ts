import { addValidationRules } from '../utils/validationRulesPluginTemplate.js'
import { ApolloArmor } from '@escape.tech/graphql-armor'

const armor = new ApolloArmor({
  maxDepth: {
    n: 7,
  },
  blockFieldSuggestion: {
    enabled: false, // Introspection is enabled so this has no effect
  },
})
const protection = armor.protect()

export const ArmorPlugin = addValidationRules('ArmorPlugin', protection.validationRules)
