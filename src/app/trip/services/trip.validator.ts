import {Injectable} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ReferentialRef, Trip} from "./trip.model";
import {SharedValidators} from "../../shared/validator/validators";
import {LocalSettingsService} from "../../core/services/local-settings.service";
import {DataRootEntityValidatorService} from "./validator/base.validator";
import {IWithObserversEntity} from "./model/base.model";

@Injectable()
export class TripValidatorService extends DataRootEntityValidatorService<Trip> {

  constructor(
    protected formBuilder: FormBuilder,
    protected settings: LocalSettingsService
  ) {
    super(formBuilder);
  }

  getFormConfig(data?: Trip): { [key: string]: any } {
    const isOnFieldMode = this.settings.isUsageMode('FIELD');

    return Object.assign(
      super.getFormConfig(data),
      {
        __typename: ['TripVO'],
        vesselSnapshot: ['', Validators.compose([Validators.required, SharedValidators.entity])],
        departureDateTime: ['', Validators.required],
        departureLocation: ['', Validators.compose([Validators.required, SharedValidators.entity])],
        returnDateTime: ['', isOnFieldMode ? null : Validators.required],
        returnLocation: ['', isOnFieldMode ? SharedValidators.entity : Validators.compose([Validators.required, SharedValidators.entity])],
        observers: this.getObserversArray(data),
        metiers: this.getMetiersArray(data)
      });
  }

  getFormOptions(data?: any): { [key: string]: any } {
    return {
      validator: Validators.compose([
        SharedValidators.dateRange('departureDateTime', 'returnDateTime'),
        SharedValidators.dateMinDuration('departureDateTime', 'returnDateTime', 1, 'hours'),
        SharedValidators.dateMaxDuration('departureDateTime', 'returnDateTime', 100, 'days')
      ])
    };
  }

  getFormGroupOld(data?: Trip): FormGroup {
    const isOnFieldMode = this.settings.isUsageMode('FIELD');

    return this.formBuilder.group({
      id: [''],
      program: ['', Validators.compose([Validators.required, SharedValidators.entity])],
      updateDate: [''],
      creationDate: [''],
      vesselSnapshot: ['', Validators.compose([Validators.required, SharedValidators.entity])],
      departureDateTime: ['', Validators.required],
      departureLocation: ['', Validators.compose([Validators.required, SharedValidators.entity])],
      returnDateTime: ['', isOnFieldMode ? null : Validators.required],
      returnLocation: ['', isOnFieldMode ? SharedValidators.entity : Validators.compose([Validators.required, SharedValidators.entity])],
      comments: ['', Validators.maxLength(2000)]
    }, {
      validator: Validators.compose([
        SharedValidators.dateRange('departureDateTime', 'returnDateTime'),
        SharedValidators.dateMinDuration('departureDateTime', 'returnDateTime', 1, 'hours'),
        SharedValidators.dateMaxDuration('departureDateTime', 'returnDateTime', 100, 'days')
      ])
    });
  }

  getMetiersArray(data?: Trip) {
    return this.formBuilder.array(
      (data && data.metiers || []).map(this.getMetierControl),
      SharedValidators.requiredArrayMinLength(1)
    );
  }

  getMetierControl(metier: ReferentialRef) {
    return this.formBuilder.control(metier || '', [Validators.required, SharedValidators.entity]);
  }
}


