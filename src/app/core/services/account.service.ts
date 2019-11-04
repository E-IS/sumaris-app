import {Injectable} from "@angular/core";
import {base58, CryptoService, KeyPair} from "./crypto.service";
import {
  Account, Department,
  EntityUtils,
  getMainProfile,
  hasUpperOrEqualsProfile, Person,
  Referential,
  StatusIds,
  UsageMode,
  UserProfileLabel,
  UserSettings
} from "./model";
import {BehaviorSubject, Observable, Subject, Subscription} from "rxjs";
import gql from "graphql-tag";
import {Storage} from '@ionic/storage';
import {FetchPolicy} from "apollo-client";

import {toDateISOString} from "../../shared/shared.module";
import {BaseDataService} from "./base.data-service.class";
import {ErrorCodes, ServerErrorCodes} from "./errors";
import {environment} from "../../../environments/environment";
import {GraphqlService} from "./graphql.service";
import {LocalSettingsService} from "./local-settings.service";
import {FormFieldDefinition} from "../../shared/form/field.model";


export declare interface AccountHolder {
  loaded: boolean;
  keypair: KeyPair;
  authToken: string;
  pubkey: string;
  account: Account;
  person: Person;
  department: Department;
  // TODO : use this ?
  mainProfile: String;
}
export interface AuthData {
  username: string;
  password: string;
}
export interface RegisterData extends AuthData {
  account: Account;
}

const TOKEN_STORAGE_KEY = "token";
const PUBKEY_STORAGE_KEY = "pubkey";
const SECKEY_STORAGE_KEY = "seckey";
const ACCOUNT_STORAGE_KEY = "account";

/* ------------------------------------
 * GraphQL queries
 * ------------------------------------*/
export const Fragments = {
  account: gql`
    fragment AccountFragment on AccountVO {
      id
      firstName
      lastName
      email
      pubkey
      avatar
      statusId
      updateDate
      creationDate
      profiles
      settings {
        id
        locale
        latLongFormat
        content
        nonce
        updateDate
        __typename
      }
      department {
        id
        label
        name
        __typename
      }
      __typename
    }
  `
};

// Load account query
const LoadQuery: any = gql`
  query Account($pubkey: String){
    account(pubkey: $pubkey){
      ...AccountFragment
    }
  }
  ${Fragments.account}
`;

// Check email query
const IsEmailExistsQuery: any = gql`
  query IsEmailExists($email: String, $hash: String){
    isEmailExists(email: $email, hash: $hash)
  }
`;
export declare type IsEmailExistsVariables = {
  email: string;
  hash: string;
};

// Save (create or update) account mutation
const SaveMutation: any = gql`
  mutation SaveAccount($account:AccountVOInput){
    saveAccount(account: $account){
      ...AccountFragment
    }
  }
  ${Fragments.account}
`;

// Create account mutation
const CreateMutation: any = gql`
  mutation CreateAccount($account:AccountVOInput){
    createAccount(account: $account){
      ...AccountFragment
    }
  }
  ${Fragments.account}
`;

// Sent confirmation email
const SendConfirmEmailMutation: any = gql`
  mutation sendAccountConfirmationEmail($email:String, $locale:String){
    sendAccountConfirmationEmail(email: $email, locale: $locale)
  }
`;

// Confirm account email
const ConfirmEmailMutation: any = gql`
  mutation confirmAccountEmail($email:String, $code:String){
    confirmAccountEmail(email: $email, code: $code)
  }
`;

// Authentication  query
const AuthQuery: any = gql`
  query Auth($token: String){
    authenticate(token: $token)
  }
`;

// New auth challenge query
const AuthChallengeQuery: any = gql`
  query AuthChallenge{
    authChallenge{
      challenge
      pubkey
      signature
    }
  }
`;

const UpdateSubscription: any = gql`
  subscription updateAccount($pubkey: String, $interval: Int){
    updateAccount(pubkey: $pubkey, interval: $interval) {
      id
      updateDate
    }
  }
`;

@Injectable({providedIn: 'root'})
export class AccountService extends BaseDataService {

  private data: AccountHolder = {
    loaded: false,
    keypair: null,
    authToken: null,
    pubkey: null,
    mainProfile: null,
    account: null,
    person: null,
    department: null
  };

  private _startPromise: Promise<any>;
  private _started = false;
  private _$additionalFields = new BehaviorSubject<FormFieldDefinition[]>([]);

  public onLogin = new Subject<Account>();
  public onLogout = new Subject<any>();
  public onAuthTokenChange = new Subject<string | undefined>();

  get account(): Account {
    return this.data.loaded ? this.data.account : undefined;
  }

  get person(): Person {
    if (this.data.loaded && !this.data.person) {
      this.data.person = this.data.loaded ? this.data.account.asPerson() : undefined;
    }
    return this.data.person;
  }

  get department(): Department {
    if (this.data.loaded && !this.data.department) {
      this.data.department = this.data.loaded ? this.data.account.asPerson().department : undefined;
    }
    return this.data.department;
  }

  constructor(
    protected graphql: GraphqlService,
    private settings: LocalSettingsService,
    private cryptoService: CryptoService,
    private storage: Storage
  ) {
    super(graphql);

    this.resetData();

    this.start();

    // Send auth token to the graphql layer, when changed
    this.onAuthTokenChange.subscribe((token) => this.graphql.setAuthToken(token));

    this.graphql.onStart.subscribe(async () => {
      if (this.isLogin()) {
        console.debug("[account] Graphql restarted. Force logout, to auth again");
        await this.logout();
      }
    });

    console.debug('::: AccountService constructor');

    // For DEV only
    this._debug = !environment.production;
  }

  private resetData() {
    this.data.loaded = false;
    this.data.keypair = null;
    this.data.authToken = null;
    this.data.pubkey = null;
    this.data.mainProfile = null;
    this.data.account = new Account();
    this.data.person = null;
    this.data.department = null;
  }

  async start() {
    if (this._startPromise) return this._startPromise;
    if (this._started) return;

    // Restoring local settings
    this._startPromise = this.settings.ready()
      .then(() => this.restoreLocally())
      .then(() => {
        this._started = true;
        this._startPromise = undefined;
      });
    return this._startPromise;
  }

  public isStarted(): boolean {
    return this._started;
  }

  public ready(): Promise<void> {
    if (this._started) return Promise.resolve();
    return this.start();
  }

  public isLogin(): boolean {
    return !!(this.data.pubkey && this.data.loaded);
  }

  public isAuth(): boolean {
    return !!(this.data.pubkey && this.data.keypair && this.data.keypair.secretKey);
  }

  public hasMinProfile(label: UserProfileLabel): boolean {
    // should be login, and status ENABLE or TEMPORARY
    if (!this.data.account || !this.data.account.pubkey ||
      (this.data.account.statusId != StatusIds.ENABLE && this.data.account.statusId != StatusIds.TEMPORARY)) {
      return false;
    }
    return hasUpperOrEqualsProfile(this.data.account.profiles, label as UserProfileLabel);
  }

  public hasExactProfile(label: UserProfileLabel): boolean {
    // should be login, and status ENABLE or TEMPORARY
    if (!this.data.account || !this.data.account.pubkey ||
      (this.data.account.statusId != StatusIds.ENABLE && this.data.account.statusId != StatusIds.TEMPORARY))
      return false;
    return !!this.data.account.profiles.find(profile => profile === label);
  }


  public hasProfileAndIsEnable(label: UserProfileLabel): boolean {
    // should be login, and status ENABLE
    if (!this.data.account || !this.data.account.pubkey || this.data.account.statusId != StatusIds.ENABLE) return false;
    return hasUpperOrEqualsProfile(this.data.account.profiles, label as UserProfileLabel);
  }

  public isAdmin(): boolean {
    return this.hasProfileAndIsEnable('ADMIN');
  }

  public isSupervisor(): boolean {
    return this.hasProfileAndIsEnable('SUPERVISOR');
  }

  public isUser(): boolean {
    return this.hasProfileAndIsEnable('USER');
  }

  /**
   * @deprecated
   * @param mode
   */
  public isUsageMode(mode: UsageMode): boolean {
    return this.settings.isUsageMode(mode);
  }

  public isOnlyGuest(): boolean {
    // Should be login, and status ENABLE or TEMPORARY
    if (!this.data.account || !this.data.account.pubkey ||
      (this.data.account.statusId !== StatusIds.ENABLE && this.data.account.statusId !== StatusIds.TEMPORARY))
      return false;
    // Profile less then user
    return !hasUpperOrEqualsProfile(this.data.account.profiles, 'USER');
  }

  public canUserWriteDataForDepartment(recorderDepartment: Referential | any): boolean {
    if (EntityUtils.isEmpty(recorderDepartment)) {
      console.warn("Unable to check if user has right: invalid recorderDepartment", recorderDepartment);
      return this.isAdmin();
    }

    // Should be login, and status ENABLE
    if (!this.data.account || !this.data.account.pubkey || this.data.account.statusId !== StatusIds.ENABLE) return false;

    if (!this.data.account.department || !this.data.account.department.id) {
      console.warn("User account has no department ! Unable to check write right against recorderDepartment");
      return false;
    }

    // Same recorder department: OK, user can write
    if (this.data.account.department.id === recorderDepartment.id) return true;

    // Else, check if supervisor (or more)
    return hasUpperOrEqualsProfile(this.data.account.profiles, 'SUPERVISOR');
  }

  public async register(data: RegisterData): Promise<Account> {
    if (this.isLogin()) {
      throw new Error("User already login. Please logout before register.");
    }
    if (!data.username || !data.username) throw new Error("Missing required username por password");

    if (this._debug) console.debug('[account] Register new user account...', data.account);
    this.data.loaded = false;
    let now = Date.now();

    try {
      const keypair = await this.cryptoService.scryptKeypair(data.username, data.password);
      data.account.pubkey = base58.encode(keypair.publicKey);

      // Default values
      data.account.settings.locale = this.settings.locale;
      data.account.settings.latLongFormat = this.settings.latLongFormat;
      data.account.department.id = data.account.department.id || environment.defaultDepartmentId;

      this.data.keypair = keypair;
      const account = await this.saveAccount(data.account, keypair);

      // Default values
      account.avatar = account.avatar || "../assets/img/person.png";
      this.data.mainProfile = getMainProfile(account.profiles);

      this.data.account = account;
      this.data.pubkey = account.pubkey;

      // Try to auth on remote server
      this.data.authToken = await this.authenticateAndGetToken();

      this.data.loaded = true;

      await this.saveLocally();

      console.debug("[account] Account successfully registered in " + (Date.now() - now) + "ms");
      this.onLogin.next(this.data.account);
      return this.data.account;
    }
    catch (error) {
      console.error(error && error.message || error);
      this.resetData();
      throw error;
    }
  }

  async login(data: AuthData): Promise<Account> {
    if (!data.username || !data.password) throw "Missing required username or password";

    console.debug("[account] Trying to login...");

    let keypair;
    try {
      keypair = await this.cryptoService.scryptKeypair(data.username, data.password);
    } catch (error) {
      console.error(error);
      this.resetData();
      throw { code: ErrorCodes.UNKNOWN_ERROR, message: "ERROR.SCRYPT_ERROR" };
    }

    // Store pubkey+keypair
    this.data.pubkey = base58.encode(keypair.publicKey);
    this.data.keypair = keypair;

    // Try to auth on remote server
    try {
      this.data.authToken = await this.authenticateAndGetToken();
    }
    catch (error) {
      console.error(error);
      this.resetData();
      throw error;
    }

    // Load account data
    try {
      await this.loadData();
    }
    catch (err) {
      // If account not found, check if email is valid
      if (err && err.code == ErrorCodes.LOAD_ACCOUNT_ERROR) {

        let isEmailExists;
        try {
          isEmailExists = await this.isEmailExists(data.username);
        } catch (otherError) {
          throw err; // resend the first error
        }

        // Email not exists (no account)
        if (!isEmailExists) {
          throw { code: ErrorCodes.UNKNOWN_ACCOUNT_EMAIL, message: "ERROR.UNKNOWN_ACCOUNT_EMAIL" };
        }
        // Email exists, so error = 'bad password'
        throw { code: ErrorCodes.BAD_PASSWORD, message: "ERROR.BAD_PASSWORD" };
      }

      throw err; // resend the first error
    }

    try {
      // Store to local storage
      await this.saveLocally();
    }
    catch (error) {
      console.error(error);
      this.resetData();
      throw error;
    }

    console.debug("[account] Successfully authenticated {" + this.data.pubkey.substr(0, 6) + "}");

    // Emit event to observers
    this.onLogin.next(this.data.account);

    return this.data.account;
  }

  public async refresh(): Promise<Account> {
    if (!this.data.pubkey) throw new Error("User not logged");

    await this.loadData({ fetchPolicy: 'network-only' });
    await this.saveLocally();

    console.debug("[account] Successfully reload account");

    // Emit login event to subscribers
    this.onLogin.next(this.data.account);

    return this.data.account;
  }

  async loadData(opts?: { fetchPolicy?: FetchPolicy }): Promise<Account> {
    if (!this.data.pubkey) throw new Error("User not logged");

    this.data.loaded = false;

    try {
      const account = (await this.loadAccount(this.data.pubkey, opts)) || new Account();

      // Fill default values
      account.avatar = account.avatar || "../assets/img/person.png";
      account.settings = account.settings || new UserSettings();
      account.settings.locale = account.settings.locale || this.settings.locale;
      account.settings.latLongFormat = account.settings.latLongFormat || this.settings.latLongFormat || 'DDMM';

      // Read main profile
      this.data.mainProfile = getMainProfile(account.profiles);

      if (this.data.account) {
        account.copy(this.data.account);
      }
      else {
        this.data.account = account;
      }
      this.data.loaded = true;
      return this.data.account;
    }
    catch (error) {
      this.resetData();
      if (error.code && error.message) throw error;

      console.error(error);
      throw {
        code: ErrorCodes.LOAD_ACCOUNT_ERROR,
        message: 'ERROR.LOAD_ACCOUNT_ERROR'
      };
    };
  }

  public async restoreLocally(): Promise<Account | undefined> {

    // Restore from storage
    const values = await Promise.all([
      this.storage.get(PUBKEY_STORAGE_KEY),
      this.storage.get(TOKEN_STORAGE_KEY),
      this.storage.get(ACCOUNT_STORAGE_KEY),
      this.storage.get(SECKEY_STORAGE_KEY)
    ]);
    const pubkey = values[0];
    const token = values[1];
    const accountStr = values[2];
    const seckey = values[3];

    // Quit if no pubkey
    if (!pubkey) return;

    // Quit if could not auth on remote server
    const canRemoteAuth = !!token || !!seckey;
    if (!canRemoteAuth) return;

    if (this._debug) console.debug("[account] Restoring account {" + pubkey.substr(0, 6) + "}'...");

    this.data.pubkey = pubkey;
    this.data.keypair = seckey && {
      publicKey: base58.decode(pubkey),
      secretKey: base58.decode(seckey)
    };

    try {
      this.data.authToken = await this.authenticateAndGetToken(token);
      if (!this.data.authToken) throw "Authentication failed";
    }
    catch (error) {
      console.error(error);
      // TODO: do not logout, but allow navigation on local data ?
      this.logout();
      return;
    }

    // No account: stop here (= data not loaded)
    if (!accountStr) return;

    const accountObj: any = JSON.parse(accountStr);
    if (!accountObj) return;

    const account = Account.fromObject(accountObj);
    if (account.pubkey !== pubkey) return;

    this.data.account = account;
    this.data.mainProfile = getMainProfile(account.profiles);
    this.data.loaded = true;

    // Emit event
    this.onLogin.next(this.data.account);

    return account;
  }

  /**
  * Save account into the local storage
  */
  async saveLocally(): Promise<void> {
    if (!this.data.pubkey) throw "User not logged";

    if (this._debug) console.debug("[account] Saving account {" + this.data.pubkey.substring(0, 6) + "} in local storage...");

    let copy = this.data.account.asObject();
    const seckey = this.data.keypair && !!this.data.keypair.secretKey && base58.encode(this.data.keypair.secretKey) || null;

    await Promise.all([
      this.storage.set(PUBKEY_STORAGE_KEY, this.data.pubkey),
      this.storage.set(TOKEN_STORAGE_KEY, this.data.authToken),
      this.storage.set(ACCOUNT_STORAGE_KEY, JSON.stringify(copy)),
      this.storage.set(SECKEY_STORAGE_KEY, seckey)
    ]);

    if (this._debug) console.debug("[account] Account saved in local storage");
  }

  /**
   * Create or update an user account, to the remote storage
   * @param account
   * @param keyPair
   */
  public async saveRemotely(account: Account): Promise<Account> {
    if (!this.data.pubkey) return Promise.reject("User not logged");
    if (this.data.pubkey != account.pubkey) return Promise.reject("Not user account");

    console.debug("[account] Saving account {" + account.pubkey.substring(0, 6) + "} remotely...");
    let now = new Date

    const updateAccount = await this.saveAccount(account, this.data.keypair);
    console.debug("[account] Account remotely saved in " + (new Date().getTime() - now.getTime()) + "ms");

    // Set default values
    account.avatar = account.avatar || "../assets/img/person.png";
    this.data.mainProfile = getMainProfile(account.profiles);

    this.data.account = account;
    this.data.loaded = true;
    // Save locally (in storage)
    await this.saveLocally();

    // Send event
    this.onLogin.next(this.data.account);

    return this.data.account;
  }

  public async logout(): Promise<void> {

    const tokenRemoved = !!this.data.authToken;

    this.resetData();

    await Promise.all([
      this.storage.remove(PUBKEY_STORAGE_KEY),
      this.storage.remove(TOKEN_STORAGE_KEY),
      this.storage.remove(ACCOUNT_STORAGE_KEY),
      this.storage.remove(SECKEY_STORAGE_KEY)
    ]);

    // Clean page history, in local settings
    await this.settings.clearPageHistory();

    // Notify observers
    this.onLogout.next();
    if (tokenRemoved) {
      this.onAuthTokenChange.next(undefined);
    }


  }

  /**
   * Load a account by pubkey
   * @param pubkey
   */
  public async loadAccount(pubkey: string, opts?: { fetchPolicy?: FetchPolicy }): Promise<Account | undefined> {

    if (this._debug) console.debug("[account-service] Loading account {" + pubkey.substring(0, 6) + "}...");
    var now = new Date();

    const res = await this.graphql.query<{ account: any }>({
      query: LoadQuery,
      variables: {
        pubkey: pubkey
      },
      error: { code: ErrorCodes.LOAD_ACCOUNT_ERROR, message: "ERROR.LOAD_ACCOUNT_ERROR" },
      fetchPolicy: opts && opts.fetchPolicy || environment.apolloFetchPolicy || undefined
    });

    if (res && res.account) {
      const account = new Account();
      account.fromObject(res.account);
      if (this._debug) console.debug("[account-service] Account {" + pubkey.substring(0, 6) + "} loaded in " + (new Date().getTime() - now.getTime()) + "ms", res);
      return account;
    }
    else {
      console.warn("[account-service] Account {" + pubkey.substring(0, 6) + "} not found !");
      return undefined;
    }
  }

  /**
   * Create or update an user account
   * @param account
   * @param keyPair
   */
  public async saveAccount(account: Account, keyPair: KeyPair): Promise<Account> {
    account.pubkey = account.pubkey || base58.encode(keyPair.publicKey);

    const isNew = !account.id && account.id !== 0;

    // If this is an update: get existing account's updateDate, to avoid 'version error' when saving
    if (!isNew) {
      const existingAccount = await this.loadAccount(account.pubkey, { fetchPolicy: 'network-only' });
      if (!existingAccount || !existingAccount.updateDate) {
        throw { code: ErrorCodes.ACCOUNT_NOT_EXISTS, message: "ERROR.ACCOUNT_NOT_EXISTS" };
      }
      account.updateDate = existingAccount.updateDate || account.updateDate;
      if (account.settings && existingAccount.settings) {
        account.settings.updateDate = existingAccount.settings.updateDate || account.settings.updateDate;
      }
    }

    const json = account.asObject();

    // User not allow to change his profiles
    delete json.profiles;
    delete json.mainProfile; // Not known on server

    // Execute mutation
    const res = await this.graphql.mutate<{ saveAccount: any }>({
      mutation: isNew ? CreateMutation : SaveMutation,
      variables: {
        account: json
      },
      error: {
        code: ErrorCodes.SAVE_ACCOUNT_ERROR,
        message: "ERROR.SAVE_ACCOUNT_ERROR"
      }
    });

    const savedAccount = res && res.saveAccount;

    // Copy update properties
    account.id = savedAccount && savedAccount.id || account.id;
    account.updateDate = savedAccount && savedAccount.updateDate || account.updateDate;
    account.settings.id = savedAccount && savedAccount.settings && savedAccount.settings.id || account.settings.id;
    account.settings.updateDate = savedAccount && savedAccount.settings && savedAccount.settings.updateDate || account.settings.updateDate;

    return account;
  }

  /**
   * Check if email is available for new account registration.
   * Throw an error if not available
   * @param email
   */
  public async checkEmailAvailable(email: string): Promise<void> {
    const isEmailExists = await this.isEmailExists(email);
    if (isEmailExists) {
      throw { code: ErrorCodes.EMAIL_ALREADY_REGISTERED, message: "ERROR.EMAIL_ALREADY_REGISTERED" };
    }
  }

  /**
   * Check if email is exists in server.
   * @param email
   */
  async isEmailExists(email: string): Promise<boolean> {

    if (this._debug) console.debug("[account] Checking if {" + email + "} exists...");

    const data = await this.graphql.query<{ isEmailExists: boolean }, IsEmailExistsVariables>({
      query: IsEmailExistsQuery,
      variables: {
        email: email,
        hash: undefined
      }
    });

    if (this._debug) console.debug("[account] Email exist: " + (data && data.isEmailExists));

    return data && data.isEmailExists;
  }

  async sendConfirmationEmail(email: String, locale?: string): Promise<boolean> {

    locale = locale || this.settings.locale;
    console.debug("[account] Sending confirmation email to {" + email + "} with locale {" + locale + "}...");

    return await this.graphql.mutate<boolean>({
      mutation: SendConfirmEmailMutation,
      variables: {
        email: email,
        locale: locale
      },
      error: {
        code: ErrorCodes.SENT_CONFIRMATION_EMAIL_FAILED,
        message: "ERROR.SENT_ACCOUNT_CONFIRMATION_EMAIL_FAILED"
      }
    });
  }

  async confirmEmail(email: String, code: String): Promise<boolean> {

    console.debug("[account] Sendng confirm request for email {" + email + "} with code {" + code + "}...");

    const res = await this.graphql.mutate<{ confirmAccountEmail: boolean }>({
      mutation: ConfirmEmailMutation,
      variables: {
        email: email,
        code: code
      },
      error: {
        code: ErrorCodes.CONFIRM_EMAIL_FAILED,
        message: "ERROR.CONFIRM_ACCOUNT_EMAIL_FAILED"
      }
    });
    return res && res.confirmAccountEmail;
  }

  public listenChanges(): Subscription {
    if (!this.data.pubkey) return Subscription.EMPTY;

    const self = this;

    console.debug('[account] [WS] Listening changes on {/subscriptions/websocket}...');

    const subscription = this.graphql.subscribe<{updateAccount: any}>({
      query: UpdateSubscription,
      variables: {
        pubkey: this.data.pubkey,
        interval: 10
      },
      error: {
        code: ErrorCodes.SUBSCRIBE_ACCOUNT_ERROR,
        message: 'ERROR.ACCOUNT.SUBSCRIBE_ACCOUNT_ERROR'
      }
    }).subscribe({
        async next(data) {
          if (data && data.updateAccount) {
            const existingUpdateDate = self.data.account && toDateISOString(self.data.account.updateDate);
            if (existingUpdateDate !== data.updateAccount.updateDate) {
              console.debug("[account] [WS] Detected update on {" + data.updateAccount.updateDate + "}");
              await self.refresh();
            }
          }
        },
      async error(err) {
          if (err && err.code == ServerErrorCodes.NOT_FOUND) {
            console.info("[account] Account not exists anymore: force user to logout...", err);
            await self.logout();
          }
          else if (err && err.code == ServerErrorCodes.UNAUTHORIZED) {
             console.info("[account] Account not authorized: force user to logout...", err);
             await self.logout();
          }
          else {
            console.warn("[account] [WS] Received error:", err);
          }
        },
        complete() {
          console.debug('[account] [WS] Completed');
        }
    });

    // Add log when closing WS
    subscription.add(() => console.debug('[account] [WS] Stop to listen changes'));

    return subscription;
  }

  /**
   * @deprecated
   */
  public getPageSettings(pageId: string, propertyName?: string): string[] {
    return this.settings.getPageSettings(pageId, propertyName);
  }

  /**
   * @deprecated
   */
  public async savePageSetting(pageId: string, value: any, propertyName?: string) {
    await this.settings.savePageSetting(pageId, value, propertyName);
  }

  get additionalFields(): FormFieldDefinition[] {
    return this._$additionalFields.getValue();
  }

  get $additionalFields(): Observable<FormFieldDefinition[]> {
    return this._$additionalFields.asObservable();
  }

  getAdditionalField(key: string): FormFieldDefinition | undefined {
    return this._$additionalFields.getValue().find(f => f.key === key);
  }

  registerAdditionalField(field: FormFieldDefinition) {
    const values = this._$additionalFields.getValue();
    if (!!values.find(f => f.key === field.key)) {
      throw new Error("Additional account field {" + field.key + "} already define.");
    }
    if (this._debug) console.debug("[account] Adding additional account field {" + field.key + "}", field);
    this._$additionalFields.next(values.concat(field));
  }

  async authenticateAndGetToken(token?: string, counter?: number): Promise<string> {
    if (!this.data.pubkey) throw "User not logged";

    if (this._debug && !counter) console.debug("[account] Authenticating on server...");

    if (counter > 4) {
      if (this._debug) console.debug(`[account] Authentication failed (after ${counter} attempts)`);
      throw { code: ErrorCodes.AUTH_SERVER_ERROR, message: "ERROR.AUTH_SERVER_ERROR" };
    }

    // Check if valid
    if (token) {
      const data = await this.graphql.query<{ authenticate: boolean }, { token: string }>({
        query: AuthQuery,
        variables: {
          token: token
        },
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: "ERROR.UNAUTHORIZED"
        },
        fetchPolicy: 'network-only'
      });

      // Token is accepted by the server: store it
      if (data && data.authenticate) {
        this.onAuthTokenChange.next(token);
        return token; // return the token
      }

      // Continue (will retry with another challenge)
    }

    // Generate a new token
    const challengeError = {
      code: ErrorCodes.AUTH_CHALLENGE_ERROR,
      message: "ERROR.AUTH_CHALLENGE_ERROR"
    };
    const data = await this.graphql.query<{
      authChallenge: {
        pubkey: string,
        challenge: string,
        signature: string
      }
    }>({
      query: AuthChallengeQuery,
      variables: {},
      error: challengeError,
      fetchPolicy: 'network-only'
    });

    // Check challenge
    if (!data || !data.authChallenge) throw challengeError; // Should never occur

    // TODO: check server signature
    const signatureOK = await this.cryptoService.verify(
      data.authChallenge.challenge,
      data.authChallenge.signature,
      data.authChallenge.pubkey
    );
    if (!signatureOK) {
      console.warn("FIXME: Bad server signature on auth challenge !", data.authChallenge);
    }
    // TODO: check server pubkey as a valid certificate

    // Do the challenge
    const signature = await this.cryptoService.sign(data.authChallenge.challenge, this.data.keypair);
    const newToken = `${this.data.pubkey}:${data.authChallenge.challenge}|${signature}`;

    // iterate with the new token
    return await this.authenticateAndGetToken(newToken, (counter || 1) + 1 /* increment */);
  }

  /* -- Protected methods -- */

}
