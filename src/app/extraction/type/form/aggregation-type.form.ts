import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, ViewChild} from "@angular/core";
import {ExtractionColumn} from "../../services/model/extraction.model";
import {FormArray, FormBuilder, FormGroup} from "@angular/forms";
import {AggregationTypeValidatorService} from "../../services/validator/aggregation-type.validator";
import {ReferentialForm} from "../../../referential/form/referential.form";
import {BehaviorSubject} from "rxjs";
import {arraySize, isNil, isNotNilOrBlank} from "../../../shared/functions";
import {DateAdapter} from "@angular/material/core";
import {Moment} from "moment";
import {LocalSettingsService} from "../../../core/services/local-settings.service";
import {ExtractionService} from "../../services/extraction.service";
import {debounceTime} from "rxjs/operators";
import {AggregationStrata, AggregationType, ProcessingFrequency, ProcessingFrequencyList} from "../../services/model/aggregation-type.model";
import {ExtractionUtils} from "../../services/extraction.utils";
import {AggregationService} from "../../services/aggregation.service";
import {FormArrayHelper} from "../../../core/form/form.utils";
import {AppForm} from "../../../core/form/form.class";
import {StatusIds} from "../../../core/services/model/model.enum";
import {EntityUtils} from "../../../core/services/model/entity.model";

declare interface ColumnMap {
  [sheetName: string]: ExtractionColumn[];
}

const FrequenciesById: { [id: number]: ProcessingFrequency; } = ProcessingFrequencyList.reduce((res, frequency) => {
  res[frequency.id] = frequency;
  return res;
}, {});

@Component({
  selector: 'app-aggregation-type-form',
  styleUrls: ['./aggregation-type.form.scss'],
  templateUrl: './aggregation-type.form.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AggregationTypeForm extends AppForm<AggregationType> implements OnInit {


  data: AggregationType;
  frequenciesById = FrequenciesById;

  $sheetNames = new BehaviorSubject<String[]>(undefined);
  $timeColumns = new BehaviorSubject<ColumnMap>(undefined);
  $spatialColumns = new BehaviorSubject<ColumnMap>(undefined);
  $aggColumns = new BehaviorSubject<ColumnMap>(undefined);
  $techColumns = new BehaviorSubject<ColumnMap>(undefined);
  aggFunctions = [
    {
      value: 'SUM',
      name: 'EXTRACTION.AGGREGATION.EDIT.AGG_FUNCTION.SUM'
    },
    {
      value: 'AVG',
      name: 'EXTRACTION.AGGREGATION.EDIT.AGG_FUNCTION.AVG'
    }
  ];

  stratumFormArray: FormArray;
  stratumHelper: FormArrayHelper<AggregationStrata>;

  showMarkdownPreview = true;
  $markdownContent = new BehaviorSubject<string>(undefined);

  @Input()
  showError = true;

  @ViewChild('referentialForm', {static: true}) referentialForm: ReferentialForm;

  get value(): any {
    const json = this.form.value;

    // Re add label, because missing when field disable
    json.label = this.form.get('label').value;

    return json;
  }

  set value(value: any) {
    this.setValue(value);
  }

  get strataForms(): FormGroup[] {
    return this.stratumFormArray.controls as FormGroup[];
  }

  get isSpatial(): boolean {
    return this.form.controls['isSpatial'].value;
  }

  enable(opts?: { onlySelf?: boolean; emitEvent?: boolean }) {
    super.enable(opts);
    if (!this.isSpatial) {
      this.stratumFormArray.disable();
    }
  }

  constructor(protected dateAdapter: DateAdapter<Moment>,
              protected formBuilder: FormBuilder,
              protected settings: LocalSettingsService,
              protected validatorService: AggregationTypeValidatorService,
              protected extractionService: ExtractionService,
              protected aggregationService: AggregationService,
              protected cd: ChangeDetectorRef) {
    super(dateAdapter,
      validatorService.getFormGroup(),
      settings);

    // Stratum
    this.stratumFormArray = this.form.controls.stratum as FormArray;
    this.stratumHelper = new FormArrayHelper<AggregationStrata>(
      this.stratumFormArray,
      (strata) => validatorService.getStrataFormGroup(strata),
      (v1, v2) => EntityUtils.equals(v1, v2, 'id') || v1.sheetName === v2.sheetName,
      (strata) => !strata || isNil(strata.sheetName),
      {
        allowEmptyArray: false
      }
    );

    this.registerSubscription(
      this.form.get('documentation').valueChanges
        .pipe(
          debounceTime(350)
        )
        .subscribe(md => this.$markdownContent.next(md))
      );
  }

  async updateLists(type?: AggregationType) {
    if (type) {
      this.data = type;
    }
    else if (this.data) {
      type = this.data;
    }
    else {
      return; // Skip
    }

    console.debug('[aggregation-form] Loading columns of type', type);

    // If spatial, load columns
    if (type.isSpatial || this.isSpatial) {

      const sheetNames = type.sheetNames || [];
      this.$sheetNames.next(sheetNames);

      const map: {[key: string]: ColumnMap} = {};
      await Promise.all(sheetNames.map(sheetName => {
        return this.aggregationService.loadColumns(type, sheetName)
          .then(columns => {
            columns = columns || [];
            const columnMap = ExtractionUtils.dispatchColumns(columns);
            Object.keys(columnMap).forEach(key => {
              const m: ColumnMap = map[key] ||  <ColumnMap>{};
              m[sheetName] = columnMap[key];
              map[key] = m;
            });
          });
      }));

      console.debug('[aggregation-type] Columns map:', map);
      this.$timeColumns.next(map.timeColumns);
      this.$spatialColumns.next(map.spatialColumns);
      this.$aggColumns.next(map.aggColumns);
      this.$techColumns.next(map.techColumns);
    }
  }

  ngOnInit(): void {
    super.ngOnInit();

    // Set entity name (required for referential form validator)
    this.referentialForm.entityName = 'AggregationType';

    // Override status list i18n
    this.referentialForm.statusList = [
      {
        id: StatusIds.ENABLE,
        icon: 'eye',
        label: 'EXTRACTION.AGGREGATION.EDIT.STATUS_ENUM.PUBLIC'
      },
      {
        id: StatusIds.TEMPORARY,
        icon: 'eye-off',
        label: 'EXTRACTION.AGGREGATION.EDIT.STATUS_ENUM.PRIVATE'
      },
      {
        id: StatusIds.DISABLE,
        icon: 'close',
        label: 'EXTRACTION.AGGREGATION.EDIT.STATUS_ENUM.DISABLE'
      }
    ];

    this.registerSubscription(
      this.form.get('isSpatial').valueChanges
        .subscribe(isSpatial => {
           // Not need stratum
           if (!isSpatial) {
             this.stratumHelper.resize(0);
             this.stratumHelper.allowEmptyArray = true;
             this.stratumFormArray.disable();
           }
           else {
             if (this.stratumHelper.size() === 0) {
               this.stratumHelper.resize(1);
             }
             this.stratumHelper.allowEmptyArray = false;
             this.stratumFormArray.enable();
             this.updateLists();
           }
        })
    );
  }

  toggleDocPreview() {
    this.showMarkdownPreview = !this.showMarkdownPreview;
    if (this.showMarkdownPreview) {
      this.markForCheck();
    }
  }

  /* -- protected -- */

  setValue(data: AggregationType, opts?: { emitEvent?: boolean; onlySelf?: boolean }) {

    console.debug('[aggregation-type-form] Setting value: ', data);
    // If spatial, load columns
    if (data && data.isSpatial) {
      // If spatial product, make sure there is one strata
      this.stratumHelper.resize(Math.max(1, arraySize(data.stratum)));
      this.stratumHelper.allowEmptyArray = false;
      this.stratumHelper.enable();
    }
    else {
      this.stratumHelper.resize(0);
      this.stratumHelper.allowEmptyArray = true;
      this.stratumHelper.disable();
    }

    // Show doc preview, if doc exists
    this.showMarkdownPreview = this.showMarkdownPreview && isNotNilOrBlank(data.documentation);

    super.setValue(data, opts);

  }



  protected markForCheck() {
    this.cd.markForCheck();
  }

}
