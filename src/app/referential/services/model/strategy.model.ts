import {
  MINIFY_OPTIONS,
  NOT_MINIFY_OPTIONS,
  Referential,
  ReferentialAsObjectOptions,
  ReferentialRef
} from "../../../core/services/model/referential.model";
import {Entity} from "../../../core/services/model/entity.model";
import {Moment} from "moment";
import {EntityAsObjectOptions} from "../../../core/services/model/entity.model";
import {TaxonGroupRef, TaxonNameRef} from "./taxon.model";
import {DenormalizedPmfmStrategy, PmfmStrategy} from "./pmfm-strategy.model";
import {fromDateISOString, toDateISOString} from "../../../shared/dates";


export class Strategy<T extends Strategy<any> = Strategy<any>> extends Referential<Strategy> {

  static TYPENAME = 'StrategyVO';

  static fromObject(source: any): Strategy {
    if (!source || source instanceof Strategy) return source;
    const res = new Strategy();
    res.fromObject(source);
    return res;
  }

  analyticReference: string;
  creationDate: Moment;
  appliedStrategies: AppliedStrategy[];
  pmfms: PmfmStrategy[];
  denormalizedPmfms: DenormalizedPmfmStrategy[];
  departments: StrategyDepartment[];

  gears: any[];
  taxonGroups: TaxonGroupStrategy[];
  taxonNames: TaxonNameStrategy[];
  programId: number;

  constructor(data?: {
    id?: number,
    label?: string,
    name?: string
  }) {
    super();
    this.__typename = Strategy.TYPENAME;
    this.id = data && data.id;
    this.label = data && data.label;
    this.name = data && data.name;
    this.appliedStrategies = [];
    this.departments = [];
    this.gears = [];
    this.taxonGroups = [];
    this.taxonNames = [];
  }

  clone(): T {
    const target = new Strategy();
    target.fromObject(this);
    return target as T;
  }

  asObject(opts?: EntityAsObjectOptions): any {
    const target: any = super.asObject(opts);
    target.programId = this.programId;
    target.creationDate = toDateISOString(this.creationDate);
    target.appliedStrategies = this.appliedStrategies && this.appliedStrategies.map(s => s.asObject({ ...opts, ...NOT_MINIFY_OPTIONS }));
    target.pmfms = this.pmfms && this.pmfms.map(s => s.asObject({ ...opts, ...NOT_MINIFY_OPTIONS }));
    target.denormalizedPmfms = this.denormalizedPmfms && this.denormalizedPmfms.map(s => s.asObject({ ...opts, ...NOT_MINIFY_OPTIONS }));
    target.departments = this.departments && this.departments.map(s => s.asObject({ ...opts, ...NOT_MINIFY_OPTIONS }));
    target.gears = this.gears && this.gears.map(s => s.asObject(opts));
    target.taxonGroups = this.taxonGroups && this.taxonGroups.map(s => s.asObject({ ...opts, ...NOT_MINIFY_OPTIONS }));
    target.taxonNames = this.taxonNames && this.taxonNames.map(s => s.asObject({ ...opts, ...NOT_MINIFY_OPTIONS }));
    return target;
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.analyticReference = source.analyticReference;
    this.programId = source.programId;
    this.appliedStrategies = source.appliedStrategies && source.appliedStrategies.map(AppliedStrategy.fromObject) || [];
    this.pmfms = source.pmfms && source.pmfms.map(PmfmStrategy.fromObject) || [];
    this.denormalizedPmfms = source.denormalizedPmfms && source.denormalizedPmfms.map(DenormalizedPmfmStrategy.fromObject) || [];
    this.departments = source.departments && source.departments.map(StrategyDepartment.fromObject) || [];
    this.gears = source.gears && source.gears.map(ReferentialRef.fromObject) || [];
    // Taxon groups, sorted by priority level
    this.taxonGroups = source.taxonGroups && source.taxonGroups.map(TaxonGroupStrategy.fromObject) || [];
    this.taxonNames = source.taxonNames && source.taxonNames.map(TaxonNameStrategy.fromObject) || [];
  }

  equals(other: T): boolean {
    return super.equals(other)
      // Or by functional attributes
      || (
        // Same label
        this.label === other.label
        // Same program
        && ((!this.programId && !other.programId) || this.programId === other.programId)
      );
  }
}

export class StrategyDepartment extends Entity<StrategyDepartment> {

  strategyId: number;
  location: ReferentialRef;
  privilege: ReferentialRef;
  department: ReferentialRef;

  static fromObject(source: any): StrategyDepartment {
    if (!source || source instanceof StrategyDepartment) return source;
    const res = new StrategyDepartment();
    res.fromObject(source);
    return res;
  }

  clone(): StrategyDepartment {
    const target = new StrategyDepartment();
    target.fromObject(this);
    return target;
  }

  asObject(opts?: ReferentialAsObjectOptions): any {
    const target: any = super.asObject(opts);
    target.location = this.location && this.location.asObject(opts) || undefined;
    target.privilege = this.privilege && this.privilege.asObject(opts);
    target.department = this.department && this.department.asObject(opts);
    return target;
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.strategyId = source.strategyId;
    this.location = source.location && ReferentialRef.fromObject(source.location);
    this.privilege = source.privilege && ReferentialRef.fromObject(source.privilege);
    this.department = source.department && ReferentialRef.fromObject(source.department);
  }

}

export class AppliedStrategy extends Entity<AppliedStrategy> {

  static TYPENAME = 'AppliedStrategyVO';

  strategyId: number;
  location: ReferentialRef;
  appliedPeriods: AppliedPeriod[];

  static fromObject(source: any): AppliedStrategy {
    if (!source || source instanceof AppliedStrategy) return source;
    const res = new AppliedStrategy();
    res.fromObject(source);
    return res;
  }

  constructor() {
    super();
    this.__typename = AppliedStrategy.TYPENAME;
  }

  clone(): AppliedStrategy {
    const target = new AppliedStrategy();
    target.fromObject(this);
    return target;
  }

  asObject(opts?: ReferentialAsObjectOptions): any {
    const target: any = super.asObject(opts);
    target.location = this.location && this.location.asObject(opts);
    target.appliedPeriods = this.appliedPeriods && this.appliedPeriods.map(p => p.asObject(opts)) || undefined;
    return target;
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.strategyId = source.strategyId;
    this.location = source.location && ReferentialRef.fromObject(source.location);
    this.appliedPeriods = source.appliedPeriods && source.appliedPeriods.map(AppliedPeriod.fromObject) || [];
  }

  equals(other: AppliedStrategy) {
    return super.equals(other)
      // Same strategyId and location
      || (this.strategyId === other.strategyId
      && ((!this.location && !other.location) || (this.location && other.location && this.location.id === other.location.id))
    );
  }

}

export class AppliedPeriod {

  static TYPENAME = 'AppliedPeriodVO';

  __typename: string;
  appliedStrategyId: number;
  startDate: Moment;
  endDate: Moment;
  acquisitionNumber: number;

  static fromObject(source: any): AppliedPeriod {
    if (!source || source instanceof AppliedPeriod) return source;
    const res = new AppliedPeriod();
    res.fromObject(source);
    return res;
  }

  constructor() {
    this.__typename = AppliedPeriod.TYPENAME;
  }

  asObject(opts?: ReferentialAsObjectOptions): any {
    const target: any = Object.assign({}, this); //= {...this};
    if (!opts || opts.keepTypename !== true) delete target.__typename;
    target.startDate = toDateISOString(this.startDate);
    target.endDate = toDateISOString(this.endDate);
    return target;
  }

  fromObject(source: any) {
    this.appliedStrategyId = source.appliedStrategyId;
    this.startDate = fromDateISOString(source.startDate);
    this.endDate = fromDateISOString(source.endDate);
    this.acquisitionNumber = source.acquisitionNumber;
  }

  clone(): AppliedPeriod {
    const target = new AppliedPeriod();
    target.fromObject(this.asObject());
    return target;
  }
}

export class TaxonGroupStrategy {

  strategyId: number;
  priorityLevel: number;
  taxonGroup: TaxonGroupRef;

  static fromObject(source: any): TaxonGroupStrategy {
    if (!source || source instanceof TaxonGroupStrategy) return source;
    const res = new TaxonGroupStrategy();
    res.fromObject(source);
    return res;
  }

  asObject(opts?: ReferentialAsObjectOptions): any {
    const target: any = Object.assign({}, this); //= {...this};
    if (!opts || opts.keepTypename !== true) delete target.__typename;
    target.taxonGroup = this.taxonGroup && this.taxonGroup.asObject({ ...opts, ...MINIFY_OPTIONS });
    return target;
  }

  fromObject(source: any) {
    this.strategyId = source.strategyId;
    this.priorityLevel = source.priorityLevel;
    this.taxonGroup = source.taxonGroup && TaxonGroupRef.fromObject(source.taxonGroup);
  }
}

export class TaxonNameStrategy {

  strategyId: number;
  priorityLevel: number;
  taxonName: TaxonNameRef;

  static fromObject(source: any): TaxonNameStrategy {
    if (!source || source instanceof TaxonNameStrategy) return source;
    const res = new TaxonNameStrategy();
    res.fromObject(source);
    return res;
  }

  asObject(opts?: ReferentialAsObjectOptions): any {
    const target: any = Object.assign({}, this); //= {...this};
    if (!opts || opts.keepTypename !== true) delete target.taxonName.__typename;
    return target;
  }

  fromObject(source: any) {
    this.strategyId = source.strategyId;
    this.priorityLevel = source.priorityLevel;
    this.taxonName = source.taxonName && TaxonNameRef.fromObject(source.taxonName);
  }

}
