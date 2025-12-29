/**
 * Plugin to rename Postgraphile's default node ID field to 'nodeId' and keep `id` for PostgreSQL's primary key column named `id`
 */
export const IdToNodeIdPlugin: GraphileConfig.Plugin = {
  name: 'IdToNodeIdPlugin',
  version: '1.0.0',
  inflection: {
    replace: {
      nodeIdFieldName() {
        return 'nodeId'
      },
      _attributeName(_, __, details) {
        const { codec, attributeName } = details
        const attribute = codec.attributes[attributeName]
        const name = attribute.extensions?.tags?.name || attributeName
        return this.coerceToGraphQLName(name)
      },
    },
  },
}
