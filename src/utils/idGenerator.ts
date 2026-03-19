import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const CLIENT_ID_KEY = 'enablr_client_id';

let cachedClientId: string | null = null;

export function generateId(): string {
  return Crypto.randomUUID();
}

export async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  let clientId = await SecureStore.getItemAsync(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = generateId();
    await SecureStore.setItemAsync(CLIENT_ID_KEY, clientId);
  }

  cachedClientId = clientId;
  return clientId;
}
