import {
  SystemSecurity,
  FactionState,
  Economy,
  Allegiance,
  FactionGovernment,
  FactionHappiness,
  StationType,
  PowerplayState,
} from '../../../db/schema.js'

export const SystemSecurityMap = {
  '$galaxy_map_info_state_anarchy;': SystemSecurity.Anarchy,
  '$galaxy_map_info_state_lawless;': SystemSecurity.Anarchy,
  '$system_security_high;': SystemSecurity.High,
  '$system_security_low;': SystemSecurity.Low,
  '$system_security_medium;': SystemSecurity.Medium,
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
  '$economy_colony;': Economy.Colony,
  '$economy_extraction;': Economy.Extraction,
  '$economy_hightech;': Economy.HighTech,
  '$economy_industrial;': Economy.Industrial,
  '$economy_military;': Economy.Military,
  '$economy_none;': null,
  '$economy_refinery;': Economy.Refinery,
  '$economy_service;': Economy.Service,
  '$economy_terraforming;': Economy.Terraforming,
  '$economy_tourism;': Economy.Tourism,
  '$economy_repair;': Economy.Repair,
  '$economy_rescue;': Economy.Rescue,
  '$economy_damaged;': Economy.Damaged,
}

export const FactionGovernmentMap = {
  '$government_anarchy;': FactionGovernment.Anarchy,
  '$government_communism;': FactionGovernment.Communism,
  '$government_confederacy;': FactionGovernment.Confederacy,
  '$government_cooperative;': FactionGovernment.Cooperative,
  '$government_corporate;': FactionGovernment.Corporate,
  '$government_democracy;': FactionGovernment.Democracy,
  '$government_dictatorship;': FactionGovernment.Dictatorship,
  '$government_feudal;': FactionGovernment.Feudal,
  '$government_imperial;': FactionGovernment.Imperial,
  '$government_none;': null,
  '$government_patronage;': FactionGovernment.Patronage,
  '$government_prison;': FactionGovernment.Prison,
  '$government_prisoncolony;': FactionGovernment.PrisonColony,
  '$government_theocracy;': FactionGovernment.Theocracy,
  '$government_engineer;': FactionGovernment.Workshop,
}

export const StationTypeMap = {
  coriolis: StationType.Coriolis,
  'coriolis starport': StationType.Coriolis,
  'dodec': StationType.Dodec,
  bernal: StationType.Ocellus,
  'ocellus starport': StationType.Ocellus,
  orbis: StationType.Orbis,
  'orbis starport': StationType.Orbis,
  outpost: StationType.Outpost,
  'civilian outpost': StationType.Outpost,
  'commercial outpost': StationType.Outpost,
  'industrial outpost': StationType.Outpost,
  'military outpost': StationType.Outpost,
  'mining outpost': StationType.Outpost,
  'scientific outpost': StationType.Outpost,
  surfacestation: StationType.PlanetaryOutpost,
  crateroutpost: StationType.PlanetaryOutpost,
  'planetary outpost': StationType.PlanetaryOutpost,
  'planetary port': StationType.PlanetaryPort,
  craterport: StationType.PlanetaryPort,
  asteroidbase: StationType.AsteroidBase,
  megaship: StationType.MegaShip,
}

export const FactionHappinessMap = {
  '$faction_happinessband1;': FactionHappiness.Elated,
  '$faction_happinessband2;': FactionHappiness.Happy,
  '$faction_happinessband3;': FactionHappiness.Discontented,
  '$faction_happinessband4;': FactionHappiness.Unhappy,
  '$faction_happinessband5;': FactionHappiness.Despondent,
  none: null,
}

export const PowerplayStateMap = {
  Unoccupied: PowerplayState.Unoccupied,
  Stronghold: PowerplayState.Stronghold,
  Exploited: PowerplayState.Exploited,
  Fortified: PowerplayState.Fortified,
}

export const ValidPowerplayPowers = new Set([
  'A. Lavigny-Duval',
  'Aisling Duval',
  'Archon Delaine',
  'Denton Patreus',
  'Edmund Mahon',
  'Felicia Winters',
  'Jerome Archer',
  'Li Yong-Rui',
  'Nakato Kaine',
  'Pranav Antal',
  'Yuri Grom',
  'Zemina Torval',
])
