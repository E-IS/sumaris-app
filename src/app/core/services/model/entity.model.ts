import {Moment} from "moment";
import {isEmptyArray, isNil, isNilOrBlank, isNotNil, joinPropertiesPath,} from "../../../shared/functions";
import {FilterFn} from "../../../shared/services/entity-service.class";
import {ObjectMap, ObjectMapEntry, PropertiesArray, PropertiesMap} from "../../../shared/types";
import {StoreObject} from "@apollo/client/core";
import {DataEntity} from "../../../data/services/model/data-entity.model";
import {fromDateISOString, toDateISOString} from "../../../shared/dates";


export declare interface Cloneable<T> {
  clone(): T;
}

export function entityToString(obj: Entity<any> | any, properties?: string[]): string | undefined {
  return obj && obj.id && joinPropertiesPath(obj, properties || ['name']) || undefined;
}

export interface EntityAsObjectOptions {
  minify?: boolean;
  keepTypename?: boolean; // true by default
  keepLocalId?: boolean; // true by default
}

export interface IEntity<T, O extends EntityAsObjectOptions = EntityAsObjectOptions, ID = number>
  extends Cloneable<T> {
  id: ID;
  updateDate: Moment;
  __typename: string;
  equals(other: T): boolean;
  clone(): T;
  asObject(opts?: O): any;
  fromObject(source: any);
}

export declare interface ITreeItemEntity<T extends IEntity<T>> {
  parentId: number;
  parent: T;
  children: T[];
}


export abstract class Entity<T extends IEntity<any, O, ID>, O extends EntityAsObjectOptions = EntityAsObjectOptions, ID = number>
  implements IEntity<T, O, ID> {

  id: ID;
  updateDate: Moment;
  __typename: string;

  abstract clone(): T;

  asObject(opts?: O): StoreObject {
    const target: any = Object.assign({}, this); //= {...this};
    if (!opts || opts.keepTypename !== true) delete target.__typename;
    if (opts && opts.keepLocalId === false && target.id < 0) delete target.id;
    target.updateDate = toDateISOString(this.updateDate);
    return target;
  }

  fromObject(source: any) {
    this.id = (source.id || source.id === 0) ? source.id : undefined;
    this.updateDate = fromDateISOString(source.updateDate);
    this.__typename = source.__typename || this.__typename; // Keep original type (can be set in constructor)
  }

  equals(other: T): boolean {
    return other && this.id === other.id;
  }



}

// @dynamic
export abstract class EntityUtils {
  // Check that the object has a NOT nil attribute (ID by default)
  static isNotEmpty<T extends IEntity<any> | any>(obj: any | T, checkedAttribute: keyof T): boolean {
    return !!obj && obj[checkedAttribute] !== null && obj[checkedAttribute] !== undefined;
  }

  // Check that the object has a NOT nil attribute (ID by default)
  static isNotEmptyEntity<T extends IEntity<any>>(obj: any | T, checkedAttribute: keyof T): obj is T {
    return !!obj && obj[checkedAttribute] !== null && obj[checkedAttribute] !== undefined;
  }

  static isEmpty(obj: any | IEntity<any>, checkedAttribute: string): boolean {
    return !obj || obj[checkedAttribute] === null || obj[checkedAttribute] === undefined;
  }

  static equals<T extends IEntity<any>|any>(o1: T, o2: T, checkAttribute?: keyof T): boolean {
    return (o1 === o2) || (isNil(o1) && isNil(o2))  || (o1 && o2 && o1[checkAttribute] === o2[checkAttribute]);
  }

  static getPropertyByPath(obj: any | IEntity<any>, path: string): any {
    if (isNil(obj)) return undefined;
    const i = path.indexOf('.');
    if (i === -1) {
      return obj[path];
    }
    const key = path.substring(0, i);
    if (isNil(obj[key])) return undefined;
    if (obj[key] && typeof obj[key] === "object") {
      return EntityUtils.getPropertyByPath(obj[key], path.substring(i + 1));
    }
    throw new Error(`Invalid form path: '${key}' is not an valid object.`);
  }

  static getArrayAsMap<T = any>(source?: ObjectMapEntry<T>[]): ObjectMap<T> {
    return (source || []).reduce((res, item) => {
      res[item.key] = item.value;
      return res;
    }, {});
  }

  static getMapAsArray<T = any>(source?: ObjectMap<T>): ObjectMapEntry<T>[] {
    if (source instanceof Array) return source;
    return Object.getOwnPropertyNames(source || {})
      .map(key => {
        return {
          key,
          value: source[key]
        };
      });
  }

  static getPropertyArrayAsObject(source?: PropertiesArray): PropertiesMap {
    return (source || []).reduce((res, item) => {
      res[item.key] = item.value;
      return res;
    }, {});
  }

  static copyIdAndUpdateDate(source: IEntity<any> | undefined, target: IEntity<any>) {
    if (!source) return;

    // Update (id and updateDate)
    target.id = isNotNil(source.id) ? source.id : target.id;
    target.updateDate = fromDateISOString(source.updateDate) || target.updateDate;

    // Update creation Date, if exists
    if (source['creationDate']) {
      target['creationDate'] = fromDateISOString(source['creationDate']);
    }
  }

  static copyControlDate(source: DataEntity<any> | undefined, target: DataEntity<any>) {
    if (!source) return;

    // Update (id and updateDate)
    target.controlDate = fromDateISOString(source.controlDate);
  }

  static copyQualificationDateAndFlag(source: DataEntity<any> | undefined, target: DataEntity<any>) {
    if (!source) return;

    // Update (id and updateDate)
    target.qualificationDate = fromDateISOString(source.qualificationDate); // can be null
    target.qualificationComments = source.qualificationComments; // can be null
    target.qualityFlagId = source.qualityFlagId; // can be = 0 (default)
  }

  static async fillLocalIds<T extends IEntity<T>>(items: T[], sequenceFactory: (firstEntity: T, incrementSize: number) => Promise<number>) {
    const newItems = (items || []).filter(item => isNil(item.id) || item.id === 0);
    if (isEmptyArray(newItems)) return;
    // Get the sequence
    let currentId = await sequenceFactory(newItems[0], newItems.length) + 1;
    // Take the min (sequence, id), in case the sequence is corrupted
    currentId = items.filter(item => isNotNil(item.id) && item.id < 0).reduce((res, item) => Math.min(res, item.id), currentId);
    newItems.forEach(item => item.id = --currentId);
  }

  static cleanIdAndUpdateDate<T extends IEntity<T>>(source: T) {
    if (!source) return; // Skip
    source.id = null;
    source.updateDate = null;
  }

  static cleanIdsAndUpdateDates<T extends IEntity<T>>(items: T[]) {
    (items || []).forEach(EntityUtils.cleanIdAndUpdateDate);
  }

  static sort<T extends IEntity<T> | any>(data: T[], sortBy?: string, sortDirection?: string): T[] {
    return data.sort(this.sortComparator(sortBy, sortDirection));
  }

  static sortComparator<T extends IEntity<T> | any>(sortBy?: string, sortDirection?: string): (a: T, b: T) => number {
    const after = (!sortDirection || sortDirection === 'asc') ? 1 : -1;
    const isSimplePath = !sortBy || sortBy.indexOf('.') === -1;
    if (isSimplePath) {
      return (a, b) => {
        const valueA = isNotNil(a) ? a[sortBy] : undefined;
        const valueB = isNotNil(b) ? b[sortBy] : undefined;
        return EntityUtils.compare(valueA, valueB, after);
      };
    }
    else {
      return (a, b) => {
        const valueA = EntityUtils.getPropertyByPath(a, sortBy);
        const valueB = EntityUtils.getPropertyByPath(b, sortBy);
        return EntityUtils.compare(valueA, valueB, after);
      };
    }
  }

  static compare<T extends IEntity<any>>(value1: T, value2: T, direction: 1 | -1, checkAttribute?: keyof T): number {
    checkAttribute = checkAttribute || 'id';
    if (EntityUtils.isNotEmptyEntity(value1, checkAttribute) && EntityUtils.isNotEmptyEntity(value2, checkAttribute)) {
      return EntityUtils.equals(value1, value2, checkAttribute) ? 0 : (value1[checkAttribute] > value2[checkAttribute] ? direction : (-1 * direction));
    }
    return value1 === value2 ? 0 : (value1 > value2 ? direction : (-1 * direction));
  }

  static filter<T extends IEntity<T> | any>(data: T[],
                                           searchAttribute: string,
                                           searchText: string): T[] {
    const filterFn = this.searchTextFilter(searchAttribute, searchText);
    return data.filter(filterFn);
  }

  static searchTextFilter<T extends IEntity<T> | any>(searchAttribute: string | string[],
                                                     searchText: string): FilterFn<T> {
    if (isNilOrBlank(searchAttribute) || isNilOrBlank(searchText)) return undefined; // filter not need

    const searchRegexp = searchText.replace(/[.]/g, '[.]').replace(/[*]+/g, '.*');
    if (searchRegexp === '.*') return undefined; // filter not need

    const flags = 'gi';
    const asPrefixPattern = '^' + searchRegexp;
    const anyMatchPattern = '^.*' + searchRegexp;

    // Only one search attributes
    if (typeof searchAttribute === 'string') {
      const isSimplePath = !searchAttribute || searchAttribute.indexOf('.') === -1;
      const searchAsPrefix =  searchAttribute.toLowerCase().endsWith('label') || searchAttribute.toLowerCase().endsWith('code');
      const regexp = new RegExp(searchAsPrefix && asPrefixPattern || anyMatchPattern, flags);
      if (isSimplePath) {
        return a => regexp.test( a[searchAttribute]);
      }
      else {
        return a => regexp.test(EntityUtils.getPropertyByPath(a, searchAttribute));
      }
    }

    // many search attributes
    else {
      const regexps = searchAttribute.map(path => {
        const searchAsPrefix =  path.toLowerCase().endsWith('label') || path.toLowerCase().endsWith('code');
        return new RegExp( searchAsPrefix && asPrefixPattern || anyMatchPattern, flags);
      });
      return a => !!searchAttribute.find((path, index) => regexps[index].test(EntityUtils.getPropertyByPath(a, path)));
    }
  }

  /**
   * Transform a batch entity tree into a array list. This method keep links parent/children.
   *
   * Method used to find batch without id (e.g. before local storage)
   * @param source
   */
  static treeToArray<T extends ITreeItemEntity<any>>(source: T): T[] {
    if (!source) return null;
    return (source.children || []).reduce((res, batch) => {
      batch.parent = source;
      return res.concat(this.treeToArray(batch)); // recursive call
    }, [source]);
  }

  static listOfTreeToArray<T extends ITreeItemEntity<any>>(sources: T[]): T[] {
    if (!sources || !sources.length) return null;
    return sources.reduce((res, source) => res.concat(this.treeToArray<T>(source)), []);
  }

  /**
   * Fill parent attribute, of all children found in the tree
   *
   * @param source
   */
  static treeFillParent<T extends ITreeItemEntity<any>>(source: T): T[] {
    if (!source) return null;
    (source.children || []).forEach(child => {
      child.parent = source;
      this.treeFillParent(child); // Loop
    });
  }

  static isLocal(entity: IEntity<any>): boolean {
    return entity && (isNotNil(entity.id) && entity.id < 0);
  }

  static isRemote(entity: IEntity<any>): boolean {
    return entity && !EntityUtils.isLocal(entity);
  }
}

