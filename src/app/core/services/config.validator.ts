import {Injectable} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Configuration, EntityUtils, FieldOptions} from "./model";

@Injectable()
export class ConfigValidatorService {

  constructor(
    private formBuilder: FormBuilder
  ) {
  }

  getFormGroup(data?: Configuration): FormGroup {


    return this.formBuilder.group({
      id: [data && data.id || null],
      label: [data && data.label || null, Validators.compose([Validators.required, Validators.max(50)])],
      name: [data && data.name || null, Validators.compose([Validators.required, Validators.max(100)])],
      updateDate: [data && data.updateDate || null],
      creationDate: [data && data.creationDate || null],
      statusId: [data && data.statusId || null, Validators.required],
      properties: this.getPropertiesArray(data && data.properties)
    });
  }

  getPropertiesArray(array?: any) {
    const properties = (array && array instanceof Array) ? array : EntityUtils.getObjectAsArray(array || {});
    return this.formBuilder.array(
      properties.map(item => this.getPropertyFormGroup(item))
    );
  }

  getPropertyFormGroup(data?: {key: string; value?: string;}): FormGroup {
    return this.formBuilder.group({
      key: [data && data.key || null, Validators.compose([Validators.required, Validators.max(50)])],
      value: [data && data.value || null, Validators.compose([Validators.required, Validators.max(100)])]
    });
  }
}
