/**
 * LiveRouteMap Component
 * Displays multi-stop delivery route with Leaflet map
 * Shows driver location, pickup, delivery stops, polyline connecting them
 */

import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import { MultiStopRoute, Stop } from "../hooks/useMultiStopRoute";

interface LiveRouteMapProps {
  route: MultiStopRoute;
  driverLocation?: { latitude: number; longitude: number } | null;
  highlightedStopId?: number | null;
  onStopSelected?: (stop: Stop) => void;
}

const { height: screenHeight } = Dimensions.get("window");

export const LiveRouteMap = React.memo(
  ({ route, driverLocation, highlightedStopId, onStopSelected }: LiveRouteMapProps) => {
    // Generate map HTML
    const mapHtml = useMemo(() => {
      return generateMapHTML(route, driverLocation, highlightedStopId);
    }, [route, driverLocation, highlightedStopId]);

    return (
      <View style={styles.container}>
        <WebView
          style={styles.map}
          source={{ html: mapHtml }}
          scrollEnabled={false}
          javaScriptEnabled={true}
          scalesPageToFit={true}
          originWhitelist={["*"]}
          startInLoadingState={false}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "STOP_SELECTED" && onStopSelected) {
                const stop = route.stops.find((s) => s.id === data.stopId);
                if (stop) onStopSelected(stop);
              }
            } catch (err) {
              console.log("Map message error:", err);
            }
          }}
        />
      </View>
    );
  }
);

LiveRouteMap.displayName = "LiveRouteMap";

/**
 * Generate HTML for Leaflet map with multi-stop route
 */
function generateMapHTML(
  route: MultiStopRoute,
  driverLocation?: { latitude: number; longitude: number } | null,
  highlightedStopId?: number | null
): string {
  // Calculate map center
  const centerLat = driverLocation?.latitude || route.stops[0]?.latitude || 38.423734;
  const centerLng = driverLocation?.longitude || route.stops[0]?.longitude || 27.142826;

  // Build markers HTML
  const markers = route.stops
    .map((stop, idx) => {
      const isHighlighted = stop.id === highlightedStopId;
      const color = stop.type === "pickup" ? "#FCD34D" : "#34D399";
      const borderColor = stop.type === "pickup" ? "#F59E0B" : "#10B981";

      return `
    (function() {
      var marker = L.divIcon({
        html: '<div style="background:${color};color:#111;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;border:3px solid ${borderColor};font-size:16px;${isHighlighted ? "box-shadow:0 0 10px rgba(99, 165, 245, 0.8);" : ""}">${stop.letter}</div>',
        iconSize: [40, 40],
        className: 'stop-marker'
      });
      
      L.marker([${stop.latitude}, ${stop.longitude}], { icon: marker })
        .addTo(window.map)
        .bindPopup('<div style="font-family:system-ui;font-size:13px;"><strong>${stop.letter}</strong> ${stop.customerName || stop.type}<br/>${stop.address.substring(0, 50)}</div>')
        .on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'STOP_SELECTED',stopId:${stop.id}}));
        });
    })();
      `;
    })
    .join("\n");

  // Build polyline coordinates
  const polylineCoords = route.stops.map((stop) => `[${stop.latitude}, ${stop.longitude}]`).join(",");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
      <style>
        * { margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }
        .stop-marker { display: flex !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <script>
        window.map = L.map('map', { center: [${centerLat}, ${centerLng}], zoom: 14 });
        
        // Tile layer with Google Maps styling
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          attribution: '© Google Maps',
          crossOrigin: true
        }).addTo(window.map);
        
        // Fallback to OSM if Google fails
        window.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
          crossOrigin: true
        });
        
        // Add stop markers
        ${markers}
        
        // Draw polyline connecting all stops
        L.polyline([${polylineCoords}], {
          color: '#3B82F6',
          weight: 4,
          opacity: 0.7,
          dashArray: '5, 5'
        }).addTo(window.map);
        
        // Add driver location
        ${
          driverLocation
            ? `
          L.circleMarker([${driverLocation.latitude}, ${driverLocation.longitude}], {
            radius: 12,
            fillColor: '#3B82F6',
            color: '#1D4ED8',
            weight: 3,
            fillOpacity: 0.9
          }).addTo(window.map)
            .bindPopup('<div style="font-family:system-ui;font-size:12px;"><strong>Driver</strong></div>');
        `
            : ""
        }
        
        // Fit bounds to all markers
        var bounds = L.latLngBounds([
          ${route.stops.map((s) => `[${s.latitude}, ${s.longitude}]`).join(",")}
          ${driverLocation ? `,\n          [${driverLocation.latitude}, ${driverLocation.longitude}]` : ""}
        ]);
        window.map.fitBounds(bounds, { padding: [50, 50] });
        
        console.log('✅ Multi-stop map ready with ${route.stops.length} stops');
      </script>
    </body>
    </html>
  `;

  return html;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});
