// src/utils/secureFetch.ts
import { getItem } from "./storage";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default async function secureFetch(url: string, options: any = {}) {
  const token = await getItem("token");

  // Get platform - default to 'web' if Platform.OS fails
  let platform = "web";
  try {
    platform = Platform.OS;
  } catch (e) {
    // Fallback to web if Platform is not available
  }

  // Build the URL with platform query parameter as fallback
  let finalUrl = `${API_URL}${url}`;
  const separator = url.includes("?") ? "&" : "?";
  finalUrl = `${finalUrl}${separator}platform=${platform}`;

  const headers: any = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : "",
  };

  // Only send expo-platform header on native (not web, to avoid CORS issues)
  if (platform !== "web") {
    headers["expo-platform"] = platform;
  }

  const res = await fetch(finalUrl, {
    ...options,
    headers,
  });

  if (!res.ok) {
    console.log("❌ API Error:", res.status, url);
    throw new Error(`API ${res.status}: ${url}`);
  }

  return res.json();
}
