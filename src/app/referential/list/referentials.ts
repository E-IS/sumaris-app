import { Component, OnInit, OnDestroy } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { map } from "rxjs/operators";
import { ValidatorService, TableElement } from "angular4-material-table";
import { AppTableDataSource, AppTable, AppFormUtils } from "../../core/core.module";
import { ReferentialValidatorService } from "../validator/validators";
import { ReferentialService, ReferentialFilter } from "../services/referential-service";
import { Referential, StatusIds, ReferentialRef } from "../services/model";
import { ModalController, Platform } from "@ionic/angular";
import { Router, ActivatedRoute } from "@angular/router";
import { VesselService } from '../services/vessel-service';
import { AccountService } from '../../core/services/account.service';
import { Location } from '@angular/common';
import { FormGroup, FormBuilder } from "@angular/forms";
import { TranslateService } from "@ngx-translate/core";
import { RESERVED_START_COLUMNS, RESERVED_END_COLUMNS } from "../../core/table/table.class";


const DEFAULT_ENTITY_NAME = "Location";

@Component({
  selector: 'page-referentials',
  templateUrl: 'referentials.html',
  styleUrls: ['referentials.scss'],
  providers: [
    { provide: ValidatorService, useClass: ReferentialValidatorService }
  ],
})
export class ReferentialsPage extends AppTable<Referential, ReferentialFilter> implements OnInit, OnDestroy {

  protected entityName: string;

  showLevelColumn = true;
  filterForm: FormGroup;
  entities: Observable<{ id: string, label: string, level?: string, levelLabel?: string }[]>;
  levels = new Subject<ReferentialRef[]>();
  levelsItems = this.levels.asObservable();
  statusList: any[] = [
    {
      id: StatusIds.ENABLE,
      icon: 'checkmark',
      label: 'REFERENTIAL.STATUS_ENABLE'
    },
    {
      id: StatusIds.DISABLE,
      icon: 'warning',
      label: 'REFERENTIAL.STATUS_DISABLE'
    },
    {
      id: StatusIds.TEMPORARY,
      icon: 'code-working',
      label: 'REFERENTIAL.STATUS_TEMPORARY'
    }
  ];
  statusById; any;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: Platform,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected accountService: AccountService,
    protected validatorService: ReferentialValidatorService,
    protected referentialService: ReferentialService,
    protected vesselService: VesselService,
    protected formBuilder: FormBuilder,
    protected translate: TranslateService
  ) {
    super(route, router, platform, location, modalCtrl, accountService,
      // columns
      RESERVED_START_COLUMNS
        .concat([
          'label',
          'name',
          'level',
          'status',
          'comments'])
        .concat(RESERVED_END_COLUMNS),
      new AppTableDataSource<Referential, ReferentialFilter>(Referential, referentialService, validatorService, {
        prependNewElements: false,
        serviceOptions: {
          saveOnlyDirtyRows: true
        }
      })
    );

    this.allowRowDetail = false;

    // Allow inline edition only if admin
    this.inlineEdition = accountService.hasProfile('ADMIN');

    this.i18nColumnPrefix = 'REFERENTIAL.';

    this.filterForm = formBuilder.group({
      'entityName': [''],
      'searchText': [null]
    });

    this.route.params.subscribe(res => {
      const entityName = res["entityName"];
      if (!entityName) {
        this.router.navigate([DEFAULT_ENTITY_NAME], {
          relativeTo: this.route,
          skipLocationChange: false
        });
      }
      else {
        //this.filterForm.controls['entityName'].setValue(entityName);
        this.filterForm.setValue({ entityName: entityName, searchText: res["q"] || null });
      }
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

    // Combo entities
    this.entities = this.referentialService.loadTypes()
      .first()
      .pipe(
        map((types) => types.map(type => {
          return {
            id: type.id,
            label: ('REFERENTIAL.ENTITY.' + type.id.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()),
            level: type.level,
            levelLabel: type.level && ('REFERENTIAL.ENTITY.' + type.level.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase())
          };
        }))
      );

    // Update filter when changes
    this.filterForm.valueChanges.subscribe(() => {
      this.filter = this.filterForm.value;
    });
    this.onRefresh.subscribe(() => {
      this.filterForm.markAsUntouched();
      this.filterForm.markAsPristine();
    });

    // Copy data to validator
    this.dataSource.connect().subscribe(rows => {
      rows.forEach(row => AppFormUtils.copyEntity2Form(row.currentData, row.validator));
    });

    // Only if entityName has been select:  load data
    this.filter = this.filterForm.value;
    this.entityName = this.filter.entityName;
    if (this.entityName) {
      // Load levels
      this.loadLevels(this.entityName);
      // Load items
      console.info(`[referential] Loading ${this.entityName}...`);
      this.onRefresh.emit();
    }
  }

  onEntityNameChange(entityName: string) {
    // No change: skip
    if (this.entityName === entityName) return;

    this.entityName = entityName || this.filterForm.controls['entityName'].value;

    // Load levels
    this.loadLevels(entityName);

    console.info(`[referential] Loading ${entityName}...`);
    this.onRefresh.emit();

    this.router.navigate([entityName], {
      relativeTo: this.route.parent,
      skipLocationChange: false
    });
  }

  addRow(): boolean {
    // Create new row
    const result = super.addRow();
    if (!result) return result;

    const row = this.dataSource.getRow(-1);
    row.validator.controls['entityName'].setValue(this.entityName);
    return true;
  }

  async loadLevels(entityName: string): Promise<Referential[]> {
    const res = await this.referentialService.loadLevels(entityName);
    this.levels.next(res);
    this.showLevelColumn = res && res.length > 0;
    return res
  }
}

