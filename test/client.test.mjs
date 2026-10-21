import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as sdk from '../dist/esm/index.js';
const { Client, VERSION } = sdk;
const key = 'test-key-SECRET+"/';
function fixture(body = { value: null, unknown: { unit: 'TECU', time: '2026-10-21T00:00:00Z' } }, status = 200, headers = {}) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url: new URL(url), init }); return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }); };
  return { client: new Client({ apiKey: key, maxRetries: 0, fetch }), calls, fetch };
}
test('ESM and CommonJS share classes and version', async () => {
  const { createRequire } = await import('node:module');
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.equal(cjs.Client, Client); assert.equal(VERSION, '0.1.4');
});
test('preserves raw JSON, unknown fields, null, timestamps and safe quota metadata', async () => {
  const raw = '{"value":null,"new":42,"time":"2026-10-21T00:00:00+09:00"}';
  const { client } = fixture(raw, 200, { 'X-RateLimit-Limit': '1000', 'X-RateLimit-Remaining': '999', 'X-RateLimit-Reset': '42', 'set-cookie': 'secret', 'x-debug': key });
  const r = await client.solar.flux();
  assert.deepEqual(r.data, JSON.parse(raw)); assert.equal(Buffer.from(r.rawBody).toString(), raw);
  assert.deepEqual(r.rateLimit, { limit: 1000, remaining: 999, resetSeconds: 42, retryAfter: null });
  assert.equal(r.headers['set-cookie'], undefined); assert.equal(r.headers['x-debug'], undefined);
});
test('GET-only requests carry fixed UTM and UA; redirects disabled', async () => {
  const { client, calls } = fixture(); await client.spaceWeather.current();
  const { url, init } = calls[0]; assert.equal(url.origin, 'https://ionoflux.runvia.app');
  assert.equal(url.pathname, '/v1/space-weather/current');
  assert.deepEqual(Object.fromEntries(url.searchParams), { utm_source: 'nodejs', utm_medium: 'sdk', utm_content: VERSION });
  assert.equal(init.headers['X-API-Key'], key); assert.equal(init.headers['User-Agent'], `ionoflux-node/${VERSION}`);
  assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
});
test('public routes never send keys', async () => {
  const { client, calls } = fixture(); await client.sources(); await client.data.status(); await client.data.status('tec');
  assert.equal(calls.length, 3); for (const { init } of calls) assert.equal(init.headers['X-API-Key'], undefined);
});
test('missing key includes account link without network', async () => {
  const previous = process.env.IONOFLUX_API_KEY; delete process.env.IONOFLUX_API_KEY;
  try { const { fetch, calls } = fixture(); const c = new Client({ fetch });
    await assert.rejects(c.solar.flux(), e => e instanceof sdk.ConfigurationError && e.message.includes(sdk.KEY_URL));
    assert.equal(calls.length, 0); await c.sources();
  } finally { if (previous !== undefined) process.env.IONOFLUX_API_KEY = previous; }
});
test('environment key is used and explicit key takes precedence', async () => {
  const previous = process.env.IONOFLUX_API_KEY; process.env.IONOFLUX_API_KEY = 'env-key';
  try { const f = fixture(); await new Client({ fetch: f.fetch }).solar.flux(); assert.equal(f.calls[0].init.headers['X-API-Key'], 'env-key');
    await f.client.solar.flux(); assert.equal(f.calls[1].init.headers['X-API-Key'], key);
  } finally { if (previous === undefined) delete process.env.IONOFLUX_API_KEY; else process.env.IONOFLUX_API_KEY = previous; }
});
for (const options of [ { apiKey: '' }, { apiKey: 'a b' }, { apiKey: 'a\nb' }, { apiKey: '키' },
  { baseUrl: 'http://example.com/v1' }, { baseUrl: 'https://a:b@example.com/v1' }, { baseUrl: 'https://example.com/v1?q=x' },
  { baseUrl: 'https://example.com/v1#x' }, { baseUrl: 'https://example.com/v2' }, { baseUrl: 'no-url' },
  { timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: 2147483648 }, { maxRetries: 4 }, { maxRetries: true } ])
  test(`invalid configuration ${JSON.stringify(options)}`, () => assert.throws(() => new Client(options), sdk.ConfigurationError));
test('custom HTTPS API prefix keeps v1 exactly once', async () => {
  const f = fixture(); await new Client({ baseUrl: 'https://example.com/api/v1/', fetch: f.fetch }).sources();
  assert.equal(f.calls[0].url.pathname, '/api/v1/sources');
});
const routes = [
  ['solar.flux', c => c.solar.flux(), 'solar/flux', { interval: 'raw', limit: '5000' }],
  ['solar.sunspots', c => c.solar.sunspots({ source: 'silso' }), 'solar/sunspots', { source: 'silso' }],
  ['solar.xray', c => c.solar.xray(), 'solar/xray', { band: 'long' }],
  ['solar.wind', c => c.solar.wind(), 'solar/wind', { parameter: 'speed' }],
  ['geomagnetic.kp', c => c.geomagnetic.kp({ includeForecast: false }), 'geomagnetic/kp', { include_forecast: 'false' }],
  ['geomagnetic.ap', c => c.geomagnetic.ap(), 'geomagnetic/ap', { interval: 'raw' }],
  ['statistics', c => c.statistics('ssn', { source: 'silso' }), 'statistics/ssn', { source: 'silso' }],
  ['alerts.scales', c => c.alerts.scales(), 'alerts/scales', {}],
  ['ionosphere.tec', c => c.ionosphere.tec({ lat: 37, lon: 127, format: 'geojson' }), 'ionosphere/tec', { lat: '37', lon: '127', format: 'geojson' }],
  ['ionosphere.muf', c => c.ionosphere.muf(), 'ionosphere/muf', { hop_km: '3000', source: 'model' }],
  ['ionosphere.stations', c => c.ionosphere.stations(), 'ionosphere/stations', { max_age_hours: '6' }],
  ['propagation.path', c => c.propagation.path({ from: 'PM95', to: 'FN31', frequency: 14.074, txGain: 3 }), 'propagation/path', { from: 'PM95', to: 'FN31', frequency: '14.074', tx_gain: '3', rx_gain: '2.15', mode: 'ft8', power: '100' }],
  ['propagation.forecast', c => c.propagation.forecast({ from: 'Seoul', to: 'Tokyo' }), 'propagation/forecast', { hours: '24' }],
  ['propagation.conditions', c => c.propagation.conditions(), 'propagation/conditions', {}],
  ['observations.live', c => c.observations.live({ bbox: [120,30,140,40], band: '20m', mode: 'FT8' }), 'observations/live', { bbox: '120,30,140,40', band: '20m', mode: 'FT8', minutes: '15', limit: '2000' }],
  ['observations.paths', c => c.observations.paths({ from: 'PM95', to: 'FN31' }), 'observations/paths', { radius_km: '500', hours: '1' }],
  ['observations.bands', c => c.observations.bands(), 'observations/bands', { radius_km: '1000', role: 'rx', minutes: '15' }],
  ['observations.callsign', c => c.observations.callsign('HL1ABC/P'), 'observations/callsign/HL1ABC%2FP', { role: 'tx', hours: '24', limit: '300' }],
];
for (const [name, call, path, params] of routes) test(`contract: ${name}`, async () => {
  const { client, calls } = fixture(); await call(client); assert.equal(calls[0].url.pathname, `/v1/${path}`);
  for (const [k,v] of Object.entries(params)) assert.equal(calls[0].url.searchParams.get(k), v, k);
  assert.equal(calls[0].url.searchParams.has('start'), false);
});
test('date ranges normalize explicit offsets and Date instants into UTC', async () => {
  const f = fixture(); await f.client.solar.flux({ start: '2026-10-21T09:00:00+09:00', end: new Date('2026-10-22T00:00:00Z') });
  assert.equal(f.calls[0].url.searchParams.get('start'), '2026-10-21T00:00:00.000Z');
  assert.equal(f.calls[0].url.searchParams.get('end'), '2026-10-22T00:00:00.000Z');
});
test('alerts repeat categories and preserve array response', async () => {
  const f = fixture([{ category: 'WATCH', future: null }]); const r = await f.client.alerts.list({ category: ['WATCH','WARNING'] });
  assert.deepEqual(f.calls[0].url.searchParams.getAll('category'), ['WATCH','WARNING']); assert.deepEqual(r.data, [{ category: 'WATCH', future: null }]);
});
const invalid = [
  c => c.solar.flux({ interval: 'year' }), c => c.solar.flux({ limit: true }), c => c.solar.flux({ limit: 10001 }),
  c => c.solar.flux({ start: '2026-10-21T00:00:00' }), c => c.solar.flux({ start: new Date('bad') }),
  c => c.solar.flux({ start: '2026-10-22T00:00:00Z', end: '2026-10-21T00:00:00Z' }),
  c => c.solar.flux({ start: '2000-01-01T00:00:00Z', end: '2026-10-21T00:00:00Z' }),
  c => c.statistics('__proto__'), c => c.statistics('sfi', { source: 'silso' }),
  c => c.data.status('../sources'), c => c.alerts.list({ category: 'WATCH' }), c => c.alerts.list({ category: ['bad'] }),
  c => c.ionosphere.tec({ lat: 0 }), c => c.ionosphere.tec({ lat: NaN, lon: 0 }),
  c => c.ionosphere.muf({ source: 'ionosonde', hopKm: 1000 }), c => c.ionosphere.muf({ source: 'ionosonde', format: 'geojson' }),
  c => c.ionosphere.stations({ maxAgeHours: 49 }),
  c => c.propagation.path({ from: 'A', to: 'Tokyo', frequency: 14 }),
  c => c.propagation.path({ from: 'Seoul', to: 'Tokyo', frequency: 55 }),
  c => c.propagation.path({ from: 'Seoul', to: 'Tokyo', frequency: 14, power: 0 }),
  c => c.propagation.forecast({ from: 'Seoul', to: 'Tokyo', hours: 73 }),
  c => c.observations.live({ bbox: [140,30,120,40] }), c => c.observations.live({ bbox: [0,0,1] }),
  c => c.observations.live({ minutes: 61 }), c => c.observations.live({ band: '2m' }),
  c => c.observations.live({ mode: 'x'.repeat(17) }), c => c.observations.paths({ from: 'Seoul', to: 'Tokyo', hours: 0 }),
  c => c.observations.bands({ role: 'both' }), c => c.observations.callsign('../sources'),
];
for (const [i, call] of invalid.entries()) test(`validation prevents HTTP #${i + 1}`, async () => {
  const f = fixture(); await assert.rejects(async () => call(f.client), RangeError); assert.equal(f.calls.length, 0);
});
for (const [code, name] of [[301,'RedirectError'],[401,'AuthenticationError'],[403,'PermissionDeniedError'],[404,'NotFoundError'],[422,'ValidationError'],[429,'RateLimitError'],[500,'ServerError'],[400,'APIError']])
  test(`HTTP ${code} maps to ${name} with redaction`, async () => {
    const f = fixture({ detail: [key, encodeURIComponent(key)] }, code, { 'retry-after': key });
    await assert.rejects(f.client.solar.flux(), e => {
      assert.ok(e instanceof sdk[name]); assert.equal(e.statusCode, code); assert.ok(!inspect(e).includes(key));
      assert.ok(!JSON.stringify(e).includes(key)); assert.equal(e.cause, undefined); assert.equal(e.request, undefined);
      assert.equal(e.retryAfter, '<redacted>'); return true;
    }); assert.equal(f.calls.length, 1);
  });
test('client inspect and JSON never expose key', () => {
  const f = fixture(); assert.ok(!inspect(f.client).includes(key)); assert.ok(!JSON.stringify(f.client).includes(key));
});
for (const body of ['<html>bad</html>', 'null', '[]', '5', '"str"']) test(`rejects malformed/object-shape response ${body}`, async () => {
  await assert.rejects(fixture(body).client.sources(), sdk.ResponseError);
});
test('alerts reject non-object members', async () => { await assert.rejects(fixture([1]).client.alerts.list(), sdk.ResponseError); });
test('HTML failures are not copied into errors', async () => {
  await assert.rejects(fixture(`<html>${key}</html>`, 500).client.solar.flux(), e => e.detail === 'Request failed');
});
test('malformed and unsafe numeric quotas become null', async () => {
  const r = await fixture({}, 200, { 'X-RateLimit-Limit': 'x', 'X-RateLimit-Remaining': '99999999999999999999', 'X-RateLimit-Reset': '-1' }).client.sources();
  assert.equal(r.rateLimit.limit, null); assert.equal(r.rateLimit.remaining, null); assert.equal(r.rateLimit.resetSeconds, null);
});
test('bounded 503 retries then succeeds', async () => {
  let calls = 0; const c = new Client({ apiKey: key, maxRetries: 1, fetch: async () => new Response('{}', { status: ++calls === 1 ? 503 : 200 }) });
  await c.solar.flux(); assert.equal(calls, 2);
});
for (const headers of [{ 'retry-after': '0' }, { 'x-ratelimit-remaining': '0' }]) test(`quota hints suppress 503 retries ${JSON.stringify(headers)}`, async () => {
  let calls = 0; const c = new Client({ apiKey: key, maxRetries: 3, fetch: async () => { calls++; return new Response('{}', { status: 503, headers }); } });
  await assert.rejects(c.solar.flux(), sdk.ServerError); assert.equal(calls, 1);
});
test('transport failures retry selected codes without leaking cause', async () => {
  let calls = 0; const c = new Client({ apiKey: key, maxRetries: 1, fetch: async () => { calls++; throw new Error(key, { cause: { code: 'ECONNRESET', request: key } }); } });
  await assert.rejects(c.solar.flux(), e => e instanceof sdk.TransportError && e.cause === undefined && !inspect(e).includes(key)); assert.equal(calls, 2);
});
test('unknown transport failures do not retry', async () => {
  let calls = 0; const c = new Client({ apiKey: key, fetch: async () => { calls++; throw new Error(key); } });
  await assert.rejects(c.solar.flux(), sdk.TransportError); assert.equal(calls, 1);
});
test('timeout covers reading the body', async () => {
  const c = new Client({ apiKey: key, timeoutMs: 10, maxRetries: 0, fetch: async (_u, init) => ({
    status: 200, headers: new Headers(), arrayBuffer: () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error(key)), { once: true }))
  }) }); await assert.rejects(c.solar.flux(), sdk.TransportError);
});
test('close aborts in-flight requests and prevents subsequent HTTP', async () => {
  let started; const ready = new Promise(r => { started = r; });
  const c = new Client({ apiKey: key, fetch: async (_u, init) => new Promise((_resolve, reject) => { started(); init.signal.addEventListener('abort', () => reject(new Error(key)), { once: true }); }) });
  const pending = c.solar.flux(); await ready; c.close(); await assert.rejects(pending, sdk.ConfigurationError);
  assert.equal(c.isClosed, true); await assert.rejects(c.sources(), sdk.ConfigurationError); c.close();
});

test('timestamps reject calendar rollover and ambiguous midnight', async () => {
  const f = fixture();
  for (const start of ['2026-02-30T00:00:00Z', '2026-02-29T00:00:00Z', '2026-10-21T24:00:00Z'])
    await assert.rejects(async () => f.client.solar.flux({ start }), RangeError);
  assert.equal(f.calls.length, 0);
});
test('429 never retries even with remaining retry budget', async () => {
  let calls = 0; const c = new Client({ apiKey: key, maxRetries: 3, fetch: async () => { calls++; return new Response('{}', { status: 429 }); } });
  await assert.rejects(c.solar.flux(), sdk.RateLimitError); assert.equal(calls, 1);
});
test('invalid UTF-8 is a response error and is never retried', async () => {
  let calls = 0; const c = new Client({ fetch: async () => { calls++; return new Response(new Uint8Array([0xff,0xfe])); } });
  await assert.rejects(c.sources(), sdk.ResponseError); assert.equal(calls, 1);
});
