import {Observable} from "rxjs";
import {Apollo} from "apollo-angular";
import {ApolloQueryResult, FetchPolicy} from "apollo-client";
import {R} from "apollo-angular/types";
import {ErrorCodes, ServerErrorCodes, ServiceError} from "./errors";
import {map} from "rxjs/operators";

import {environment} from '../../../environments/environment';

export abstract class BaseDataService {

  protected _debug = false;
  protected _lastVariables: any = {
    loadAll: undefined,
    load: undefined
  };

  protected constructor(
    protected apollo: Apollo
  ) {

  }

  protected query<T, V = R>(opts: {
    query: any,
    variables: V,
    error?: ServiceError,
    fetchPolicy?: FetchPolicy
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.apollo.query<ApolloQueryResult<T>, V>({
        query: opts.query,
        variables: opts.variables,
        fetchPolicy: opts.fetchPolicy || (environment.apolloFetchPolicy as FetchPolicy) || undefined
      })
        .catch(error => this.onApolloError<T>(error))
        .first()
        .subscribe(({ data, errors }) => {
          if (errors) {
            const error = errors[0] as any;
            if (error && error.code && error.message) {
              reject(error);
              return;
            }
            console.error("[data-service] " + error.message);
            reject(opts.error ? opts.error : error.message);
            return;
          }
          resolve(data as T);
        });
    });
  }

  protected watchQuery<T, V = R>(opts: {
    query: any,
    variables: V,
    error?: ServiceError,
    fetchPolicy?: FetchPolicy
  }): Observable<T> {
    return this.apollo.watchQuery<T, V>({
      query: opts.query,
      variables: opts.variables,
      fetchPolicy: opts.fetchPolicy || (environment.apolloFetchPolicy as FetchPolicy) || undefined,
      notifyOnNetworkStatusChange: true
    })
      .valueChanges
      .catch(error => this.onApolloError<T>(error))
      .pipe(
        map(({ data, errors }) => {
          if (errors) {
            const error = errors[0] as any;
            if (error && error.code && error.message) {
              throw error;
            }
            console.error("[data-service] " + error.message);
            throw opts.error ? opts.error : error.message;
          }
          return data;
        })
      );
  }

  protected mutate<T, V = R>(opts: {
    mutation: any,
    variables: V,
    error?: ServiceError
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.apollo.mutate<ApolloQueryResult<T>, V>({
        mutation: opts.mutation,
        variables: opts.variables
      })
        .catch(error => this.onApolloError<T>(error))
        .first()
        .subscribe(({ data, errors }) => {
          if (errors) {
            const error = errors[0] as any;
            if (error && error.code && error.message) {
              if (error && error.code == ServerErrorCodes.BAD_UPDATE_DATE) {
                reject({ code: ServerErrorCodes.BAD_UPDATE_DATE, message: "ERROR.BAD_UPDATE_DATE" });
              }
              else if (error && error.code == ServerErrorCodes.DATA_LOCKED) {
                reject({ code: ServerErrorCodes.DATA_LOCKED, message: "ERROR.DATA_LOCKED" });
              }
              else {
                reject(error);
              }
            }
            else {
              console.error("[data-service] " + error.message);
              reject(opts.error ? opts.error : error.message);
            }
          }
          else {
            resolve(data as T);
          }
        });
    });
  }

  protected subscribe<T, V = R>(opts: {
    query: any,
    variables: V,
    error?: ServiceError
  }): Observable<T> {

    return this.apollo.subscribe({
      query: opts.query,
      variables: opts.variables
    }, {
      useZone: true
    })
      .catch(error => this.onApolloError<T>(error))
      .pipe(
        map(({ data, errors }) => {
          if (errors) {
            let error = errors[0];
            if (error && error.code && error.message) {
              throw error;
            }
            console.error("[data-service] " + error.message);
            throw opts.error ? opts.error : error.message;
          }
          return data;
        })
      );
  }

  protected addToQueryCache<V = R>(opts: {
    query: any,
    variables: V
  }, propertyName: string, newValue: any) {

    try {
      const values = this.apollo.getClient().readQuery(opts);

      if (values && values[propertyName]) {
        values[propertyName].push(newValue);

        this.apollo.getClient().writeQuery({
          query: opts.query,
          variables: opts.variables,
          data: values
        });
        return; // OK: stop here
      }
    }

    catch(err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
    }
    if (this._debug) console.debug("[data-service] Unable to add entity to cache. Please check query has been cached, and {" + propertyName + "} exists in the result:", opts.query);
  }

  protected addManyToQueryCache<V = R>(opts: {
    query: any,
    variables: V
  }, propertyName: string, newValues: any[]) {

    if (!newValues || !newValues.length) return; // nothing to process

    try {
      const values = this.apollo.getClient().readQuery(opts);

      if (values && values[propertyName]) {
        // Keep only not existing values
        newValues = newValues.filter(nv => !values[propertyName].find(v => nv['id'] === v['id'] && nv['entityName'] === v['entityName']));

        if (!newValues.length) return; // No new value

        // Update the cache
        values[propertyName] = values[propertyName].concat(newValues);
        this.apollo.getClient().writeQuery({
          query: opts.query,
          variables: opts.variables,
          data: values
        });
        return; // OK: stop here
      }
    }

    catch(err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
    }

    if (this._debug) console.debug("[data-service] Unable to add entities to cache. Please check query has been cached, and {" + propertyName + "} exists in the result:", opts.query);
  }

  protected removeToQueryCacheById<V = R>(opts: {
    query: any,
    variables: V
  }, propertyName: string, idToRemove: number) {

    try {
      const values = this.apollo.getClient().readQuery(opts);

      if (values && values[propertyName]) {

        values[propertyName] = (values[propertyName] || []).filter(item => item['id'] !== idToRemove);
        this.apollo.getClient().writeQuery({
          query: opts.query,
          variables: opts.variables,
          data: values
        });

        return;
      }
    }
    catch(err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
    }
    console.warn("[data-service] Unable to remove id from cache. Please check {" + propertyName + "} exists in the result:", opts.query);
  }

  protected removeToQueryCacheByIds<V = R>(opts: {
    query: any,
    variables: V
  }, propertyName: string, idsToRemove: number[]) {

    try {
      const values = this.apollo.getClient().readQuery(opts);

      if (values && values[propertyName]) {

        values[propertyName] = (values[propertyName] || []).reduce((result: any[], item: any) => {
          return idsToRemove.indexOf(item['id']) === -1 ? result.concat(item) : result;
        }, []);
        this.apollo.getClient().writeQuery({
          query: opts.query,
          variables: opts.variables,
          data: values
        });

        return;
      }
    }
    catch(err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
    }
    console.warn("[data-service] Unable to remove id from cache. Please check {" + propertyName + "} exists in the result:", opts.query);
  }

  private onApolloError<T>(err: any): Observable<ApolloQueryResult<T>> {
    const appError = (err.networkError && (this.toAppError(err.networkError) || this.createAppErrorByCode(ErrorCodes.UNKNOWN_NETWORK_ERROR))) ||
      (err.graphQLErrors && this.toAppError(err.graphQLErrors[0])) ||
      this.toAppError(err) ||
      this.toAppError(err.originalError);
    return Observable.of({
      data: null,
      errors: appError && [appError] || err.graphQLErrors || [err],
      loading: false,
      networkStatus: null,
      stale: null
    });
  }

  private createAppErrorByCode(errorCode: number): any | undefined {
    const message = this.getI18nErrorMessageByCode(errorCode);
    if (message) return {
      code: errorCode,
      message: this.getI18nErrorMessageByCode(errorCode)
    };
    return undefined;
  }

  private getI18nErrorMessageByCode(errorCode: number): string | undefined{
    switch (errorCode) {
      case ServerErrorCodes.UNAUTHORIZED:
        return "ERROR.UNAUTHORIZED";
      case ServerErrorCodes.FORBIDDEN:
        return "ERROR.FORBIDDEN";
      case ErrorCodes.UNKNOWN_NETWORK_ERROR:
        return "ERROR.UNKNOWN_NETWORK_ERROR";
    }
    return undefined;
  }

  private toAppError(err: any) : any | undefined{
    const message = err && err.message || err;
    if (typeof message == "string" && message.trim().indexOf('{"code":') == 0) {
      const error = JSON.parse(message);
      return error && this.createAppErrorByCode(error.code) || err;
    }
    return undefined;
  }



}
