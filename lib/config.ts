import { getBaseUrl } from './dev-host';

export const API_BASE_URL =
    __DEV__ ? getBaseUrl(Number(process.env.EXPO_PUBLIC_PORT) ?? 4000) : (process.env.EXPO_PUBLIC_API_BASE_URL ?? '');

console.log(API_BASE_URL);
