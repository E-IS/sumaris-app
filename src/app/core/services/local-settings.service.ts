import {Inject, Injectable, InjectionToken, Optional} from "@angular/core";
import {HistoryPageReference, LocalSettings, Peer, UsageMode} from "./model";
import {TranslateService} from "@ngx-translate/core";
import {Storage} from '@ionic/storage';

import {isNotNil, toBoolean} from "../../shared/shared.module";
import {environment} from "../../../environments/environment";
import {Subject} from "rxjs";
import {isNotNilOrBlank} from "../../shared/functions";
import {Platform} from "@ionic/angular";
import {FormFieldDefinition} from "../../shared/form/field.model";
import * as moment from "moment";
import {debounceTime, filter, throttleTime} from "rxjs/operators";
export const SETTINGS_STORAGE_KEY = "settings";
export const SETTINGS_TRANSIENT_PROPERTIES = ["mobile", "touchUi"];


export const APP_LOCAL_SETTINGS_OPTIONS = new InjectionToken<LocalSettings>('LocalSettingsOptions');

@Injectable({
  providedIn: 'root',
  deps: [APP_LOCAL_SETTINGS_OPTIONS]
})
export class LocalSettingsService {

  private _debug = false;
  private _startPromise: Promise<any>;
  private _started = false;
  private _additionalFields: FormFieldDefinition[] = [];
  private _delayedSaveSubject: Subject<any>;

  private data: LocalSettings;

  public onChange = new Subject<LocalSettings>();

  get settings(): LocalSettings {
    return this.data;
  }

  get locale(): string {
    return this.data && this.data.locale || this.translate.currentLang || this.translate.defaultLang;
  }

  get latLongFormat(): string {
    return this.data && this.data.latLongFormat || 'DDMM';
  }

  get usageMode(): UsageMode {
    return (this.data && this.data.usageMode || (this.mobile ? "FIELD" : "DESK"));
  }

  get mobile(): boolean {
    return this.data && toBoolean(this.data.mobile, this.platform.is('mobile'));
  }

  set mobile(value: boolean) {
    this.data.mobile = value;
  }

  get touchUi(): boolean {
    return this.data.touchUi;
  }

  set touchUi(value: boolean) {
    this.data.mobile = value;
  }

  get defaultPrograms(): string[] {
    return (this.data && this.data.defaultPrograms || []);
  }

  get pageHistory(): HistoryPageReference[] {
    return (this.data && this.data.pageHistory || []);
  }

  private _id: number;
  constructor(
    private translate: TranslateService,
    private platform: Platform,
    private storage: Storage,
    @Inject(APP_LOCAL_SETTINGS_OPTIONS) private defaultSettings: LocalSettings
  ) {

    this.defaultSettings = Object.assign({
      pageHistoryMaxSize: 3,
      accountInheritance: true,
      latLongFormat: environment.defaultLatLongFormat || 'DDMM'
    }, this.defaultSettings || {});

    // Register default options
    //this.registerFields(Object.getOwnPropertyNames(CoreOptions).map(key => CoreOptions[key]));

    this.resetData();

    this.start();

    // TODO for DEV only
    //this._debug = !environment.production;
  }


  async start(): Promise<LocalSettings> {
    if (this._startPromise) return this._startPromise;
    if (this._started) return;

    // Restoring local settings
    this._startPromise = this.platform.ready()
      .then(() => {
        this.data.mobile = this.platform.is('mobile');
        this.data.mobile = this.data.mobile || this.platform.is('phablet') || this.platform.is('tablet');
        this.data.usageMode = this.data.mobile ? "FIELD" : "DESK"; // FIELD by default, if mobile detected
      })
      .then(() => this.restoreLocally())
      .then(async (settings) => {
        this._started = true;
        this._startPromise = undefined;
        return settings;
      });
    return this._startPromise;
  }

  get started(): boolean {
    return this._started;
  }

  ready(): Promise<LocalSettings> {
    if (this._started) return Promise.resolve(this.data);
    return this.start();
  }

  isUsageMode(mode: UsageMode): boolean {
    return this.usageMode === mode;
  }

  isFieldUsageMode(): boolean {
    return this.usageMode === 'FIELD';
  }

  async restoreLocally(): Promise<LocalSettings | undefined> {

    // Restore from storage
    const settingsStr = await this.storage.get(SETTINGS_STORAGE_KEY);

    // Restore local settings (or keep old settings)
    if (isNotNilOrBlank(settingsStr)) {
      const restoredData = JSON.parse(settingsStr);

      // Avoid to override transient properties
      SETTINGS_TRANSIENT_PROPERTIES.forEach(transientKey => {
        delete restoredData[transientKey];
      });

      this.data = Object.assign(this.data, restoredData);
    }

    // Emit event
    this.onChange.next(this.data);

    return this.data;
  }

  getLocalSetting(key: string, defaultValue?: string): string {
    return this.data && isNotNil(this.data[key]) && this.data[key] || defaultValue;
  }

  async apply(settings: LocalSettings) {
    this.data = this.data || {};

    Object.assign(this.data, settings || {});

    // Save locally
    this.saveLocally();

    // Emit event
    this.onChange.next(this.data);
  }

  async applyProperty(key: keyof LocalSettings, value: any) {
    const changes = {};
    changes[key] = value;
    await this.apply(changes);
  }

  getPageSettings(pageId: string, propertyName?: string): string[] {
    const key = pageId.replace(/[/]/g, '__');
    return this.data && this.data.pages
      && this.data.pages[key] && (propertyName && this.data.pages[key][propertyName] || this.data.pages[key]);
  }

  async savePageSetting(pageId: string, value: any, propertyName?: string) {
    const key = pageId.replace(/[/]/g, '__');

    this.data = this.data || {};
    this.data.pages = this.data.pages || {}
    if (propertyName) {
      this.data.pages[key] = this.data.pages[key] || {};
      this.data.pages[key][propertyName] = value;
    }
    else {
      this.data.pages[key] = value;
    }

    // Update local settings
    this.saveLocally();
  }

  getFieldDisplayAttributes(fieldName: string, defaultAttributes?: string[]): string[] {
    const value = this.data && this.data.properties &&  this.data.properties[`sumaris.field.${fieldName}.attributes`];
    // Nothing found in settings: return defaults
    if (!value) return defaultAttributes || ['label','name'];

    return value.split(',');
  }

  get additionalFields(): FormFieldDefinition[] {
    return this._additionalFields;
  }

  registerAdditionalField(def: FormFieldDefinition) {
    if (this._additionalFields.findIndex(f => f.key === def.key) !== -1) {
      throw new Error(`Additional additional property {${def.key}} already define.`);
    }
    if (this._debug) console.debug(`[settings] Adding additional property {${def.key}}`, def);
    this._additionalFields.push(def);
  }

  registerAdditionalFields(defs: FormFieldDefinition[]) {
    (defs || []).forEach(def => this.registerAdditionalField(def));
  }

  async addToPageHistory(page: HistoryPageReference,
                         opts?: {removePathQueryParams?: boolean; removeTitleSmallTag?: boolean; },
                         pageHistory?: HistoryPageReference[] // used for recursive call to children
  ) {
    // If not inside recursive call: fill page history defaults
    if (!pageHistory) this.fillPageHistoryDefaults(page, opts);

    pageHistory = pageHistory || this.data.pageHistory;

    const index = pageHistory.findIndex(p => (
      // same path
      p.path === page.path
      // or sub-path
      || page.path.startsWith(p.path + '/'))
    );

    // New page: insert it
    if (index === -1) {
      //if (this._debug)
      console.debug("[settings] Adding page to history: ", page);

      // Prepend to list
      pageHistory.splice(0, 0, page);
    }

    else {
      const existingPage = pageHistory[index];

      // Same path: replace existing page
      if (pageHistory[index].path === page.path) {
        //if (this._debug)
        console.debug("[settings] Updating existing page in history: ", page);
        pageHistory.splice(index, 1);

        // Copy exiting children
        page.children = existingPage.children || [];

        // Prepend to list
        pageHistory.splice(0, 0, page);
      }

      // Not same path (should be a parent page)
      else {
        // Create parent's children array, if not exists
        existingPage.children = existingPage.children || [];

        // Update the parent time
        existingPage.time = page.time;

        // Add page as parent's children (recursive call)
        this.addToPageHistory(page, opts, existingPage.children);
      }
    }

    // Save locally (only if not a recursive execution)
    if (pageHistory === this.data.pageHistory) {

      // If max has been reached, remove old pages
      if (this.data.pageHistory.length > this.data.pageHistoryMaxSize) {
        const removedPages = pageHistory.splice(this.data.pageHistoryMaxSize, pageHistory.length - this.data.pageHistoryMaxSize);
        console.debug("[settings] Pages removed from history: ", removedPages);
      }

      // Apply new value
      this.applyProperty('pageHistory', pageHistory);
    }
  }

  async removeHistory(path: string) {
    const index = this.data.pageHistory.findIndex(p => p.path === path);
    if (index === -1) return; // skip if not found

    this.data.pageHistory.splice(index, 1);

    // Save locally
    this.saveLocally();
  }

  async clearPageHistory() {
    // Reset all page history
    await this.applyProperty('pageHistory', []);
  }

  /* -- Protected methods -- */

  private resetData() {
    this.data = this.data || {};

    this.data.locale = this.translate.currentLang || this.translate.defaultLang;
    this.data.mobile = undefined;
    this.data.usageMode = undefined;
    this.data.pageHistory = [];

    const defaultPeer = environment.defaultPeer && Peer.fromObject(environment.defaultPeer);
    this.data.peerUrl = defaultPeer && defaultPeer.url || undefined;

    Object.assign(this.data, this.defaultSettings);

    if (this._started) this.onChange.next(this.data);
  }

  private saveLocally(immediate?: boolean): Promise<any> {

    // Execute immediate
    if (immediate) {
      if (!this.data) {
        console.debug("[settings] Removing local settings from storage");
        return this.storage.remove(SETTINGS_STORAGE_KEY);
      }
      else {
        console.debug("[settings] Store local settings", this.data);
        return this.storage.set(SETTINGS_STORAGE_KEY, JSON.stringify(this.data));
      }
    }

    // Execute with delay
    else {

      // Create the save subject
      if (!this._delayedSaveSubject) {
        this._delayedSaveSubject = new Subject<any>();
        this._delayedSaveSubject
          .pipe(
            debounceTime(1000),
            filter(() => this._started)
          )
          .subscribe(() => this.saveLocally(true));
      }

      this._delayedSaveSubject.next();
    }
  }

  private fillPageHistoryDefaults(page: HistoryPageReference, opts?: {
      removePathQueryParams?: boolean;
    removeTitleSmallTag?: boolean;
  }): HistoryPageReference {
    // Set time
    page.time = page.time || moment();

    // Clean the title (remove <small> tags)
    if (!opts || opts.removeTitleSmallTag !== false) {
      page.title = page.title.replace(/<small[^<]+<\/small>/g, '');
      page.title = page.title.replace(/[ ]*class='hidden-xs hidden-sm'/g, '');
    }

    // Remove query params
    if (!opts || opts.removePathQueryParams !== false) {
      page.path = page.path.replace(/[?].*$/, '');
    }

    return page;
  }
}
