import { FormControl, ValidationErrors } from "@angular/forms";
import * as moment from 'moment/moment';
import { DATE_ISO_PATTERN } from "../constants";

export class SharedValidators {

  static validDate(control: FormControl): ValidationErrors | null {
    const value = control.value;
    const date = !value || moment.isMoment(value) ? value : moment(control.value, DATE_ISO_PATTERN);
    if (date && (!date.isValid() || date.year() < 1970)) {
      return { validDate: true };
    }
  }

}
