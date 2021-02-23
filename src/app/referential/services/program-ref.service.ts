import {Injectable} from "@angular/core";
import {FetchPolicy, gql, WatchQueryFetchPolicy} from "@apollo/client/core";
import {BehaviorSubject, defer, Observable} from "rxjs";
import {filter, map} from "rxjs/operators";
import {ErrorCodes} from "./errors";
import {ReferentialFragments} from "./referential.fragments";
import {GraphqlService} from "../../core/graphql/graphql.service";
import {IEntitiesService, IEntityService, LoadResult} from "../../shared/services/entity-service.class";
import {TaxonGroupRef, TaxonGroupTypeIds, TaxonNameRef} from "./model/taxon.model";
import {firstArrayValue, isNilOrBlank, isNotEmptyArray, isNotNil, propertiesPathComparator, suggestFromArray} from "../../shared/functions";
import {CacheService} from "ionic-cache";
import {ReferentialRefFilter, ReferentialRefService} from "./referential-ref.service";
import {firstNotNilPromise} from "../../shared/observables";
import {AccountService} from "../../core/services/account.service";
import {NetworkService} from "../../core/services/network.service";
import {EntitiesStorage} from "../../core/services/storage/entities-storage.service";
import {IReferentialRef, ReferentialRef, ReferentialUtils} from "../../core/services/model/referential.model";
import {StatusIds} from "../../core/services/model/model.enum";
import {Program} from "./model/program.model";

import {DenormalizedPmfmStrategy} from "./model/pmfm-strategy.model";
import {IWithProgramEntity} from "../../data/services/model/model.utils";
import {ReferentialFilter} from "./referential.service";
import {StrategyFragments} from "./strategy.fragments";
import {AcquisitionLevelCodes} from "./model/model.enum";
import {JobUtils} from "../../shared/services/job.utils";
import {ProgramFragments} from "./program.fragments";
import {PlatformService} from "../../core/services/platform.service";
import {ConfigService} from "../../core/services/config.service";
import {PmfmService} from "./pmfm.service";
import {BaseReferentialService} from "./base-referential-service.class";


export class ProgramFilter extends ReferentialFilter {

}

export const ProgramRefQueries = {
  // Load by id, with only properties
  loadLight: gql`query ProgramRef($id: Int, $label: String){
        data: program(id: $id, label: $label){
          ...LightProgramFragment
        }
    }
    ${ProgramFragments.lightProgram}
  `,
  // Load by id or label, with strategies
  load: gql`query ProgramRef($id: Int, $label: String){
        data: program(id: $id, label: $label){
          ...ProgramRefFragment
          strategies {
            ...StrategyRefFragment
          }
        }
    }
    ${ProgramFragments.programRef}
    ${StrategyFragments.strategyRef}
    ${StrategyFragments.denormalizedPmfmStrategy}
    ${StrategyFragments.taxonGroupStrategy}
    ${StrategyFragments.taxonNameStrategy}
    ${ReferentialFragments.referential}
    ${ReferentialFragments.taxonName}
  `,

  // Load all query
  loadAll: gql` query Programs($filter: ProgramFilterVOInput!, $offset: Int, $size: Int, $sortBy: String, $sortDirection: String){
    data: programs(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...ProgramRefFragment
    }
  }
  ${ProgramFragments.programRef}`,

  // Load all query (with total)
  loadAllWithTotal: gql` query Programs($filter: ProgramFilterVOInput!, $offset: Int, $size: Int, $sortBy: String, $sortDirection: String){
    data: programs(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...ProgramRefFragment
    }
    total: programsCount(filter: $filter)
  }
  ${ProgramFragments.programRef}`,

  // Load all query (with total, and strategies)
  loadAllWithTotalAndStrategy: gql` query Programs($filter: ProgramFilterVOInput!, $offset: Int, $size: Int, $sortBy: String, $sortDirection: String){
    data: programs(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...ProgramRefFragment
      strategies {
        ...StrategyRefFragment
      }
    }
    total: programsCount(filter: $filter)
  }
  ${ProgramFragments.programRef}
  ${StrategyFragments.strategyRef}
  ${StrategyFragments.denormalizedPmfmStrategy}
  ${StrategyFragments.taxonGroupStrategy}
  ${StrategyFragments.taxonNameStrategy}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.taxonName}`
};

const ProgramRefCacheKeys = {
  CACHE_GROUP: 'program',

  PROGRAM_BY_LABEL: 'programByLabel',
  PMFMS: 'programPmfms',
  GEARS: 'programGears',
  TAXON_GROUPS: 'programTaxonGroups',
  TAXON_GROUP_ENTITIES: 'programTaxonGroupEntities',
  TAXON_NAME_BY_GROUP: 'programTaxonNameByGroup',
  TAXON_NAMES: 'taxonNameByGroup'
};

@Injectable({providedIn: 'root'})
export class ProgramRefService
  extends BaseReferentialService<Program, ProgramFilter>
  implements IEntitiesService<Program, ProgramFilter>,
    IEntityService<Program> {

  constructor(
    graphql: GraphqlService,
    platform: PlatformService,
    protected network: NetworkService,
    protected accountService: AccountService,
    protected cache: CacheService,
    protected entities: EntitiesStorage,
    protected configService: ConfigService,
    protected pmfmService: PmfmService,
    protected referentialRefService: ReferentialRefService
  ) {
    super(graphql, platform, Program,
      {
        queries: ProgramRefQueries,
        filterAsObjectFn: ProgramFilter.asPodObject,
        filterFnFactory: ProgramFilter.searchFilter,
      });
  }

  canUserWrite(data: IWithProgramEntity<any>): boolean {
    if (!data) return false;

    // If the user is the recorder: can write
    if (data.recorderPerson && this.accountService.isLogin() && this.accountService.account.asPerson().equals(data.recorderPerson)) {
      return true;
    }

    // TODO: check rights on program (need model changes)

    // Check same department
    return this.accountService.canUserWriteDataForDepartment(data.recorderDepartment);
  }

  /**
   * Watch program by label
   * @param label
   * @param opts
   */
  watchByLabel(label: string, opts?: {
    toEntity?: boolean;
    debug?: boolean;
    query?: any;
    cache?: boolean;
    fetchPolicy?: WatchQueryFetchPolicy;
  }): Observable<Program> {

    // Use cache (enable by default, if no custom query)
    if (!opts || (opts.cache !== false && !opts.query)) {
      const cacheKey = [ProgramRefCacheKeys.PROGRAM_BY_LABEL, label].join('|');
      return this.cache.loadFromObservable(cacheKey,
        defer(() => this.watchByLabel(label, {...opts, cache: false, toEntity: false})),
        ProgramRefCacheKeys.CACHE_GROUP
      )
      .pipe(
        map(data => (!opts || opts.toEntity !== false) ? Program.fromObject(data) : data)
      );
    }

    // Debug
    const debug = this._debug && (!opts || opts.debug !== false);
    let now = debug && Date.now();
    if (debug) console.debug(`[program-ref-service] Watching program {${label}}...`);

    let res: Observable<any>;

    const offline = this.network.offline && (!opts || opts.fetchPolicy !== 'network-only');
    if (offline) {
      res = this.entities.watchAll<any>(Program.TYPENAME, {
        offset: 0, size: 1,
        filter: (p) => p.label === label
      }).pipe(
        map(res => firstArrayValue(res && res.data))
      );
    }
    else {
      const query = opts && opts.query || this.queries.load;
      res = this.graphql.watchQuery<{data: any}>({
        query,
        variables: { label },
        fetchPolicy: opts && (opts.fetchPolicy as FetchPolicy) || 'no-cache',
        error: {code: ErrorCodes.LOAD_REFERENTIAL_ERROR, message: "REFERENTIAL.ERROR.LOAD_REFERENTIAL_ERROR"}
      }).pipe(map(res => res && res.data));
    }

    return res.pipe(
      //filter(isNotNil),
      map(data => {
        const entity = (!opts || opts.toEntity !== false) ? Program.fromObject(data) : data;
        if (now) {
          console.debug(`[program-ref-service] Watching program {${label}} [OK] in ${Date.now() - now}ms`);
          now = undefined;
        }
        return entity;
      })
    );
  }

  async existsByLabel(label: string): Promise<Boolean> {
    if (isNilOrBlank(label)) return false;

    const program = await this.loadByLabel(label, {toEntity: false});
    return ReferentialUtils.isNotEmpty(program);
  }

  async loadByLabel(label: string, opts?: {
    toEntity?: boolean;
    query?: any;
    cache?: boolean;
    fetchPolicy?: FetchPolicy;
  }): Promise<Program> {

    // Use cache (enable by default, if no custom query)
    if (!opts || (opts.cache !== false && !opts.query)) {
      const cacheKey = [ProgramRefCacheKeys.PROGRAM_BY_LABEL, label].join('|');
      return this.cache.getOrSetItem<Program>(cacheKey,
        () => this.loadByLabel(label, {...opts, cache: false, toEntity: false}),
        ProgramRefCacheKeys.CACHE_GROUP)
        .then(data => (!opts || opts.toEntity !== false) ? Program.fromObject(data) : data);
    }

    let data: any;
    if (this._debug) console.debug(`[program-ref-service] Loading program {${label}}...`);

    // If offline mode
    const offline = this.network.offline && (!opts || opts.fetchPolicy !== 'network-only');
    if (offline) {
      data = await this.entities.loadAll<Program>(Program.TYPENAME, {
        offset: 0, size: 1,
        filter: (p) => p.label ===  label
      }).then(res => firstArrayValue(res && res.data));
    }
    else {
      const query = opts && opts.query || this.queries.load;
      const res = await this.graphql.query<{ data: any }>({
        query,
        variables: { label },
        error: {code: ErrorCodes.LOAD_PROGRAM_ERROR, message: "PROGRAM.ERROR.LOAD_PROGRAM_ERROR"}
      });
      data = res && res.data;
    }

    // Convert to entity (if need)
    const entity = (!opts || opts.toEntity !== false)
      ? Program.fromObject(data)
      : data as Program;

    if (this._debug) console.debug(`[program-ref-service] Program loaded {${label}}`, entity);
    return entity;
  }

  /**
   * Watch program pmfms
   */
  watchProgramPmfms(programLabel: string, opts: {
    cache?: boolean;
    acquisitionLevel: string;
    strategyLabel?: string;
    gearId?: number;
    taxonGroupId?: number;
    referenceTaxonId?: number;
    toEntity?: boolean;
  }, debug?: boolean): Observable<DenormalizedPmfmStrategy[]> {

    // Use cache (enable by default)
    if (!opts || opts.cache !== false) {
      const cacheKey = [ProgramRefCacheKeys.PMFMS, programLabel, JSON.stringify(opts)].join('|');
      return this.cache.loadFromObservable(cacheKey,
        defer(() => this.watchProgramPmfms(programLabel, {...opts, cache: false, toEntity: false})),
        ProgramRefCacheKeys.CACHE_GROUP)
        .pipe(
          map(data => (!opts || opts.toEntity !== false)
            ? (data || []).map(DenormalizedPmfmStrategy.fromObject)
            : (data || []) as DenormalizedPmfmStrategy[])
        );
    }

    return this.watchByLabel(programLabel, {toEntity: false, debug: false}) // Watch the program
      .pipe(
        map(program => {
          // Find strategy
          const strategy = (program && program.strategies || []).find(s => !opts || !opts.strategyLabel || s.label === opts.strategyLabel);

          const pmfmIds = []; // used to avoid duplicated pmfms
          const res = (strategy && strategy.denormalizedPmfms || [])
            // Filter on acquisition level and gear
            .filter(p =>
              pmfmIds.indexOf(p.id) === -1
              && (
                !opts || (
                  (!opts.acquisitionLevel || p.acquisitionLevel === opts.acquisitionLevel)
                  // Filter on gear (if PMFM has gears = compatible with all gears)
                  && (!opts.gearId || !p.gearIds || !p.gearIds.length || p.gearIds.findIndex(id => id === opts.gearId) !== -1)
                  // Filter on taxon group
                  && (!opts.taxonGroupId || !p.taxonGroupIds || !p.taxonGroupIds.length || p.taxonGroupIds.findIndex(g => g === opts.taxonGroupId) !== -1)
                  // Filter on reference taxon
                  && (!opts.referenceTaxonId || !p.referenceTaxonIds || !p.referenceTaxonIds.length || p.referenceTaxonIds.findIndex(g => g === opts.referenceTaxonId) !== -1)
                  // Add to list of IDs
                  && pmfmIds.push(p.id)
                )
              ))

            // Sort on rank order
            .sort((p1, p2) => p1.rankOrder - p2.rankOrder);

          if (debug) console.debug(`[program-ref-service] PMFM for ${opts.acquisitionLevel} (filtered):`, res);

          // TODO: translate name/label using translate service ?

          return (!opts || opts.toEntity !== false)
            ? res && res.map(DenormalizedPmfmStrategy.fromObject)
            : res as DenormalizedPmfmStrategy[];
        }
      ),
      filter(isNotNil) // TODO
    );
  }

  /**
   * Load program pmfms
   */
  loadProgramPmfms(programLabel: string, options?: {
    acquisitionLevel: string;
    strategyLabel?: string;
    gearId?: number;
    taxonGroupId?: number;
    referenceTaxonId?: number;
  }, debug?: boolean): Promise<DenormalizedPmfmStrategy[]> {

    return firstNotNilPromise(
      this.watchProgramPmfms(programLabel, options, debug)
    );
  }

  /**
   * Watch program gears
   */
  watchGears(programLabel: string, opts?: {
    strategyLabel?: string;
    toEntity?: boolean;
    cache?: boolean;
  }): Observable<ReferentialRef[]> {

    // Use cache (enable by default)
    if (!opts || opts.cache !== false) {
      const cacheKey = [ProgramRefCacheKeys.GEARS, programLabel].join('|');
      return this.cache.loadFromObservable(cacheKey,
        defer(() => this.watchGears(programLabel, {...opts, cache: false, toEntity: false})),
        ProgramRefCacheKeys.CACHE_GROUP)
        .pipe(
          map(data => (!opts || opts.toEntity !== false)
            ? (data || []).map(ReferentialRef.fromObject)
            : (data || []) as ReferentialRef[])
        );
    }

    return this.watchByLabel(programLabel, {toEntity: false}) // Load the program
        .pipe(
          map(program => {
            // Find strategy
            const strategy = (program && program.strategies || []).find(s => !opts || !opts.strategyLabel || s.label === opts.strategyLabel);

            const data = (strategy && strategy.gears || []);
            if (this._debug) console.debug(`[program-ref-service] Found ${data.length} gears on program {${program.label}}`);

            // Convert into entities
            return (!opts || opts.toEntity !== false)
              ? data.map(ReferentialRef.fromObject)
              : data as ReferentialRef[];
          })
        );
  }

  /**
   * Load program gears
   */
  loadGears(programLabel: string): Promise<ReferentialRef[]> {
    return firstNotNilPromise(this.watchGears(programLabel));
  }

  /**
   * Watch program taxon groups
   */
  watchTaxonGroups(programLabel: string, opts?: {
    strategyLabel?: string;
    toEntity?: boolean;
    cache?:  boolean;
  }): Observable<TaxonGroupRef[]> {

    // Use cache (enable by default)
    if (!opts || opts.cache !== false) {
      const cacheKey = [ProgramRefCacheKeys.TAXON_GROUPS, programLabel].join('|');
      return this.cache.loadFromObservable(cacheKey,
        defer(() => this.watchTaxonGroups(programLabel, {...opts, cache: false, toEntity: false})),
        ProgramRefCacheKeys.CACHE_GROUP)
        .pipe(
          map(data => (!opts || opts.toEntity !== false)
            ? (data || []).map(TaxonGroupRef.fromObject)
            : (data || []) as TaxonGroupRef[])
        );
    }

    // Watch program
    return this.watchByLabel(programLabel, {toEntity: false})
      .pipe(
        map(program => {
          // Find strategy
          const strategy = (program && program.strategies || []).find(s => !opts || !opts.strategyLabel || s.label === opts.strategyLabel);

          const data = (strategy && strategy.taxonGroups && strategy.taxonGroups.slice() || [])

            // Sort taxonGroupStrategies, on priorityLevel
             .sort(propertiesPathComparator(
               ['priorityLevel', 'taxonGroup.label', 'taxonGroup.name'],
               // Use default values, because priorityLevel can be null in the DB
               [1, 'ZZZ', 'ZZZ'])
             )
            .map(v => v.taxonGroup);
          if (this._debug) console.debug(`[program-ref-service] Found ${data.length} taxon groups on program {${programLabel}}`);

          // Convert into entities
          return (!opts || opts.toEntity !== false)
            ? data.map(TaxonGroupRef.fromObject)
            : data as TaxonGroupRef[];
        })
      );
  }

  /**
   * Load program taxon groups
   */
  async loadTaxonGroups(programLabel: string, opts?: { toEntity?: boolean; }): Promise<TaxonGroupRef[]> {
    return firstNotNilPromise(this.watchTaxonGroups(programLabel, opts));
    /*const mapCacheKey = [ProgramRefCacheKeys.TAXON_GROUP_ENTITIES, programLabel].join('|');
    const res = await this.cache.getOrSetItem(mapCacheKey,
      () => this.watchTaxonGroups(programLabel, {toEntity: true}).toPromise(),
      ProgramRefCacheKeys.CACHE_GROUP);

    // Convert to entity, after cache (convert by default)
    return (!opts || opts.toEntity !== false)
      ? res.map(TaxonGroupRef.fromObject)
      : res as TaxonGroupRef[];*/
  }

  /**
   * Suggest program taxon groups
   */
  async suggestTaxonGroups(value: any, filter?: Partial<ReferentialRefFilter & { program: string; }>): Promise<LoadResult<IReferentialRef>> {
    // Search on program's taxon groups
    if (filter && isNotNil(filter.program)) {
      const programItems = await this.loadTaxonGroups(filter.program, {toEntity: false});
      if (isNotEmptyArray(programItems)) {
        return suggestFromArray(programItems, value, {
          searchAttribute: filter.searchAttribute
        });
      }
    }

    // If nothing found in program, or species defined
    return this.referentialRefService.suggest(value, {
      ...filter,
      entityName: 'TaxonGroup',
      levelId: TaxonGroupTypeIds.FAO
    });
  }

  /**
   * Load program taxon groups
   */
  async suggestTaxonNames(value: any, options: {
    program?: string;
    levelId?: number;
    levelIds?: number[]
    searchAttribute?: string;
    taxonGroupId?: number;
  }): Promise<LoadResult<TaxonNameRef>> {

    // Search on taxon group's taxon'
    if (isNotNil(options.program) && isNotNil(options.taxonGroupId)) {

      // Get map from program
      const taxonNamesByTaxonGroupId = await this.loadTaxonNamesByTaxonGroupIdMap(options.program);
      const values = taxonNamesByTaxonGroupId[options.taxonGroupId];
      if (isNotEmptyArray(values)) {

        // All values
        if (isNilOrBlank(options.searchAttribute)) return {data: values};

        // Text search
        return suggestFromArray<TaxonNameRef>(values, value, {
          searchAttribute: options.searchAttribute
        });
      }
    }

    // If nothing found in program: search on taxonGroup
    const res = await this.referentialRefService.suggestTaxonNames(value, {
      levelId: options.levelId,
      levelIds: options.levelIds,
      taxonGroupId: options.taxonGroupId,
      searchAttribute: options.searchAttribute
    });

    // If there result, use it
    if (res && isNotEmptyArray(res.data) || res.total > 0) return res;

    // Then, retry in all taxon (without taxon groups - Is the link taxon<->taxonGroup missing ?)
    if (isNotNil(options.taxonGroupId)) {
      return this.referentialRefService.suggestTaxonNames(value, {
        levelId: options.levelId,
        levelIds: options.levelIds,
        searchAttribute: options.searchAttribute
      });
    }

    // Nothing found
    return {data: []};
  }

  async loadTaxonNamesByTaxonGroupIdMap(program: string): Promise<{ [key: number]: TaxonNameRef[] } | undefined> {
    const mapCacheKey = [ProgramRefCacheKeys.TAXON_NAME_BY_GROUP, program].join('|');

    return await this.cache.getOrSetItem(mapCacheKey,
      async (): Promise<{ [key: number]: TaxonNameRef[] }> => {
      const taxonGroups = await this.loadTaxonGroups(program);
      return (taxonGroups || []).reduce((res, taxonGroup) => {
        if (isNotEmptyArray(taxonGroup.taxonNames)) {
          res[taxonGroup.id] = taxonGroup.taxonNames;
          //empty = false;
        }
        return res;
      }, {});
    }, ProgramRefCacheKeys.CACHE_GROUP);
  }

  async executeImport(progression: BehaviorSubject<number>,
                      opts?: {
                        maxProgression?: number;
                        acquisitionLevels?: string[];
                      }) {


    const maxProgression = opts && opts.maxProgression || 100;

    const now = this._debug && Date.now();
    console.info("[program-ref-service] Importing programs...");

    try {
      // Clear cache
      await this.clearCache();

      // Create search filter
      let loadFilter: ProgramFilter = {
        statusIds:  [StatusIds.ENABLE, StatusIds.TEMPORARY]
      };

      // Add filter on acquisition level
      if (opts && isNotEmptyArray(opts.acquisitionLevels)) {
        const acquisitionLevels: string[] = opts && opts.acquisitionLevels || Object.keys(AcquisitionLevelCodes).map(key => AcquisitionLevelCodes[key]);
        if (acquisitionLevels && acquisitionLevels.length === 1) {
          loadFilter = {
            ...loadFilter,
            searchJoin: "strategies/pmfms/acquisitionLevel",
            searchAttribute: "label",
            searchText: acquisitionLevels[0]
          };
        }
        else {
          console.warn('Cannot request on many acquisition level (not implemented)');
        }
      }

      // Step 1. load all programs
      const importedProgramLabels = [];
      const {data} = await JobUtils.fetchAllPages<any>((offset, size) =>
          this.loadAll(offset, size, 'id', 'asc', loadFilter, {
            debug: false,
            query: ProgramRefQueries.loadAllWithTotalAndStrategy,
            fetchPolicy: "network-only",
            toEntity: false
          }),
        progression,
        {
          maxProgression: maxProgression * 0.9,
          onPageLoaded: ({data}) => {
            const labels = (data || []).map(p => p.label) as string[];
            importedProgramLabels.push(...labels);
          },
          logPrefix: '[program-ref-service]'
        }
      );

      // Step 2. Saving locally
      await this.entities.saveAll(data || [], {
        entityName: Program.TYPENAME,
        reset: true
      });

      if (this._debug) console.debug(`[landing-service] Importing programs [OK] in ${Date.now() - now}ms`, data);

    }
    catch (err) {
      console.error("[program-ref-service] Error during programs importation", err);
      throw err;
    }
  }

  async clearCache() {
    console.info("[program-ref-service] Clearing program cache...");
    await this.cache.clearGroup(ProgramRefCacheKeys.CACHE_GROUP);
  }

  /* -- protected methods -- */

}
