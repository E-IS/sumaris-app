import {DataEntityAsObjectOptions} from "../../../data/services/model/data-entity.model";
import {Moment} from "moment";
import {IEntityWithMeasurement, MeasurementUtils, MeasurementValuesUtils} from "./measurement.model";
import {Landing} from "./landing.model";
import {
  NOT_MINIFY_OPTIONS,
  ReferentialAsObjectOptions,
  ReferentialRef
} from "../../../core/services/model/referential.model";
import {RootDataEntity} from "../../../data/services/model/root-data-entity.model";
import {IWithObserversEntity} from "../../../data/services/model/model.utils";
import {fromDateISOString, toDateISOString} from "../../../shared/dates";
import {Person} from "../../../core/services/model/person.model";


export class ObservedLocation extends RootDataEntity<ObservedLocation>
  implements IEntityWithMeasurement<ObservedLocation>, IWithObserversEntity<ObservedLocation> {

  static TYPENAME = 'ObservedLocationVO';

  static fromObject(source: any): ObservedLocation {
    const res = new ObservedLocation();
    res.fromObject(source);
    return res;
  }

  program: ReferentialRef;
  startDateTime: Moment;
  endDateTime: Moment;
  location: ReferentialRef;
  measurementValues: { [key: string]: any };
  observers: Person[];

  landings: Landing[];

  constructor() {
    super();
    this.__typename = ObservedLocation.TYPENAME;
    this.program = null;
    this.location = null;
    this.measurementValues = {};
    this.observers = [];
    this.landings = [];
  }

  clone(): ObservedLocation {
    const target = new ObservedLocation();
    target.fromObject(this.asObject());
    return target;
  }

  copy(target: ObservedLocation) {
    target.fromObject(this);
  }

  asObject(options?: DataEntityAsObjectOptions): any {
    const target = super.asObject(options);
    target.startDateTime = toDateISOString(this.startDateTime);
    target.endDateTime = toDateISOString(this.endDateTime);
    target.location = this.location && this.location.asObject({ ...options, ...NOT_MINIFY_OPTIONS /*keep for list*/ } as ReferentialAsObjectOptions) || undefined;
    target.measurementValues = MeasurementValuesUtils.asObject(this.measurementValues, options);
    target.landings = this.landings && this.landings.map(s => s.asObject(options)) || undefined;
    target.observers = this.observers && this.observers.map(o => o.asObject({ ...options, ...NOT_MINIFY_OPTIONS /*keep for list*/ } as ReferentialAsObjectOptions)) || undefined;

    return target;
  }

  fromObject(source: any): ObservedLocation {
    super.fromObject(source);
    this.startDateTime = fromDateISOString(source.startDateTime);
    this.endDateTime = fromDateISOString(source.endDateTime);
    this.location = source.location && ReferentialRef.fromObject(source.location);

    this.measurementValues = source.measurementValues && {...source.measurementValues} || MeasurementUtils.toMeasurementValues(source.measurements);
    this.observers = source.observers && source.observers.map(Person.fromObject) || [];
    this.landings = source.landings && source.landings.map(Landing.fromObject) || [];

    return this;
  }

  equals(other: ObservedLocation): boolean {
    return super.equals(other)
      || (
        // Same location
        (this.location && other.location && this.location.id === other.location.id)
        // Same start date/time
        && (this.startDateTime === other.startDateTime)
        // Same recorder person
        && (this.recorderPerson && other.recorderPerson && this.recorderPerson.id === other.recorderPerson.id)
      );
  }
}
