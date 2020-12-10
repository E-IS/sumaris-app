import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, ViewChild} from '@angular/core';
import {Moment} from 'moment/moment';
import {DateAdapter} from "@angular/material/core";
import {LocalSettingsService} from "../../core/services/local-settings.service";
import {ControlValueAccessor, FormBuilder, FormArray, Validators} from "@angular/forms";
import {ReferentialRefService} from "../../referential/services/referential-ref.service";
import {StrategyService} from "../services/strategy.service";
import {
  AppForm,
  ReferentialRef,
  IReferentialRef,
  FormArrayHelper,
  Referential, toDateISOString, fromDateISOString
} from '../../core/core.module';
import {BehaviorSubject, Observable} from "rxjs";
import { Program } from '../services/model/program.model';
import { DEFAULT_PLACEHOLDER_CHAR } from 'src/app/shared/constants';
import { InputElement } from 'src/app/shared/shared.module';
import { ReferentialUtils} from "../../core/services/model/referential.model";
import * as moment from "moment";
import {SimpleStrategyValidatorService} from "../services/validator/simpleStrategy.validator";
import {SimpleStrategy} from "../services/model/simpleStrategy.model";
import {AppliedPeriod, AppliedStrategy, Strategy, StrategyDepartment} from "../services/model/strategy.model";
import {filter, map} from "rxjs/operators";
import {Pmfm} from "../services/model/pmfm.model";
import {removeDuplicatesFromArray} from "../../shared/functions";
import {PmfmStrategy} from "../services/model/pmfm-strategy.model";
import {AppFormHolder, IAppForm, IAppFormFactory} from "../../core/form/form.utils";
import { StrategyValidatorService } from '../services/validator/strategy.validator';
import { SharedValidators } from 'src/app/shared/validator/validators';
import {PmfmStrategiesTable} from "../strategy/pmfm-strategies.table";
import {AppListForm} from "../../core/form/list.form";
import {MatBooleanField} from "../../shared/material/boolean/material.boolean";



@Component({
  selector: 'form-planification',
  templateUrl: './planification.form.html',
  styleUrls: ['./planification.form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {provide: StrategyValidatorService}
  ],
})
export class PlanificationForm extends AppForm<Strategy> implements OnInit {

  // protected formBuilder: FormBuilder;
  private _eotpSubject = new BehaviorSubject<IReferentialRef[]>(undefined);
  private _calcifiedTypeSubject = new BehaviorSubject<IReferentialRef[]>(undefined);

  mobile: boolean;
  programId = -1;

  enableTaxonNameFilter = true;
  canFilterTaxonName = true;
  taxonNameHelper: FormArrayHelper<ReferentialRef>;

  enableEotpFilter = true;
  canFilterEotp = true;

  enableLaboratoryFilter = true;
  canFilterLaboratory = true;
  laboratoryHelper: FormArrayHelper<ReferentialRef>;
  laboratoryFocusIndex = -1;

  enableFishingAreaFilter = true;
  canFilterFishingArea = true;
  fishingAreaHelper: FormArrayHelper<ReferentialRef>;
  fishingAreaFocusIndex = -1;

  enableCalcifiedTypeFilter = true;
  canFilterCalcifiedType = true;
  calcifiedTypeHelper: FormArrayHelper<ReferentialRef>;
  calcifiedTypeFocusIndex = -1;

  @Input() program: Program;
  @Input() showError = true;
  @Input() entityName;
  label: string = '';

  @Input() placeholderChar: string = DEFAULT_PLACEHOLDER_CHAR;


  pmfmStrategiesHelper: FormArrayHelper<PmfmStrategy>;
  appliedStrategiesHelper: FormArrayHelper<AppliedStrategy>;
  pmfmStrategiesFocusIndex = -1;

  public sampleRowMask = ['2', '0', '2', '0', '_', 'B', 'I', '0', '_', /\d/, /\d/, /\d/, /\d/];

  get calcifiedTypesForm(): FormArray {
    return this.form.controls.calcifiedTypes as FormArray;
  }

  get laboratoriesForm(): FormArray {
    return this.form.controls.strategyDepartments as FormArray;
  }

  get fishingAreasForm(): FormArray {
    // appliedStrategies.location à la place de appliedStrategies
    return this.form.controls.appliedStrategies as FormArray;
  }

  get taxonNamesForm(): FormArray {
    return this.form.controls.taxonNames as FormArray;
  }

  get pmfmStrategiesForm(): FormArray {
    return this.form.controls.pmfmStrategies as FormArray;
  }

  get appliedStrategiesForm(): FormArray {
    return this.form.controls.appliedStrategies as FormArray;
  }

  @ViewChild('weightPmfmStrategiesTable', { static: true }) weightPmfmStrategiesTable: PmfmStrategiesTable;
  @ViewChild('sizePmfmStrategiesTable', { static: true }) sizePmfmStrategiesTable: PmfmStrategiesTable;
  @ViewChild('maturityPmfmStrategiesTable', { static: true }) maturityPmfmStrategiesTable: PmfmStrategiesTable;

  constructor(
    protected dateAdapter: DateAdapter<Moment>,
    protected validatorService: StrategyValidatorService,
    protected referentialRefService: ReferentialRefService,
    protected strategyService: StrategyService,
    protected settings: LocalSettingsService,
    protected cd: ChangeDetectorRef,
    protected formBuilder: FormBuilder,
  ) {
    super(dateAdapter, validatorService.getFormGroup(), settings);
    this.mobile = this.settings.mobile;
  }
  tabIndex?: number;
  hidden?: boolean;
  appliedYear: string ='';

  focus() {
    throw new Error('Method not implemented.');
  }
  writeValue(value: any): void {
    //  if (value !== this.sampleRowCode) {
    //       this.sampleRowCode = value;
    //     }
  }
  registerOnChange(fn: any): void {
    throw new Error('Method not implemented.');
  }
  registerOnTouched(fn: any): void {
    throw new Error('Method not implemented.');
  }
  setDisabledState?(isDisabled: boolean): void {
    throw new Error('Method not implemented.');
  }

  ngOnInit() {
    super.ngOnInit();
    // register year field changes
    this.registerSubscription(
      this.form.get('creationDate').valueChanges
        .subscribe(async (date : Moment) => {
          //update mask
          let year = "2020";
          if (date && (typeof date === 'object') && (date.year()))
          {
            year = date.year().toString();
          }
          else if (date && (typeof date === 'string'))
          {
            let dateAsString = date as string;
            year = dateAsString.split('-')[0];
          }
          this.sampleRowMask = [...year.split(''), '-', 'B', 'I', '0', '-', /\d/, /\d/, /\d/, /\d/];
          // set sample row code
          //TODO : replace 40 with this.program.id
          this.label = await this.strategyService.findStrategyNextLabel(40,`${year}-BIO-`, 4);
        })
    );

    // taxonName autocomplete
    this.registerAutocompleteField('taxonName', {
      suggestFn: (value, filter) => this.suggest(value, {
          ...filter, statusId : 1
        },
        'TaxonName',
        this.enableTaxonNameFilter),
      attributes: ['name'],
      columnNames: [ 'REFERENTIAL.NAME'],
      columnSizes: [2,10],
      mobile: this.settings.mobile
    });

    // laboratory autocomplete
    this.registerAutocompleteField('laboratory', {
      suggestFn: (value, filter) => this.suggest(value, {
          ...filter, statusId : 1
        },
        'Department',
        this.enableLaboratoryFilter),
      columnSizes : [4,6],
      mobile: this.settings.mobile
    });

    // fishingArea autocomplete
    this.registerAutocompleteField('fishingArea', {
      suggestFn: (value, filter) => this.suggest(value, {
          ...filter, statusId : 1, Id : 111
        },
        'Location',
        this.enableFishingAreaFilter),
      mobile: this.settings.mobile
    });


    // eotp combo -------------------------------------------------------------------
    this.registerAutocompleteField('analyticReference', {
      columnSizes : [4,6],
      items: this._eotpSubject,
      mobile: this.mobile
    });
    this.loadEotps();

    // Calcified type combo ------------------------------------------------------------
    // this.registerAutocompleteField('calcifiedType', {
    //   attributes: ['name'],
    //   columnNames: [ 'REFERENTIAL.NAME'],
    //   items: this._calcifiedTypeSubject,
    //   mobile: this.mobile
    // });
    // this.loadCalcifiedType();

    // const res = await this.referentialRefService.loadAll(0, 200, null,null,
    //   {
    //     entityName: 'Fraction',
    //     searchAttribute: "description",
    //     searchText: "individu"
    //   });
    // return res.data;

    this.registerAutocompleteField('calcifiedType', {
        suggestFn: (value, filter) => this.suggest(value, {
            ...filter, statusId : 1
          },
          'Fraction',
          this.enableCalcifiedTypeFilter),
      attributes: ['name'],
      columnNames: [ 'REFERENTIAL.NAME'],
        columnSizes: [2,10],
        mobile: this.settings.mobile
    });

    //set current date to year field
    this.form.get('creationDate').setValue(moment());

    //init helpers
    // this.initCalcifiedTypeHelper();
    this.initLaboratoryHelper();
    //this.initFishingAreaHelper();
    this.initTaxonNameHelper();
    this.initPmfmStrategiesHelper();
    this.initAppliedStrategiesHelper();

  }

  /**
   * Suggest autocomplete values
   * @param value
   * @param filter - filters to apply
   * @param entityName - referential to request
   * @param filtered - boolean telling if we load prefilled data
   */
  protected async suggest(value: string, filter: any, entityName: string, filtered: boolean) : Promise<IReferentialRef[]> {
    if(filtered) {
      //TODO a remplacer par recuperation des donnees deja saisies
      const res = await this.referentialRefService.loadAll(0, 5, null, null,
        { ...filter,
          entityName : entityName
        },
        { withTotal: false /* total not need */ }
      );
      return res.data;
    } else {
      return this.referentialRefService.suggest(value, {
        ...filter,
        entityName : entityName
      });
    }
  }

  toggleFilteredItems(fieldName: string){
    let value : boolean;
    switch (fieldName) {
      case 'eotp':
        this.enableEotpFilter = value = !this.enableEotpFilter;
        this.loadEotps();
        break;
      case 'laboratory':
        this.enableLaboratoryFilter = value = !this.enableLaboratoryFilter;
        break;
      case 'fishingArea':
        this.enableFishingAreaFilter = value = !this.enableFishingAreaFilter;
        break;
      case 'taxonName':
        this.enableTaxonNameFilter = value = !this.enableTaxonNameFilter;
        break;
      case 'calcifiedType':
        this.enableCalcifiedTypeFilter = value = !this.enableCalcifiedTypeFilter;
        //this.loadCalcifiedType();
        break;
      default:
        break;
    }
    this.markForCheck();
    console.debug(`[planification] set enable filtered ${fieldName} items to ${value}`);
  }

  setValueSimpleStrategy(data: Strategy, opts?: { emitEvent?: boolean; onlySelf?: boolean }) {
    console.debug("[planification-form] Setting Strategy value", data);
    if (!data) return;


    console.log(data);

    super.setValue(data, opts);
    console.log(this.form);

    if (data.label) {
      // SAMPLE ROW CODE
      const sampleRowCodeControl = this.form.get("label");

      // FIX Replace '_' by '-'
      let sampleRowValue = data.label.replace(/_/g, "-");
      sampleRowCodeControl.patchValue(sampleRowValue);
    }
      // EOTP
      const eotpControl = this.form.get("analyticReference");
      let eotp = data.analyticReference;
      let eotpValues = this._eotpSubject.getValue();
      let eotpObject = eotpValues.find(e => e.label && e.label === eotp);
      eotpControl.patchValue(eotpObject);

      // LABORATORIES
      const laboratoriesControl = this.laboratoriesForm;
      let strategyDepartments = data.strategyDepartments;
      let laboratories = strategyDepartments.map(strategyDepartment => { return strategyDepartment.department;});
      this.laboratoryHelper.resize(Math.max(1, data.strategyDepartments.length));
      laboratoriesControl.patchValue(laboratories);



    //   // TAXONS
    const taxonNamesControl = this.taxonNamesForm;
    let taxonsNames = data.taxonNames;
    let taxons = taxonsNames.map(taxonsNames => { return taxonsNames.taxonName;});
    this.taxonNameHelper.resize(Math.max(1, data.taxonNames.length));
    taxonNamesControl.patchValue(taxons);




    //   // YEAR
    //   //  Automatic binding


    // FISHING AREA
    // applied_strategy.location_fk + program2location (zones en mer / configurables)
    let fishingAreaAppliedStrategies = data.appliedStrategies;
    let fishingArea = fishingAreaAppliedStrategies.map(appliedStrategy => { return appliedStrategy.location;});



      // EFFORT
    //   const appliedStrategiesControl = this.form.get("appliedStrategies");
      let appliedStrategies = data.appliedStrategies;
    let quarterEffort1 = null;
    let quarterEffort2 = null;
    let quarterEffort3 = null;
    let quarterEffort4 = null;
      if (appliedStrategies)
      {
        // We keep the first applied period of the array as linked to fishing area
        let fishingAreaAppliedStrategyAsObject = appliedStrategies[0];
        if (fishingAreaAppliedStrategyAsObject)
        {
          // We iterate over applied periods in order to retrieve quarters acquisition numbers
          let fishingAreaAppliedStrategy = fishingAreaAppliedStrategyAsObject as AppliedStrategy;
          let fishingAreaAppliedPeriodsAsObject = fishingAreaAppliedStrategy.appliedPeriods;
          if (fishingAreaAppliedPeriodsAsObject)
          {
            let fishingAreaAppliedPeriods = fishingAreaAppliedPeriodsAsObject as AppliedPeriod[];
            for (let fishingAreaAppliedPeriod of fishingAreaAppliedPeriods) {
              let startDateMonth = fromDateISOString(fishingAreaAppliedPeriod.startDate).month();
              let endDateMonth = fromDateISOString(fishingAreaAppliedPeriod.endDate).month();
              if (startDateMonth >= 0 && endDateMonth < 3)
              {
                // First quarter
                quarterEffort1 = fishingAreaAppliedPeriod.acquisitionNumber;
              }
              else if (startDateMonth >= 3 && endDateMonth < 6)
              {
                // Second quarter
                quarterEffort2 = fishingAreaAppliedPeriod.acquisitionNumber;
              }
              else if (startDateMonth >= 6 && endDateMonth < 9)
              {
                // Third quarter
                quarterEffort3 = fishingAreaAppliedPeriod.acquisitionNumber;
              }
              else if (startDateMonth >= 9 && endDateMonth < 12)
              {
                // Fourth quarter
                quarterEffort4 = fishingAreaAppliedPeriod.acquisitionNumber;
              }

            }
          }
        }
      }
    const appliedStrategiesControl = this.appliedStrategiesForm;

    let appliedStrategiesValues = [quarterEffort1, quarterEffort2, quarterEffort3, quarterEffort4];
    appliedStrategiesValues = appliedStrategiesValues.concat(fishingArea);
    this.appliedStrategiesHelper.resize(appliedStrategiesValues.length);
    appliedStrategiesControl.patchValue(appliedStrategiesValues);


      // WEIGHT PMFMS
    //   const weightPmfmsControl = this.form.get("weightPmfmStrategies");
       let weightPmfmStrategy = (data.pmfmStrategies || []).filter(p => p.pmfm && p.pmfm.parameter && p.pmfm.parameter.label === 'WEIGHT');

      if (weightPmfmStrategy)
      {
        let weightPmfm = weightPmfmStrategy.map(pmfmStrategy =>  {return pmfmStrategy.pmfm;});
        //weightPmfmsControl.patchValue(weightPmfm);
    //     weightPmfmsControl.patchValue(weightPmfmStrategy);

        // this.weightPmfmStrategiesTable.value = weightPmfmStrategy || [];
      }

      // Size
    //   const sizePmfmsControl = this.form.get("sizePmfmStrategies");
      const sizeValues = ['LENGTH_PECTORAL_FORK', 'LENGTH_CLEITHRUM_KEEL_CURVE', 'LENGTH_PREPELVIC', 'LENGTH_FRONT_EYE_PREPELVIC', 'LENGTH_LM_FORK', 'LENGTH_PRE_SUPRA_CAUDAL', 'LENGTH_CLEITHRUM_KEEL', 'LENGTH_LM_FORK_CURVE', 'LENGTH_PECTORAL_FORK_CURVE', 'LENGTH_FORK_CURVE', 'STD_STRAIGTH_LENGTH', 'STD_CURVE_LENGTH', 'SEGMENT_LENGTH', 'LENGTH_MINIMUM_ALLOWED', 'LENGTH', 'LENGTH_TOTAL', 'LENGTH_STANDARD', 'LENGTH_PREANAL', 'LENGTH_PELVIC', 'LENGTH_CARAPACE', 'LENGTH_FORK', 'LENGTH_MANTLE'];
      let sizePmfmStrategy = (data.pmfmStrategies || []).filter(p => p.pmfm && p.pmfm.parameter && sizeValues.includes(p.pmfm.parameter.label));
      if (sizePmfmStrategy)
      {
    //     let sizePmfm = sizePmfmStrategy.map(pmfmStrategy =>  {return pmfmStrategy.pmfm;});
    //     sizePmfmsControl.patchValue(sizePmfm);
        // this.sizePmfmStrategiesTable.value = sizePmfmStrategy || [];
      }

      // SEX

      const pmfmStrategiesControl = this.pmfmStrategiesForm;
      this.pmfmStrategiesHelper.resize(6);

      let age = data.pmfmStrategies.filter(p => p.pmfm && p.pmfm.parameter && p.pmfm.parameter.label ===  "AGE");
      let sex = data.pmfmStrategies.filter(p => p.pmfm && p.pmfm.parameter && p.pmfm.parameter.label ===  "SEX");


      // MATURITY PMFMS
    //   const maturityPmfmsControl = this.form.get("maturityPmfmStrategies");
      const maturityValues = ['MATURITY_STAGE_3_VISUAL', 'MATURITY_STAGE_4_VISUAL', 'MATURITY_STAGE_5_VISUAL', 'MATURITY_STAGE_6_VISUAL', 'MATURITY_STAGE_7_VISUAL', 'MATURITY_STAGE_9_VISUAL'];
      let maturityPmfmStrategy = (data.pmfmStrategies || []).filter(p => p.pmfm && p.pmfm.parameter && maturityValues.includes(p.pmfm.parameter.label));
      if (maturityPmfmStrategy)
      {
    //     let maturityPmfm = maturityPmfmStrategy.map(pmfmStrategy =>  {return pmfmStrategy.pmfm;});
    //     maturityPmfmsControl.patchValue(maturityPmfm);
        // this.maturityPmfmStrategiesTable.value = maturityPmfmStrategy || [];
      }

    // let pmfmStrategies = [ sex ? true : false, age ? true : false, weightPmfmStrategy, sizePmfmStrategy, maturityPmfmStrategy];
    let pmfmStrategies : any[] = [ sex ? true : false, age ? true : false];




        // CALCIFIED TYPES
      // const calcifiedTypesControl = this.calcifiedTypesForm;
      // let calcifiedTypesPmfmStrategy = (data.pmfmStrategies || []).filter(p => p.fractionId && !p.pmfm);

    // return {
    //   id: pmfmStrategy.fractionId,
    //   entityName: "Fraction",
    //   __typename: "ReferentialVO" || undefined
    // };
    pmfmStrategies.push(null);
    pmfmStrategies.push(null);
    pmfmStrategies.push(null);



      let calcifiedTypesPmfmStrategy = (data.pmfmStrategies || []).filter(p => p.fractionId && !p.pmfm);
      if (calcifiedTypesPmfmStrategy)
      {
        calcifiedTypesPmfmStrategy.forEach(pmfmStrategy => {
          pmfmStrategies.push({
            id:pmfmStrategy.fractionId,
            label:null,
            name:null,
            rankOrder:null
          })
        });
        // calcifiedTypesPmfmStrategy.map(pmfmStrategy =>  {
        //   return new ReferentialRef ({
        //     id:pmfmStrategy.fractionId,
        //     label:null, name:null,rankOrder:null}
        //     );
        // });

    //     // Not initialiezd since loadCalcifiedTypes ares loaded asynchronously
    //     //this._calcifiedTypeSubject.getValue();
    //     // @ts-ignore
    //     //for (let item of this._calcifiedTypeSubject.asObservable())
    //     //{
    //     //  item.toString();
    //    // }
        // this.calcifiedTypeHelper.resize(Math.max(1, calcifiedTypesPmfmStrategy.length));
        // calcifiedTypesControl.patchValue(calcifiedTypesFractionRefIds);
      }

      pmfmStrategiesControl.patchValue(pmfmStrategies);


    console.debug(data.entityName);
  }

  // save button
  save(){
    console.log("save work");

    console.log(this.form.get("comments"));

    /* console.log("comment : "+this.form.get("comment").value);*/
  }

  cancel(){
    console.log("cancel works");
  }

  add(){
    console.log("add works");
  }

  close(){
    console.log("close works");
  }

  // TaxonName Helper -----------------------------------------------------------------------------------------------
  protected initTaxonNameHelper() {
    // appliedStrategies => appliedStrategies.location ?
      this.taxonNameHelper = new FormArrayHelper<ReferentialRef>(
        FormArrayHelper.getOrCreateArray(this.formBuilder, this.form, 'taxonNames'),
        (taxonName) => this.formBuilder.control(taxonName && taxonName.name || null, [Validators.required, SharedValidators.entity]),
        ReferentialUtils.equals,
        ReferentialUtils.isEmpty,
        {
          allowEmptyArray: false
        }
      );
      // Create at least one fishing Area
      if (this.taxonNameHelper.size() === 0) {
        this.taxonNameHelper.resize(1);
      }
    }

  // pmfmStrategies Helper -----------------------------------------------------------------------------------------------
  protected initPmfmStrategiesHelper() {
  // appliedStrategies => appliedStrategies.location ?
    this.pmfmStrategiesHelper = new FormArrayHelper<PmfmStrategy>(
      FormArrayHelper.getOrCreateArray(this.formBuilder, this.form, 'pmfmStrategies'),
      (pmfmStrategy) => this.formBuilder.control(pmfmStrategy || null, [Validators.required]),
      ReferentialUtils.equals,
      ReferentialUtils.isEmpty,
      {
        allowEmptyArray: false
      }
    );
    // Create at least one fishing Area
    if (this.pmfmStrategiesHelper.size() === 0) {
      this.pmfmStrategiesHelper.resize(6);
    }
  }

  addPmfmStrategies() {
    this.pmfmStrategiesHelper.add();
    if (!this.mobile) {
      this.pmfmStrategiesFocusIndex = this.pmfmStrategiesHelper.size() - 1;
    }
  }

  // appliedStrategies Helper -----------------------------------------------------------------------------------------------
  protected initAppliedStrategiesHelper() {
    // appliedStrategiesHelper formControl can't have common validator since quarters efforts are optional
    this.appliedStrategiesHelper = new FormArrayHelper<AppliedStrategy>(
      FormArrayHelper.getOrCreateArray(this.formBuilder, this.form, 'appliedStrategies'),
      (appliedStrategy) => this.formBuilder.control(appliedStrategy || null),
      ReferentialUtils.equals,
      ReferentialUtils.isEmpty,
      {
        allowEmptyArray: false
      }
    );
    // Create at least one fishing Area
    if (this.appliedStrategiesHelper.size() === 0) {
      this.appliedStrategiesHelper.resize(7);
    }
  }
  addFishingArea() {
    this.appliedStrategiesHelper.add();
    if (!this.mobile) {
      this.fishingAreaFocusIndex = this.appliedStrategiesHelper.size() - 1 -4;
    }
  }


  // fishingArea Helper -----------------------------------------------------------------------------------------------
  // protected initFishingAreaHelper() {
  //   // appliedStrategies => appliedStrategies.location ?
  //     this.fishingAreaHelper = new FormArrayHelper<ReferentialRef>(
  //       FormArrayHelper.getOrCreateArray(this.formBuilder, this.form, 'appliedStrategies'),
  //       (fishingArea) => this.formBuilder.control(fishingArea || null, [Validators.required, SharedValidators.entity]),
  //       ReferentialUtils.equals,
  //       ReferentialUtils.isEmpty,
  //       {
  //         allowEmptyArray: false
  //       }
  //     );
  //     // Create at least one fishing Area
  //     if (this.fishingAreaHelper.size() === 0) {
  //       this.fishingAreaHelper.resize(1);
  //     }
  //   }
  //   addFishingArea() {
  //     this.fishingAreaHelper.add();
  //     if (!this.mobile) {
  //       this.fishingAreaFocusIndex = this.fishingAreaHelper.size() - 1;
  //     }
  //   }

  // Laboratory Helper -----------------------------------------------------------------------------------------------
  protected initLaboratoryHelper() {
    this.laboratoryHelper = new FormArrayHelper<ReferentialRef>(
      FormArrayHelper.getOrCreateArray(this.formBuilder, this.form, 'strategyDepartments'),
      (laboratory) => this.formBuilder.control(laboratory || null, [Validators.required, SharedValidators.entity]),
      ReferentialUtils.equals,
      ReferentialUtils.isEmpty,
      {
        allowEmptyArray: false
      }
    );
    // Create at least one laboratory
    if (this.laboratoryHelper.size() === 0) {
      this.laboratoryHelper.resize(1);
    }
  }
  addLaboratory() {
    this.laboratoryHelper.add();
    if (!this.mobile) {
      this.laboratoryFocusIndex = this.laboratoryHelper.size() - 1;
    }
  }
  // CalcifiedTypeHelper -----------------------------------------------------------------------------------------------

  // protected initCalcifiedTypeHelper() {
  //   this.calcifiedTypeHelper = new FormArrayHelper<ReferentialRef>(
  //     FormArrayHelper.getOrCreateArray(this.formBuilder, this.form, 'calcifiedTypes'),
  //     (calcifiedType) => this.formBuilder.control(calcifiedType || null, [Validators.required, SharedValidators.entity]),
  //     ReferentialUtils.equals,
  //     ReferentialUtils.isEmpty,
  //     {
  //       allowEmptyArray: false
  //     }
  //   );
  //   // Create at least one calcifiedType
  //   if (this.calcifiedTypeHelper.size() === 0) {
  //     this.calcifiedTypeHelper.resize(1);
  //   }
  // }
  // addCalcifiedType() {
  //   this.calcifiedTypeHelper.add();
  //   if (!this.mobile) {
  //     this.calcifiedTypeFocusIndex = this.calcifiedTypeHelper.size() - 1;
  //   }
  // }

  // Calcified Type ---------------------------------------------------------------------------------------------
  protected async loadCalcifiedType() {
    // const calcifiedTypeControl = this.form.get('calcifiedTypes');
    // calcifiedTypeControl.enable();
    // // Refresh filtred departments
    // if (this.enableCalcifiedTypeFilter) {
    //   const allcalcifiedTypes = await this.loadFilteredCalcifiedTypesMethod();
    //   this._calcifiedTypeSubject.next(allcalcifiedTypes);
    // } else {
    //   // TODO Refresh filtred departments
    //   const filtredCalcifiedTypes = await this.loadCalcifiedTypesMethod();
    //   this._calcifiedTypeSubject.next(filtredCalcifiedTypes);
    // }
  }
  // Load CalcifiedTypes Service
  protected async loadCalcifiedTypesMethod(): Promise<ReferentialRef[]> {
    const res = await this.referentialRefService.loadAll(0, 200, null,null,
      {
        entityName: 'Fraction',
        searchAttribute: "description",
        searchText: "individu"
      });
    return res.data;
  }

  //TODO : Load filtred CalcifiedTypes Service : another service to implement
  protected async loadFilteredCalcifiedTypesMethod(): Promise<ReferentialRef[]> {
    const res = await this.referentialRefService.loadAll(0, 1, null,null,
      {
        entityName: 'Fraction',
        searchAttribute: "description",
        searchText: "individu"
      });
    return res.data;
  }
  // EOTP  ---------------------------------------------------------------------------------------------------

  protected async loadEotps() {
    const res = await this.strategyService.LoadAllAnalyticReferencesQuery(0, 200, null, null, null);
    this._eotpSubject.next(res);
  }

  protected markForCheck() {
    if (this.cd) this.cd.markForCheck();
  }

}
