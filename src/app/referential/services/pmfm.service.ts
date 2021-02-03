import {Injectable} from "@angular/core";
import {FetchPolicy, gql, WatchQueryFetchPolicy} from "@apollo/client/core";
import {ErrorCodes} from "./errors";
import {AccountService} from "../../core/services/account.service";
import {GraphqlService} from "../../core/graphql/graphql.service";
import {environment} from "../../../environments/environment";
import {ReferentialFilter, ReferentialService} from "./referential.service";
import {Pmfm} from "./model/pmfm.model";
import {Observable, of} from "rxjs";
import {ReferentialFragments} from "./referential.fragments";
import {map} from "rxjs/operators";
import {ReferentialUtils, SAVE_AS_OBJECT_OPTIONS} from "../../core/services/model/referential.model";
import {SortDirection} from "@angular/material/sort";
import {BaseEntityService} from "../../core/services/base.data-service.class";
import {
  EntityServiceLoadOptions,
  IEntitiesService,
  IEntityService,
  LoadResult,
  SuggestService
} from "../../shared/services/entity-service.class";
import {isNil, isNotNil} from "../../shared/functions";
import {StatusIds} from "../../core/services/model/model.enum";
import {EntityUtils} from "../../core/services/model/entity.model";
import {ReferentialRefService} from "./referential-ref.service";
import {ObjectMap} from "../../shared/types";

const LoadAllQuery: any = gql`
  query Pmfms($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: ReferentialFilterVOInput){
    pmfms(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...LightPmfmFragment
    }
  }
  ${ReferentialFragments.lightPmfm}
`;
const LoadAllWithDetailsQuery: any = gql`
  query PmfmsWithDetails($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: ReferentialFilterVOInput){
    data: pmfms(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...PmfmFragment
    }
    total: referentialsCount(entityName: "Pmfm", filter: $filter)
  }
  ${ReferentialFragments.pmfm}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.fullReferential}
  ${ReferentialFragments.parameter}
`;
const LoadAllWithTotalQuery: any = gql`
  query PmfmsWithTotal($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: ReferentialFilterVOInput){
    data: pmfms(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      ...LightPmfmFragment
    }
    total: referentialsCount(entityName: "Pmfm", filter: $filter)
  }
  ${ReferentialFragments.lightPmfm}
`;
const LoadAllIdsQuery: any = gql`
  query PmfmIds($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: ReferentialFilterVOInput){
    data: referentials(entityName: "Pmfm", filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      id
    }
  }
`;
const LoadQuery: any = gql`
  query Pmfm($label: String, $id: Int){
    pmfm(label: $label, id: $id){
      ...PmfmFragment
    }
  }
  ${ReferentialFragments.pmfm}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.fullReferential}
  ${ReferentialFragments.parameter}
`;

const SaveQuery: any = gql`
  mutation SavePmfm($pmfm:PmfmVOInput){
    savePmfm(pmfm: $pmfm){
      ...PmfmFragment
    }
  }
  ${ReferentialFragments.pmfm}
  ${ReferentialFragments.referential}
  ${ReferentialFragments.fullReferential}
  ${ReferentialFragments.parameter}
`;

export class PmfmFilter extends ReferentialFilter {
  entityName?: 'Pmfm';
}

// TODO BLA: étendre la class BaseReferentialService
@Injectable({providedIn: 'root'})
export class PmfmService extends BaseEntityService implements IEntityService<Pmfm>,
  IEntitiesService<Pmfm, PmfmFilter>,
  SuggestService<Pmfm, PmfmFilter>
{

  constructor(
    protected graphql: GraphqlService,
    protected accountService: AccountService,
    protected referentialService: ReferentialService,
    protected referentialRefService: ReferentialRefService
  ) {
    super(graphql, environment);
  }

  async existsByLabel(label: string, opts?: { excludedId?: number; }): Promise<boolean> {
    if (isNil(label)) return false;
    return await this.referentialService.existsByLabel(label, { ...opts, entityName: 'Pmfm' });
  }

  async load(id: number, options?: EntityServiceLoadOptions): Promise<Pmfm> {

    if (this._debug) console.debug(`[pmfm-service] Loading pmfm {${id}}...`);

    const res = await this.graphql.query<{ pmfm: any }>({
      query: LoadQuery,
      variables: {
        id: id
      },
      error: {code: ErrorCodes.LOAD_REFERENTIAL_ERROR, message: "REFERENTIAL.ERROR.LOAD_REFERENTIAL_ERROR"}
    });
    const entity = res && res.pmfm && Pmfm.fromObject(res.pmfm);

    if (this._debug) console.debug(`[pmfm-service] Pmfm {${id}} loaded`, entity);

    return entity;
  }

  /**
   * Save a pmfm entity
   * @param entity
   */
  async save(entity: Pmfm, options?: EntityServiceLoadOptions): Promise<Pmfm> {

    this.fillDefaultProperties(entity);

    // Transform into json
    const json = entity.asObject(SAVE_AS_OBJECT_OPTIONS);

    const now = Date.now();
    if (this._debug) console.debug(`[pmfm-service] Saving Pmfm...`, json);

    await this.graphql.mutate<{ savePmfm: any }>({
      mutation: SaveQuery,
      variables: {
        pmfm: json
      },
      error: { code: ErrorCodes.SAVE_REFERENTIAL_ERROR, message: "REFERENTIAL.ERROR.SAVE_REFERENTIAL_ERROR" },
      update: (proxy, {data}) => {
        // Update entity
        const savedEntity = data && data.savePmfm;
        if (savedEntity) {
          if (this._debug) console.debug(`[pmfm-service] Pmfm saved in ${Date.now() - now}ms`, entity);
          this.copyIdAndUpdateDate(savedEntity, entity);
        }
      }
    });

    return entity;
  }

  /**
   * Delete pmfm entities
   */
  async delete(entity: Pmfm, options?: any): Promise<any> {

    entity.entityName = 'Pmfm';

    await this.referentialService.deleteAll([entity]);
  }

  listenChanges(id: number, options?: any): Observable<Pmfm | undefined> {
    // TODO
    console.warn("TODO: implement listen changes on pmfm");
    return of();
  }

  watchAll(
    offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filter?: PmfmFilter,
    opts?: {
      fetchPolicy?: WatchQueryFetchPolicy;
      withTotal?: boolean;
    }
  ): Observable<LoadResult<Pmfm>> {
    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'label',
      sortDirection: sortDirection || 'asc',
      filter: PmfmFilter.asPodObject(filter)
    };
    const now = Date.now();
    if (this._debug) console.debug("[pmfm-service] Watching pmfms using options:", variables);

    const query = (!opts || opts.withTotal !== false) ? LoadAllWithTotalQuery : LoadAllQuery;
    return this.graphql.watchQuery<LoadResult<any>>({
      query,
      variables,
      error: {code: ErrorCodes.LOAD_REFERENTIAL_ERROR, message: "REFERENTIAL.ERROR.LOAD_REFERENTIAL_ERROR"},
      fetchPolicy: opts && opts.fetchPolicy || undefined
    })
      .pipe(
        map(({data, total}) => {
            const entities = (data || []).map(Pmfm.fromObject);
            if (this._debug) console.debug(`[pmfm-service] Pmfms loaded in ${Date.now() - now}ms`, entities);
            return {
              data: entities,
              total
            };
          }
        )
      );
  }

  /**
   * Load pmfms
   * @param offset
   * @param size
   * @param sortBy
   * @param sortDirection
   * @param filter
   */
  async loadAll(offset: number,
                size: number,
                sortBy?: string,
                sortDirection?: SortDirection,
                filter?: PmfmFilter,
                opts?: {
                  query?: any,
                  fetchPolicy?: FetchPolicy;
                  withTotal?: boolean;
                  withDetails?: boolean;
                  toEntity?: boolean;
                  debug?: boolean;
                }): Promise<LoadResult<Pmfm>> {
    opts = opts || {};
    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'label',
      sortDirection: sortDirection || 'asc',
      filter: PmfmFilter.asPodObject(filter)
    };
    const debug = this._debug && (opts.debug !== false);
    const now = debug && Date.now();
    if (debug) console.debug("[pmfm-service] Loading pmfms... using options:", variables);

    const query = opts.query ? opts.query : (
      opts.withDetails ? LoadAllWithDetailsQuery : (
        opts.withTotal ? LoadAllWithTotalQuery : LoadAllQuery
      )
    );
    const {data, total} = await this.graphql.query<LoadResult<any>>({
      query,
      variables,
      error: {code: ErrorCodes.LOAD_REFERENTIAL_ERROR, message: "REFERENTIAL.ERROR.LOAD_REFERENTIAL_ERROR"},
      fetchPolicy: opts && opts.fetchPolicy || undefined
    });

    const entities = (!opts || opts.toEntity !== false) ?
      (data || []).map(Pmfm.fromObject) :
      (data || []) as Pmfm[];
    if (debug) console.debug(`[pmfm-service] Pmfms loaded in ${Date.now() - now}ms`);
    return {
      data: entities,
      total
    };

  }

  async saveAll(data: Pmfm[], options?: any): Promise<Pmfm[]> {
    if (!data) return data;
    return await Promise.all(data.map((pmfm) => this.save(pmfm, options)));
  }

  deleteAll(data: Pmfm[], options?: any): Promise<any> {
    throw new Error("Not implemented yet");
  }

  async suggest(value: any, filter?: PmfmFilter): Promise<Pmfm[]> {
    if (ReferentialUtils.isNotEmpty(value)) return [value];
    value = (typeof value === "string" && value !== '*') && value || undefined;
    const res = await this.loadAll(0, !value ? 30 : 10, null, null,
      { ...filter, searchText: value},
      { withTotal: false /* total not need */ }
    );
    return res.data;
  }

  /**
   * Get referential references, group by level labels
   * @param data
   */
  async loadIdsGroupByParameterLabels(parameterLabelsMap: ObjectMap<string[]>): Promise<ObjectMap<number[]>> {

    // TODO BLA: voir si a besoin d'un cache ici
    const pmfmMap = await this.referentialRefService.loadAllGroupByLevels({
        entityName: 'Pmfm',
        statusIds: [StatusIds.ENABLE, StatusIds.TEMPORARY]
      },
      { levelLabels: parameterLabelsMap },
      { toEntity: false });

    // Keep only Pmfm.id
    return Object.keys(parameterLabelsMap).reduce((res, key) => {
      res[key] = pmfmMap[key].map(e => e.id);
      return res;
    }, {});
  }

  /* -- protected methods -- */

  protected fillDefaultProperties(entity: Pmfm) {
    entity.statusId = isNotNil(entity.statusId) ? entity.statusId : StatusIds.ENABLE;
  }

  protected copyIdAndUpdateDate(source: Pmfm, target: Pmfm) {
    EntityUtils.copyIdAndUpdateDate(source, target);

    // Update Qualitative values
    if (source.qualitativeValues && target.qualitativeValues) {
      target.qualitativeValues.forEach(entity => {
        const savedQualitativeValue = source.qualitativeValues.find(json => entity.equals(json));
        EntityUtils.copyIdAndUpdateDate(savedQualitativeValue, entity);
      });
    }

  }
}
