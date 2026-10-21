import { Client, APIResponse, JSONObject, Band } from 'ionoflux';
const client = new Client({ apiKey: 'example' });
const band: Band = '20m';
const response: Promise<APIResponse<JSONObject>> = client.observations.live({ band, bbox: [-1,-1,1,1] });
void response;
void client.propagation.path({ from: 'Seoul', to: 'Tokyo', frequency: 14.074 });
void client.alerts.list({ category: ['WATCH'] });
// @ts-expect-error unsupported band
client.observations.live({ band: '2m' });
// @ts-expect-error frequency required
client.propagation.path({ from: 'Seoul', to: 'Tokyo' });
// @ts-expect-error invalid source
client.solar.sunspots({ source: 'gfz' });
client.close();
