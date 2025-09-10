import { postgraphile } from "postgraphile"

import { makePgService } from "postgraphile/adaptors/pg"
import { PostGraphileAmberPreset } from "postgraphile/presets/amber"
// import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection"

const PGL_Preset: GraphileConfig.Preset = {
	extends: [PostGraphileAmberPreset],
	pgServices: [
		makePgService({
			connectionString: process.env.POSTGRES_CONNECTION_STRING,
			schemas: ["public"],
		}),
	],
	grafast: {
		explain: true,
	},
}

export const pgl = postgraphile(PGL_Preset)
