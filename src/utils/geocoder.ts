/**
 * Geocoding Utility
 * Converts addresses to coordinates using Nominatim (OpenStreetMap)
 */

interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}

/**
 * Extract city/country from address for fallback geocoding
 * Helps with Turkish and other international addresses
 */
function extractLocationParts(address: string): { city?: string; country?: string } {
  const parts = address.split(",").map((p) => p.trim());
  return {
    city: parts[parts.length - 2] || undefined,
    country: parts[parts.length - 1] || undefined,
  };
}

/**
 * Extract city from Turkish address format
 * Handles formats like "HURRY BEY, 4 Eylül, Ortaokul Cd. No:34, 35900 Tire/İzmir"
 */
function extractTurkishCity(address: string): string | undefined {
  // Look for pattern like "35900 Tire/İzmir" or "Tire/İzmir" or "Tire, İzmir"
  const matches = address.match(/(\d{5})?\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+)\/([A-ZÇĞİÖŞÜa-zçğıöşü]+)|([A-ZÇĞİÖŞÜa-zçğıöşü]+),\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+)$/);
  
  if (matches) {
    // Format: postal_code city/province or city, province
    if (matches[2] && matches[3]) {
      return `${matches[2]}, ${matches[3]}`; // city, province
    } else if (matches[4] && matches[5]) {
      return `${matches[4]}, ${matches[5]}`; // city, province
    }
  }
  
  // Fallback: try to extract last two comma-separated parts
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  
  return undefined;
}

/**
 * Geocode an address to coordinates
 * Uses Nominatim (free, no API key required)
 * Includes fallback strategy for non-ASCII addresses
 * @param address - Address string to geocode
 * @returns Promise with lat, lng, and resolved address
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim() === "") {
    console.warn("⚠️ Geocoder: Empty address");
    return null;
  }

  try {
    console.log(`🔍 Geocoding: "${address}"`);

    // Try exact address first
    const encodedAddress = encodeURIComponent(address);
    let url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&language=en`;

    let response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "BeyProMobileApp/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let results = await response.json();

    // If no results, try Turkish city extraction
    if (!results || results.length === 0) {
      console.warn(`⚠️ Geocoder: No results for "${address}", trying Turkish city fallback...`);
      
      const turkishCity = extractTurkishCity(address);
      if (turkishCity) {
        const encodedFallback = encodeURIComponent(turkishCity);
        url = `https://nominatim.openstreetmap.org/search?q=${encodedFallback}&format=json&limit=1&language=en`;
        
        response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "BeyProMobileApp/1.0",
          },
        });

        if (response.ok) {
          results = await response.json();
          console.log(`🔄 Turkish city fallback for "${turkishCity}": ${results.length > 0 ? "✅ Success" : "❌ No results"}`);
        }
      }
    }

    // If still no results, try generic city/country extraction
    if (!results || results.length === 0) {
      console.warn(`⚠️ Geocoder: No results for "${address}", trying generic fallback...`);
      
      const { city, country } = extractLocationParts(address);
      if (city) {
        const fallbackQuery = country ? `${city}, ${country}` : city;
        const encodedFallback = encodeURIComponent(fallbackQuery);
        url = `https://nominatim.openstreetmap.org/search?q=${encodedFallback}&format=json&limit=1&language=en`;
        
        response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "BeyProMobileApp/1.0",
          },
        });

        if (response.ok) {
          results = await response.json();
          console.log(`🔄 Generic fallback for "${fallbackQuery}": ${results.length > 0 ? "✅ Success" : "❌ No results"}`);
        }
      }
    }

    if (!results || results.length === 0) {
      console.warn(`⚠️ Geocoder: No results for "${address}" (all strategies exhausted)`);
      return null;
    }

    const result = results[0];
    const geocoded: GeocodeResult = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name,
    };

    console.log(`✅ Geocoded "${address}" -> (${geocoded.lat}, ${geocoded.lng})`);
    return geocoded;
  } catch (error) {
    console.error("❌ Geocoding error:", error);
    return null;
  }
}

/**
 * Batch geocode multiple addresses
 * @param addresses - Array of address strings
 * @returns Promise with array of geocoding results
 */
export async function geocodeAddresses(addresses: string[]): Promise<(GeocodeResult | null)[]> {
  return Promise.all(addresses.map((addr) => geocodeAddress(addr)));
}

/**
 * Reverse geocode coordinates to address
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Promise with address string
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    console.log(`🔍 Reverse geocoding: (${lat}, ${lng})`);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "BeyProMobileApp/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const address = result.address?.road || result.display_name || "Unknown location";

    console.log(`✅ Reverse geocoded (${lat}, ${lng}) -> "${address}"`);
    return address;
  } catch (error) {
    console.error("❌ Reverse geocoding error:", error);
    return null;
  }
}
