// src/api/secureFetch.ts
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getItem } from "../utils/storage";

const exp = Constants.expoConfig ?? (Constants as any).manifest ?? {};
const DEFAULT_API_URL = "https://hurrypos-backend.onrender.com/api";
const resolveUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\/+$/, "");
  if (normalized.endsWith("/api")) return normalized;
  // Keep sub-paths that already include /api somewhere (e.g. /api/v2)
  if (/\/api($|\/)/.test(normalized)) return normalized;
  return `${normalized}/api`;
};
const API_URL =
  resolveUrl(process.env.EXPO_PUBLIC_API_URL) ||
  resolveUrl(exp.extra?.EXPO_PUBLIC_API_URL) ||
  DEFAULT_API_URL;

export default async function secureFetch(
  endpoint: string,
  options: any = {}
) {
  // Use storage wrapper to get token (handles both secure and regular storage)
  const token = await getItem("token");

  // Get platform - default to 'web' if Platform.OS fails
  let platform = "web";
  try {
    platform = Platform.OS;
  } catch (e) {
    // Fallback to web if Platform is not available
  }

  // Build the URL with platform query parameter as fallback
  let url = `${API_URL}${endpoint}`;
  const separator = endpoint.includes("?") ? "&" : "?";
  url = `${url}${separator}platform=${platform}`;

  const headers: any = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Only send expo-platform header on native (not web, to avoid CORS issues)
  if (platform !== "web") {
    headers["expo-platform"] = platform;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Try to parse a useful error message. Prefer JSON, then <pre> blocks in HTML, otherwise a trimmed text snippet.
    const contentType = res.headers.get("content-type") || "";
    let bodyText = await res.text();
    let extractedMessage = bodyText;

    try {
      if (contentType.includes("application/json")) {
        const json = JSON.parse(bodyText);
        // Common API error shapes: { message } or { error }
        extractedMessage = json.message || json.error || JSON.stringify(json);
      } else if (contentType.includes("text/html")) {
        // Try to extract text inside <pre> tags (common express error pages)
        const preMatch = bodyText.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        if (preMatch && preMatch[1]) {
          extractedMessage = preMatch[1].trim();
        } else {
          // Strip HTML tags for a short snippet
          extractedMessage = bodyText.replace(/<[^>]+>/g, "").trim();
        }
      }
    } catch (e) {
      // Fallback to raw bodyText when parsing fails
      extractedMessage = bodyText;
    }

    const err = new Error(`API ${res.status} ${res.statusText}: ${extractedMessage}`);
    // Attach response details for callers that want to inspect programmatically
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    (err as any).body = bodyText;
    throw err;
  }

  return res.json();
}
