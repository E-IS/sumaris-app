import {HttpClient} from "@angular/common/http";
import {environment} from "../../../environments/environment";
import {TranslateHttpLoader} from "@ngx-translate/http-loader";

// deprecated because of static environment
export class HttpTranslateLoaderFactory {

  static build(http: HttpClient) {
    if (environment.production) {
      // This is need to force a reload, after an app update
      return new TranslateHttpLoader(http, './assets/i18n/', `-${environment.version}.json`);
    }
    return new TranslateHttpLoader(http, './assets/i18n/', `.json`);
  }

}
