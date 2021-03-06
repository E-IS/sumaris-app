/* -- Extraction -- */

import {Entity, EntityAsObjectOptions} from "../../../core/services/model/entity.model";
import {Department} from "../../../core/services/model/department.model";
import {Person} from "../../../core/services/model/person.model";
import {Moment} from "moment";
import {isNotEmptyArray, isNotNilOrBlank} from "../../../shared/functions";

export declare type ExtractionCategoryType = 'PRODUCT' | 'LIVE';
export const ExtractionCategories = {
  PRODUCT: 'PRODUCT',
  LIVE: 'LIVE',
};

export class ExtractionType<T extends ExtractionType<any> = ExtractionType<any>> extends Entity<T> {

  static TYPENAME = 'ExtractionTypeVO';

  static equals(o1: ExtractionType, o2: ExtractionType): boolean {
    return o1 && o2 ? o1.label === o2.label && o1.category === o2.category : o1 === o2;
  }

  static fromObject(source: any): ExtractionType {
    if (!source || source instanceof ExtractionType) return source;
    const res = new ExtractionType();
    res.fromObject(source);
    return res;
  }

  category: string;
  label: string;
  name?: string;
  version?: string;
  sheetNames: string[];
  statusId: number;
  isSpatial: boolean;
  docUrl: string;
  description: string;
  comments:  string;

  recorderPerson: Person;
  recorderDepartment: Department;

  constructor() {
    super();
    this.__typename = ExtractionType.TYPENAME;
    this.recorderDepartment = null;
  }

  clone(): T {
    return this.copy(new ExtractionType() as T);
  }

  copy(target: T): T {
    target.fromObject(this);
    return target;
  }

  fromObject(source: any): ExtractionType<T> {
    super.fromObject(source);
    this.label = source.label;
    this.category = source.category;
    this.name = source.name;
    this.description = source.description;
    this.comments = source.comments;
    this.version = source.version;
    this.sheetNames = source.sheetNames;
    this.statusId = source.statusId;
    this.isSpatial = source.isSpatial;
    this.docUrl = source.docUrl;
    this.recorderPerson = source.recorderPerson && Person.fromObject(source.recorderPerson) || null;
    this.recorderDepartment = source.recorderDepartment && Department.fromObject(source.recorderDepartment);
    return this;
  }

  asObject(options?: EntityAsObjectOptions): any {
    const target = super.asObject(options);
    target.recorderPerson = this.recorderPerson && this.recorderPerson.asObject(options) || undefined;
    target.recorderDepartment = this.recorderDepartment && this.recorderDepartment.asObject(options) || undefined;
    return target;
  }

  get format(): string {
    if (!this.label) return undefined;
    const lastIndex = this.label.lastIndexOf('-');
    if (lastIndex === -1) return this.label;
    return this.label.substr(0, lastIndex);
  }
}

export class ExtractionResult {

  static fromObject(source: any): ExtractionResult {
    if (!source || source instanceof ExtractionResult) return source;
    const target = new ExtractionResult();
    target.fromObject(source);
    return target;
  }

  columns: ExtractionColumn[];
  rows: ExtractionRow[];
  total: number;

  fromObject(source: any): ExtractionResult {
    this.total = source.total;
    this.columns = source.columns && source.columns.map(ExtractionColumn.fromObject) || null;
    this.rows = source.rows && source.rows.slice() || null;
    return this;
  }
}


export class ExtractionColumn {
  static fromObject(source: any): ExtractionColumn {
    if (!source || source instanceof ExtractionColumn) return source;
    const target = new ExtractionColumn();
    target.fromObject(source);
    return target;
  }

  id: number;
  creationDate: Moment;
  index?: number;
  label: string;
  name: string;
  columnName: string;
  type: string;
  description?: String;
  rankOrder: number;
  values?: string[];

  fromObject(source: any): ExtractionColumn {
    this.id = source.id;
    this.creationDate = source.creationDate;
    this.index = source.index;
    this.label = source.label;
    this.name = source.name;
    this.columnName = source.columnName;
    this.type = source.type;
    this.description = source.description;
    this.rankOrder = source.rankOrder;
    this.values = source.values && source.values.slice();
    return this;
  }
}

export class ExtractionRow extends Array<any> {
  constructor(...items: any[]) {
    super(...items);
  }
}

export declare class ExtractionFilter {
  searchText?: string;
  criteria?: ExtractionFilterCriterion[];
  sheetName?: string;
}

export declare type CriterionOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'BETWEEN' | 'NULL' | 'NOT NULL';

export class ExtractionFilterCriterion extends Entity<ExtractionFilterCriterion> {

  static fromObject(source: any): ExtractionFilterCriterion {
    const res = new ExtractionFilterCriterion();
    res.fromObject(source);
    return res;
  }

  static isNotEmpty(criterion: ExtractionFilterCriterion): boolean {
    return criterion && (
      isNotNilOrBlank(criterion.value)
      || isNotEmptyArray(criterion.values)
      || criterion.operator === 'NULL'
      || criterion.operator === 'NOT NULL');
  }

  name?: string;
  operator: CriterionOperator;
  value?: string;
  values?: string[];
  endValue?: string;
  sheetName?: string;

  constructor() {
    super();
  }

  copy(target: ExtractionFilterCriterion): ExtractionFilterCriterion {
    target.fromObject(this);
    return target;
  }

  clone(): ExtractionFilterCriterion {
    return this.copy(new ExtractionFilterCriterion());
  }

  fromObject(source: any): ExtractionFilterCriterion {
    super.fromObject(source);
    this.name = source.name;
    this.operator = source.operator;
    this.value = source.value;
    this.endValue = source.endValue;
    this.sheetName = source.sheetName;
    return this;
  }

  asObject(options?: EntityAsObjectOptions): any {
    return super.asObject(options);
  }
}
