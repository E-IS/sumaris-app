import {Injectable} from "@angular/core";
import gql from "graphql-tag";
import {Observable} from "rxjs";
import {
  LoadResult,
  EntitiesService,
  EntityService,
  isNil,
  isNotNil,
  isNotEmptyArray,
  isNilOrBlank
} from "../../shared/shared.module";
import {BaseEntityService, EntityUtils, Referential, ReferentialRef} from "../../core/core.module";
import {ErrorCodes} from "./errors";

import {GraphqlService} from "../../core/services/graphql.service";
import {SortDirection} from "@angular/material/sort";
import {Strategy} from './model/strategy.model';
import {StrategyFilter} from '../strategy/strategies.table';
import {EntitiesServiceWatchOptions, EntityServiceLoadOptions} from 'src/app/shared/services/entity-service.class';
import {FetchPolicy} from 'apollo-client';
import {NetworkService} from 'src/app/core/services/network.service';
import {AccountService} from 'src/app/core/services/account.service';
import {EntitiesStorage} from 'src/app/core/services/entities-storage.service';
import {ReferentialFragments} from "./referential.fragments";
import {isEmptyArray} from "../../shared/functions";
import {
  MINIFY_OPTIONS,
  NOT_MINIFY_OPTIONS,
  ReferentialAsObjectOptions,
  ReferentialUtils
} from "../../core/services/model/referential.model";

import {ReferentialRefFilter} from "./referential-ref.service";
import {ReferentialFilter} from "./referential.service";

import {
  DataEntityAsObjectOptions,
  SAVE_OPTIMISTIC_AS_OBJECT_OPTIONS
} from "../../data/services/model/data-entity.model";

import {
  SAVE_LOCALLY_AS_OBJECT_OPTIONS,
  SAVE_AS_OBJECT_OPTIONS
} from "../../core/services/model/referential.model";

export declare interface StrategySaveOptions {
  programId?: number
}

export const StrategyFragments = {
  referential: gql`fragment ReferentialFragment on ReferentialVO {
    id
    label
    name
    rankOrder
    statusId
    entityName
    __typename
  }`,
  strategyRef: gql`
    fragment StrategyRefFragment on StrategyVO {
      id
      label
      name
      description
      comments
      analyticReference
      updateDate
      creationDate
      statusId
      gears {
        ...ReferentialFragment
      }
      taxonGroups {
        ...TaxonGroupStrategyFragment
      }
      taxonNames {
        ...TaxonNameStrategyFragment
      }
      appliedStrategies {
        ...AppliedStrategyFragment
      }
      pmfmStrategies {
        ...PmfmStrategyRefFragment
      }
      strategyDepartments {
        ...StrategyDepartmentFragment
      }
    }
  `,
  lightStrategy: gql`
  fragment LightStrategyFragment on StrategyVO {
    id
    label
    name
    description
    comments
    analyticReference
    updateDate
    creationDate
    statusId
    programId
  }
  `,
  strategy: gql`
    fragment StrategyFragment on StrategyVO {
      id
      label
      name
      description
      comments
      analyticReference
      updateDate
      creationDate
      statusId
      programId
      gears {
        ...ReferentialFragment
      }
      taxonGroups {
        ...TaxonGroupStrategyFragment
      }
      taxonNames {
        ...TaxonNameStrategyFragment
      }
      appliedStrategies {
        ...AppliedStrategyFragment
      }
      pmfmStrategies {
        ...PmfmStrategyFragment
      }
      strategyDepartments {
        ...StrategyDepartmentFragment
      }
    }
  `,
  appliedStrategy: gql`
    fragment AppliedStrategyFragment on AppliedStrategyVO {
      strategyId
      location {
        ...ReferentialFragment
      }
      appliedPeriods {
        ...AppliedPeriodFragment
      }
      __typename
    }
  `,
  appliedPeriod: gql`
    fragment AppliedPeriodFragment on AppliedPeriodVO {
      appliedStrategyId
      startDate
      endDate
      acquisitionNumber
      __typename
    }
  `,
  strategyDepartment: gql`
    fragment StrategyDepartmentFragment on StrategyDepartmentVO {
      strategyId
      location {
        ...ReferentialFragment
      }
      privilege {
        ...ReferentialFragment
      }
      department {
        ...ReferentialFragment
      }
      __typename
    }
  `,
  taxonName: gql`fragment TaxonNameFragment on TaxonNameVO {
    id
    label
    name
    statusId
    levelId
    referenceTaxonId
    entityName
    isReferent
    __typename
  }`,
  pmfmStrategy: gql`
    fragment PmfmStrategyFragment on PmfmStrategyVO {
      id
      acquisitionLevel
      rankOrder
      isMandatory
      acquisitionNumber
      defaultValue
      pmfmId
      pmfm {
        ...FullPmfmFragment
      }
      parameterId
      parameter {
        ...ReferentialFragment
      }
      matrixId
      matrix {
        ...ReferentialFragment
      }
      fractionId
      fraction {
        ...ReferentialFragment
      }
      methodId
      method {
        ...ReferentialFragment
      }
      gearIds
      taxonGroupIds
      referenceTaxonIds
      strategyId
      __typename
  }`,
  taxonGroupStrategy: gql`
    fragment TaxonGroupStrategyFragment on TaxonGroupStrategyVO {
      strategyId
      priorityLevel
      taxonGroup {
          id
          label
          name
          entityName
          taxonNames {
              ...TaxonNameFragment
          }
      }
      __typename
    }
  `,
  taxonNameStrategy: gql`
    fragment TaxonNameStrategyFragment on TaxonNameStrategyVO {
      strategyId
      priorityLevel
      taxonName {
          ...TaxonNameFragment
      }
      __typename
    }
  `,

}


const FindStrategyNextLabel: any = gql`
  query SuggestedStrategyNextLabelQuery($programId: Int!, $labelPrefix: String, $nbDigit: Int){
    suggestedStrategyNextLabel(programId: $programId, labelPrefix: $labelPrefix, nbDigit: $nbDigit)
  }
`;

const LoadAllAnalyticReferencesQuery: any = gql`
  query AnalyticReferencesQuery($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: ReferentialFilterVOInput){
    analyticReferences(offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection, filter: $filter){
      ...ReferentialFragment
    }
  }
  ${ReferentialFragments.referential}
`;

const LoadQuery: any = gql`
  query Strategy($id: Int!) {
    strategy(id: $id) {
      ...StrategyFragment
    }
  }
  ${StrategyFragments.strategy}
  ${StrategyFragments.appliedStrategy}
  ${StrategyFragments.appliedPeriod}
  ${StrategyFragments.strategyDepartment}
  ${StrategyFragments.pmfmStrategy}
  ${StrategyFragments.taxonGroupStrategy}
  ${StrategyFragments.taxonNameStrategy}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.fullPmfm}
  ${ReferentialFragments.fullParameter}
  ${ReferentialFragments.taxonName}
  ${ReferentialFragments.fullReferential}
`;
const LoadQueryWithExpandedPmfmStrategy: any = gql`
  query Strategy($label: String!, $expandedPmfmStrategy : Boolean!) {
    strategy(label: $label, expandedPmfmStrategy : $expandedPmfmStrategy) {
      ...StrategyFragment
    }
  }
  ${StrategyFragments.strategy}
  ${StrategyFragments.appliedStrategy}
  ${StrategyFragments.appliedPeriod}
  ${StrategyFragments.strategyDepartment}
  ${StrategyFragments.pmfmStrategy}
  ${StrategyFragments.taxonGroupStrategy}
  ${StrategyFragments.taxonNameStrategy}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.fullPmfm}
  ${ReferentialFragments.fullParameter}
  ${ReferentialFragments.taxonName}
  ${ReferentialFragments.fullReferential}
`;

const LoadAllQuery: any = gql`
query Strategies($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: StrategyFilterVOInput){
  strategies(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
    ...LightStrategyFragment
  }
}
${StrategyFragments.lightStrategy}
`;

const LoadAllWithTotalQuery: any = gql`
  query StrategiesWithTotal($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: StrategyFilterVOInput){
    strategies(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...LightStrategyFragment
    }
    referentialsCount(entityName: "Strategy")
  }
  ${StrategyFragments.lightStrategy}
`;

const SaveStrategy: any = gql`
    mutation SaveStrategy($strategy:StrategyVOInput){
      saveStrategy(strategy: $strategy){
        ...StrategyFragment
      }
    }
  ${StrategyFragments.strategy}
  ${StrategyFragments.appliedStrategy}
  ${StrategyFragments.appliedPeriod}
  ${StrategyFragments.pmfmStrategy}
  ${StrategyFragments.strategyDepartment}
  ${StrategyFragments.taxonGroupStrategy}
  ${StrategyFragments.taxonNameStrategy}
  ${StrategyFragments.referential}
  ${ReferentialFragments.fullPmfm}
  ${StrategyFragments.taxonName}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.fullParameter}
  ${ReferentialFragments.fullReferential}

`;
const LoadAllStrategies: any = gql`
  query Strategies($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: StrategyFilterVOInput){
    strategies(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...StrategyFragment
    }
  }
  ${StrategyFragments.strategy}
  ${StrategyFragments.appliedStrategy}
  ${StrategyFragments.appliedPeriod}
  ${StrategyFragments.pmfmStrategy}
  ${StrategyFragments.strategyDepartment}
  ${StrategyFragments.taxonGroupStrategy}
  ${StrategyFragments.taxonNameStrategy}
  ${StrategyFragments.referential}
  ${ReferentialFragments.fullPmfm}
  ${StrategyFragments.taxonName}
`;

const DeleteStrategies: any = gql`
    mutation deleteStrategies($ids:[Int]){
      deleteStrategies(ids: $ids)
    }
  `;

@Injectable({providedIn: 'root'})
export class StrategyService extends BaseEntityService implements EntitiesService<Strategy, StrategyFilter>, EntityService<Strategy> {

  loading = false;

  constructor(
    protected graphql: GraphqlService,
    protected network: NetworkService,
    protected accountService: AccountService,
    protected entities: EntitiesStorage
  ) {
    super(graphql);
    if (this._debug) console.debug('[strategy-service] Creating service');
  }

  async load(id: number, options?: EntityServiceLoadOptions): Promise<Strategy | null> {
    if (isNil(id)) throw new Error("Missing argument 'id' ");

    const now = this._debug && Date.now();
    if (this._debug) console.debug(`[strategy-service] Loading strategy #${id}...`);
    this.loading = true;

    try {
      let json: any;

      // Load locally
      if (id < 0) {
        json = await this.entities.load<Strategy>(id, Strategy.TYPENAME);
      }

      // Load from pod
      else {
        const res = await this.graphql.query<{ strategy: Strategy }>({
          query: LoadQuery,
          variables: {
            id: id
          },
          error: {code: ErrorCodes.LOAD_STRATEGY_ERROR, message: "STRATEGY.ERROR.LOAD_STRATEGY_ERROR"},
          fetchPolicy: options && options.fetchPolicy || undefined
        });
        json = res && res.strategy;
      }

      // Transform to entity
      const data = Strategy.fromObject(json);
      if (data && this._debug) console.debug(`[strategy-service] Strategy #${id} loaded in ${Date.now() - now}ms`, data);
      return data;
    } finally {
      this.loading = false;
    }
  }


  /**
   *
   * @param label
   * @param options : expandedPmfmStrategy
   */

  async loadByLabel(label: string, options?: EntityServiceLoadOptions): Promise<Strategy | null> {
    if (isNilOrBlank(label)) throw new Error("Missing argument 'label' ");

    const now = this._debug && Date.now();
    if (this._debug) console.debug(`[strategy-service] Loading strategy #${label}...`);
    this.loading = true;

    try {
      let json: any;

      // Load from pod
        const res = await this.graphql.query<{ strategy: Strategy }>({
          query: LoadQueryWithExpandedPmfmStrategy,
          variables: {
            label: label,
            expandedPmfmStrategy: true
          },

          error: {code: ErrorCodes.LOAD_STRATEGY_ERROR, message: "STRATEGY.ERROR.LOAD_STRATEGY_ERROR"},
          fetchPolicy: options && options.fetchPolicy || undefined,

        });
        json = res && res.strategy;


      // Transform to entity
      const data = Strategy.fromObject(json);
      if (data && this._debug) console.debug(`[strategy-service] Strategy #${label} loaded in ${Date.now() - now}ms`, data);
      return data;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Save an strategy
   * @param data
   */

  async save(entity: Strategy, options?: any): Promise<Strategy> {

    if (!entity) return entity;

    const json = this.asObject(entity, SAVE_AS_OBJECT_OPTIONS);

    if(json.taxonNames) {
      // not need
      delete json.taxonNames[0].taxonGroup;
      delete json.taxonNames[0].taxonName.__typename;
    }

    const now = Date.now();
    if (this._debug) console.debug("[strategy-service] Saving strategy...", json);

    const res = await this.graphql.mutate<{ saveStrategy: Strategy }>({
      mutation: SaveStrategy,
      variables: {
        strategy: json
      },
      error: {code: ErrorCodes.SAVE_PROGRAM_ERROR, message: "PROGRAM.ERROR.SAVE_PROGRAM_ERROR"}
    });
    const savedStrategy = res && res.saveStrategy;
    this.copyIdAndUpdateDate(savedStrategy, entity);

    //if (this._debug)
    console.debug(`[strategy-service] Strategy saved and updated in ${Date.now() - now}ms`, entity);

    return entity;
  }


  /**
   * delete strategy
   * @param data
   */

  async delete(data: Strategy, options?: any): Promise<any> {
    await this.deleteAll([data]);
  }

  listenChanges(id: number, options?: any): Observable<Strategy> {
    throw new Error('Method not implemented.');
  }

  watchAll(offset: number, size: number, sortBy?: string, sortDirection?: SortDirection, filter?: StrategyFilter, options?: EntitiesServiceWatchOptions): Observable<LoadResult<Strategy>> {
    throw new Error('Method not implemented.');
  }

  /**
   * Load strategies
   * @param offset
   * @param size
   * @param sortBy
   * @param sortDirection
   * @param dataFilter
   */
  async loadAll(offset: number,
                size: number,
                sortBy?: string,
                sortDirection?: SortDirection,
                dataFilter?: StrategyFilter,
                opts?: {
                  query?: any,
                  fetchPolicy: FetchPolicy;
                  withTotal?: boolean;
                  toEntity?: boolean;
                  debug?: boolean;
                }): Promise<LoadResult<Strategy>> {

    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'label',
      sortDirection: sortDirection || 'asc',
      filter: dataFilter
    };
    const debug = this._debug && (!opts || opts.debug !== false);
    const now = debug && Date.now();
    if (debug) console.debug("[strategy-service] Loading strategies... using options:", variables);

    let loadResult: { strategies: any[], referentialsCount?: number };

    // Offline mode
    const offline = this.network.offline && (!opts || opts.fetchPolicy !== 'network-only');
    if (offline) {
// loadResult = await this.entities.loadAll('StrategyVO',
//  {
//    ...variables,
//    filter: EntityUtils.searchTextFilter('label', dataFilter.searchText)
//  }
// ).then(res => {
//  return {
//    programs: res && res.data,
//    referentialsCount: res && res.total
//  };
// });
    }

// Online mode
    else {
      const query = opts && opts.query || opts && opts.withTotal && LoadAllWithTotalQuery || LoadAllQuery;
      loadResult = await this.graphql.query<{ strategies: any[], referentialsCount?: number }>({
        query,
        variables,
        error: {code: ErrorCodes.LOAD_STRATEGIES_ERROR, message: "STRATEGY.ERROR.LOAD_STRATEGIES_ERROR"},
        fetchPolicy: opts && opts.fetchPolicy || undefined
      });
    }

    const data = (!opts || opts.toEntity !== false) ?
      (loadResult && loadResult.strategies || []).map(Strategy.fromObject) :
      (loadResult && loadResult.strategies || []) as Strategy[];
    if (debug) console.debug(`[strategy-service] Strategies loaded in ${Date.now() - now}ms`);
    return {
      data: data,
      total: loadResult.referentialsCount
    };

  }

  /**
   * Save many strategies
   * @param data
   */

  async saveAll(entities: Strategy[], options?: any): Promise<Strategy[]> {
    if (!entities) return entities;
    return await Promise.all(entities.map((strategy) => this.save(strategy, options)));
  }

  /**
   * Delete many strategies
   * @param entities
   */

  async deleteAll(entities: Strategy[]): Promise<any> {
    // Get local entity ids, then delete id
    const localIds = entities && entities
      .map(t => t.id)
      .filter(id => id < 0);
    if (isNotEmptyArray(localIds)) {
      if (this._debug) console.debug("[strategy-service] Deleting programs locally... ids:", localIds);
      await this.entities.deleteMany<Strategy>(localIds, 'StrategyVO');
    }

    const ids: number[] = entities && entities
      .map(t => t.id)
      .filter(id => id >= 0);
    if (isEmptyArray(ids)) return; // stop, if nothing else to do

    const now = Date.now();
    if (this._debug) console.debug("[strategy-service] Deleting strategies... ids:", ids);

    await this.graphql.mutate({
      mutation: DeleteStrategies,
      variables: {
        ids
      },
      update: (proxy) => {
        // Remove from cached queries
        this.removeFromMutableCachedQueryByIds(proxy, {
          query: LoadAllStrategies, ids
        });

        if (this._debug) console.debug(`[strategy-service] strategies deleted in ${Date.now() - now}ms`);
      }
    });
  }

  async findStrategyNextLabel(programId: number, labelPrefix?: string, nbDigit?: number): Promise<string> {
    if (this._debug) console.debug(`[strategy-service] Loading strategy next label...`);

    const res = await this.graphql.query<{ suggestedStrategyNextLabel: string }>({
      query: FindStrategyNextLabel,
      variables: {
        programId: programId,
        labelPrefix: labelPrefix,
        nbDigit: nbDigit
      },
      error: {code: ErrorCodes.LOAD_PROGRAM_ERROR, message: "PROGRAM.STRATEGY.ERROR.LOAD_STRATEGY_LABEL_ERROR"},
      fetchPolicy: 'network-only'
    });
    return res && res.suggestedStrategyNextLabel;
  }

  async LoadAllAnalyticReferences(
    offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filter?: ReferentialRefFilter): Promise<ReferentialRef[]> {

    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'label',
      sortDirection: sortDirection || 'asc',
      filter: ReferentialFilter.asPodObject(filter)
    };

    const now = this._debug && Date.now();
    if (this._debug) console.debug(`[strategy-service] Loading analytic references items...`, variables);

    const res = await this.graphql.query<{ analyticReferences: Referential[] }>({
      query: LoadAllAnalyticReferencesQuery,
      variables: variables,
      error: { code: ErrorCodes.LOAD_PROGRAM_ERROR, message: "PROGRAM.STRATEGY.ERROR.LOAD_STRATEGY_REFERENCES_ERROR" },
      fetchPolicy: 'cache-first'
    });

    if (this._debug) console.debug(`[strategy-service] Analytic references items loaded in ${Date.now() - now}ms`);
    return (res && res.analyticReferences || []) as ReferentialRef[];
  }

  async suggestAnalyticReferences(value: any, filter?: ReferentialRefFilter, sortBy?: keyof Referential, sortDirection?: SortDirection): Promise<ReferentialRef[]> {
    if (ReferentialUtils.isNotEmpty(value)) return [value];
    value = (typeof value === "string" && value !== '*') && value || undefined;
    const res = await this.LoadAllAnalyticReferences(0, !value ? 30 : 10, sortBy, sortDirection,
      { ...filter, searchText: value}
    );
    return res;
  }

  protected asObject(source: Strategy, opts?: ReferentialAsObjectOptions): any {

    return source.asObject(
      <ReferentialAsObjectOptions>{
        ...opts,
        ...NOT_MINIFY_OPTIONS, // Force NOT minify, because program is a referential that can be minify in just an ID
      });
  }

  //TODO : implements fillDefaultProperties here
  protected fillDefaultProperties(entity: Strategy, options?: Partial<StrategySaveOptions>) {
  }
  protected copyIdAndUpdateDate(source: Strategy, target: Strategy) {

    EntityUtils.copyIdAndUpdateDate(source, target);

    // Update strategies

    // Make sure tp copy programId (need by equals)
    target.programId = source.id;

    const savedStrategy = source;
    EntityUtils.copyIdAndUpdateDate(savedStrategy, target);

    // Update pmfm strategy (id)
    if (savedStrategy.pmfmStrategies && savedStrategy.pmfmStrategies.length > 0) {

      target.pmfmStrategies.forEach(targetPmfmStrategy => {

        // Make sure to copy strategyId (need by equals)
        targetPmfmStrategy.strategyId = savedStrategy.id;

        const savedPmfmStrategy = target.pmfmStrategies.find(srcPmfmStrategy => targetPmfmStrategy.equals(srcPmfmStrategy));
        targetPmfmStrategy.id = savedPmfmStrategy.id;
      });
    }




  }
}
