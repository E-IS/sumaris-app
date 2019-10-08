import {Component, Input, OnInit} from '@angular/core';
import {SaleValidatorService} from "../services/sale.validator";
import {
  entityToString,
  EntityUtils,
  LocationLevelIds,
  ReferentialRef,
  referentialToString,
  Sale,
  VesselFeatures,
  vesselFeaturesToString
} from "../services/trip.model";
import {Moment} from 'moment/moment';
import {AppForm} from '../../core/core.module';
import {DateAdapter} from "@angular/material";
import {Observable} from 'rxjs';
import {debounceTime, mergeMap, switchMap} from 'rxjs/operators';
import {ReferentialRefService, VesselService} from '../../referential/referential.module';
import {LocalSettingsService} from "../../core/services/local-settings.service";

@Component({
  selector: 'form-sale',
  templateUrl: './sale.form.html',
  styleUrls: ['./sale.form.scss']
})
export class SaleForm extends AppForm<Sale> implements OnInit {

  vessels: Observable<VesselFeatures[]>;
  locations: Observable<ReferentialRef[]>;
  saleTypes: Observable<ReferentialRef[]>;

  @Input() required: boolean = true;
  @Input() showError: boolean = true;
  @Input() showVessel: boolean = true;
  @Input() showEndDateTime: boolean = true;
  @Input() showComment: boolean = true;
  @Input() showButtons: boolean = true;

  get empty(): any {
    const value = this.value;
    return (!value.saleLocation || !value.saleLocation.id)
      && (!value.startDateTime)
      && (!value.endDateTime)
      && (!value.saleType || !value.saleType.id)
      && (!value.comments || !value.comments.length);
  }

  get valid(): any {
    return this.form && (this.required ? this.form.valid : (this.form.valid || this.empty));
  }

  constructor(
    protected dateAdapter: DateAdapter<Moment>,
    protected saleValidatorService: SaleValidatorService,
    protected vesselService: VesselService,
    protected referentialRefService: ReferentialRefService,
    protected settings: LocalSettingsService
  ) {
    super(dateAdapter, saleValidatorService.getFormGroup(), settings);
  }

  ngOnInit() {
    super.ngOnInit();

    // Set if required or not
    this.saleValidatorService.setRequired(this.form, this.required);

    // Combo: vessels (if need)
    if (this.showVessel) {
      this.vessels = this.form.controls['vesselFeatures']
        .valueChanges
        .pipe(
          mergeMap(value => {
            if (EntityUtils.isNotEmpty(value)) return Observable.of([value]);
            value = (typeof value === "string") && value || undefined;
            return this.vesselService.watchAll(0, 10, undefined, undefined,
              {searchText: value as string}
            ).map(({data}) => data);
          }));
    } else {
      this.form.controls['vesselFeatures'].clearValidators();
    }

    // Combo: sale locations
    this.locations = this.form.controls['saleLocation']
      .valueChanges
      .pipe(
        debounceTime(250),
        switchMap(value => this.referentialRefService.suggest(value, {
          entityName: 'Location',
          levelId: LocationLevelIds.PORT
        }))
      );

    // Combo: sale types
    this.saleTypes = this.form.controls['saleType']
      .valueChanges
      .pipe(
        debounceTime(250),
        switchMap(value => this.referentialRefService.suggest(value, {entityName: 'SaleType'}))
      );
  }

  entityToString = entityToString;
  vesselFeaturesToString = vesselFeaturesToString;
  referentialToString = referentialToString;
}
