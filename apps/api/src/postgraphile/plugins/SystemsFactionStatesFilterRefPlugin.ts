import { addFilterableRelationRef } from './PgFilterRefHelpers.js'

/**
 * See comment in `PgFilterRefHelpers.ts` for more details.
 *
 * @todo This is entirely AI generated based on source code analysis of the `@haathie/postgraphile-targeted-conditions` plugin.
 * I did not find any documentation on how this should be done, this may not be the correct way to do this.
 */
export const SystemsFactionStatesFilterRefPlugin: GraphileConfig.Plugin = {
  name: 'SystemsFactionStatesFilterRefPlugin',
  schema: {
    hooks: {
      build(build) {
        addFilterableRelationRef({
          build,
          sourceResourceName: 'systems',
          targetResourceName: 'factionStates',
          refName: 'factionStatesFilter',
          remoteAttribute: 'systemId',
        })
        return build
      },
    },
  },
}
