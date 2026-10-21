<p align="center"><img src="https://ionoflux.runvia.app/icon1.png" width="96" height="96" alt="IonoFlux"></p>

# IonoFlux for Node.js

Promise-based JavaScript and TypeScript client for the [IonoFlux API](https://ionoflux.runvia.app/developers/api): space weather, solar and geomagnetic series, TEC/MUF maps, HF propagation predictions and reception reports. Requires **Node.js 22+**. Supports **ESM and CommonJS**, ships TypeScript declarations and has no runtime dependencies. [한국어](https://github.com/hongjunna/ionoflux-npm/blob/main/README.ko.md).

First released as **0.1.3**, aligned with the API surface of [IonoFlux Python 0.1.3](https://github.com/hongjunna/ionoflux-python). This is a Node.js SDK: use it in a server, CLI or backend worker. Keep Server API keys out of browser/React client bundles, HTML, logs and source control.

[Official SDK guide](https://ionoflux.runvia.app/developers/npm) · [한국어 안내](https://ionoflux.runvia.app/ko/developers/npm)

## Install and connect

```sh
npm install ionoflux@0.1.4
```

Create a **Server API key** at [your account](https://ionoflux.runvia.app/account) and provide it through `IONOFLUX_API_KEY` in your server environment. Server key creation requires a service URL. Never spoof an Origin header to use a Web key from Node.js.

```js
import { Client, APIError } from 'ionoflux';

const client = new Client(); // reads IONOFLUX_API_KEY
try {
  const response = await client.solar.flux({ interval: '1d', limit: 30 });
  console.log(response.data);
  console.log(response.rateLimit.remaining);
} catch (error) {
  if (error instanceof APIError) console.error(error.statusCode, error.detail);
  else throw error;
} finally {
  client.close();
}
```

CommonJS: `const { Client } = require('ionoflux');`. You can also pass `new Client({ apiKey: process.env.IONOFLUX_API_KEY })`. Public `sources()` and `data.status()` calls work without a key and never send a configured key.

## API

Methods return `Promise<APIResponse<T>>`. Options use camelCase; wire query parameters use the API's original names. JSON **response field names remain unchanged**. Every method uses GET.

| Call | Options / purpose |
| --- | --- |
| `client.spaceWeather.current()` | Current space weather summary |
| `client.solar.flux(options)` | Solar flux series |
| `client.solar.sunspots(options)` | Series; `source: 'swpc' \| 'silso'` |
| `client.solar.xray(options)` | Series; `band: 'long' \| 'short'` (long) |
| `client.solar.wind(options)` | Series; `parameter: 'speed' \| 'density' \| 'bt' \| 'bz'` (speed) |
| `client.geomagnetic.kp(options)` | Series; `source: 'swpc' \| 'gfz'`, `includeForecast` (true) |
| `client.geomagnetic.ap(options)` | Ap series |
| `client.statistics(metric, options)` | `start`, `end`, source appropriate to metric |
| `client.alerts.list(options)` | `since`, repeatable `category` array, `limit` (50, max 500); returns object array |
| `client.alerts.scales()` | NOAA scales |
| `client.sources()` | Public provider metadata and terms |
| `client.data.status(dataset?)` | Public coverage, freshness and latest-record metadata |
| `client.ionosphere.tec(options)` | `time`, paired `lat`/`lon`, `format: 'json' \| 'geojson'` |
| `client.ionosphere.muf(options)` | Map options plus `hopKm` (3000, 0–4000), `source: 'model' \| 'ionosonde'` |
| `client.ionosphere.stations(options)` | `maxAgeHours` (6, 1–48) |
| `client.propagation.path(options)` | Required `from`, `to`, `frequency` (MHz, 1.8–54); optional `time`, link options |
| `client.propagation.forecast(options)` | Required `from`, `to`; `start`, `hours` (24, 1–72), link options |
| `client.propagation.conditions(options)` | Optional `location`, `time`; global conditions when location is omitted |
| `client.observations.live(options)` | `minutes` (15, 1–60), `band`, `mode`, `source`, `bbox`, `limit` (2000, max 5000) |
| `client.observations.paths(options)` | Required `from`, `to`; `radiusKm` (500, 50–1500), `hours` (1, >0–6), `band` |
| `client.observations.bands(options)` | `location`, `radiusKm` (1000, 50–3000), `role: 'rx' \| 'tx'` (rx), `minutes` (15, 5–60), `mode` |
| `client.observations.callsign(callsign, options)` | `role: 'tx' \| 'rx'` (tx), `hours` (24, >0–48), `limit` (300, max 1000) |

Series options: `start`, `end`, `interval` (raw), `limit` (5000, 1–10000). Intervals: `raw`, `1m`, `5m`, `1h`, `3h`, `1d`, `7d`, `1mo`. `1mo` means a fixed 30 days. Times accept a valid `Date` or ISO string with `Z`/explicit offset and are sent in UTC. When both bounds are set, require start < end and at most 3660 days. Omitted bounds use API defaults. A limit may truncate results; there is no automatic pagination or bulk download.

Statistics metrics: `sfi` (swpc), `ssn` (swpc/silso), `kp` (swpc/gfz), `ap` (gfz), `xray_long`/`xray_short` (primary), `solar_wind_speed`/`solar_wind_density`/`imf_bt`/`imf_bz` (swpc-rtsw). The first source is the default. Alert categories: `ALERT`, `WARNING`, `WATCH`, `SUMMARY`, `CANCEL`, `OTHER`, `ES_OPENING`. Datasets: `sfi`, `ssn`, `xray`, `solar_wind`, `kp`, `ap`, `tec`, `ionosonde`, `stations`, `pskreporter`, `wsprnet`, `activity`, `alerts`, `places`.

Locations are Maidenhead locators, `lat,lon` strings or place names (2–200 characters). Link options: `mode` (ft8; ft4/wspr/cw/ssb/am/rtty/psk31), `power` (100 W, >0–100000), `txGain`/`rxGain` (2.15 dBi, −20–30), `noise` (rural; city/residential/quiet), `path` (auto/short/long). Bands: 160m/80m/60m/40m/30m/20m/17m/15m/12m/10m/6m. Observation `mode` accepts 1–16 characters; `source` is pskreporter/wsprnet; `bbox` is `[minLon,minLat,maxLon,maxLat]` with increasing bounds. Callsigns follow the API pattern (3–24 characters, alphanumeric ends, alphanumeric/slash/hyphen interior); portable suffixes containing `/` are encoded safely but may return 404 from the API's single-segment route. Ionosonde MUF rejects coordinates, GeoJSON and a nondefault hop distance because these do not apply to station measurements.

```js
const client = new Client();
try {
  const tec = await client.ionosphere.tec({ lat: 37.57, lon: 126.98 });
  const predicted = await client.propagation.path({
    from: 'Seoul', to: 'Tokyo', frequency: 14.074, mode: 'ft8',
  });
  const reports = await client.observations.live({ band: '20m', minutes: 15 });
  console.log(tec.data, predicted.data, reports.data);
} finally {
  client.close();
}
```

## Responses and errors

`APIResponse` contains `data`, `rawBody` (original UTF-8 bytes as `Uint8Array`), `statusCode`, an allowlist of safe `headers`, and `rateLimit` (`limit`, `remaining`, `resetSeconds`, `retryAfter`). Quota values may be null; `resetSeconds` is a duration, never an epoch. JSON fields, unknown properties, timestamps, nulls, units and attribution are preserved. Generic `JSONObject` types intentionally avoid guessing fixed schemas for nested model/provider payloads. See the [public OpenAPI](https://ionoflux.runvia.app/openapi.json) for response schemas. JSON numbers follow JavaScript number precision.

Errors derive from `IonoFluxError`: `ConfigurationError`, `TransportError`, `ResponseError`, and `APIError`. HTTP subclasses: `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404), `ValidationError` (422), `RateLimitError` (429), `ServerError` (5xx), `RedirectError` (3xx). API errors include sanitized `detail`, `statusCode`, `rateLimit`, `retryAfter`; they contain no request object or transport cause. Local argument errors are `RangeError`. Missing credentials include the key issuance link. Do not log raw transport objects or sensitive successful response bodies.

Client options: `baseUrl` (default `https://ionoflux.runvia.app/v1`, HTTPS root ending in `/v1`, no credentials/query/fragment), `timeoutMs` (10000; total deadline per attempt including the body), `maxRetries` (1, integer 0–3), optional fetch-compatible `fetch` (caller owns it; it must respect AbortSignal). Native Node.js fetch supplies connection pooling; its global dispatcher/network configuration remains the application's responsibility. `close()` aborts in-flight requests and refuses future calls; it leaves the shared runtime pool/custom transport owned by the caller. `Symbol.dispose` is supported.

Only selected transient network failures/timeouts and HTTP 502/503/504 retry with 250/500/1000 ms backoff. `Retry-After` or remaining quota 0 suppresses HTTP retries. No automatic 429 retry or daily quota sleep. Redirects are refused, credentials omitted on public metadata routes, and the SDK adds no Origin/Referer. Each request has fixed `utm_source=nodejs`, `utm_medium=sdk`, `utm_content=0.1.4` and `User-Agent: ionoflux-node/0.1.4`; the tags contain no user/key/host identifiers.

## Data meaning and license

GloTEC TEC/MUF maps and HF path forecasts are **model results**; read `model`, `ionosphere_basis`, `confidence` and response limitations. GIRO station/ionosonde data are measurements. PSK Reporter and WSPRnet are reception reports: no report does not prove a closed band, and SNR is not comparable across receivers. Preserve attribution and consult `sources()` for provider terms; WSPRnet data restrict commercial use. This SDK does not promise forecast accuracy or change API quota/access rules.

Licensed under [PolyForm Noncommercial 1.0.0](https://github.com/hongjunna/ionoflux-npm/blob/main/LICENSE). See [NOTICE](https://github.com/hongjunna/ionoflux-npm/blob/main/NOTICE). Commercial use requires separate permission; provider data terms apply independently.
