import {
  SystemSecurity,
  FactionState,
  Economy,
  Allegiance,
  FactionGovernment,
  FactionHappiness,
  StationType,
  PowerplayState,
  FactionConflictType,
  FactionConflictStatus,
} from '@elitehub/db/schema'

export const SystemSecurityMap = {
  '$galaxy_map_info_state_anarchy;': SystemSecurity.Anarchy,
  anarchy: SystemSecurity.Anarchy,
  '$galaxy_map_info_state_lawless;': SystemSecurity.Anarchy,
  lawless: SystemSecurity.Anarchy,
  '$system_security_high;': SystemSecurity.High,
  high: SystemSecurity.High,
  '$system_security_medium;': SystemSecurity.Medium,
  medium: SystemSecurity.Medium,
  '$system_security_low;': SystemSecurity.Low,
  low: SystemSecurity.Low,
}

export const FactionStateMap = {
  null: null,
  none: null,
  boom: FactionState.Boom,
  bust: FactionState.Bust,
  civilunrest: FactionState.CivilUnrest,
  civilwar: FactionState.CivilWar,
  civilliberty: FactionState.CivilLiberty,
  election: FactionState.Election,
  expansion: FactionState.Expansion,
  famine: FactionState.Famine,
  investment: FactionState.Investment,
  lockdown: FactionState.Lockdown,
  outbreak: FactionState.Outbreak,
  pirateattack: FactionState.PirateAttack,
  retreat: FactionState.Retreat,
  war: FactionState.War,
  blight: FactionState.Blight,
  drought: FactionState.Drought,
  infrastructurefailure: FactionState.InfrastructureFailure,
  naturaldisaster: FactionState.NaturalDisaster,
  publicholiday: FactionState.PublicHoliday,
  terrorism: FactionState.TerroristAttack,
}

export const AllegianceMap = {
  alliance: Allegiance.Alliance,
  empire: Allegiance.Empire,
  federation: Allegiance.Federation,
  independent: Allegiance.Independent,
  none: null,
  $pirate: Allegiance.Pirate,
  pilotsfederation: Allegiance.PilotsFederation,
  thargoid: Allegiance.Thargoids,
  guardian: Allegiance.Guardians,
}

export const EconomyMap = {
  '$economy_agri;': Economy.Agriculture,
  agri: Economy.Agriculture,
  agriculture: Economy.Agriculture,
  '$economy_colony;': Economy.Colony,
  colony: Economy.Colony,
  '$economy_extraction;': Economy.Extraction,
  extraction: Economy.Extraction,
  '$economy_hightech;': Economy.HighTech,
  hightech: Economy.HighTech,
  'high tech': Economy.HighTech,
  '$economy_industrial;': Economy.Industrial,
  industrial: Economy.Industrial,
  '$economy_military;': Economy.Military,
  military: Economy.Military,
  '$economy_none;': null,
  none: null,
  '$economy_refinery;': Economy.Refinery,
  refinery: Economy.Refinery,
  '$economy_service;': Economy.Service,
  service: Economy.Service,
  '$economy_terraforming;': Economy.Terraforming,
  terraforming: Economy.Terraforming,
  '$economy_tourism;': Economy.Tourism,
  tourism: Economy.Tourism,
  '$economy_repair;': Economy.Repair,
  repair: Economy.Repair,
  '$economy_rescue;': Economy.Rescue,
  rescue: Economy.Rescue,
  '$economy_damaged;': Economy.Damaged,
  damaged: Economy.Damaged,
}

export const FactionGovernmentMap = {
  '$government_anarchy;': FactionGovernment.Anarchy,
  anarchy: FactionGovernment.Anarchy,
  '$government_communism;': FactionGovernment.Communism,
  communism: FactionGovernment.Communism,
  '$government_confederacy;': FactionGovernment.Confederacy,
  confederacy: FactionGovernment.Confederacy,
  '$government_cooperative;': FactionGovernment.Cooperative,
  cooperative: FactionGovernment.Cooperative,
  '$government_corporate;': FactionGovernment.Corporate,
  corporate: FactionGovernment.Corporate,
  '$government_democracy;': FactionGovernment.Democracy,
  democracy: FactionGovernment.Democracy,
  '$government_dictatorship;': FactionGovernment.Dictatorship,
  dictatorship: FactionGovernment.Dictatorship,
  '$government_feudal;': FactionGovernment.Feudal,
  feudal: FactionGovernment.Feudal,
  '$government_imperial;': FactionGovernment.Imperial,
  imperial: FactionGovernment.Imperial,
  '$government_none;': null,
  none: null,
  '$government_patronage;': FactionGovernment.Patronage,
  patronage: FactionGovernment.Patronage,
  '$government_prison;': FactionGovernment.Prison,
  prison: FactionGovernment.Prison,
  '$government_prisoncolony;': FactionGovernment.PrisonColony,
  prisoncolony: FactionGovernment.PrisonColony,
  'prison colony': FactionGovernment.PrisonColony,
  '$government_theocracy;': FactionGovernment.Theocracy,
  theocracy: FactionGovernment.Theocracy,
  '$government_engineer;': FactionGovernment.Workshop,
  engineer: FactionGovernment.Workshop,
}

// Inspired by EDSM https://github.com/EDSM-NET/Alias/blob/master/Station/Type.php
export const StationTypeMap = {
  // Coriolis
  coriolis: StationType.Coriolis,
  'coriolis starport': StationType.Coriolis,
  // Dodec
  dodec: StationType.Dodec,
  // Ocellus
  bernal: StationType.Ocellus,
  ocellus: StationType.Ocellus,
  'ocellus starport': StationType.Ocellus,
  // Orbis
  orbis: StationType.Orbis,
  'orbis starport': StationType.Orbis,
  // Outposts
  outpost: StationType.Outpost,
  'civilian outpost': StationType.Outpost,
  'commercial outpost': StationType.Outpost,
  'industrial outpost': StationType.Outpost,
  'military outpost': StationType.Outpost,
  'mining outpost': StationType.Outpost,
  'scientific outpost': StationType.Outpost,
  outpostscientific: StationType.Outpost,
  // Planetary Outposts
  surfacestation: StationType.PlanetaryOutpost,
  crateroutpost: StationType.PlanetaryOutpost,
  'planetary outpost': StationType.PlanetaryOutpost,
  // Planetary Ports
  'planetary port': StationType.PlanetaryPort,
  craterport: StationType.PlanetaryPort,
  // Asteroid Bases
  asteroidbase: StationType.AsteroidBase,
  // Mega Ships
  megaship: StationType.MegaShip,
  onfootsettlement: StationType.OnFootSettlement,
}

export const FactionHappinessMap = {
  '$faction_happinessband1;': FactionHappiness.Elated,
  happinessband1: FactionHappiness.Elated,
  '$faction_happinessband2;': FactionHappiness.Happy,
  happinessband2: FactionHappiness.Happy,
  '$faction_happinessband3;': FactionHappiness.Discontented,
  happinessband3: FactionHappiness.Discontented,
  '$faction_happinessband4;': FactionHappiness.Unhappy,
  happinessband4: FactionHappiness.Unhappy,
  '$faction_happinessband5;': FactionHappiness.Despondent,
  happinessband5: FactionHappiness.Despondent,
  none: null,
}

export const FactionConflictTypeMap = {
  civilwar: FactionConflictType.CivilWar,
  election: FactionConflictType.Election,
  war: FactionConflictType.War,
}

export const FactionConflictStatusMap = {
  pending: FactionConflictStatus.Pending,
  active: FactionConflictStatus.Active,
  '': FactionConflictStatus.Concluded,
}

export const PowerplayStateMap = {
  unoccupied: PowerplayState.Unoccupied,
  stronghold: PowerplayState.Stronghold,
  exploited: PowerplayState.Exploited,
  fortified: PowerplayState.Fortified,
}

// Used to convert the lowercase powerplay power names to the full powerplay power names that are stored in the database
export const PowerplayPowersFromLowercaseMap = {
  'a. lavigny-duval': 'A. Lavigny-Duval',
  'aisling duval': 'Aisling Duval',
  'archon delaine': 'Archon Delaine',
  'denton patreus': 'Denton Patreus',
  'edmund mahon': 'Edmund Mahon',
  'felicia winters': 'Felicia Winters',
  'jerome archer': 'Jerome Archer',
  'li yong-rui': 'Li Yong-Rui',
  'nakato kaine': 'Nakato Kaine',
  'pranav antal': 'Pranav Antal',
  'yuri grom': 'Yuri Grom',
  'zemina torval': 'Zemina Torval',
} as const

export const ValidPowerplayPowersLowercased = new Set(
  Object.keys(PowerplayPowersFromLowercaseMap).map((power) => power.toLowerCase())
)

export const EXCLUDED_STATION_GOVERNMENTS = new Set([
  '$government_megaconstruction;',
  'megaconstruction',
  '$government_carrier;',
  'carrier',
])

// Map helper functions for cleaner lookups
export const mapGovernment = (value?: string) =>
  FactionGovernmentMap?.[value?.toLowerCase() as keyof typeof FactionGovernmentMap]

export const mapAllegiance = (value?: string) =>
  AllegianceMap?.[value?.toLowerCase() as keyof typeof AllegianceMap]

export const mapEconomy = (value?: string) =>
  EconomyMap?.[value?.toLowerCase() as keyof typeof EconomyMap]

export const mapSecurity = (value?: string) =>
  SystemSecurityMap?.[value?.toLowerCase() as keyof typeof SystemSecurityMap]

export const mapPowerplayState = (value?: string) =>
  PowerplayStateMap?.[value?.toLowerCase() as keyof typeof PowerplayStateMap]

// Can be null, do not throw away the data if happiness parsing fails
export const mapHappiness = (value?: string) =>
  FactionHappinessMap?.[value?.toLowerCase() as keyof typeof FactionHappinessMap] ?? null

export const mapStationType = (value?: string) =>
  StationTypeMap?.[value?.toLowerCase() as keyof typeof StationTypeMap]

export const mapFactionState = (value?: string) =>
  FactionStateMap?.[value?.toLowerCase() as keyof typeof FactionStateMap]

export const mapFactionConflictType = (value?: string) =>
  FactionConflictTypeMap?.[value?.toLowerCase() as keyof typeof FactionConflictTypeMap]

export const mapFactionConflictStatus = (value?: string) =>
  FactionConflictStatusMap?.[value?.toLowerCase() as keyof typeof FactionConflictStatusMap]
