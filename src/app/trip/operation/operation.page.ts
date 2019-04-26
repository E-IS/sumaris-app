import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";
import {OperationService} from '../services/operation.service';
import {OperationForm} from './operation.form';
import {Batch, EntityUtils, Operation, Trip} from '../services/trip.model';
import {TripService} from '../services/trip.service';
import {MeasurementsForm} from '../measurement/measurements.form.component';
import {AccountService, AppFormUtils, AppTabPage, environment} from '../../core/core.module';
import {CatchBatchForm} from '../catch/catch.form';
import {SamplesTable} from '../sample/samples.table';
import {SubSamplesTable} from '../sample/sub-samples.table';
import {AlertController} from "@ionic/angular";
import {TranslateService} from '@ngx-translate/core';
import {AcquisitionLevelCodes, UsageMode} from '../../core/services/model';
import {isNil, isNotNil} from '../../shared/shared.module';
import {PmfmIds, ProgramService, QualitativeLabels} from '../../referential/referential.module';
import {Subject} from 'rxjs';
import {DateFormatPipe} from 'src/app/shared/pipes/date-format.pipe';
import {BatchGroupsTable} from "../batch/batch-groups.table";
import {SubBatchesTable} from "../batch/sub-batches.table";
import {MatTabChangeEvent} from "@angular/material";
import {debounceTime, distinctUntilChanged, filter, first, map, mergeMap, startWith, switchMap} from "rxjs/operators";
import {Validators} from "@angular/forms";
import * as moment from "moment";
import {Moment} from "moment";
import {IndividualMonitoringTable} from "../sample/individualmonitoring/sample-individual-monitoring.table";
import {ProgramProperties} from "../../referential/services/model";

@Component({
  selector: 'page-operation',
  templateUrl: './operation.page.html',
  styleUrls: ['./operation.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationPage extends AppTabPage<Operation, { tripId: number }> implements OnInit {

  protected _enableListenChanges: boolean = false; // FIXME: in pod, add converter on Operation => OperationVO

  title = new Subject<string>();
  trip: Trip;
  programSubject = new Subject<string>();
  saving = false;
  rankOrder: number;
  selectedBatchSamplingTabIndex = 0;
  selectedSurvivalTestTabIndex = 0;

  defaultBackHref: string;
  showBatchSamplingTables = false;
  enableSubBatchSamplingTable = false;
  showSurvivalTestTables = false;
  usageMode: UsageMode;

  @ViewChild('opeForm') opeForm: OperationForm;

  @ViewChild('measurementsForm') measurementsForm: MeasurementsForm;

  @ViewChild('catchBatchForm') catchBatchForm: CatchBatchForm;

  @ViewChild('survivalTestsTable') survivalTestsTable: SamplesTable;

  @ViewChild('individualMonitoringTable') individualMonitoringTable: IndividualMonitoringTable;

  @ViewChild('individualReleaseTable') individualReleaseTable: SubSamplesTable;

  @ViewChild('batchGroupsTable') batchGroupsTable: BatchGroupsTable;

  @ViewChild('subBatchesTable') subBatchesTable: SubBatchesTable;


  constructor(
    route: ActivatedRoute,
    router: Router,
    alterCtrl: AlertController,
    translate: TranslateService,
    protected dateFormat: DateFormatPipe,
    protected accountService: AccountService,
    protected operationService: OperationService,
    protected tripService: TripService,
    protected programService: ProgramService,
    protected cd: ChangeDetectorRef
  ) {
    super(route, router, alterCtrl, translate);

    // Listen route parameters
    this.route.queryParams
      .pipe(
        first()
      )
      .subscribe(res => {
        const subTabIndex = +res["sub-tab"];
        if (isNotNil(subTabIndex)) {
          this.selectedBatchSamplingTabIndex = subTabIndex > 1 ? 1 : subTabIndex;
          this.selectedSurvivalTestTabIndex = subTabIndex;
        } else {
          this.selectedBatchSamplingTabIndex = 0;
          this.selectedSurvivalTestTabIndex = 0;
        }
      });

    // FOR DEV ONLY ----
    this.debug = !environment.production;
  }

  ngOnInit() {
    super.ngOnInit();

    // Register sub forms & table
    this.registerForms([this.opeForm, this.measurementsForm, this.catchBatchForm])
      .registerTables([
        this.survivalTestsTable,
        this.individualMonitoringTable,
        this.individualReleaseTable,
        this.batchGroupsTable,
        this.subBatchesTable
      ]);

    // Disable, during load
    this.disable();

    // Read route
    this.route.params.first().subscribe(res => {
      const tripId = res && res["tripId"];
      const id = res && res["opeId"];
      if (!id || id === "new") {
        this.load(undefined, {tripId: tripId});
      } else {
        this.load(parseInt(id), {tripId: tripId});
      }
    });

    this.registerSubscription(
      this.opeForm.form.controls['physicalGear'].valueChanges.subscribe((res) => {
        if (this.loading) return; // SKip during loading
        this.catchBatchForm.gear = res && res.gear && res.gear.label || null;
      })
    );

    // Update available parent on sub-sample table, when samples changes
    this.registerSubscription(
      this.survivalTestsTable.listChange
        .pipe(debounceTime(400))
        .subscribe(samples => {
          if (this.loading) return; // skip during loading
          const availableParents = (samples || [])
            .filter(s => !!s.measurementValues[PmfmIds.TAG_ID]);
          // Will refresh the tables (inside the setter):
          this.individualMonitoringTable.availableParents = availableParents;
          this.individualReleaseTable.availableParents = availableParents;
        }));

    // Update available parent on individual batch table, when batch group changes
    this.registerSubscription(
      this.batchGroupsTable.listChange
        .pipe(debounceTime(400))
        .subscribe(batchGroups => {
          if (this.loading || !this.enableSubBatchSamplingTable) return; // skip during loading
          // Will refresh the tables (inside the setter):
          this.subBatchesTable.availableParents = (batchGroups || []);
        })
    );

    // Enable sub batches when having pmfmf
    this.subBatchesTable.pmfms
      .pipe(
        filter(isNotNil),
        first()
      )
      .subscribe(pmfms => {
        if (!this.enableSubBatchSamplingTable && pmfms.length > 0) {
          this.enableSubBatchSamplingTable = true;
          this.markForCheck();
        }
      });

    this.ngInitExtension();
  }

  async load(id?: number, options?: { tripId: number }) {
    this.error = null;

    // New operation
    if (isNil(id)) {
      if (this.debug) console.debug("[page-operation] Creating new operation...");

      if (!options || isNil(options.tripId)) throw new Error("Missing argument 'options.tripId'!");

      const trip = await this.tripService.load(options.tripId);

      this.usageMode = this.computeUsageMode(trip);

      const data = new Operation();

      // If is on field mode, fill default values
      if (this.usageMode) {
        data.startDateTime = moment();
      }

      // Use the default gear, if only one
      if (trip.gears.length == 1) {
        data.physicalGear = Object.assign({}, trip.gears[0]);
      }

      await this.updateView(data, trip);
      this.loading = false;
    }

    // Load existing operation
    else {
      if (this.debug) console.debug(`[page-operation] Loading operation with id {${id}}...`);

      const data = await this.operationService.load(id);
      if (!data || !data.tripId) {
        console.error(`[page-operation] Unable to load operation with id {${id}}`);
        this.error = "TRIP.OPERATION.ERROR.LOAD_OPERATION_ERROR";
        this.loading = false;
        return;
      }

      if (this.debug) console.debug("[page-operation] Operation loaded", data);

      const trip = await this.tripService.load(data.tripId);
      this.usageMode = this.computeUsageMode(trip);

      await this.updateView(data, trip);
      this.loading = false;
      this.startListenChanges();
    }
  }

  startListenChanges() {
    if (this._enableListenChanges) {

      const subscription = this.operationService.listenChanges(this.data.id)
        .subscribe((data: Operation | undefined) => {
          const newUpdateDate = data && (data.updateDate as Moment) || undefined;
          if (isNotNil(newUpdateDate) && newUpdateDate.isAfter(this.data.updateDate)) {
            if (this.debug) console.debug("[operation] Detected update on server", newUpdateDate);
            if (!this.dirty) {
              this.updateView(data, this.trip);
            }
          }
        });

      // Add log when closing
      if (this.debug) subscription.add(() => console.debug('[operation] [WS] Stop to listen changes'));

      this.registerSubscription(subscription);
    }
  }

  async updateView(data: Operation | null, trip?: Trip) {
    this.data = data;
    this.opeForm.value = data;

    if (trip) {
      this.trip = trip;
      this.opeForm.trip = trip;

      // Set program
      const program = trip && trip.program && trip.program.label;
      this.programSubject.next(program);

      this.batchGroupsTable.program = program;
      this.subBatchesTable.program = program;
    }

    const gearLabel = data && data.physicalGear && data.physicalGear.gear && data.physicalGear.gear.label;

    // Get all batches (and children), and samples
    const batches = (data && data.catchBatch && data.catchBatch.children) || [];
    const samples = (data && data.samples || []).reduce((res, sample) => !sample.children ? res.concat(sample) : res.concat(sample).concat(sample.children), [])

    // Set measurements
    this.measurementsForm.gear = gearLabel;
    this.measurementsForm.value = data && data.measurements || [];
    this.measurementsForm.updateControls();

    // Set catch batch
    this.catchBatchForm.gear = gearLabel;
    this.catchBatchForm.value = data && data.catchBatch || Batch.fromObject({
      rankOrder: 1,
      label: AcquisitionLevelCodes.CATCH_BATCH
    });

    // Set survival tests
    const survivalTestSamples = samples.filter(s => s.label && s.label.startsWith(this.survivalTestsTable.acquisitionLevel + "#"));
    this.survivalTestsTable.value = survivalTestSamples;

    // Set individual monitoring
    this.individualMonitoringTable.availableParents = survivalTestSamples.filter(s => s.measurementValues && isNotNil(s.measurementValues[PmfmIds.TAG_ID]));
    this.individualMonitoringTable.value = samples.filter(s => s.label && s.label.startsWith(this.individualMonitoringTable.acquisitionLevel + "#"));

    // Set individual release tables
    this.individualReleaseTable.availableParents = this.individualMonitoringTable.availableParents;
    this.individualReleaseTable.value = samples.filter(s => s.label && s.label.startsWith(this.individualReleaseTable.acquisitionLevel + "#"));

    // Set sampling batch tables (if exists)
    const batchGroups = batches.filter(s => s.label && s.label.startsWith(this.batchGroupsTable.acquisitionLevel + "#"));

    this.batchGroupsTable.pmfms
      .pipe(
        filter(isNotNil),
        first()
      )
      .subscribe(() => {
        const qvPmfm = this.batchGroupsTable.qvPmfm;
        this.subBatchesTable.availableParents = batchGroups;
        this.subBatchesTable.value = batchGroups.reduce((res, group) => {
          if (qvPmfm) {
            return res.concat(group.children.reduce((res, qvBatch) => {
              const children = this.getBatchChildrenByLevel(qvBatch, this.subBatchesTable.acquisitionLevel);
              return res.concat(children
                .map(child => {
                  // Copy QV value from the group
                  child.measurementValues = child.measurementValues || {};
                  child.measurementValues[qvPmfm.pmfmId] = qvBatch.measurementValues[qvPmfm.pmfmId];
                  // Replace parent by the group (instead of the sampling batch)
                  child.parentId = group.id;
                  return child;
                }));
            }, []));
          } else {
            return res.concat(this.getBatchChildrenByLevel(group, this.subBatchesTable.acquisitionLevel)
              .map(child => {
                // Replace parent by the group (instead of the sampling batch)
                child.parentId = group.id;
                return child;
              }));
          }
        }, []);
      });

    this.batchGroupsTable.value = batchGroups;

    // Update title
    await this.updateTitle();

    // Compute the default back href
    this.defaultBackHref = `/trips/${data.tripId}?tab=2`;

    this.markAsPristine();
    this.markAsUntouched();

    if (!this.trip || isNotNil(this.trip.validationDate)) {
      this.disable();
    } else {
      this.enable();
    }

    this.markForCheck();

  }

  /**
   * Configure specific behavior
   */
  protected ngInitExtension() {
    if (this.measurementsForm) {
      this.measurementsForm.pmfms
        .pipe(
          filter(isNotNil),
          debounceTime(400),
          first(),
          map(() => this.measurementsForm.form)
        )
        .subscribe((formGroup) => {

          // If PMFM "Sampling type" exists (e.g. SUMARiS), then use to enable/disable some tables
          const samplingTypeControl = formGroup && formGroup.controls[PmfmIds.SURVIVAL_SAMPLING_TYPE];
          if (isNotNil(samplingTypeControl)) {
            this.registerSubscription(
              samplingTypeControl.valueChanges
                .pipe(
                  debounceTime(400),
                  startWith(samplingTypeControl.value),
                  filter(EntityUtils.isNotEmpty),
                  map(value => value.label),
                  distinctUntilChanged()
                )
                .subscribe(qvLabel => {
                  // Force first tab index
                  this.selectedBatchSamplingTabIndex = 0;
                  this.selectedSurvivalTestTabIndex = 0;

                  switch (qvLabel as string) {
                    case QualitativeLabels.SURVIVAL_SAMPLING_TYPE.SURVIVAL:
                      if (this.debug) console.debug("[operation] Enable survival test tables");
                      this.showSurvivalTestTables = true;
                      this.showBatchSamplingTables = false;
                      break;
                    case QualitativeLabels.SURVIVAL_SAMPLING_TYPE.CATCH_HAUL:
                      if (this.debug) console.debug("[operation] Enable batch sampling tables");
                      this.showSurvivalTestTables = false;
                      this.showBatchSamplingTables = true;
                      break;
                    case QualitativeLabels.SURVIVAL_SAMPLING_TYPE.UNSAMPLED:
                      if (this.debug) console.debug("[operation] Disable survival test and batch sampling tables");
                      this.showSurvivalTestTables = false;
                      this.showBatchSamplingTables = false;
                  }
                  this.markForCheck();
                })
            );
          }

          // If PMFM "Is Sampling ?" exists, then use to enable/disable some tables
          const isSamplingControl = formGroup && formGroup.controls[PmfmIds.IS_SAMPLING];
          if (isNotNil(isSamplingControl)) {
            this.registerSubscription(
              isSamplingControl.valueChanges
                .pipe(
                  debounceTime(400),
                  startWith(isSamplingControl.value),
                  filter(isNotNil),
                  distinctUntilChanged()
                )
                .subscribe(isSampling => {
                  // Force first tab index
                  this.selectedBatchSamplingTabIndex = 0;
                  this.selectedSurvivalTestTabIndex = 0;
                  if (this.debug) console.debug("[operation] Detected PMFM changes value for IS_SAMPLING: ", isSampling);

                  if (isSampling) {
                    if (this.debug) console.debug("[operation] Enable batch sampling tables");
                    this.showSurvivalTestTables = false;
                    this.showBatchSamplingTables = true;
                  } else {
                    if (this.debug) console.debug("[operation] Disable batch sampling tables");
                    this.showSurvivalTestTables = false;
                    this.showBatchSamplingTables = false;
                  }
                  this.markForCheck();
                })
            );
          }

          // Default
          if (isNil(samplingTypeControl) && isNil(isSamplingControl)) {
            if (this.debug) console.debug("[operation] Enable default tables (Nor SUMARiS nor ADAP pmfms were found)");
            this.showSurvivalTestTables = false;
            this.showBatchSamplingTables = true;
          }

          // Abnormal trip => Set comment as required
          const tripProgressControl = formGroup && formGroup.controls[PmfmIds.TRIP_PROGRESS];
          if (isNotNil(samplingTypeControl)) {
            this.registerSubscription(
              tripProgressControl.valueChanges
                .debounceTime(400)
                .pipe(
                  startWith(tripProgressControl.value),
                  filter(isNotNil),
                  distinctUntilChanged()
                )
                .subscribe(value => {
                  if (!value) {
                    this.opeForm.form.controls['comments'].setValidators(Validators.required);
                    this.opeForm.form.controls['comments'].markAsTouched({onlySelf: true});
                  } else {
                    this.opeForm.form.controls['comments'].setValidators([]);
                  }
                  this.opeForm.form.controls['comments'].updateValueAndValidity({emitEvent: false});
                })
            );
          }

        });
    }

    this.registerSubscription(
      this.programSubject.asObservable()
        .pipe(mergeMap(label => {
          return this.programService.watchByLabel(label);
        })) // Watch program
        //.pipe(mergeMap(this.programService.loadByLabel)) // Load program
        .subscribe(program => {
          if (this.debug) console.debug(`[operation] Program ${program.label} loaded, with properties: `, program.properties);
          // Configure batch columns
          if (this.batchGroupsTable) {
            this.batchGroupsTable.showTaxonNameColumn = program.getPropertyAsBoolean(ProgramProperties.BATCH_TAXON_NAME_ENABLE);
            this.batchGroupsTable.showTaxonGroupColumn = program.getPropertyAsBoolean(ProgramProperties.BATCH_TAXON_GROUP_ENABLE);
          }
          if (this.subBatchesTable) {
            //this.subBatchesTable.showTaxonNameColumn = program.getPropertyAsBoolean(ProgramProperties.BATCH_TAXON_NAME_ENABLE);
            //this.subBatchesTable.showTaxonGroupColumn = program.getPropertyAsBoolean(ProgramProperties.BATCH_TAXON_GROUP_ENABLE);
          }

          if (this.survivalTestsTable) {
            //this.survivalTestsTable.showTaxonNameColumn = enableBatchTaxonName;
            //this.survivalTestsTable.showTaxonGroupColumn = enableBatchTaxonGroup;
          }
        })
    );

  }

  async save(event): Promise<any> {
    if (this.loading || this.saving) return;

    // Not valid
    if (!this.valid) {
      this.markAsTouched();

      this.logFormErrors();

      this.openFirstInvalidTab();

      this.submitted = true;
      return;
    }

    if (this.loading || this.saving || !this.valid || !this.dirty) return;
    this.saving = true;
    this.error = undefined;

    if (this.debug) console.debug("[page-operation] Saving...");

    // Update entity from JSON
    let json = this.opeForm.value;
    json.measurements = this.measurementsForm.value;
    this.data.fromObject(json);
    this.data.tripId = this.trip.id;

    // get catch batch
    this.data.catchBatch = this.catchBatchForm.value;

    // save survival tables
    if (this.showSurvivalTestTables) {
      await this.survivalTestsTable.save();
      await this.individualMonitoringTable.save();
      await this.individualReleaseTable.save();
      // get sub-samples, from tables
      const subSamples = (this.individualMonitoringTable.value || [])
        .concat(this.individualReleaseTable.value || []);
      this.data.samples = (this.survivalTestsTable.value || [])
        .map(sample => {
          // Add children
          sample.children = subSamples.filter(childSample => childSample.parent && sample.equals(childSample.parent));
          return sample;
        });
    } else {
      this.data.samples = undefined;
    }

    // Save batch sampling tables
    if (this.showBatchSamplingTables) {
      await this.batchGroupsTable.save();
      await this.subBatchesTable.save();

      // get batches
      const batchGroups = (this.batchGroupsTable.value || []);

      const subBatches = (this.subBatchesTable.value || []);
      const qvPmfm = this.batchGroupsTable.qvPmfm;
      batchGroups.forEach(batchGroup => {
        // Add children
        (batchGroup.children || []).forEach(b => {
          const children = subBatches.filter(childBatch => childBatch.parent && batchGroup.equals(childBatch.parent) &&
            (!qvPmfm || (childBatch.measurementValues[qvPmfm.pmfmId] == b.measurementValues[qvPmfm.pmfmId]))
          );
          // If has sampling batch, use it a parent
          if (b.children && b.children.length == 1) b.children[0].children = children;
          else b.children = children;
        });
      });
      this.data.catchBatch.children = batchGroups;
    } else {
      this.data.catchBatch.children = undefined;
    }

    const isNew = this.isNewData();
    this.disable();

    try {

      // Save trip form (with sale)
      const updatedData = await this.operationService.save(this.data);

      // Update the view (e.g metadata)
      await this.updateView(updatedData);

      // Update route location
      if (isNew) {
        this.router.navigate(['../' + updatedData.id], {
          relativeTo: this.route,
          queryParams: this.route.snapshot.queryParams,
          replaceUrl: true // replace the current satte in history
        });

        // Subscription to changes
        //this.startListenChanges();
      }

      this.submitted = false;

      return updatedData;
    } catch (err) {
      console.error(err && err.message || err);
      this.error = err && err.message || err;
      this.submitted = true;
      this.enable();
    } finally {
      this.saving = false;
    }
  }

  // Override default function
  async doReload() {
    this.loading = true;
    await this.load(this.data && this.data.id,
      {tripId: this.trip && this.trip.id});
  }

  /**
   * Compute the title
   * @param data
   */
  async updateTitle(data?: Operation) {
    data = data || this.data;

    // new ope
    let title;
    if (!data || isNil(data.id)) {
      title = await this.translate.get('TRIP.OPERATION.NEW.TITLE').toPromise();
    }
    // Existing ope
    else {
      title = await this.translate.get('TRIP.OPERATION.EDIT.TITLE', {
        vessel: this.trip && this.trip.vesselFeatures && (this.trip.vesselFeatures.exteriorMarking || this.trip.vesselFeatures.name) || '',
        departureDateTime: this.trip && this.trip.departureDateTime && this.dateFormat.transform(this.trip.departureDateTime) as string || '',
        startDateTime: data.startDateTime && this.dateFormat.transform(data.startDateTime, {time: true}) as string
      }).toPromise();
    }

    // Emit the title
    this.title.next(title);

  }


  protected getBatchChildrenByLevel(batch: Batch, acquisitionLevel: string): Batch[] {
    return (batch.children || []).reduce((res, child) => {
      if (child.label && child.label.startsWith(acquisitionLevel + "#")) return res.concat(child);
      return res.concat(this.getBatchChildrenByLevel(child, acquisitionLevel)); // recursive call
    }, []);
  }

  public onBatchSamplingTabChange(event: MatTabChangeEvent) {
    const queryParams: Params = Object.assign({}, this.route.snapshot.queryParams);
    queryParams['sub-tab'] = event.index;
    this.router.navigate(['.'], {
      relativeTo: this.route,
      queryParams: queryParams
    });
    if (!this.loading) {
      // On each tables, confirm editing row
      this.batchGroupsTable.confirmEditCreate();
      this.subBatchesTable.confirmEditCreate();
    }
  }

  public onSurvivalTestTabChange(event: MatTabChangeEvent) {
    const queryParams: Params = Object.assign({}, this.route.snapshot.queryParams);
    queryParams['sub-tab'] = event.index;
    this.router.navigate(['.'], {
      relativeTo: this.route,
      queryParams: queryParams
    });
    if (!this.loading) {
      // On each tables, confirm editing row
      this.survivalTestsTable.confirmEditCreate();
      this.individualMonitoringTable.confirmEditCreate();
      this.individualReleaseTable.confirmEditCreate();
    }
  }

  enable() {
    if (!this.data || !this.trip || isNotNil(this.trip.validationDate)) return false;
    // If not a new trip, check user can write
    if ((this.data.id || this.data.id === 0) && !this.tripService.canUserWrite(this.trip)) {
      if (this.debug) console.warn("[operation] Leave form disable (User has NO write access)");
      return;
    }
    if (this.debug) console.debug("[operation] Enabling form (User has write access)");
    super.enable();
  }

  protected logFormErrors() {
    if (this.debug) console.warn("[page-operation] Validation errors !");
    if (this.opeForm.invalid) {
      AppFormUtils.logFormErrors(this.opeForm.form, "[operation-form]");
    }
    if (this.measurementsForm.invalid) {
      AppFormUtils.logFormErrors(this.measurementsForm.form, "[operation-meas-form]");
    }
    if (this.catchBatchForm.invalid) {
      AppFormUtils.logFormErrors(this.catchBatchForm.form, "[catch-form]");
    }
    if (this.survivalTestsTable.invalid) {
      if (this.survivalTestsTable.editedRow && this.survivalTestsTable.editedRow.editing) {
        AppFormUtils.logFormErrors(this.survivalTestsTable.editedRow.validator, "[survivaltests-table]")
      }
    }
    if (this.individualMonitoringTable.invalid) {
      if (this.individualMonitoringTable.editedRow && this.individualMonitoringTable.editedRow.editing) {
        AppFormUtils.logFormErrors(this.individualMonitoringTable.editedRow.validator, "[monitoring-table]")
      }
    }
    if (this.batchGroupsTable.invalid) {
      if (this.batchGroupsTable.editedRow && this.batchGroupsTable.editedRow.editing) {
        AppFormUtils.logFormErrors(this.batchGroupsTable.editedRow.validator, "[batch-group-table]")
      }
    }
    if (this.subBatchesTable.invalid) {
      if (this.subBatchesTable.editedRow && this.subBatchesTable.editedRow.editing) {
        AppFormUtils.logFormErrors(this.subBatchesTable.editedRow.validator, "[batch-table]")
      }
    }
    if (this.individualReleaseTable.invalid) {
      if (this.individualReleaseTable.editedRow && this.individualReleaseTable.editedRow.editing) {
        AppFormUtils.logFormErrors(this.individualReleaseTable.editedRow.validator, "[release-table]")
      }
    }
  }

  /**
   * Open the first tab that is invalid
   */
  protected openFirstInvalidTab() {
    // tab 0
    const tab0Invalid = this.opeForm.invalid || this.measurementsForm.invalid;
    // tab 1
    const subTab0Invalid = (this.showBatchSamplingTables && this.batchGroupsTable.invalid) || (this.showSurvivalTestTables && this.survivalTestsTable.invalid);
    const subTab1Invalid = (this.showBatchSamplingTables && this.subBatchesTable.invalid) || (this.showSurvivalTestTables && this.individualMonitoringTable.invalid);
    const subTab2Invalid = this.showBatchSamplingTables && this.individualReleaseTable.invalid || false;
    const tab1Invalid = this.catchBatchForm.invalid || subTab0Invalid || subTab1Invalid || subTab2Invalid;

    // Open the first invalid tab
    let invalidTabIndex = tab0Invalid ? 0 : (tab1Invalid ? 1 : this.selectedTabIndex);
    if (this.selectedTabIndex === 0 && !tab0Invalid) {
      this.selectedTabIndex = invalidTabIndex;
    } else if (this.selectedTabIndex === 1 && !tab1Invalid) {
      this.selectedTabIndex = invalidTabIndex;
    }

    // If tab 1, open the invalid sub tab
    if (invalidTabIndex == 1) {
      if (this.showBatchSamplingTables) {
        const invalidSubTabIndex = subTab0Invalid ? 0 : (subTab1Invalid ? 1 : (subTab2Invalid ? 2 : this.selectedBatchSamplingTabIndex));
        if (this.selectedBatchSamplingTabIndex === 0 && !subTab0Invalid) {
          this.selectedBatchSamplingTabIndex = invalidSubTabIndex;
        } else if (this.selectedBatchSamplingTabIndex === 1 && !subTab1Invalid) {
          this.selectedBatchSamplingTabIndex = invalidSubTabIndex;
        } else if (this.selectedBatchSamplingTabIndex === 2 && !subTab2Invalid) {
          this.selectedBatchSamplingTabIndex = invalidSubTabIndex;
        }
      } else if (this.showSurvivalTestTables) {
        const invalidSubTabIndex = subTab0Invalid ? 0 : (subTab1Invalid ? 1 : (subTab2Invalid ? 2 : this.selectedSurvivalTestTabIndex));
        if (this.selectedSurvivalTestTabIndex === 0 && !subTab0Invalid) {
          this.selectedSurvivalTestTabIndex = invalidSubTabIndex;
        } else if (this.selectedSurvivalTestTabIndex === 1 && !subTab1Invalid) {
          this.selectedSurvivalTestTabIndex = invalidSubTabIndex;
        } else if (this.selectedSurvivalTestTabIndex === 2 && !subTab2Invalid) {
          this.selectedSurvivalTestTabIndex = invalidSubTabIndex;
        }
      }
    }
  }

  protected computeUsageMode(trip: Trip): UsageMode {
    return this.accountService.isUsageMode('FIELD')
    && isNotNil(trip && trip.departureDateTime)
    && trip.departureDateTime.diff(moment(), "day") < 15 ? 'FIELD' : 'DESK';
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}
