import {Injectable} from "@angular/core";
import {gql} from "@apollo/client/core";
import {Observable} from "rxjs";
import {VesselFeatures} from "./model/vessel.model";
import {map} from "rxjs/operators";
import {ErrorCodes} from "../../referential/services/errors";
import {GraphqlService} from "../../core/graphql/graphql.service";
import {ReferentialFragments} from "../../referential/services/referential.fragments";
import {VesselFilter} from "./vessel-service";
import {SortDirection} from "@angular/material/sort";
import {BaseGraphqlService} from "../../core/services/base-graphql-service.class";
import {IEntitiesService, LoadResult} from "../../shared/services/entity-service.class";
import {environment} from "../../../environments/environment";

export const VesselFeaturesFragments = {
    vesselFeatures: gql`fragment VesselFeaturesFragment on VesselFeaturesVO {
        id
        startDate
        endDate
        name
        exteriorMarking
        administrativePower
        lengthOverAll
        grossTonnageGt
        grossTonnageGrt
        creationDate
        updateDate
        comments
        basePortLocation {
            ...LocationFragment
        }
        recorderDepartment {
            ...LightDepartmentFragment
        }
        recorderPerson {
            ...LightPersonFragment
        }
    }`,
};

export const LoadFeaturesQuery: any = gql`query VesselFeaturesHistory($vesselId: Int!, $offset: Int, $size: Int, $sortBy: String, $sortDirection: String){
        vesselFeaturesHistory(vesselId: $vesselId, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
            ...VesselFeaturesFragment
        }
    }
    ${VesselFeaturesFragments.vesselFeatures}
    ${ReferentialFragments.location}
    ${ReferentialFragments.lightDepartment}
    ${ReferentialFragments.lightPerson}`;

@Injectable({providedIn: 'root'})
export class VesselFeaturesService
  extends BaseGraphqlService
  implements IEntitiesService<VesselFeatures, VesselFilter> {

  constructor(
    protected graphql: GraphqlService
  ) {
    super(graphql, environment);
  }


  /**
   * Load vessel features history
   * @param offset
   * @param size
   * @param sortBy
   * @param sortDirection
   * @param filter
   */
  watchAll(offset: number,
           size: number,
           sortBy?: string,
           sortDirection?: SortDirection,
           filter?: VesselFilter): Observable<LoadResult<VesselFeatures>> {

    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'startDate',
      sortDirection: sortDirection || 'asc',
      vesselId: filter.vesselId
    };

    let now = Date.now();
    if (this._debug) console.debug("[vessel-features-history-service] Getting vessel features history using options:", variables);

    return this.mutableWatchQuery<{ vesselFeaturesHistory: any[] }>({
      queryName: 'LoadFeatures',
      query: LoadFeaturesQuery,
      arrayFieldName: 'vesselFeaturesHistory',
      insertFilterFn: (vr: VesselFeatures) => vr.vesselId === filter.vesselId,
      variables,
      error: {code: ErrorCodes.LOAD_VESSELS_ERROR, message: "VESSEL.ERROR.LOAD_VESSELS_ERROR"}
    })
      .pipe(
        map(({vesselFeaturesHistory}) => {
            const data = (vesselFeaturesHistory || []).map(VesselFeatures.fromObject);
            if (this._debug && now) {
              console.debug(`[vessel-features-history-service] Vessel features history loaded in ${Date.now() - now}ms`, data);
              now = null;
            }
            return { data };
          }
        )
      );
  }

  deleteAll(data: VesselFeatures[], options?: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  saveAll(data: VesselFeatures[], options?: any): Promise<VesselFeatures[]> {
    throw new Error("Method not implemented.");
  }

  /* -- protected methods -- */

}
