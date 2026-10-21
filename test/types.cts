import { Client, APIResponse } from 'ionoflux';
const client = new Client();
const response: Promise<APIResponse> = client.sources();
void response;
client.close();
