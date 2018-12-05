import { Injectable } from "@angular/core";
import gql from "graphql-tag";
import { Apollo } from "apollo-angular";
import { Observable, Subject } from "rxjs-compat";
import { Person, Operation, Referential, DataEntity, VesselPosition, Measurement, Sample, Batch } from "./trip.model";
import {DataService, BaseDataService, LoadResult} from "../../core/services/data-service.class";
import { map } from "rxjs/operators";
import { TripService } from "../services/trip.service";

import { ErrorCodes } from "./trip.errors";
import { AccountService } from "../../core/services/account.service";
import { Fragments, DataFragments } from "./trip.queries";
import { environment } from "src/app/core/core.module";


export declare class OperationFilter {
  tripId?: number;
}
const LoadAllQuery: any = gql`
  query Operations($filter: OperationFilterVOInput, $offset: Int, $size: Int, $sortBy: String, $sortDirection: String){
    operations(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      id
      startDateTime
      endDateTime
      fishingStartDateTime
      fishingEndDateTime
      rankOrderOnPeriod
      physicalGearId
      tripId
      comments
      hasCatch
      updateDate
      metier {
        ...ReferentialFragment
      }
      recorderDepartment {
        ...RecorderDepartmentFragment
      }
      positions {
        ...PositionFragment
      }
    }
  }
  ${Fragments.recorderDepartment}
  ${Fragments.position}
  ${Fragments.referential}
`;
const LoadQuery: any = gql`
  query Operation($id: Int) {
    operation(id: $id) {
      id
      startDateTime
      endDateTime
      fishingStartDateTime
      fishingEndDateTime
      rankOrderOnPeriod
      physicalGearId
      tripId
      comments
      hasCatch
      updateDate
      metier {
        ...ReferentialFragment
      }
      recorderDepartment {
        ...RecorderDepartmentFragment
      }
      positions {
        ...PositionFragment
      }
      measurements {
        ...MeasurementFragment
      }
      gearMeasurements {
        ...MeasurementFragment
      }
      samples {
        ...SampleFragment
      }
      batches {
        ...BatchFragment
      }
    }  
  }
  ${Fragments.recorderDepartment}
  ${Fragments.position}
  ${Fragments.measurement}
  ${Fragments.referential}
  ${DataFragments.sample}  
  ${DataFragments.batch}  
`;
const SaveOperations: any = gql`
  mutation saveOperations($operations:[OperationVOInput]){
    saveOperations(operations: $operations){
      id
      startDateTime
      endDateTime
      fishingStartDateTime
      fishingEndDateTime
      rankOrderOnPeriod      
      physicalGearId
      tripId
      comments
      hasCatch
      updateDate
      metier {
        ...ReferentialFragment
      }
      recorderDepartment {
        ...RecorderDepartmentFragment
      }
      positions {
        ...PositionFragment
      }    
      measurements {
        ...MeasurementFragment
      }
      gearMeasurements {
        ...MeasurementFragment
      }
      samples {
        ...SampleFragment
      }
      batches {
        ...BatchFragment
      }
    }
  }
  ${Fragments.recorderDepartment}
  ${Fragments.position}
  ${Fragments.measurement}
  ${Fragments.referential}
  ${DataFragments.sample} 
  ${DataFragments.batch}  
`;
const DeleteOperations: any = gql`
  mutation deleteOperations($ids:[Int]){
    deleteOperations(ids: $ids)
  }
`;

const sortByStartDateFn = (n1: Operation, n2: Operation) => { return n1.startDateTime.isSame(n2.startDateTime) ? 0 : (n1.startDateTime.isAfter(n2.startDateTime) ? 1 : -1); };

@Injectable()
export class OperationService extends BaseDataService implements DataService<Operation, OperationFilter>{

  constructor(
    protected apollo: Apollo,
    protected accountService: AccountService,
    protected tripService: TripService
  ) {
    super(apollo);

    // -- For DEV only
    //this._debug = !environment.production;
  }

  /**
   * Load many operations
   * @param offset
   * @param size
   * @param sortBy
   * @param sortDirection
   * @param filter
   */
  loadAll(offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: string,
    filter?: OperationFilter): Observable<LoadResult<Operation>> {
    const variables: any = {
      offset: offset || 0,
      size: size || 1000,
      sortBy: sortBy || 'startDateTime',
      sortDirection: sortDirection || 'asc',
      filter: filter
    };
    this._lastVariables.loadAll = variables;

    if (this._debug) console.debug("[operation-service] Loading operations... using options:", variables);
    return this.watchQuery<{ operations: Operation[]; operationsCount: number }>({
      query: LoadAllQuery,
      variables: variables,
      error: { code: ErrorCodes.LOAD_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.LOAD_OPERATIONS_ERROR" },
      fetchPolicy: 'cache-and-network'
    })
      .pipe(
        map(({operations, operationsCount}) => {
          const data = (operations || []).map(Operation.fromObject);
          if (this._debug) console.debug(`[operation-service] Loaded ${data.length} operations`);

          // Compute rankOrderOnPeriod, by tripId
          if (filter && filter.tripId) {
            let rankOrderOnPeriod = 1;
            [].concat(data).sort(sortByStartDateFn).forEach(o => o.rankOrderOnPeriod = rankOrderOnPeriod++);
          }

          return {
            data: data,
            total: operationsCount
          };
        }));
  }

  load(id: number): Observable<Operation | null> {
    if (this._debug) console.debug("[operation-service] Loading operation {" + id + "}...");

    return this.watchQuery<{ operation: Operation }>({
      query: LoadQuery,
      variables: {
        id: id
      },
      error: { code: ErrorCodes.LOAD_OPERATION_ERROR, message: "TRIP.OPERATION.ERROR.LOAD_OPERATION_ERROR" }
    })
      .pipe(
        map(data => {
          if (data && data.operation) {
            const res = Operation.fromObject(data.operation);
            if (this._debug) console.debug("[operation-service] Operation {" + id + "} loaded", res);
            return res;
          }
          return null;
        })
      );
  }

  /**
   * Save many operations
   * @param data
   */
  async saveAll(entities: Operation[], options?: any): Promise<Operation[]> {
    if (!entities) return entities;

    if (!options || !options.tripId) {
      console.error("[operation-service] Missing options.tripId");
      throw { code: ErrorCodes.SAVE_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.SAVE_OPERATIONS_ERROR" };
    }

    // Compute rankOrderOnPeriod
    let rankOrderOnPeriod = 1;
    entities.sort(sortByStartDateFn).forEach(o => o.rankOrderOnPeriod = rankOrderOnPeriod++);

    const json = entities.map(t => {
      // Fill default properties (as recorder department and person)
      this.fillDefaultProperties(t, options);
      return t.asObject(true/*minify*/);
    });

    const now = new Date();
    if (this._debug) console.debug("[operation-service] Saving operations...", json);

    const res = await this.mutate<{ saveOperations: Operation[] }>({
      mutation: SaveOperations,
      variables: {
        operations: json
      },
      error: { code: ErrorCodes.SAVE_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.SAVE_OPERATIONS_ERROR" }
    });

    // Copy id and update date
    (res && res.saveOperations && entities || [])
      .forEach(entity => {
        const savedOperation = res.saveOperations.find(res => entity.equals(res));
        this.copyIdAndUpdateDate(savedOperation, entity);
      });

    if (this._debug) console.debug("[operation-service] Operations saved and updated in " + (new Date().getTime() - now.getTime()) + "ms", entities);

    return entities;
  }

  /**
     * Save an operation
     * @param data
     */
  async save(entity: Operation): Promise<Operation> {


    // Fill default properties (as recorder department and person)
    this.fillDefaultProperties(entity, {});

    // Transform into json
    const json = entity.asObject(true/*minify*/);
    const isNew = !entity.id && entity.id !== 0;

    const now = new Date();
    if (this._debug) console.debug("[operation-service] Saving operation...", json);

    const res = await this.mutate<{ saveOperations: Operation[] }>({
      mutation: SaveOperations,
      variables: {
        operations: [json]
      },
      error: { code: ErrorCodes.SAVE_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.SAVE_OPERATION_ERROR" }
    });

    const savedOperation = res && res.saveOperations && res.saveOperations[0];
    if (savedOperation) {
      // Copy id and update Date
      this.copyIdAndUpdateDate(savedOperation, entity);

      // Update the cache
      if (isNew && this._lastVariables.loadAll) {
        this.addToQueryCache({
          query: LoadAllQuery,
          variables: this._lastVariables.loadAll
        }, 'operations', entity.asObject());
      }
    }

    if (this._debug) console.debug("[operation-service] Operation saved and updated in " + (new Date().getTime() - now.getTime()) + "ms", entity);

    return entity;
  }

  /**
   * Save many operations
   * @param entities
   */
  async deleteAll(entities: Operation[]): Promise<any> {

    let ids = entities && entities
      .map(t => t.id)
      .filter(id => (id > 0));

    const now = new Date();
    if (this._debug) console.debug("[operation-service] Deleting operations... ids:", ids);

    await this.mutate<any>({
      mutation: DeleteOperations,
      variables: {
        ids: ids
      }
    });

    // Remove from cache
    if (this._lastVariables.loadAll) {
      this.removeToQueryCacheByIds({
        query: LoadAllQuery,
        variables: this._lastVariables.loadAll
      }, 'operations', ids);
    }

    if (this._debug) console.debug("[operation-service] Operation deleted in " + (new Date().getTime() - now.getTime()) + "ms");
  }

  /* -- protected methods -- */

  protected fillDefaultProperties(entity: Operation, options?: any) {

    // Fill Recorder department
    this.fillRecorderPartment(entity);
    this.fillRecorderPartment(entity.startPosition)
    this.fillRecorderPartment(entity.endPosition)
    entity.measurements && entity.measurements.forEach(m => this.fillRecorderPartment(m));

    // Fill position date s
    entity.startPosition.dateTime = entity.fishingStartDateTime || entity.startDateTime;
    entity.endPosition.dateTime = entity.fishingEndDateTime || entity.endDateTime;

    // Fill trip ID
    if (!entity.tripId && options) {
      entity.tripId = options.tripId;
    }
  }

  fillRecorderPartment(entity: DataEntity<Operation | VesselPosition | Measurement>) {
    if (!entity.recorderDepartment || !entity.recorderDepartment.id) {

      const person: Person = this.accountService.account;

      // Recorder department
      if (person && person.department) {
        entity.recorderDepartment.id = person.department.id;
      }
    }
  }

  copyIdAndUpdateDate(source: Operation | undefined | any, target: Operation) {
    if (!source) return;

    // Update (id and updateDate)
    target.id = source.id || target.id;
    target.updateDate = source.updateDate || target.updateDate;
    target.dirty = false;

    // Update positions (id and updateDate)
    if (source.positions && source.positions.length > 0) {
      [target.startPosition, target.endPosition].forEach(targetPos => {
        let savedPos = source.positions.find(srcPos => targetPos.equals(srcPos));
        if (savedPos) {
          targetPos.id = savedPos.id || targetPos.id;
          targetPos.updateDate = savedPos.updateDate || targetPos.updateDate;
          targetPos.dirty = false;
        }
      });
    }

    // Update measurements
    if (target.measurements && source.measurements) {
      target.measurements.forEach(targetMeas => {
        const sourceMeas = source.measurements.find(json => targetMeas.equals(json));
        targetMeas.id = sourceMeas && sourceMeas.id || targetMeas.id;
        targetMeas.updateDate = sourceMeas && sourceMeas.updateDate || targetMeas.updateDate;
        targetMeas.dirty = false;
      });
    }

    // Update samples (recursively)
    if (target.samples && source.samples) {
      this.copyIdAndUpdateDateOnSamples(source.samples, target.samples);
    }

    // Update batches (recursively)
    if (target.catchBatch && source.batches) {
      this.copyIdAndUpdateDateOnBatch(source.batches, [target.catchBatch]);
    }
  }

  /**
   * Copy Id and update, in sample tree (recursively)
   * @param sources
   * @param targets
   */
  copyIdAndUpdateDateOnSamples(sources: (Sample | any)[], targets: Sample[]) {
    // Update samples
    if (sources && targets) {
      targets.forEach(target => {
        const source = sources.find(json => target.equals(json));
        target.id = source && source.id || target.id;
        target.updateDate = source && source.updateDate || target.updateDate;
        target.dirty = false;

        // Apply to children
        if (target.children) {
          this.copyIdAndUpdateDateOnSamples(sources, target.children);
        }
      });
    }
  }

  /**
   * Copy Id and update, in batch tree (recursively)
   * @param sources
   * @param targets
   */
  copyIdAndUpdateDateOnBatch(sources: (Batch | any)[], targets: Batch[]) {
    if (sources && targets) {
      targets.forEach(target => {
        const source = sources.find(json => target.equals(json));
        target.id = source && source.id || target.id;
        target.updateDate = source && source.updateDate || target.updateDate;
        target.dirty = false;

        // Apply to children
        if (target.children) {
          this.copyIdAndUpdateDateOnBatch(sources, target.children);
        }
      });
    }
  }
}
