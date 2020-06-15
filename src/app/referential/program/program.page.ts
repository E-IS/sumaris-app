import {ChangeDetectionStrategy, Component, Injector, OnInit, ViewChild} from "@angular/core";
import {TableElement, ValidatorService} from "angular4-material-table";
import {AbstractControl, FormBuilder, FormGroup} from "@angular/forms";
import {AppEditorPage, EntityUtils, isNil} from "../../core/core.module";
import {Program, ProgramProperties, Strategy} from "../services/model";
import {ProgramService} from "../services/program.service";
import {ReferentialForm} from "../form/referential.form";
import {ProgramValidatorService} from "../services/validator/program.validator";
import {StrategiesTable} from "../strategy/strategies.table";
import {changeCaseToUnderscore, EditorDataServiceLoadOptions, fadeInOutAnimation} from "../../shared/shared.module";
import {AccountService} from "../../core/services/account.service";
import {ReferentialUtils} from "../../core/services/model";
import {AppPropertiesForm} from "../../core/form/properties.form";
import {ReferentialRefService} from "../services/referential-ref.service";
import {ModalController} from "@ionic/angular";
import {FormFieldDefinition, FormFieldDefinitionMap} from "../../shared/form/field.model";
import {StrategyForm} from "../strategy/strategy.form";
import {animate, AnimationEvent, state, style, transition, trigger} from "@angular/animations";
import {debounceTime, filter, first} from "rxjs/operators";
import {firstNotNilPromise} from "../../shared/observables";

export enum AnimationState {
  ENTER = 'enter',
  LEAVE = 'leave'
}

@Component({
  selector: 'app-program',
  templateUrl: 'program.page.html',
  providers: [
    {provide: ValidatorService, useExisting: ProgramValidatorService}
  ],
  animations: [fadeInOutAnimation,
    // Fade in
    trigger('fadeIn', [
      state('*', style({opacity: 0, display: 'none', visibility: 'hidden'})),
      state(AnimationState.ENTER, style({opacity: 1, display: 'inherit', visibility: 'inherit'})),
      state(AnimationState.LEAVE, style({opacity: 0, display: 'none', visibility: 'hidden'})),
      // Modal
      transition(`* => ${AnimationState.ENTER}`, [
        style({display: 'inherit',  visibility: 'inherit', transform: 'translateX(50%)'}),
        animate('0.4s ease-out', style({opacity: 1, transform: 'translateX(0)'}))
      ]),
      transition(`${AnimationState.ENTER} => ${AnimationState.LEAVE}`, [
        animate('0.2s ease-out', style({opacity: 0, transform: 'translateX(50%)'})),
        style({display: 'none',  visibility: 'hidden'})
      ]) ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgramPage extends AppEditorPage<Program> implements OnInit {

  propertyDefinitions = Object.getOwnPropertyNames(ProgramProperties).map(name => ProgramProperties[name]);
  fieldDefinitions: FormFieldDefinitionMap = {};
  form: FormGroup;
  i18nFieldPrefix = 'PROGRAM.';
  strategyFormState: AnimationState;

  @ViewChild('referentialForm', { static: true }) referentialForm: ReferentialForm;
  @ViewChild('propertiesForm', { static: true }) propertiesForm: AppPropertiesForm;
  @ViewChild('strategiesTable', { static: true }) strategiesTable: StrategiesTable;
  @ViewChild('strategyForm', { static: true }) strategyForm: StrategyForm;

  constructor(
    protected injector: Injector,
    protected formBuilder: FormBuilder,
    protected accountService: AccountService,
    protected validatorService: ProgramValidatorService,
    protected programService: ProgramService,
    protected referentialRefService: ReferentialRefService,
    protected modalCtrl: ModalController
  ) {
    super(injector,
      Program,
      programService);
    this.form = validatorService.getFormGroup();

    // default values
    this.defaultBackHref = "/referential/list?entity=Program";
    this._enabled = this.accountService.isAdmin();
    this.tabCount = 4;



    //this.debug = !environment.production;
  }

  ngOnInit() {
    super.ngOnInit();

    // Set entity name (required for referential form validator)
    this.referentialForm.entityName = 'Program';

    // Check label is unique
    this.form.get('label')
      .setAsyncValidators(async (control: AbstractControl) => {
        const label = control.enabled && control.value;
        return label && (await this.programService.existsByLabel(label)) ? {unique: true} : null;
      });

    this.registerFormField('gearClassification', {
      type: 'entity',
      autocomplete: {
        suggestFn: (value, filter) => this.referentialRefService.suggest(value, filter),
        filter: {
          entityName: 'GearClassification'
        }
      }
    });

    this.registerFormField('taxonGroupType', {
      key: 'taxonGroupType',
      type: 'entity',
      autocomplete: {
        suggestFn: (value, filter) => this.referentialRefService.suggest(value, filter),
        filter: {
          entityName: 'TaxonGroupType'
        }
      }
    });

    // Listen start editing strategy
    this.registerSubscription(this.strategiesTable.onStartEditingRow
      .subscribe(row => this.onStartEditStrategy(row)));
    this.registerSubscription(this.strategiesTable.onConfirmEditCreateRow
      .subscribe(row => this.onConfirmEditCreateStrategy(row)));
    this.registerSubscription(this.strategiesTable.onCancelOrDeleteRow
      .subscribe(row => this.onCancelOrDeleteStrategy(row)));
  }


  /* -- protected methods -- */

  async load(id?: number, opts?: EditorDataServiceLoadOptions): Promise<void> {
    // Force the load from network
    return super.load(id, {...opts, fetchPolicy: "network-only"});
  }

  protected registerFormField(fieldName: string, def: Partial<FormFieldDefinition>) {
    const definition = <FormFieldDefinition>{
      key: fieldName,
      label: this.i18nFieldPrefix + changeCaseToUnderscore(fieldName).toUpperCase(),
      ...def
    }
    this.fieldDefinitions[fieldName] = definition;
  }

  protected canUserWrite(data: Program): boolean {
    // TODO : check user is in program managers
    return (this.isNewData && this.accountService.isAdmin())
      || (ReferentialUtils.isNotEmpty(data) && this.accountService.isSupervisor());

  }

  enable() {
    super.enable();

    if (!this.isNewData) {
      this.form.get('label').disable();
    }
  }

  protected registerFormsAndTables() {
    this.registerForms([this.referentialForm, this.propertiesForm, this.strategyForm])
      .registerTables([this.strategiesTable]);
  }

  protected setValue(data: Program) {
    if (!data) return; // Skip

    this.form.patchValue({...data, properties: [], strategies: []}, {emitEvent: false});

    this.propertiesForm.value = EntityUtils.getObjectAsArray(data.properties);

    // strategies
    this.strategiesTable.value = data.strategies && data.strategies.slice() || []; // force update

    this.markAsPristine();
  }

  protected async getJsonValueToSave(): Promise<any> {

    const data = await super.getJsonValueToSave();

    // Re add label, because missing when field disable
    data.label = this.form.get('label').value;
    data.properties = this.propertiesForm.value;

    // Finish edition of strategy
    if (this.strategiesTable.dirty && this.strategiesTable.editedRow) {
      await this.onConfirmEditCreateStrategy(this.strategiesTable.editedRow);
    }

    data.strategies = this.data.strategies;

    return data;
  }

  protected computeTitle(data: Program): Promise<string> {
    // new data
    if (!data || isNil(data.id)) {
      return this.translate.get('PROGRAM.NEW.TITLE').toPromise();
    }

    // Existing data
    return this.translate.get('PROGRAM.EDIT.TITLE', data).toPromise();
  }

  protected getFirstInvalidTabIndex(): number {
    if (this.referentialForm.invalid) return 0;
    if (this.propertiesForm.invalid) return 1;
    if (this.strategiesTable.invalid || this.strategyForm.invalid) return 2;
    return 0;
  }

  protected async onStartEditStrategy(row: TableElement<Strategy>) {
    if (!row) return; // skip

    const strategy = this.getStrategy(row.currentData, false) || new Strategy();
    console.debug("[program] Start editing strategy", strategy);

    if (!row.isValid()) {
      row.validator.valueChanges
        .pipe(
          debounceTime(450),
          filter(() => row.isValid()),
          first()
        )
        .subscribe(() => {
          strategy.fromObject(row.currentData);
          this.showStrategyForm(strategy)
        });
    }
    else {


      this.showStrategyForm(strategy);
    }
  }
  protected async onCancelOrDeleteStrategy(row: TableElement<Strategy>) {
    if (!row) return; // skip

    this.hideStrategyForm();
  }

  protected async onConfirmEditCreateStrategy(row: TableElement<Strategy>) {
    if (!row) return; // skip

    if (this.strategyForm.dirty) {
      const saved = await this.strategyForm.save();
      // TODO if (!saved) { ... }
    }

    const source = row.currentData;
    //const target = this.getStrategy(source, true);
    const target = this.strategyForm.value

    // Update some properties, from the strategies table
    target.label = source.label;
    target.name = source.name;
    target.description = source.description;
    target.statusId = source.statusId;
    target.comments = source.comments;

    console.debug("[program] End editing strategy", target);

    this.hideStrategyForm();
  }

  showStrategyForm(strategy: Strategy) {
    this.strategyForm.program = this.data;
    this.strategyForm.value = strategy;

    if (this.strategyFormState !== AnimationState.ENTER) {
      // Wait 200ms, during form loading, then start animation
      setTimeout(() => {
        this.strategyFormState = AnimationState.ENTER;
        this.markForCheck();
      }, 200);
    }
  }

  hideStrategyForm() {
    if (this.strategyFormState == AnimationState.ENTER) {
      this.strategyFormState = AnimationState.LEAVE;
      this.markForCheck();
    }
  }

  onStrategyAnimationDone(event: AnimationEvent): void {
    if (event.phaseName === 'done') {

      // After enter
      if (event.toState === AnimationState.ENTER) {
        // Enable form
        this.strategyForm.enable();
      }

      // After leave
      else if (event.toState === AnimationState.LEAVE) {

        // Disable form
        this.strategyForm.disable({emitEvent: false});
        this.strategyForm.setValue(Strategy.fromObject({}));
      }
    }
  }

  protected getStrategy(lightStrategy: Strategy|any, createIfNotExists?: boolean) {
    let strategy = Strategy.fromObject(lightStrategy);
    const existingStrategy = this.data.strategies.find(s => ReferentialUtils.equals(s, strategy));
    if (existingStrategy) {

      return existingStrategy;
    }
    if (createIfNotExists) {
      this.data.strategies.push(strategy);
      return strategy;
    }

  }

  protected markForCheck() {
    this.cd.markForCheck();
  }

}

