import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, Input, OnDestroy, OnInit} from "@angular/core";
import {ValidatorService} from "angular4-material-table";
import {AcquisitionLevelCodes, environment} from "../../core/core.module";
import {
  Landing,
  ObservedLocation,
  personsToString,
  referentialToString,
  Trip,
  vesselFeaturesToString
} from "../services/trip.model";
import {LandingFilter, LandingService} from "../services/landing.service";
import {LandingValidatorService} from "../services/landing.validator";
import {AppMeasurementsTable} from "../measurement/measurements.table.class";
import {measurementValueToString} from "../services/model/measurement.model";

const LANDING_RESERVED_START_COLUMNS: string[] = ['vessel', 'dateTime', 'observers'];
const LANDING_RESERVED_END_COLUMNS: string[] = ['comments'];

@Component({
  selector: 'app-landing-table',
  templateUrl: 'landings.table.html',
  providers: [
    {provide: ValidatorService, useClass: LandingValidatorService}
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingsTable extends AppMeasurementsTable<Landing, LandingFilter> implements OnInit, OnDestroy {

  protected cd: ChangeDetectorRef;

  @Input() canEdit = true;
  @Input() canDelete = true;

  @Input()
  set showObserversColumn(value: boolean) {
    this.setShowColumn('observers', value);
  }

  get showObserversColumn(): boolean {
    return this.getShowColumn('observers');
  }

  @Input()
  set showDateTimeColumn(value: boolean) {
    this.setShowColumn('dateTime', value);
  }

  get showDateTimeColumn(): boolean {
    return this.getShowColumn('dateTime');
  }

  constructor(
    injector: Injector
  ) {
    super(injector,
      Landing,
      injector.get(LandingService),
      injector.get(ValidatorService),
      {
        prependNewElements: false,
        suppressErrors: false,
        reservedStartColumns: LANDING_RESERVED_START_COLUMNS,
        reservedEndColumns: LANDING_RESERVED_END_COLUMNS
      }
    );
    this.cd = injector.get(ChangeDetectorRef);
    this.i18nColumnPrefix = 'LANDING.TABLE.';
    this.autoLoad = false; // waiting parent to load
    this.inlineEdition = false;
    this.debug = !environment.production;

    // Set default acquisition Level
    this.acquisitionLevel = AcquisitionLevelCodes.LANDING;
  }

  ngOnInit() {
    super.ngOnInit();
  }

  setParent(data: ObservedLocation | Trip) {
    if (!data) {
      this.setFilter({});
    } else if (data instanceof ObservedLocation) {
      this.setFilter({observedLocationId: data.id}, {emitEvent: true/*refresh*/});
    } else if (data instanceof Trip) {
      this.setFilter({tripId: data.id}, {emitEvent: true/*refresh*/});
    }
  }

  referentialToString = referentialToString;
  vesselFeaturesToString = vesselFeaturesToString;
  personsToString = personsToString;
  measurementValueToString = measurementValueToString;

  protected markForCheck() {
    this.cd.markForCheck();
  }
}

