/** Node.js client for the public IonoFlux API. */
export const VERSION = '0.1.3';
export const KEY_URL = 'https://ionoflux.runvia.app/account';
export type JSONValue = null | boolean | number | string | JSONValue[] | JSONObject;
export interface JSONObject { [key: string]: JSONValue }
export type Interval = 'raw' | '1m' | '5m' | '1h' | '3h' | '1d' | '7d' | '1mo';
export type Metric = 'sfi' | 'ssn' | 'kp' | 'ap' | 'xray_long' | 'xray_short' | 'solar_wind_speed' | 'solar_wind_density' | 'imf_bt' | 'imf_bz';
export type Band = '160m' | '80m' | '60m' | '40m' | '30m' | '20m' | '17m' | '15m' | '12m' | '10m' | '6m';
export type PropagationMode = 'ft8' | 'ft4' | 'wspr' | 'cw' | 'ssb' | 'am' | 'rtty' | 'psk31';
export type NoiseEnvironment = 'city' | 'residential' | 'rural' | 'quiet';
export type Category = 'ALERT' | 'WARNING' | 'WATCH' | 'SUMMARY' | 'CANCEL' | 'OTHER' | 'ES_OPENING';
export type Dataset = 'sfi' | 'ssn' | 'xray' | 'solar_wind' | 'kp' | 'ap' | 'tec' | 'ionosonde' | 'stations' | 'pskreporter' | 'wsprnet' | 'activity' | 'alerts' | 'places';
/** Date objects represent instants; strings must include Z or an explicit UTC offset. */
export type Timestamp = Date | string;
export interface DateRange { start?: Timestamp; end?: Timestamp }
export interface SeriesOptions extends DateRange { interval?: Interval; limit?: number }
export interface MapOptions { time?: Timestamp; lat?: number; lon?: number; format?: 'json' | 'geojson' }
export interface MUFOptions extends MapOptions { hopKm?: number; source?: 'model' | 'ionosonde' }
export interface LinkOptions {
  mode?: PropagationMode; power?: number; txGain?: number; rxGain?: number;
  noise?: NoiseEnvironment; path?: 'auto' | 'short' | 'long';
}
export interface PathOptions extends LinkOptions { from: string; to: string; frequency: number; time?: Timestamp }
export interface ForecastOptions extends LinkOptions { from: string; to: string; start?: Timestamp; hours?: number }
export interface LiveOptions {
  minutes?: number; band?: Band; mode?: string; source?: 'pskreporter' | 'wsprnet';
  bbox?: readonly [number, number, number, number]; limit?: number;
}
export interface ObservationPathOptions { from: string; to: string; radiusKm?: number; hours?: number; band?: Band }
export interface ObservationBandOptions { location?: string; radiusKm?: number; role?: 'rx' | 'tx'; minutes?: number; mode?: string }
export interface CallsignOptions { role?: 'tx' | 'rx'; hours?: number; limit?: number }
export interface RateLimit {
  readonly limit: number | null; readonly remaining: number | null;
  /** Seconds until quota reset, not a Unix timestamp. */
  readonly resetSeconds: number | null; readonly retryAfter: string | null;
}
export interface APIResponse<T = JSONObject> {
  readonly data: T; readonly rawBody: Uint8Array; readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>; readonly rateLimit: RateLimit;
}
export class IonoFluxError extends Error {
  constructor(message: string) { super(message); this.name = new.target.name; }
}
export class ConfigurationError extends IonoFluxError {}
export class TransportError extends IonoFluxError {}
export class ResponseError extends IonoFluxError {}
export class APIError extends IonoFluxError {
  readonly retryAfter: string | null;
  constructor(readonly statusCode: number, readonly detail: string, readonly rateLimit: RateLimit) {
    super(`IonoFlux API returned HTTP ${statusCode}: ${detail}`);
    this.retryAfter = rateLimit.retryAfter;
  }
}
export class AuthenticationError extends APIError {}
export class PermissionDeniedError extends APIError {}
export class NotFoundError extends APIError {}
export class ValidationError extends APIError {}
export class RateLimitError extends APIError {}
export class ServerError extends APIError {}
export class RedirectError extends APIError {}
const metricSources: Record<Metric, readonly string[]> = {
  sfi: ['swpc'], ssn: ['swpc', 'silso'], kp: ['swpc', 'gfz'], ap: ['gfz'],
  xray_long: ['primary'], xray_short: ['primary'], solar_wind_speed: ['swpc-rtsw'],
  solar_wind_density: ['swpc-rtsw'], imf_bt: ['swpc-rtsw'], imf_bz: ['swpc-rtsw'],
};
const bands = ['160m','80m','60m','40m','30m','20m','17m','15m','12m','10m','6m'];
const datasets = ['sfi','ssn','xray','solar_wind','kp','ap','tec','ionosonde','stations','pskreporter','wsprnet','activity','alerts','places'];
type Params = Record<string, string | number | boolean | readonly string[] | undefined>;
function choice(name: string, value: unknown, values: readonly unknown[]): void {
  if (!values.includes(value)) throw new RangeError(`Unsupported ${name}`);
}
function number(name: string, value: number, low: number, high: number, above = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value > high || (above ? value <= low : value < low))
    throw new RangeError(`${name} must be a finite number ${above ? 'greater than' : 'at least'} ${low} and at most ${high}`);
  return value;
}
function whole(name: string, value: number, low: number, high: number): number {
  number(name, value, low, high);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
  return value;
}
function place(name: string, value: string): string {
  if (typeof value !== 'string' || [...value].length < 2 || [...value].length > 200)
    throw new RangeError(`${name} must be a string of 2 to 200 characters`);
  return value;
}
function utc(value: Timestamp): string {
  if (!(value instanceof Date) && (typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)))
    throw new RangeError('Use a Date or ISO timestamp with an explicit timezone');
  if (typeof value === 'string') {
    const day = value.slice(0, 10);
    if (+value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || +value.slice(17, 19) > 59)
      throw new RangeError('Invalid clock time');
    const midnight = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== day)
      throw new RangeError('Invalid calendar date');
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid timestamp');
  return date.toISOString();
}
function dateRange({ start, end }: DateRange): Params {
  const a = start === undefined ? undefined : utc(start);
  const b = end === undefined ? undefined : utc(end);
  if (a && b && (Date.parse(a) >= Date.parse(b) || Date.parse(b) - Date.parse(a) > 3660 * 86400000))
    throw new RangeError('Require start < end and a range of at most 3660 days');
  return { start: a, end: b };
}
function time(params: Params, name: string, value?: Timestamp): Params {
  if (value !== undefined) params[name] = utc(value);
  return params;
}
function map(o: MapOptions): Params {
  const format = o.format ?? 'json'; choice('format', format, ['json','geojson']);
  if ((o.lat === undefined) !== (o.lon === undefined)) throw new RangeError('Pass lat and lon together');
  const p: Params = { format };
  if (o.lat !== undefined && o.lon !== undefined) {
    p.lat = number('lat', o.lat, -90, 90); p.lon = number('lon', o.lon, -180, 180);
  }
  return time(p, 'time', o.time);
}
function link(o: LinkOptions): Params {
  const { mode = 'ft8', noise = 'rural', path = 'auto' } = o;
  choice('mode', mode, ['ft8','ft4','wspr','cw','ssb','am','rtty','psk31']);
  choice('noise', noise, ['city','residential','rural','quiet']); choice('path', path, ['auto','short','long']);
  return { mode, noise, path, power: number('power', o.power ?? 100, 0, 100000, true),
    tx_gain: number('txGain', o.txGain ?? 2.15, -20, 30), rx_gain: number('rxGain', o.rxGain ?? 2.15, -20, 30) };
}
function filters(p: Params, band?: Band, mode?: string): Params {
  if (band !== undefined) { choice('band', band, bands); p.band = band; }
  if (mode !== undefined) {
    if (typeof mode !== 'string' || [...mode].length < 1 || [...mode].length > 16) throw new RangeError('mode must be a string of 1 to 16 characters');
    p.mode = mode;
  }
  return p;
}
function numericHeader(value?: string): number | null {
  if (!value || !/^\d{1,20}$/.test(value)) return null;
  const n = Number(value); return Number.isSafeInteger(n) ? n : null;
}
export interface ClientOptions {
  /** Defaults to IONOFLUX_API_KEY. Use a Server API key in Node.js. */
  apiKey?: string; baseUrl?: string;
  /** Total deadline in milliseconds for each attempt, including the response body. Default 10000. */
  timeoutMs?: number; maxRetries?: number;
  /** Optional fetch-compatible transport. The caller owns this transport. */
  fetch?: typeof globalThis.fetch;
}
export class Client {
  #key?: string; #base: string; #timeout: number; #retries: number;
  #fetch: typeof globalThis.fetch; #closed = false;
  #pending = new Set<AbortController>();
  constructor(options: ClientOptions = {}) {
    if (typeof process === 'undefined' || !process.versions?.node || typeof window !== 'undefined')
      throw new ConfigurationError('This SDK supports Node.js only. Keep Server API keys on your server.');
    const key = options.apiKey === undefined ? process.env.IONOFLUX_API_KEY : options.apiKey;
    if (key !== undefined && (typeof key !== 'string' || !/^[\x21-\x7e]+$/.test(key)))
      throw new ConfigurationError('API key must be a nonempty printable ASCII token');
    let url: URL;
    try { url = new URL(options.baseUrl ?? 'https://ionoflux.runvia.app/v1'); }
    catch { throw new ConfigurationError('Invalid baseUrl'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || !url.pathname.replace(/\/+$/, '').endsWith('/v1'))
      throw new ConfigurationError('baseUrl must be an HTTPS API root ending in /v1');
    const timeout = options.timeoutMs ?? 10000, retries = options.maxRetries ?? 1;
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647)
      throw new ConfigurationError('timeoutMs must be positive and at most 2147483647');
    if (!Number.isInteger(retries) || retries < 0 || retries > 3) throw new ConfigurationError('maxRetries must be an integer from 0 to 3');
    if (typeof (options.fetch ?? globalThis.fetch) !== 'function') throw new ConfigurationError('A fetch transport is required');
    this.#key = key; this.#base = url.href.replace(/\/+$/, '') + '/'; this.#timeout = timeout;
    this.#retries = retries; this.#fetch = options.fetch ?? globalThis.fetch;
  }
  get isClosed(): boolean { return this.#closed; }
  /** Aborts pending requests; does not close the runtime's shared fetch pool or a custom transport. */
  close(): void { this.#closed = true; for (const c of this.#pending) c.abort(); }
  [Symbol.dispose](): void { this.close(); }
  toJSON(): { type: string; isClosed: boolean } { return { type: 'IonoFluxClient', isClosed: this.#closed }; }
  [Symbol.for('nodejs.util.inspect.custom')](): string { return `Client(apiKey=<redacted>, isClosed=${this.#closed})`; }
  #redact(text: string): string {
    if (!this.#key) return text;
    for (const token of [this.#key, encodeURIComponent(this.#key), JSON.stringify(this.#key).slice(1, -1)])
      text = text.split(token).join('<redacted>');
    return text;
  }
  async #get<T = JSONObject>(path: string, params: Params = {}, publicRoute = false, array = false): Promise<APIResponse<T>> {
    if (this.#closed) throw new ConfigurationError('Client is closed');
    if (!publicRoute && !this.#key) throw new ConfigurationError(`Set IONOFLUX_API_KEY or apiKey to a Server API key. Get an API key: ${KEY_URL}`);
    const url = new URL(path, this.#base);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(name, String(v));
    }
    url.searchParams.set('utm_source', 'nodejs'); url.searchParams.set('utm_medium', 'sdk'); url.searchParams.set('utm_content', VERSION);
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': `ionoflux-node/${VERSION}` };
    if (!publicRoute && this.#key) headers['X-API-Key'] = this.#key;
    for (let attempt = 0; attempt <= this.#retries; attempt++) {
      if (this.#closed) throw new ConfigurationError('Client is closed');
      const controller = new AbortController(); this.#pending.add(controller);
      const timer = setTimeout(() => controller.abort(), this.#timeout);
      let response: Response | undefined, raw: Uint8Array | undefined;
      let retryable = false;
      try {
        response = await this.#fetch(url, { method: 'GET', headers, redirect: 'manual', signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        raw = new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        // Never retain a transport's request-bearing exception or cause.
        const code = (error as { cause?: { code?: string } })?.cause?.code;
        retryable = controller.signal.aborted || ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET'].includes(code ?? '');
      } finally { clearTimeout(timer); this.#pending.delete(controller); }
      if (this.#closed) throw new ConfigurationError('Client is closed');
      if (!response || !raw) {
        if (retryable && attempt < this.#retries) { await this.#pause(attempt); continue; }
        throw new TransportError('IonoFlux GET failed after bounded retries');
      }
      const safe: Record<string, string> = {};
      for (const name of ['content-type','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','retry-after']) {
        const value = response.headers.get(name); if (value !== null) safe[name] = this.#redact(value);
      }
      const rate: RateLimit = Object.freeze({ limit: numericHeader(safe['x-ratelimit-limit']), remaining: numericHeader(safe['x-ratelimit-remaining']),
        resetSeconds: numericHeader(safe['x-ratelimit-reset']), retryAfter: safe['retry-after'] ?? null });
      const code = response.status;
      if ([502,503,504].includes(code) && attempt < this.#retries && rate.retryAfter === null && rate.remaining !== 0) { await this.#pause(attempt); continue; }
      let payload: unknown;
      try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { /* handled below */ }
      const object = (v: unknown): v is JSONObject => typeof v === 'object' && v !== null && !Array.isArray(v);
      if (code < 200 || code >= 300) {
        let detail = 'Request failed';
        if (object(payload) && Object.hasOwn(payload, 'detail')) detail = JSON.stringify(payload.detail);
        detail = this.#redact(detail).slice(0, 2000);
        const ErrorType = code >= 300 && code < 400 ? RedirectError : code >= 500 ? ServerError :
          ({ 401: AuthenticationError, 403: PermissionDeniedError, 404: NotFoundError, 422: ValidationError, 429: RateLimitError } as Record<number, typeof APIError>)[code] ?? APIError;
        throw new ErrorType(code, detail, rate);
      }
      if (!(array ? Array.isArray(payload) && payload.every(object) : object(payload)))
        throw new ResponseError(array ? 'Expected a JSON array of objects' : 'Expected a JSON object');
      return Object.freeze({ data: payload as T, rawBody: raw, statusCode: code, headers: Object.freeze(safe), rateLimit: rate });
    }
    throw new TransportError('IonoFlux GET failed');
  }
  async #pause(attempt: number): Promise<void> { await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt)); }
  #series(path: string, o: SeriesOptions, extra: Params = {}): Promise<APIResponse> {
    const interval = o.interval ?? 'raw'; choice('interval', interval, ['raw','1m','5m','1h','3h','1d','7d','1mo']);
    return this.#get(path, { ...dateRange(o), interval, limit: whole('limit', o.limit ?? 5000, 1, 10000), ...extra });
  }
  sources(): Promise<APIResponse> { return this.#get('sources', {}, true); }
  statistics(metric: Metric, o: DateRange & { source?: string } = {}): Promise<APIResponse> {
    if (!Object.hasOwn(metricSources, metric)) throw new RangeError('Unsupported metric');
    if (o.source !== undefined) choice('source', o.source, metricSources[metric]);
    return this.#get(`statistics/${metric}`, { ...dateRange(o), source: o.source });
  }
  readonly spaceWeather = { current: (): Promise<APIResponse> => this.#get('space-weather/current') };
  readonly data = { status: (dataset?: Dataset): Promise<APIResponse> => {
    if (dataset !== undefined) choice('dataset', dataset, datasets);
    return this.#get('data-status' + (dataset === undefined ? '' : `/${dataset}`), {}, true);
  } };
  readonly solar = {
    flux: (o: SeriesOptions = {}): Promise<APIResponse> => this.#series('solar/flux', o),
    sunspots: (o: SeriesOptions & { source?: 'swpc' | 'silso' } = {}): Promise<APIResponse> => {
      if (o.source !== undefined) choice('source', o.source, ['swpc','silso']); return this.#series('solar/sunspots', o, { source: o.source });
    },
    xray: (o: SeriesOptions & { band?: 'long' | 'short' } = {}): Promise<APIResponse> => {
      const band = o.band ?? 'long'; choice('band', band, ['long','short']); return this.#series('solar/xray', o, { band });
    },
    wind: (o: SeriesOptions & { parameter?: 'speed' | 'density' | 'bt' | 'bz' } = {}): Promise<APIResponse> => {
      const parameter = o.parameter ?? 'speed'; choice('parameter', parameter, ['speed','density','bt','bz']); return this.#series('solar/wind', o, { parameter });
    },
  };
  readonly geomagnetic = {
    kp: (o: SeriesOptions & { source?: 'swpc' | 'gfz'; includeForecast?: boolean } = {}): Promise<APIResponse> => {
      if (o.source !== undefined) choice('source', o.source, ['swpc','gfz']);
      const include = o.includeForecast ?? true; if (typeof include !== 'boolean') throw new RangeError('includeForecast must be a boolean');
      return this.#series('geomagnetic/kp', o, { source: o.source, include_forecast: include });
    },
    ap: (o: SeriesOptions = {}): Promise<APIResponse> => this.#series('geomagnetic/ap', o),
  };
  readonly alerts = {
    list: (o: { since?: Timestamp; category?: readonly Category[]; limit?: number } = {}): Promise<APIResponse<JSONObject[]>> => {
      if (o.category !== undefined) {
        if (!Array.isArray(o.category)) throw new RangeError('category must be an array');
        for (const c of o.category) choice('category', c, ['ALERT','WARNING','WATCH','SUMMARY','CANCEL','OTHER','ES_OPENING']);
      }
      return this.#get('alerts', time({ limit: whole('limit', o.limit ?? 50, 1, 500), category: o.category }, 'since', o.since), false, true);
    },
    scales: (): Promise<APIResponse> => this.#get('alerts/scales'),
  };
  readonly ionosphere = {
    tec: (o: MapOptions = {}): Promise<APIResponse> => this.#get('ionosphere/tec', map(o)),
    muf: (o: MUFOptions = {}): Promise<APIResponse> => {
      const source = o.source ?? 'model', hop = o.hopKm ?? 3000; choice('source', source, ['model','ionosonde']);
      const p = map(o);
      if (source === 'ionosonde' && (o.lat !== undefined || p.format !== 'json' || hop !== 3000))
        throw new RangeError('ionosonde source does not accept lat/lon, geojson or hopKm');
      return this.#get('ionosphere/muf', { ...p, source, hop_km: number('hopKm', hop, 0, 4000) });
    },
    stations: (o: { maxAgeHours?: number } = {}): Promise<APIResponse> => this.#get('ionosphere/stations', { max_age_hours: whole('maxAgeHours', o.maxAgeHours ?? 6, 1, 48) }),
  };
  readonly propagation = {
    path: (o: PathOptions): Promise<APIResponse> => this.#get('propagation/path', time({ from: place('from', o.from), to: place('to', o.to), frequency: number('frequency', o.frequency, 1.8, 54), ...link(o) }, 'datetime', o.time)),
    forecast: (o: ForecastOptions): Promise<APIResponse> => this.#get('propagation/forecast', time({ from: place('from', o.from), to: place('to', o.to), hours: whole('hours', o.hours ?? 24, 1, 72), ...link(o) }, 'start', o.start)),
    conditions: (o: { location?: string; time?: Timestamp } = {}): Promise<APIResponse> => this.#get('propagation/conditions', time({ location: o.location === undefined ? undefined : place('location', o.location) }, 'datetime', o.time)),
  };
  readonly observations = {
    live: (o: LiveOptions = {}): Promise<APIResponse> => {
      const p: Params = { minutes: whole('minutes', o.minutes ?? 15, 1, 60), limit: whole('limit', o.limit ?? 2000, 1, 5000) };
      if (o.source !== undefined) { choice('source', o.source, ['pskreporter','wsprnet']); p.source = o.source; }
      if (o.bbox !== undefined) {
        if (!Array.isArray(o.bbox) || o.bbox.length !== 4) throw new RangeError('bbox must contain minLon,minLat,maxLon,maxLat');
        const [w,s,e,n] = o.bbox; number('minLon', w, -180, 180); number('minLat', s, -90, 90); number('maxLon', e, -180, 180); number('maxLat', n, -90, 90);
        if (w >= e || s >= n) throw new RangeError('bbox requires minLon < maxLon and minLat < maxLat'); p.bbox = o.bbox.join(',');
      }
      return this.#get('observations/live', filters(p, o.band, o.mode));
    },
    paths: (o: ObservationPathOptions): Promise<APIResponse> => this.#get('observations/paths', filters({ from: place('from', o.from), to: place('to', o.to), radius_km: number('radiusKm', o.radiusKm ?? 500, 50, 1500), hours: number('hours', o.hours ?? 1, 0, 6, true) }, o.band)),
    bands: (o: ObservationBandOptions = {}): Promise<APIResponse> => {
      const role = o.role ?? 'rx'; choice('role', role, ['rx','tx']);
      return this.#get('observations/bands', filters({ location: o.location === undefined ? undefined : place('location', o.location), role, radius_km: number('radiusKm', o.radiusKm ?? 1000, 50, 3000), minutes: whole('minutes', o.minutes ?? 15, 5, 60) }, undefined, o.mode));
    },
    callsign: (callsign: string, o: CallsignOptions = {}): Promise<APIResponse> => {
      if (typeof callsign !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/-]{1,22}[A-Za-z0-9]$/.test(callsign)) throw new RangeError('Invalid callsign');
      const role = o.role ?? 'tx'; choice('role', role, ['tx','rx']);
      return this.#get(`observations/callsign/${encodeURIComponent(callsign)}`, { role, hours: number('hours', o.hours ?? 24, 0, 48, true), limit: whole('limit', o.limit ?? 300, 1, 1000) });
    },
  };
}
