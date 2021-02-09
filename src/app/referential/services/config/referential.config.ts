import {TypePolicies} from "@apollo/client/core";
import {FormFieldDefinition, FormFieldDefinitionMap} from "../../../shared/form/field.model";
import {changeCaseToUnderscore} from "../../../shared/functions";
import {LocationLevelIds, ParameterLabelGroups, TaxonomicLevelIds} from "../model/model.enum";

export const REFERENTIAL_GRAPHQL_TYPE_POLICIES = <TypePolicies>{
  'MetierVO': {
    keyFields: ['entityName', 'id']
  },
  'PmfmVO': {
    keyFields: ['entityName', 'id']
  },
  'TaxonGroupVO': {
    keyFields: ['entityName', 'id']
  },
  'TaxonNameVO': {
    keyFields: ['entityName', 'id']
  },
  'LocationVO': {
    keyFields: ['entityName', 'id']
  },
  'ReferentialVO': {
    keyFields: ['entityName', 'id']
  },
  'TaxonGroupStrategyVO': {
    keyFields: ['__typename', 'strategyId', 'taxonGroup', ['entityName', 'id']]
  },
  'TaxonNameStrategyVO': {
    keyFields: ['__typename', 'strategyId', 'taxonName', ['entityName', 'id']]
  }
};

export const REFERENTIAL_CONFIG_OPTIONS: FormFieldDefinitionMap = {
  REFERENTIAL_VESSEL_ENABLE: <FormFieldDefinition>{
    key: 'sumaris.referential.vessel.enable',
    label: 'REFERENTIAL.OPTIONS.VESSELS_ENABLE',
    type: 'boolean',
    defaultValue: 'false'
  },

  LOCATION_LEVEL_COUNTRY_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.LocationLevel.COUNTRY.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.LOCATION_LEVEL_COUNTRY_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'LocationLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: LocationLevelIds.COUNTRY
  },
  LOCATION_LEVEL_PORT_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.LocationLevel.HARBOUR.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.LOCATION_LEVEL_PORT_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'LocationLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: LocationLevelIds.PORT
  },
  LOCATION_LEVEL_AUCTION_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.locationLevel.AUCTION.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.LOCATION_LEVEL_AUCTION_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'LocationLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: LocationLevelIds.AUCTION
  },
  LOCATION_LEVEL_ICES_RECTANGLE_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.locationLevel.RECTANGLE_ICES.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.LOCATION_LEVEL_ICES_RECTANGLE_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'LocationLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: LocationLevelIds.ICES_RECTANGLE
  },
  LOCATION_LEVEL_ICES_DIVISION_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.locationLevel.ICES_DIVISION.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.LOCATION_LEVEL_ICES_DIVISION_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'LocationLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: LocationLevelIds.ICES_DIVISION
  },
  TAXONOMIC_LEVEL_FAMILY_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.taxonomicLevel.FAMILY.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.TAXONOMIC_LEVEL_FAMILY_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'TaxonomicLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: TaxonomicLevelIds.FAMILY
  },
  TAXONOMIC_LEVEL_GENUS_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.taxonomicLevel.GENUS.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.TAXONOMIC_LEVEL_GENUS_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'TaxonomicLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: TaxonomicLevelIds.GENUS
  },
  TAXONOMIC_LEVEL_SPECIES_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.taxonomicLevel.SPECIES.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.TAXONOMIC_LEVEL_SPECIES_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'TaxonomicLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: TaxonomicLevelIds.SPECIES
  },
  TAXONOMIC_LEVEL_SUBSPECIES_ID: <FormFieldDefinition>{
    key: 'sumaris.enumeration.taxonomicLevel.SUBSPECIES.id',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.TAXONOMIC_LEVEL_SUBSPECIES_ID',
    type: 'entity',
    autocomplete: {
      filter: {
        entityName: 'TaxonomicLevel',
        statusIds: [0, 1]
      }
    },
    defaultValue: TaxonomicLevelIds.SUBSPECIES
  },
  STRATEGY_PARAMETER_AGE_LABEL: <FormFieldDefinition>{
    key: 'sumaris.enumeration.parameter.age.label',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.STRATEGY_PARAMETER_AGE_LABEL',
    type: 'string',
    defaultValue: ParameterLabelGroups.AGE.join(',')
  },
  STRATEGY_PARAMETER_SEX_LABEL: <FormFieldDefinition>{
    key: 'sumaris.enumeration.parameter.sex.label',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.STRATEGY_PARAMETER_SEX_LABEL',
    type: 'string',
    defaultValue: ParameterLabelGroups.SEX.join(',')
  },
  STRATEGY_PARAMETER_WEIGHT_LABELS: <FormFieldDefinition>{
    key: 'sumaris.enumeration.parameter.weight.labels',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.STRATEGY_PARAMETER_WEIGHT_LABELS',
    type: 'string',
    defaultValue: ParameterLabelGroups.WEIGHT.join(',')
  },
  STRATEGY_PARAMETER_LENGTH_LABELS: <FormFieldDefinition>{
    key: 'sumaris.enumeration.parameter.length.labels',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.STRATEGY_PARAMETER_LENGTH_LABELS',
    type: 'string',
    defaultValue: ParameterLabelGroups.LENGTH.join(',')
  },
  STRATEGY_PARAMETER_MATURITY_LABELS: <FormFieldDefinition>{
    key: 'sumaris.enumeration.parameter.maturity.labels',
    label: 'CONFIGURATION.OPTIONS.ENUMERATION.STRATEGY_PARAMETER_MATURITY_LABELS',
    type: 'string',
    defaultValue: ParameterLabelGroups.MATURITY.join(',')
  },
};

export const REFERENTIAL_LOCAL_SETTINGS_OPTIONS: FormFieldDefinitionMap = {

  // Display attributes for vessel
  FIELD_VESSEL_SNAPSHOT_ATTRIBUTES: <FormFieldDefinition>{
    key: 'sumaris.field.vesselSnapshot.attributes',
    label: 'SETTINGS.FIELDS.VESSEL.NAME',
    type: 'enum',
    values: [
      {key: 'exteriorMarking,name',   value: 'SETTINGS.FIELDS.VESSEL.ATTRIBUTES.EXTERIOR_MARKING_NAME'},
      {key: 'registrationCode,name',   value: 'SETTINGS.FIELDS.VESSEL.ATTRIBUTES.REGISTRATION_CODE_NAME'}
    ]
  },
  // Display attributes for referential useful entities
  ... ['department', 'location', 'qualitativeValue', 'taxonGroup', 'taxonName', 'gear']
    // Allow user to choose how to display field (by code+label, code, etc)
    .reduce((res, fieldName) => {
      res[`FIELD_${changeCaseToUnderscore(fieldName).toUpperCase()}_ATTRIBUTES`] = {
        key: `sumaris.field.${fieldName}.attributes`,
        label: `SETTINGS.FIELDS.${changeCaseToUnderscore(fieldName).toUpperCase()}`,
        type: 'enum',
        values: [
          {key: 'label,name',   value: 'SETTINGS.FIELDS.ATTRIBUTES.LABEL_NAME'},
          {key: 'name',         value: 'SETTINGS.FIELDS.ATTRIBUTES.NAME'},
          {key: 'name,label',   value: 'SETTINGS.FIELDS.ATTRIBUTES.NAME_LABEL'},
          {key: 'label',        value: 'SETTINGS.FIELDS.ATTRIBUTES.LABEL'}
        ]
      };
      return res;
    }, {})
};
