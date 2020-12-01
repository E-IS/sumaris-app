import "./vendor";

import {APP_BASE_HREF} from "@angular/common";
import {BrowserModule, HAMMER_GESTURE_CONFIG, HammerModule} from "@angular/platform-browser";
import {CUSTOM_ELEMENTS_SCHEMA, NgModule, SecurityContext} from "@angular/core";
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from "@angular/material/core";
import {DATE_ISO_PATTERN} from "./core/constants";
import {MomentDateAdapter} from '@angular/material-moment-adapter';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {Keyboard} from '@ionic-native/keyboard/ngx';
import {NativeAudio} from "@ionic-native/native-audio/ngx";
import {Vibration} from '@ionic-native/vibration/ngx';
// App modules
import {AppComponent} from "./app.component";
import {AppRoutingModule} from "./app-routing.module";
import {CoreModule} from "./core/core.module";
import {environment} from "../environments/environment";
import {HttpClient, HttpClientModule} from "@angular/common/http";
import {Camera} from "@ionic-native/camera/ngx";
import {Network} from "@ionic-native/network/ngx";
import {AudioManagement} from "@ionic-native/audio-management/ngx";
import {APP_LOCAL_SETTINGS_OPTIONS} from "./core/services/local-settings.service";
import {LocalSettings} from "./core/services/model/settings.model";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {APP_CONFIG_OPTIONS} from "./core/services/config.service";
import {TripConfigOptions} from "./trip/services/config/trip.config";
import {IonicStorageModule} from "@ionic/storage";
import {InAppBrowser} from "@ionic-native/in-app-browser/ngx";
import {APP_MENU_ITEMS} from "./core/menu/menu.component";
import {APP_HOME_BUTTONS} from "./core/home/home";
import {ConfigOptions} from "./core/services/config/core.config";
import {APP_TESTING_PAGES, TestingPage} from "./shared/material/testing/material.testing.page";
import {IonicModule} from "@ionic/angular";
import {CacheModule} from "ionic-cache";
import {TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {SharedModule} from "./shared/shared.module";
import {HttpTranslateLoaderFactory} from "./shared/translate/http-translate-loader-factory";
import {MarkdownModule, MarkedOptions} from "ngx-markdown";
import {EntitiesStorageTypePolicies, APP_LOCAL_STORAGE_TYPE_POLICIES} from "./core/services/storage/entities-storage.service";
import {OperationService} from "./trip/services/operation.service";
import {AppGestureConfig} from "./shared/gesture/gesture-config";
import {TypePolicies} from "@apollo/client/core";
import {APP_GRAPHQL_TYPE_POLICIES} from "./core/graphql/graphql.service";
import {SocialModule} from "./social/social.module";


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    IonicModule.forRoot(),
    CacheModule.forRoot(),
    IonicStorageModule.forRoot({
      name: 'sumaris', // default
      ...environment.storage
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpTranslateLoaderFactory,
        deps: [HttpClient]
      }
    }),
    MarkdownModule.forRoot({
      loader: HttpClient, // Allow to load using [src]
      sanitize: SecurityContext.NONE,
      markedOptions: {
        provide: MarkedOptions,
        useValue: {
          gfm: true,
          breaks: false,
          pedantic: false,
          smartLists: true,
          smartypants: false,
        },
      }
    }),

    // functional modules
    CoreModule.forRoot(),
    SharedModule.forRoot(),
    SocialModule.forRoot(),
    HammerModule,
    AppRoutingModule
  ],
  providers: [
    StatusBar,
    SplashScreen,
    Keyboard,
    Camera,
    Network,
    NativeAudio,
    Vibration,
    InAppBrowser,
    AudioManagement,

    {provide: APP_BASE_HREF, useValue: (environment.baseUrl || '/')},
    //{ provide: ErrorHandler, useClass: IonicErrorHandler },
    {provide: MAT_DATE_LOCALE, useValue: 'en'},
    {
      provide: MAT_DATE_FORMATS, useValue: {
        parse: {
          dateInput: DATE_ISO_PATTERN,
        },
        display: {
          dateInput: 'L',
          monthYearLabel: 'MMM YYYY',
          dateA11yLabel: 'LL',
          monthYearA11yLabel: 'MMMM YYYY',
        }
      }
    },
    {provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE, MAT_DATE_FORMATS]},

    // Configure hammer gesture
    {provide: HAMMER_GESTURE_CONFIG, useClass: AppGestureConfig},

    { provide: APP_LOCAL_SETTINGS_OPTIONS, useValue: {
        pageHistoryMaxSize: 3
      } as LocalSettings
    },

    // Config options (Core + trip)
    { provide: APP_CONFIG_OPTIONS, useValue: {...ConfigOptions, ...TripConfigOptions}},

    // Menu items
    { provide: APP_MENU_ITEMS, useValue: [
        {title: 'MENU.HOME', path: '/', icon: 'home'},

        // Data entry
        {title: 'MENU.DATA_ENTRY_DIVIDER', profile: 'USER'},
        {title: 'MENU.TRIPS', path: '/trips',
          matIcon: 'explore',
          profile: 'USER',
          ifProperty: 'sumaris.trip.enable',
          titleProperty: 'sumaris.trip.name'
        },
        {
          title: 'MENU.OBSERVED_LOCATIONS', path: '/observations',
          matIcon: 'verified_user',
          profile: 'USER',
          ifProperty: 'sumaris.observedLocation.enable',
          titleProperty: 'sumaris.observedLocation.name'
        },

        // Data extraction
        {title: 'MENU.DATA_ACCESS_DIVIDER', profile: 'GUEST'},
        {title: 'MENU.DOWNLOADS', path: '/extraction/data', icon: 'cloud-download', profile: 'GUEST'},
        {title: 'MENU.MAP', path: '/extraction/map', icon: 'earth', profile: 'GUEST'},

        // Referential
        {title: 'MENU.REFERENTIAL_DIVIDER', profile: 'USER'},
        {title: 'MENU.VESSELS', path: '/referential/vessels', icon: 'boat', profile: 'USER'},
        {title: 'MENU.REFERENTIAL', path: '/referential', icon: 'list', profile: 'ADMIN'},
        {title: 'MENU.USERS', path: '/admin/users', icon: 'people', profile: 'ADMIN'},
        {title: 'MENU.SERVER', path: '/admin/config', icon: 'server', profile: 'ADMIN'},

        // Settings
        {title: '' /*empty divider*/, cssClass: 'flex-spacer'},
        {title: 'MENU.TESTING', path: '/testing', icon: 'code', color: 'danger', ifProperty: 'sumaris.testing.enable', profile: 'ADMIN'},
        {title: 'MENU.LOCAL_SETTINGS', path: '/settings', icon: 'settings', color: 'medium'},
        {title: 'MENU.ABOUT', action: 'about', matIcon: 'help_outline', color: 'medium', cssClass: 'visible-mobile'},

        // Logout
        {title: 'MENU.LOGOUT', action: 'logout', icon: 'log-out', profile: 'GUEST', color: 'medium hidden-mobile'},
        {title: 'MENU.LOGOUT', action: 'logout', icon: 'log-out', profile: 'GUEST', color: 'danger visible-mobile'}

      ]
    },

    // Home buttons
    { provide: APP_HOME_BUTTONS, useValue: [
        // Data entry
        { title: 'MENU.DATA_ENTRY_DIVIDER', profile: 'USER'},
        { title: 'MENU.TRIPS', path: '/trips',
          matIcon: 'explore',
          profile: 'USER',
          ifProperty: 'sumaris.trip.enable',
          titleProperty: 'sumaris.trip.name'
        },
        { title: 'MENU.OBSERVED_LOCATIONS', path: '/observations',
          matIcon: 'verified_user',
          profile: 'USER',
          ifProperty: 'sumaris.observedLocation.enable',
          titleProperty: 'sumaris.observedLocation.name'
        },
        { title: '' /*empty divider*/, cssClass: 'visible-mobile'}
      ]
    },

    // Entities Apollo cache options
    { provide: APP_GRAPHQL_TYPE_POLICIES, useValue: <TypePolicies>{
        'MetierVO': {
          keyFields: ['entityName', 'id']
        },
        'PmfmVO': {
          keyFields: ['entityName', 'id']
        },
        'TaxonGroupVO': {
          keyFields: ['entityName', 'id']
        },
        'TaxonNameVO': {
          keyFields: ['entityName', 'id']
        },
        'LocationVO': {
          keyFields: ['entityName', 'id']
        },
        'ReferentialVO': {
          keyFields: ['entityName', 'id']
        },
        'MeasurementVO': {
          keyFields: ['entityName', 'id']
        },
        'TaxonGroupStrategyVO': {
          keyFields: ['__typename', 'strategyId', 'taxonGroup', ['entityName', 'id']]
        },
        'TaxonNameStrategyVO': {
          keyFields: ['__typename', 'strategyId', 'taxonName', ['entityName', 'id']]
        }
      }
    },

    // Entities options
    { provide: APP_LOCAL_STORAGE_TYPE_POLICIES, useValue: <EntitiesStorageTypePolicies>{
        'OperationVO': {
          onlyLocalEntities: true,
          storeById: true,
          detailedAttributes: OperationService.LIGHT_EXCLUDED_ATTRIBUTES
        }
      }
    },

    // Test pages link
    { provide: APP_TESTING_PAGES, useValue: <TestingPage[]>[
      {label: 'Batch tree', page: '/testing/trip/batchTree'}
    ]},
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {

  constructor() {
    console.debug('[app] Creating module');
  }
}
