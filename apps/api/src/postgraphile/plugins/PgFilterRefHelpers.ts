/**
 * Helpers for registering filterable PostGraphile refs from the built pg relation registry.
 *
 * We use this when a nested filter should follow a generated reverse relation that cannot be
 * expressed reliably through smart-tag `@ref via:` metadata. The helper finds the single-hop
 * relation on `build.input.pgRegistry.pgRelations` and writes the corresponding `codec.refs`
 * entry that `@haathie/postgraphile-targeted-conditions` reads to expose nested filter inputs.
 *
 * Plugin-specific modules should call `addFilterableRelationRef` with the source resource,
 * target resource, ref name, and remote attribute instead of duplicating the registry lookup
 * and ref-shaping logic.
 */
type PgRelationLike = {
  localAttributes: string[]
  remoteAttributes: string[]
  remoteResource?: {
    codec?: {
      name: string
    }
  }
  remoteResourceOptions?: {
    codec?: {
      name: string
    }
    name?: string
  }
}

type RegisterFilterRefOptions = {
  build: Partial<GraphileBuild.Build> & GraphileBuild.BuildBase
  sourceResourceName: string
  targetResourceName: string
  refName: string
  remoteAttribute: string
}

const findReverseRelationName = (
  relations: Record<string, PgRelationLike>,
  remoteCodecName: string,
  remoteAttribute: string
) => {
  const relationEntry = Object.entries(relations).find(([, relation]) => {
    const candidateRemoteCodecName =
      relation?.remoteResource?.codec?.name ??
      relation?.remoteResourceOptions?.codec?.name ??
      relation?.remoteResourceOptions?.name

    return (
      candidateRemoteCodecName === remoteCodecName &&
      relation.localAttributes.length === 1 &&
      relation.localAttributes[0] === 'id' &&
      relation.remoteAttributes.length === 1 &&
      relation.remoteAttributes[0] === remoteAttribute
    )
  })

  return relationEntry?.[0]
}

export const addFilterableRelationRef = ({
  build,
  sourceResourceName,
  targetResourceName,
  refName,
  remoteAttribute,
}: RegisterFilterRefOptions) => {
  const sourceResource = build?.pgResources?.[sourceResourceName]
  const targetResource = build?.pgResources?.[targetResourceName]

  if (!sourceResource || !targetResource) {
    throw new Error(`Missing pg resources '${sourceResourceName}' or '${targetResourceName}'.`)
  }

  const relations = build.input.pgRegistry.pgRelations[sourceResourceName]

  if (!relations) {
    throw new Error(`Missing pg relations for '${sourceResourceName}'.`)
  }

  const relationName = findReverseRelationName(
    relations as unknown as Record<string, PgRelationLike>,
    targetResource.codec.name,
    remoteAttribute
  )

  if (!relationName) {
    throw new Error(
      `Could not find ${sourceResourceName} -> ${targetResourceName} relation for filter ref '${refName}'.`
    )
  }

  sourceResource.codec.refs ??= {}
  sourceResource.codec.refs[refName] = {
    definition: {
      singular: false,
      extensions: {
        tags: {
          behavior:
            'filterable -manyRelation:resource:list -manyRelation:resource:connection',
        },
      },
    },
    paths: [[{ relationName }]],
  }
}
