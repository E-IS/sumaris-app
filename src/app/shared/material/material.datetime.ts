import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  Input,
  OnInit,
  Optional,
  ViewChild
} from '@angular/core';
import {Platform} from '@ionic/angular';
import {DateAdapter, FloatLabelType, MatDatepicker, MatDatepickerInputEvent} from '@angular/material';
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NG_VALUE_ACCESSOR,
  Validators
} from "@angular/forms";
import {TranslateService} from "@ngx-translate/core";
import * as moment from "moment/moment";
import {Moment} from "moment/moment";
import {DATE_ISO_PATTERN, DEFAULT_PLACEHOLDER_CHAR} from '../constants';
import {SharedValidators} from '../validator/validators';
import {merge} from "rxjs";

export const DEFAULT_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatDateTime),
  multi: true
};

const HOUR_TIME_PATTERN = /[0-2]\d:[0-5]\d/;

const noop = () => {
};

@Component({
  selector: 'mat-date-time',
  templateUrl: 'material.datetime.html',
  styleUrls: ['./material.datetime.scss'],
  providers: [DEFAULT_VALUE_ACCESSOR],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatDateTime implements OnInit, ControlValueAccessor {
  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  protected writing: boolean = true;
  protected disabling = false;

  touchUi: boolean = false;
  mobile: boolean = false;
  form: FormGroup;
  displayPattern: string;
  dayPattern: string;
  date: Moment;
  locale: string;

  mask = [/\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/];
  hourMask = [/[0-2]/, /\d/, ':', /[0-5]/, /\d/];

  @Input() disabled: boolean = false

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() displayTime: boolean = true;

  @Input() placeholder: string;

  @Input() floatLabel: FloatLabelType = "auto";

  @Input() readonly: boolean = false;

  @Input() required: boolean = false;

  @Input() compact: boolean = false;

  @Input() placeholderChar: string = DEFAULT_PLACEHOLDER_CHAR;

  @ViewChild('datePicker1') datePicker1: MatDatepicker<Moment>;
  @ViewChild('datePicker2') datePicker2: MatDatepicker<Moment>;

  constructor(
    platform: Platform,
    private dateAdapter: DateAdapter<Moment>,
    private translate: TranslateService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
    this.touchUi = platform.is('tablet');
    this.mobile = !this.touchUi && platform.is('mobile');
    this.locale = (translate.currentLang || translate.defaultLang).substr(0, 2);
  }

  ngOnInit() {

    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error("Missing mandatory attribute 'formControl' or 'formControlName' in <mat-date-time>.");

    const isRequired = this.required || this.formControl.validator === Validators.required;
    if (this.displayTime) {
      if (this.mobile) {
        this.form = this.formBuilder.group({
          day: (isRequired ? ['', Validators.required] : [''])
        });
      } else {
        this.form = this.formBuilder.group({
          day: (isRequired ? ['', Validators.required] : ['']),
          hour: ['', isRequired ? Validators.compose([Validators.required, Validators.pattern(HOUR_TIME_PATTERN)]) : Validators.pattern(HOUR_TIME_PATTERN)]
        });
      }
    } else {
      this.form = this.formBuilder.group({
        day: (isRequired ? ['', Validators.required] : [''])
      });
    }

    // Add custom 'validDate' validator
    this.formControl.setValidators(isRequired ? Validators.compose([Validators.required, SharedValidators.validDate]) : SharedValidators.validDate);
    //this.formControl.updateValueAndValidity({ emitEvent: false, onlySelf: true });

    // Get patterns to display date and date+time
    const patterns = this.translate.instant(['COMMON.DATE_PATTERN', 'COMMON.DATE_TIME_PATTERN']);
    this.updatePattern(patterns);

    this.form.valueChanges
      .subscribe((value) => this.onFormChange(value));

    // Listen status changes outside the component (e.g. when setErrors() is calling on the formControl)
    this.formControl.statusChanges
      .subscribe((status) => {
        if (this.readonly || this.writing || this.disabling) return; // Skip
        this.markForCheck();
      });
  }

  writeValue(obj: any): void {
    if (this.writing) return;

    if (obj === null) {
      this.writing = true;
      if (this.displayTime) {
        this.form.patchValue({day: null, hour: null}, {emitEvent: false});
      } else {
        this.form.patchValue({day: null}, {emitEvent: false});
      }
      this.date = undefined;
      this.writing = false;
      this.markForCheck();
      return;
    }

    this.date = this.dateAdapter.parse(obj, DATE_ISO_PATTERN);
    if (!this.date) return; // invalid date

    this.writing = true;

    // If mobile (use ion-date-time component)
    if (this.mobile) {
      // With time
      if (this.displayTime) {
        this.form.patchValue({
          day: {
            year: {value: this.date.year()},
            month: {value: this.date.month()},
            day: {value: this.date.day()},
            hour: {value: this.date.hour()},
            minute: {value: this.date.minute()}
          }
        }, {emitEvent: false});
      }
      // Without time
      else {
        this.form.patchValue({
          day: {
            year: {value: this.date.year()},
            month: {value: this.date.month()},
            day: {value: this.date.day()},
            hour: {value: 0},
            minute: {value: 0}
          }
        }, {emitEvent: false});
      }
    } else {
      // With time
      if (this.displayTime) {

        // Format hh
        let hour: number | string = this.date.hour();
        hour = hour < 10 ? ('0' + hour) : hour;
        // Format mm
        let minutes: number | string = this.date.minutes();
        minutes = minutes < 10 ? ('0' + minutes) : minutes
        // Set form value
        this.form.patchValue({
          day: this.date.clone().startOf('day').format(this.dayPattern),
          hour: `${hour}:${minutes}`
        }, {emitEvent: false});
      }

      // Without time
      else {
        //console.log("call writeValue()", this.date, this.formControl);
        // Set form value
        this.form.patchValue({
          day: this.date.clone().startOf('day').format(this.dayPattern)
        }, {emitEvent: false});
      }
    }
    this.writing = false;
    this.markForCheck();
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.disabling) return;

    this.disabling = true;
    this.disabled = isDisabled;
    if (isDisabled) {
      this.form.disable({onlySelf: true, emitEvent: false});
    } else {
      this.form.enable({onlySelf: true, emitEvent: false});
    }
    this.disabling = false;

    this.markForCheck();
  }

  private updatePattern(patterns: string[]) {
    this.displayPattern = (this.displayTime) ?
      (patterns['COMMON.DATE_TIME_PATTERN'] != 'COMMON.DATE_TIME_PATTERN' ? patterns['COMMON.DATE_TIME_PATTERN'] : 'L LT') :
      (this.displayPattern = patterns['COMMON.DATE_PATTERN'] != 'COMMON.DATE_PATTERN' ? patterns['COMMON.DATE_PATTERN'] : 'L');
    this.dayPattern = (patterns['COMMON.DATE_PATTERN'] != 'COMMON.DATE_PATTERN' ? patterns['COMMON.DATE_PATTERN'] : 'L');
    this.writing = false;
    this.markForCheck();
  }

  private onFormChange(json): void {
    if (this.writing) return; // Skip if call by self
    this.writing = true;

    if (this.form.invalid) {
      this.formControl.markAsPending();
      let errors = {};

      if (this.mobile || !this.displayTime) {
        Object.assign(errors, this.form.controls.day.errors);
      } else {
        Object.assign(errors, this.form.controls.day.errors, this.form.controls.hour.errors);
      }
      this.formControl.setErrors(errors);
      this.writing = false;
      return;
    }

    // Make to remove placeholder chars
    if (!this.mobile) {
      while (json.day && json.day.indexOf(this.placeholderChar) != -1) {
        json.day = json.day.replace(this.placeholderChar, '');
      }
    }

    let date: Moment;
    if (this.mobile && json.day && typeof json.day !== "string") {

      if (this.displayTime) {
        json = json && json.day;
        //console.log("ion-date-time result", json);
        date = json && json.day && json.year && json.month && moment()
        // set as time as locale time
          .locale(this.locale)
          .year(json.year.value || 0)
          .month(json.month.value || 0)
          .day(json.day.value || 0)
          .hour(json.hour && json.hour.value || 0)
          .minute(json.minute && json.minute.value || 0)
          .seconds(0).millisecond(0)
          // then change in UTC, to avoid TZ offset in final string
          .utc();
      } else {
        json = json && json.day;
        //console.log("ion-date-time result", json);
        date = json && json.day && json.year && json.month && moment()
        // set as time as locale time
          .locale(this.locale)
          .year(json.year.value || 0)
          .month(json.month.value || 0)
          .day(json.day.value || 0)
          .hour(0).minute(0)
          .seconds(0).millisecond(0)
          // then change in UTC, to avoid TZ offset in final string
          .utc();
      }
    } else {

      // Parse day string
      date = json.day && this.dateAdapter.parse(json.day, this.dayPattern) || null;

      // If time
      if (this.displayTime) {

        const hourParts = (json.hour || '').split(':');
        date = date && date
        // set as time as locale time
          .locale(this.locale)
          .hour(parseInt(hourParts[0] || 0))
          .minute(parseInt(hourParts[1] || 0))
          .seconds(0).millisecond(0)
          // then change in UTC, to avoid TZ offset in final string
          .utc();
      } else {
        // Reset time
        date = date && date.utc(true).hour(0).minute(0).seconds(0).millisecond(0);
      }
    }

    // update date picker
    this.date = date && this.dateAdapter.parse(date.clone(), DATE_ISO_PATTERN);

    // Get the model value
    const dateStr = date && date.isValid() && date.format(DATE_ISO_PATTERN).replace('+00:00', 'Z') || date;
    //console.debug("[mat-date-time] Setting date: ", dateStr);
    this.formControl.setValue(dateStr);
    this.formControl.updateValueAndValidity();
    this.writing = false;
    this.markForCheck();

    this._onChangeCallback(dateStr);
  }

  private onDatePickerChange(event: MatDatepickerInputEvent<Moment>): void {
    if (this.writing || !(event && event.value)) return; // Skip if call by self
    this.writing = true;

    let date = event.value;
    date = typeof date === 'string' && this.dateAdapter.parse(date, DATE_ISO_PATTERN) || date;
    let day;
    if (this.displayTime) {
      if (this.mobile) {
        date = date && date
        // set as time as locale time
          .locale(this.locale)
          // then change in UTC, to avoid TZ offset in final string
          .utc();
        day = date && date.clone().startOf('day');
      } else {
        // Keep original day (to avoid to have a offset of 1 day - fix #33)
        day = date && date.clone().locale(this.locale).hour(0).minute(0).seconds(0).millisecond(0).utc(true);
        const hourParts = (this.form.controls.hour.value || '').split(':');
        date = date && date
        // set as time as locale time
          .locale(this.locale)
          .hour(parseInt(hourParts[0] || 0))
          .minute(parseInt(hourParts[1] || 0))
          .seconds(0).millisecond(0)
          // then change in UTC, to avoid TZ offset in final string
          .utc();
      }
    } else {
      // avoid to have TZ offset
      date = date && date.utc(true).hour(0).minute(0).seconds(0).millisecond(0);
      day = date && date.clone().startOf('day');
    }

    // update day value
    this.form.controls.day.setValue(day && day.format(this.mobile ? this.displayPattern : this.dayPattern), {emitEvent: false});

    // Get the model value
    const dateStr = date && date.format(DATE_ISO_PATTERN).replace('+00:00', 'Z');
    this.formControl.setValue(dateStr);
    this.formControl.updateValueAndValidity();
    this.writing = false;
    this.markForCheck();

    this._onChangeCallback(dateStr);
  }

  public markAsTouched() {
    if (this.form.touched) {
      this.markForCheck();

      this._onTouchedCallback();
    }
  }

  public onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      return this.openDatePicker(event);
    }
  }

  public openDatePickerIfTouchUi(event: UIEvent) {
    if (!this.touchUi) return;
    this.openDatePicker(event);
  }

  public openDatePicker(event: UIEvent, datePicker?: MatDatepicker<Moment>) {
    if (datePicker) {
      datePicker.open();
    } else {
      this.datePicker1 && this.datePicker1.open();
      this.datePicker2 && this.datePicker2.open();
    }
    event.preventDefault();
  }

  /* -- protected method -- */

  protected markForCheck() {
    //console.log("MAT DATE TIME > markForCheck !"/*, new Error()*/);
    this.cd.markForCheck();
  }
}

