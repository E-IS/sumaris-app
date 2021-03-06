import {Component, Injector, Input, OnDestroy, OnInit} from "@angular/core";
import {BehaviorSubject, Observable, of, Subject} from "rxjs";
import {debounceTime, filter, first, map} from "rxjs/operators";
import {TableElement, ValidatorService} from "@e-is/ngx-material-table";
import {ReferentialValidatorService} from "../services/validator/referential.validator";
import {ReferentialFilter, ReferentialService} from "../services/referential.service";
import {DefaultStatusList, Referential} from "../../core/services/model/referential.model";
import {ModalController, Platform} from "@ionic/angular";
import {ActivatedRoute, Router} from "@angular/router";
import {AccountService} from '../../core/services/account.service';
import {Location} from '@angular/common';
import {AbstractControl, FormBuilder, FormGroup} from "@angular/forms";
import {TranslateService} from "@ngx-translate/core";
import {AppTable, RESERVED_END_COLUMNS, RESERVED_START_COLUMNS} from "../../core/table/table.class";
import {LocalSettingsService} from "../../core/services/local-settings.service";
import {isNil, isNotEmptyArray, isNotNil, isNotNilOrBlank, sort} from "../../shared/functions";
import {EntitiesTableDataSource} from "../../core/table/entities-table-datasource.class";
import {environment} from "../../../environments/environment";
import {firstNotNilPromise} from "../../shared/observables";


@Component({
  selector: 'app-referential-page',
  templateUrl: 'referentials.page.html',
  styleUrls: ['referentials.page.scss'],
  providers: [
    {provide: ValidatorService, useExisting: ReferentialValidatorService}
  ],
})
export class ReferentialsPage extends AppTable<Referential, ReferentialFilter> implements OnInit, OnDestroy {

  static DEFAULT_ENTITY_NAME = "Pmfm";

  private _entityName: string;

  canEdit = false;
  filterForm: FormGroup;
  $selectedEntity = new BehaviorSubject<{ id: string, label: string, level?: string, levelLabel?: string }>(undefined);
  $entities = new BehaviorSubject<{ id: string, label: string, level?: string, levelLabel?: string }[]>(undefined);
  levels: Observable<Referential[]>;
  statusList = DefaultStatusList;
  statusById: any;
  filterIsEmpty = true;

  canOpenDetail = false;
  detailsPath = {
    'Program': '/referential/programs/:id',
    'Software': '/referential/list/software/:id?label=:label',
    'Pmfm': '/referential/pmfm/:id?label=:label',
    'Parameter': '/referential/parameter/:id?label=:label'
  };

  @Input() set showLevelColumn(value: boolean) {
    this.setShowColumn('level', value);
  }

  get showLevelColumn(): boolean {
    return this.getShowColumn('level');
  }

  @Input() canSelectEntity = true;
  @Input() title = 'REFERENTIAL.LIST.TITLE';

  @Input() set entityName(value: string) {
    if (this._entityName !== value) {
      this._entityName = value;
      if (!this.loadingSubject.getValue()) {
        this.applyEntityName(value, { skipLocationChange: true });
      }

    }
  }

  get entityName(): string {
    return this._entityName;
  }

  constructor(
    protected injector: Injector,
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: Platform,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected accountService: AccountService,
    protected settings: LocalSettingsService,
    protected validatorService: ReferentialValidatorService,
    protected referentialService: ReferentialService,
    protected formBuilder: FormBuilder,
    protected translate: TranslateService
  ) {
    super(route, router, platform, location, modalCtrl, settings,
      // columns
      RESERVED_START_COLUMNS
        .concat([
          'label',
          'name',
          'level',
          'status',
          'updateDate',
          'comments'])
        .concat(RESERVED_END_COLUMNS),
      new EntitiesTableDataSource<Referential, ReferentialFilter>(Referential, referentialService, validatorService, {
        prependNewElements: false,
        suppressErrors: environment.production,
        dataServiceOptions: {
          saveOnlyDirtyRows: true
        }
      }),
      null,
      injector
    );

    this.i18nColumnPrefix = 'REFERENTIAL.';
    this.allowRowDetail = false;
    this.confirmBeforeDelete = true;

    // Allow inline edition only if admin
    this.inlineEdition = accountService.isAdmin();
    this.canEdit = accountService.isAdmin();

    this.setShowColumn('updateDate', !this.mobile); // Hide by default, if mobile

    this.filterForm = formBuilder.group({
      'entityName': [null],
      'searchText': [null],
      'levelId': [null],
      'statusId': [null]
    });

    // Fill statusById
    this.statusById = {};
    this.statusList.forEach((status) => this.statusById[status.id] = status);
    this.autoLoad = false;

    // FOR DEV ONLY
    this.debug = true;
  };

  ngOnInit() {
    super.ngOnInit();

    // Listen route parameters
    if (this.canSelectEntity) {
      this.registerSubscription(
        this.route.queryParams
          .pipe(first()) // Do not refresh after the first page load (e.g. when location query path changed)
          .subscribe(({entity, q, level, status}) => {
            if (!entity) {
              this.applyEntityName(ReferentialsPage.DEFAULT_ENTITY_NAME);
            } else {
              this.filterForm.patchValue({
                entityName: entity,
                searchText: q || null,
                levelId: isNotNil(level) ? +level : null,
                statusId: isNotNil(status) ? +status : null
              }, {emitEvent: false});
              this.applyEntityName(entity, {skipLocationChange: true});
            }
          }));
    }

    // Load entities
    this.registerSubscription(
      this.referentialService.loadTypes()
        .pipe(
          map(types => types.map(type => {
            return {
              id: type.id,
              label: this.getI18nEntityName(type.id),
              level: type.level,
              levelLabel: this.getI18nEntityName(type.level)
            };
          })),
          map(types => sort(types, 'label'))
        )
        .subscribe(types => this.$entities.next(types))
    );

    // Update filter when changes
    this.registerSubscription(
      this.filterForm.valueChanges
        .pipe(
          debounceTime(250),
          filter(() => this.filterForm.valid)
        )
        // Applying the filter
        .subscribe((json) => this.setFilter(json, {emitEvent: this.mobile}))
      );

    this.registerSubscription(
      this.onRefresh.subscribe(() => {
        this.filterIsEmpty = ReferentialFilter.isEmpty({...this.filter, entityName: null /*Ignore*/});
        this.filterForm.markAsUntouched();
        this.filterForm.markAsPristine();
        this.markForCheck();
      }));

    // Force auto Load, when entity name set, and u cannot change
    if (!this.canSelectEntity && this._entityName) {
      this.applyEntityName(this._entityName);
    }
  }

  async applyEntityName(entityName: string, opts?: { emitEvent?: boolean; skipLocationChange?: boolean }) {
    opts = {emitEvent: true, skipLocationChange: false, ...opts};
    this._entityName = entityName;

    this.canOpenDetail = false;

    // Wait end of entities loading
    if (this.canSelectEntity) {
      const entities = await firstNotNilPromise(this.$entities);

      const entity = entities.find(e => e.id === entityName);
      if (!entity) {
        throw new Error(`[referential] Entity {${entityName}} not found !`);
      }

      this.$selectedEntity.next(entity);
    }

    // Load levels
    await this.loadLevels(entityName);

    this.canOpenDetail = !!this.detailsPath[entityName];
    this.inlineEdition = !this.canOpenDetail;

    // Applying the filter (will reload if emitEvent = true)
    this.filterForm.patchValue({entityName}, {emitEvent: false});
    this.applyFilter({
      ...this.filterForm.value,
      entityName
    }, {emitEvent: opts.emitEvent});

    // Update route location
    if (opts.skipLocationChange !== true && this.canSelectEntity) {
      this.router.navigate(['.'], {
        relativeTo: this.route,
        skipLocationChange: false,
        queryParams: {
          entity: entityName
        }
      });
    }
  }

  async onEntityNameChange(entityName: string): Promise<any> {
    // No change: skip
    if (this._entityName === entityName) return;
    this.applyEntityName(entityName);
  }

  addRow(event?: any): boolean {
    // Create new row
    const result = super.addRow(event);
    if (!result) return result;

    const row = this.dataSource.getRow(-1);
    row.validator.controls['entityName'].setValue(this._entityName);
    return true;
  }

  async loadLevels(entityName: string): Promise<Referential[]> {
    const res = await this.referentialService.loadLevels(entityName, {
      fetchPolicy: 'network-only'
    });

    this.levels = of(res);

    if (this.canSelectEntity) {
      this.showLevelColumn = isNotEmptyArray(res);
    }

    return res;
  }

  getI18nEntityName(entityName: string, self?: ReferentialsPage): string {
    self = self || this;

    if (isNil(entityName)) return undefined;

    const tableName = entityName.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
    const key = `REFERENTIAL.ENTITY.${tableName}`;
    let message = self.translate.instant(key);

    if (message !== key) return message;
    // No I18n translation: continue

    // Use tableName, but replace underscore with space
    message = tableName.replace(/[_-]+/g, " ").toUpperCase() || '';
    // First letter as upper case
    if (message.length > 1) {
      return message.substring(0, 1) + message.substring(1).toLowerCase();
    }
    return message;
  }

  async openRow(id: number, row: TableElement<Referential>): Promise<boolean> {
    const path = this.detailsPath[this._entityName];

    if (isNotNilOrBlank(path)) {
      await this.router.navigateByUrl(
        path
          // Replace the id in the path
          .replace(':id', isNotNil(row.currentData.id) ? row.currentData.id.toString() : '')
          // Replace the label in the path
          .replace(':label', row.currentData.label || '')
      );
      return true;
    }

    return super.openRow(id, row);
  }

  clearControlValue(event: UIEvent, formControl: AbstractControl): boolean {
    if (event) event.stopPropagation(); // Avoid to enter input the field
    formControl.setValue(null);
    return false;
  }

  protected async openNewRowDetail(): Promise<boolean> {
    const path = this.detailsPath[this._entityName];

    if (path) {
      await this.router.navigateByUrl(path
        .replace(':id', "new")
        .replace(':label', ""));
      return true;
    }

    return super.openNewRowDetail();
  }
}

