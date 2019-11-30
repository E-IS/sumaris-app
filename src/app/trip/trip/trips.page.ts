import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, OnDestroy, OnInit} from "@angular/core";
import {TableElement, ValidatorService} from "angular4-material-table";
import {
  AppTable,
  AppTableDataSource,
  environment,
  isNil,
  personsToString,
  RESERVED_END_COLUMNS,
  RESERVED_START_COLUMNS, StatusIds
} from "../../core/core.module";
import {TripValidatorService} from "../services/trip.validator";
import {TripFilter, TripService} from "../services/trip.service";
import {LocationLevelIds, ReferentialRef, Trip} from "../services/trip.model";
import {AlertController, ModalController} from "@ionic/angular";
import {ActivatedRoute, Router} from "@angular/router";
import {Location} from '@angular/common';
import {FormBuilder, FormGroup} from "@angular/forms";
import {
  qualityFlagToColor,
  ReferentialRefService,
  referentialToString,
  vesselSnapshotToString,
  VesselService
} from "../../referential/referential.module";
import {debounceTime, filter, tap} from "rxjs/operators";
import {TranslateService} from "@ngx-translate/core";
import {SharedValidators} from "../../shared/validator/validators";
import {PlatformService} from "../../core/services/platform.service";
import {LocalSettingsService} from "../../core/services/local-settings.service";
import {AccountService} from "../../core/services/account.service";
import {NetworkService} from "../../core/services/network.service";
import {VesselSnapshotService} from "../../referential/services/vessel-snapshot.service";
import {ProgressionModel, SynchroService} from "../services/synchro-service";

@Component({
  selector: 'app-trips-page',
  templateUrl: 'trips.page.html',
  styleUrls: ['./trips.page.scss'],
  providers: [
    {provide: ValidatorService, useExisting: TripValidatorService}
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripsPage extends AppTable<Trip, TripFilter> implements OnInit, OnDestroy {

  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  filterForm: FormGroup;
  filterIsEmpty = true;

  constructor(
    protected injector: Injector,
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: PlatformService,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected settings: LocalSettingsService,
    protected accountService: AccountService,
    protected dataService: TripService,
    protected referentialRefService: ReferentialRefService,
    protected vesselSnapshotService: VesselSnapshotService,
    protected formBuilder: FormBuilder,
    protected alertCtrl: AlertController,
    protected translate: TranslateService,
    protected network: NetworkService,
    protected synchro: SynchroService,
    protected cd: ChangeDetectorRef
  ) {

    super(route, router, platform, location, modalCtrl, settings,
      RESERVED_START_COLUMNS
        .concat([
          'quality',
          'program',
          'vessel',
          'departureLocation',
          'departureDateTime',
          'returnDateTime',
          'observers',
          'comments'])
        .concat(RESERVED_END_COLUMNS),
      new AppTableDataSource<Trip, TripFilter>(Trip, dataService, null, {
        prependNewElements: false,
        suppressErrors: environment.production,
        serviceOptions: {
          saveOnlyDirtyRows: true
        }
      })
    );
    this.i18nColumnPrefix = 'TRIP.TABLE.';
    this.filterForm = formBuilder.group({
      'program': [null, SharedValidators.entity],
      'vesselSnapshot': [null, SharedValidators.entity],
      'location': [null, SharedValidators.entity],
      'startDate': [null, SharedValidators.validDate],
      'endDate': [null, SharedValidators.validDate]
    });
    this.inlineEdition = false;
    this.confirmBeforeDelete = true;
    this.autoLoad = false;

    // FOR DEV ONLY ----
    this.debug = !environment.production;
  }

  ngOnInit() {
    super.ngOnInit();

    this.isAdmin = this.accountService.isAdmin();
    this.canEdit = this.isAdmin || this.accountService.isUser();
    this.canDelete = this.isAdmin;

    // Programs combo (filter)
    this.registerAutocompleteField('program', {
      service: this.referentialRefService,
      filter: {
        entityName: 'Program'
      }
    });

    // Locations combo (filter)
    this.registerAutocompleteField('location', {
      service: this.referentialRefService,
      filter: {
        entityName: 'Location',
        levelId: LocationLevelIds.PORT
      }
    });

    // Combo: vessels
    this.registerAutocompleteField('vesselSnapshot', {
      service: this.vesselSnapshotService,
      attributes: this.settings.getFieldDisplayAttributes('vesselSnapshot', ['exteriorMarking', 'name']),
      filter: {
        statusIds: [StatusIds.ENABLE, StatusIds.TEMPORARY]
      }
    });

    // Update filter when changes
    this.filterForm.valueChanges
      .pipe(
        debounceTime(250),
        filter(() => this.filterForm.valid),
        // Applying the filter
        tap(json => this.setFilter({
            programLabel: json.program && typeof json.program === "object" && json.program.label || undefined,
            startDate: json.startDate,
            endDate: json.endDate,
            locationId: json.location && typeof json.location === "object" && json.location.id || undefined,
            vesselId:  json.vesselSnapshot && typeof json.vesselSnapshot === "object" && json.vesselSnapshot.id || undefined,
          }, {emitEvent: this.mobile || isNil(this.filter)})),
        // Save filter in settings (after a debounce time)
        debounceTime(1000),
        tap(json => this.settings.savePageSetting(this.settingsId, json, 'filter'))
      )
      .subscribe();

    this.onRefresh.subscribe(() => {
      this.filterForm.markAsUntouched();
      this.filterForm.markAsPristine();
      this.markForCheck();
    });

    // Restore filter from settings, or load all trips
    this.restoreFilterOrLoad();
  }

  setFilter(json: TripFilter, opts?: { emitEvent: boolean }) {
    super.setFilter(json, opts);

    this.filterIsEmpty = TripFilter.isEmpty(json);
  }

  async toggleOfflineMode(event?: UIEvent) {
    if (this.network.offline) {
      this.network.setConnectionType('unknown');
    }
    else {
      await this.prepareOfflineMode();
      // If no error: then disable network
      // TODO

      //this.network.setConnectionType('none');
    }


    // Refresh table
    this.onRefresh.emit();
  }

  async prepareOfflineMode() {
    if (this.network.offline) throw new Error("ERROR.UNKNOWN_NETWORK_ERROR");

    const progression = this.synchro.executeImport({maxProgression: 100});

    progression.subscribe().add(() => {
      console.info("[trips] Import finished !")
    });

    try {
      await progression.pipe(filter((p: ProgressionModel) => p.value >= 100)).toPromise();
    }
    catch(err) {
      this.error = err && err.message || err;
      console.error(this.error, err);
      return;
    }

    // Refresh table
    this.onRefresh.emit();
  }

  referentialToString = referentialToString;
  personsToString = personsToString;
  qualityFlagToColor = qualityFlagToColor;

  programToString(item: ReferentialRef) {
    return item && item.label || undefined;
  }

  /* -- protected methods -- */

  protected async restoreFilterOrLoad() {
    const json = this.settings.getPageSettings(this.settingsId, 'filter');

    // No default filter: load all trips
    if (isNil(json) || typeof json !== 'object') {
      this.onRefresh.emit();
    }
    // Restore the filter (will apply it)
    else {
      this.filterForm.patchValue(json);
    }
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}

