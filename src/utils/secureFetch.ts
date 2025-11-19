// src/utils/secureFetch.ts
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default async function secureFetch(url: string, options: any = {}) {
  const token = await SecureStore.getItemAsync("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : "",
  };

  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    console.log("❌ API Error:", res.status, url);
    throw new Error(`API ${res.status}: ${url}`);
  }

  return res.json();
}
