import { Component, OnInit, Input, OnDestroy } from "@angular/core";
import { Observable } from 'rxjs';
import { mergeMap } from "rxjs/operators";
import { ValidatorService } from "angular4-material-table";
import { AppTableDataSource, AppTable, AccountService } from "../../core/core.module";
import { Referential, Operation, Trip, referentialToString } from "../services/trip.model";
import { ModalController, Platform } from "@ionic/angular";
import { Router, ActivatedRoute } from "@angular/router";
import { Location } from '@angular/common';
import { ReferentialService } from "../../referential/referential.module";
import { OperationService, OperationFilter } from "../services/operation.service";
import { SurvivalTestValidatorService } from "../services/survivaltest.validator";


@Component({
    selector: 'table-survival-tests',
    templateUrl: 'survivaltests.table.html',
    styleUrls: ['survivaltests.table.scss'],
    providers: [
        { provide: ValidatorService, useClass: SurvivalTestValidatorService }
    ]
})
export class SurvivalTestsTable extends AppTable<any, { operationId?: number }> implements OnInit, OnDestroy {


    data: any[];

    set value(data: any[]) {
        if (this.data !== data) {
            this.data = data;
            this.onRefresh.emit();
        }
    }

    get value(): any[] {
        return this.data;
    }

    constructor(
        protected route: ActivatedRoute,
        protected router: Router,
        protected platform: Platform,
        protected location: Location,
        protected modalCtrl: ModalController,
        protected accountService: AccountService,
        protected rowValidatorService: SurvivalTestValidatorService,
        protected operationService: OperationService,
        protected referentialService: ReferentialService
    ) {
        super(route, router, platform, location, modalCtrl, accountService, rowValidatorService,
            null,
            ['select',
                'rankOrder',
                'actions'],
            {} // filter
        );
        this.i18nColumnPrefix = 'TRIP.SURVIVAL_TEST.TABLE.';
        this.autoLoad = false;
        this.inlineEdition = true;
        this.setDatasource(new AppTableDataSource<any, { operationId?: number }>(Operation, this, rowValidatorService))
    };


    ngOnInit() {
        super.ngOnInit();
    }

    loadAll(
        offset: number,
        size: number,
        sortBy?: string,
        sortDirection?: string,
        filter?: any,
        options?: any
    ): Observable<any[]> {
        if (!this.data) return Observable.empty(); // Not initialized
        sortBy = sortBy || 'rankOrder';

        //console.debug("[table-physical-gear] Sorting... ", sortBy, sortDirection);
        const res = this.data.slice(0); // Copy the array
        const after = (!sortDirection || sortDirection === 'asc') ? 1 : -1;
        res.sort((a, b) =>
            a[sortBy] === b[sortBy] ?
                0 : (a[sortBy] > b[sortBy] ?
                    after : (-1 * after)
                )
        );
        return Observable.of(res);
    }

    saveAll(data: any[], options?: any): Promise<any[]> {
        if (!this.data) throw new Error("[table-physical-gears] Could not save table: value not set yet");

        this.data = data;
        return Promise.resolve(this.data);
    }

    deleteAll(dataToRemove: any[], options?: any): Promise<any> {
        console.debug("[table-survival-tests] Remove data", dataToRemove);
        this.data = this.data.filter(item => !dataToRemove.find(g => g === item || g.id === item.id))
        return Promise.resolve();
    }

    referentialToString = referentialToString;
}

