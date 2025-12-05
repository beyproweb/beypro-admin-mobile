import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  PanResponder,
  Animated,
  Alert,
  ActionSheetIOS,
  Modal,
  TouchableWithoutFeedback,
  GestureResponderEvent,
  PanResponderGestureState,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { PixelRatio } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import * as Haptics from "expo-haptics";
import * as Speech from 'expo-speech';
import * as SecureStore from "expo-secure-store";
import secureFetch from "../api/secureFetch";
import { DeliveryStop, RouteInfo } from "../types/delivery";
import { geocodeAddress } from "../utils/geocoder";
import { fetchDriverRoute, calculateRoute } from "../utils/deliveryRouteService";

const { height: screenHeight } = Dimensions.get("window");

interface MapModalProps {
  visible: boolean;
  onDismiss: () => void;
  orderId?: number;
  
  driverId?: string | number; // Add driver ID
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
  driverName?: string;
  onLocationUpdate?: (lat: number, lng: number) => void; // Optional callback for real-time updates
  // Multi-stop mode props
  multiStopMode?: boolean;
  route?: RouteInfo | null;
  onStopSelected?: (stop: DeliveryStop) => void;
  // Callback when an order is delivered via swipe (parent can update its UI)
  onOrderDelivered?: (orderId: number) => void;
  // For single-order mode allow parent to pass driver/order status so UI can reflect delivered
  orderDriverStatus?: string | null;
}

// Type for driver location updates from socket
export interface DriverLocationUpdate {
  driver_id: string | number;
  lat: number;
  lng: number;
  timestamp?: number;
}

interface LanguageOption {
  label: string;
  code: string;
  locale: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { label: "English", code: "en", locale: "en-US" },
  { label: "Türkçe", code: "tr", locale: "tr-TR" },
  { label: "Español", code: "es", locale: "es-ES" },
  { label: "Français", code: "fr", locale: "fr-FR" },
];

const LANGUAGE_STORAGE_KEY = "mapModalLanguage";

const ANNOUNCEMENT_TEMPLATES: Record<string, string> = {
  en: "Pickup in {minutes}",
  tr: "Alış {minutes} içinde",
  es: "Recogida en {minutes}",
  fr: "Retrait dans {minutes}",
};

export interface MapModalRef {
  updateDriverLocation: (lat: number, lng: number, driverId?: string | number) => void;
}

export const MapModal = React.forwardRef<MapModalRef, MapModalProps>(
    (
    {
      visible,
      onDismiss,
      orderId,
      driverId,
      deliveryLat,
      deliveryLng,
      deliveryAddress,
      pickupLat,
      pickupLng,
      pickupAddress,
      driverName,
      onLocationUpdate,
      multiStopMode = false,
      route,
      onStopSelected,
      onOrderDelivered,
      orderDriverStatus,
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const { user: authUser } = useAuth();
    const effectiveDriverName = driverName ?? authUser?.name ?? null;
  // Compute a safe top offset for map controls (leaflet zoom buttons) so they don't overlap the modal header
  const defaultStatusBar = (StatusBar && StatusBar.currentHeight) ? StatusBar.currentHeight : 12;
  // Convert millimeters to device pixels. Approximate DPI = PixelRatio.get() * 160
  const mmToPx = (mm: number) => Math.round((mm * (PixelRatio.get() * 160)) / 25.4);
  const extraOffsetPx = mmToPx(0.5); // 0.5 mm downward nudge
  const mapControlTop = Math.round((insets.top && insets.top > 0 ? insets.top : defaultStatusBar) + 56 + extraOffsetPx); // header height buffer + small nudge
    const [currentLat, setCurrentLat] = useState<number | null>(null);
    const [currentLng, setCurrentLng] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchedRoute, setFetchedRoute] = useState<RouteInfo | null>(null);
    const [geocodedDeliveryLat, setGeocodedDeliveryLat] = useState<number | null>(null);
    const [geocodedDeliveryLng, setGeocodedDeliveryLng] = useState<number | null>(null);
    const [geocodedPickupLat, setGeocodedPickupLat] = useState<number | null>(null);
    const [geocodedPickupLng, setGeocodedPickupLng] = useState<number | null>(null);
    // Helper: compute distance in kilometers between two lat/lng points (Haversine)
    const distanceKm = (lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) => {
      if (!lat1 || !lon1 || !lat2 || !lon2) return Number.POSITIVE_INFINITY;
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    const webViewRef = useRef<WebView>(null);
    const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const mapReadyRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const pendingLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [encodedPolyline, setEncodedPolyline] = useState<string | null>(null);
  // For single-delivery we may show two separate polylines: driver->pickup and pickup->delivery
  const [encodedPolylineToPickup, setEncodedPolylineToPickup] = useState<string | null>(null);
  const [encodedPolylineToDelivery, setEncodedPolylineToDelivery] = useState<string | null>(null);
  // For single-delivery mode: store ETA times for pickup and delivery (in minutes)
  const [pickupETA, setPickupETA] = useState<number | null>(null);
  const [pickupEtaAnnounced, setPickupEtaAnnounced] = useState(false);
  const [deliveryETA, setDeliveryETA] = useState<number | null>(null);
  const [driverLocationKnown, setDriverLocationKnown] = useState(false);
  // --- Minimal TTS (expo-speech) state & helpers for a quick demo ---
  const [ttsLanguage, setTtsLanguage] = useState<string>("en"); // language for Directions API (ISO code)
  const [ttsLocale, setTtsLocale] = useState<string>("en-US"); // locale for TTS voice

  // Proximity-based announcer state
  const [stepsToAnnounce, setStepsToAnnounce] = useState<Array<{ text: string; lat?: number | null; lng?: number | null; announced?: boolean }>>([]);
  const [speakingActive, setSpeakingActive] = useState<boolean>(false);
  const [showLangPicker, setShowLangPicker] = useState<boolean>(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);

  const stripHtml = (html?: string) => (html ? String(html).replace(/<[^>]+>/g, "") : "");

  const fetchDirectionsSteps = async (origin: string, destination: string, language = "en") => {
    try {
      const url = `/drivers/google-directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&language=${encodeURIComponent(language)}`;
      const data: any = await secureFetch(url);
      const legs = data?.routes?.[0]?.legs || [];
      const steps: Array<{ text: string; lat?: number | null; lng?: number | null }> = [];
      for (const leg of legs) {
        for (const s of leg.steps || []) {
          const text = stripHtml(s.html_instructions || s.instructions || "");
          const lat = s.end_location?.lat ?? s.start_location?.lat ?? null;
          const lng = s.end_location?.lng ?? s.start_location?.lng ?? null;
          if (text) steps.push({ text, lat, lng });
        }
      }
      return steps;
    } catch (e) {
      console.warn("Could not fetch directions steps", e);
      return [] as Array<{ text: string; lat?: number | null; lng?: number | null }>;
    }
  };

  // Announce a single step text and set speaking indicator for a short estimated duration
  const announceText = (text: string) => {
    try {
      stopSpeaking();
      setSpeakingActive(true);
      Speech.speak(text, { language: ttsLocale, pitch: 1.0, rate: 1.0 });
      const estMs = Math.max(2000, Math.min(8000, text.length * 60));
      setTimeout(() => {
        setSpeakingActive(false);
      }, estMs + 250);
    } catch (e) {
      console.warn("Speech.speak failed", e);
      setSpeakingActive(false);
    }
  };

  const stopSpeaking = () => {
    try {
      Speech.stop();
      setStepsToAnnounce([]);
      setSpeakingActive(false);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (!visible) {
      setPickupEtaAnnounced(false);
      setDriverLocationKnown(false);
      mapReadyRef.current = false;
      setIsMapReady(false);
      pendingLocationRef.current = null;
    }
  }, [visible]);

  const persistLanguagePreference = async (option: LanguageOption) => {
    try {
      await SecureStore.setItemAsync(
        LANGUAGE_STORAGE_KEY,
        JSON.stringify({ code: option.code, locale: option.locale })
      );
    } catch (err) {
      console.warn("Failed to persist language preference", err);
    }
  };

  const handleLanguageSelection = (option: LanguageOption) => {
    setTtsLanguage(option.code);
    setTtsLocale(option.locale);
    persistLanguagePreference(option);
  };

  useEffect(() => {
    let isMounted = true;

    const restoreLanguagePreference = async () => {
      try {
        const stored = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (!parsed || !parsed.code) return;
        const restoredOption = LANGUAGE_OPTIONS.find((opt) => opt.code === parsed.code);
        if (isMounted && restoredOption) {
          setTtsLanguage(restoredOption.code);
          setTtsLocale(restoredOption.locale);
        }
      } catch (err) {
        console.warn("Failed to load saved language preference", err);
      }
    };

    restoreLanguagePreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const openLanguagePicker = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...LANGUAGE_OPTIONS.map((opt) => opt.label), "Cancel"],
          cancelButtonIndex: LANGUAGE_OPTIONS.length,
          title: "Voice guidance language",
        },
        (buttonIndex) => {
          if (buttonIndex < LANGUAGE_OPTIONS.length) {
            handleLanguageSelection(LANGUAGE_OPTIONS[buttonIndex]);
          }
        }
      );
      return;
    }

    setShowLangPicker(true);
  };

  const currentLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((opt) => opt.code === ttsLanguage) ?? LANGUAGE_OPTIONS[0],
    [ttsLanguage]
  );

  // Proximity announcer: when the driver's location approaches a step, announce it once
  useEffect(() => {
    if (!currentLat || !currentLng || !stepsToAnnounce || stepsToAnnounce.length === 0) return;

    const PROXIMITY_BASE_KM = 0.07;
    const MAX_SPEED_OFFSET_KM = 0.06;
    const speedKmh = Math.max(0, currentSpeed) * 3.6;
    const speedOffsetKm = Math.min(MAX_SPEED_OFFSET_KM, (speedKmh / 120) * MAX_SPEED_OFFSET_KM);
    const thresholdKm = PROXIMITY_BASE_KM + speedOffsetKm;

    const index = stepsToAnnounce.findIndex(
      (st) =>
        !st.announced &&
        st.lat != null &&
        st.lng != null &&
        distanceKm(currentLat, currentLng, st.lat, st.lng) <= thresholdKm
    );

    if (index !== -1) {
      const step = stepsToAnnounce[index];
      announceText(step.text);
      setStepsToAnnounce((prev) => prev.map((p, i) => (i === index ? { ...p, announced: true } : p)));
    }
  }, [announceText, currentLat, currentLng, stepsToAnnounce, currentSpeed]);

  const handleNavigateAndSpeak = async () => {
    stopSpeaking();

    // Determine origin/destination for a simple demo
    let origin = "";
    let destination = "";

    if (!multiStopMode) {
      const originLat = currentLat || geocodedPickupLat || (pickupLat ? Number(pickupLat) : null);
      const originLng = currentLng || geocodedPickupLng || (pickupLng ? Number(pickupLng) : null);
      const destLat = geocodedDeliveryLat || (deliveryLat ? Number(deliveryLat) : null);
      const destLng = geocodedDeliveryLng || (deliveryLng ? Number(deliveryLng) : null);

      if (!originLat || !originLng || !destLat || !destLng) {
        Alert.alert("Navigation", "Missing origin or destination coordinates for directions.");
        return;
      }

      origin = `${originLat},${originLng}`;
      destination = `${destLat},${destLng}`;
    } else {
      const r = fetchedRoute || route;
      if (!r || !r.stops || r.stops.length < 2) {
        Alert.alert("Navigation", "Not enough stops for spoken navigation in multi-stop mode.");
        return;
      }
      const first = r.stops[0];
      const second = r.stops[1];
      origin = `${first.latitude},${first.longitude}`;
      destination = `${second.latitude},${second.longitude}`;
    }

    try {
      const steps = await fetchDirectionsSteps(origin, destination, ttsLanguage);
      if (!steps || steps.length === 0) {
        Alert.alert("Navigation", "No step instructions available for this route.");
        return;
      }
      // Initialize announcer state: mark all steps as not announced
  setStepsToAnnounce(steps.map((s) => ({ text: s.text, lat: s.lat, lng: s.lng, announced: false })));
  // Close language picker if open
  setShowLangPicker(false);
    } catch (e) {
      console.warn("navigate and speak failed", e);
      Alert.alert("Navigation", "Failed to fetch spoken directions.");
    }
  };
  // Keep a ref to the stops ScrollView to preserve scroll position after updates
  const stopsScrollRef = useRef<ScrollView | null>(null);
  const scrollPosRef = useRef(0);
  // Keep a ref for selected stop to read it inside handlers defined earlier
  const selectedStopRef = useRef<number | null>(null);
    // Swipe-to-deliver state (for multi-stop mode)
    const [isDelivering, setIsDelivering] = useState(false);
    const [swipeProgress, setSwipeProgress] = useState(0);
    const swipeProgressAnim = useRef(new Animated.Value(0)).current;
  const [singleDelivered, setSingleDelivered] = useState(false);
    // Combined delivered flag: either local optimistic swipe or parent-provided status
    const singleOrderDelivered = singleDelivered || (orderDriverStatus === "delivered");

    // Determine current stop (multi-stop) - pick first non-completed stop or first stop
    const routeToUse = fetchedRoute || route;
    const currentStop =
      multiStopMode && routeToUse
        ? routeToUse.stops.find((s) => s.status !== "completed") || routeToUse.stops[0]
        : null;

    // For both single and multi-stop flows determine an order id that can be delivered via swipe
    const swipeTargetOrderId: number | null = multiStopMode
      ? currentStop?.orderId ?? null
      : orderId ?? null;

    // Keep refs to fresh state values so panResponder handlers can access them
    // This avoids stale closure issues where handlers get old state values
    const swipeTargetOrderIdRef = useRef(swipeTargetOrderId);
    const isDeliveringRef = useRef(isDelivering);
    
    useEffect(() => {
      swipeTargetOrderIdRef.current = swipeTargetOrderId;
    }, [swipeTargetOrderId]);
    
    useEffect(() => {
      isDeliveringRef.current = isDelivering;
    }, [isDelivering]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          // Only detect horizontal swipes to the right
          return Math.abs(gestureState.dy) < 10 && gestureState.dx > 5;
        },
        onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          if (gestureState.dx > 0 && gestureState.dx < 300) {
            swipeProgressAnim.setValue(gestureState.dx);
            setSwipeProgress(gestureState.dx);
          }
        },
        onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          const threshold = 150; // px to complete delivery
          // Use refs to get fresh values instead of stale closure
          if (gestureState.dx > threshold && !isDeliveringRef.current) {
            handleSwipeDeliver(swipeTargetOrderIdRef.current);
          } else {
            // Snap back
            Animated.spring(swipeProgressAnim, {
              toValue: 0,
              useNativeDriver: false,
            }).start();
            setSwipeProgress(0);
          }
        },
      })
    ).current;

    // Handle incoming location updates from WebSocket
    const handleLocationUpdate = useCallback((lat: number, lng: number, driverId?: string | number) => {
      pendingLocationRef.current = { lat, lng };
      if (webViewRef.current && mapReadyRef.current) {
        const id = driverId || "driver";
        console.log("📍 Injecting driver marker to WebView:", { id, lat, lng });
        
        const injectionScript = `
          (function() {
            if (!window.mapInstance) {
              console.warn('Map not ready yet');
              return;
            }
            
            var markerId = '${id}';
            var lat = ${lat};
            var lng = ${lng};
            
            console.log('✅ Creating/updating driver marker:', markerId);
            
            if (window.mapMarkers && window.mapMarkers[markerId]) {
              // Update existing marker
              window.mapMarkers[markerId].setLatLng([lat, lng]);
            } else {
              // Create new marker
              var driverSvg = '<svg class="svg-marker" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 48 48">'
                + '<defs><filter id="f1" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0b1220" flood-opacity="0.12"/></filter></defs>'
                + '<circle cx="24" cy="24" r="18" fill="#3B82F6" stroke="#1E40AF" stroke-width="3" filter="url(#f1)"/>'
                + '<text x="24" y="28" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">A</text>'
                + '</svg>';
              
              if (!window.mapMarkers) window.mapMarkers = {};
              
              var popupLabel = (window.mainDriverName && window.mainDriverName !== null && String(window.mainDriverName).trim() !== '') ? window.mainDriverName : ('Driver ' + markerId);
              window.mapMarkers[markerId] = L.marker([lat, lng], {
                icon: L.divIcon({
                  html: driverSvg,
                  iconSize: [44, 44],
                  iconAnchor: [22, 22],
                  className: 'driver-marker'
                })
              }).addTo(window.mapInstance).bindPopup(popupLabel);
            }
            
            // Pan to driver location
            window.mapInstance.panTo([lat, lng]);
          })();
          true;
        `;
        
        webViewRef.current.injectJavaScript(injectionScript);
      } else {
        console.warn("⚠️ WebView not ready or ref missing - location not sent", { mapReady: mapReadyRef.current, hasRef: !!webViewRef.current });
      }
    }, [driverName]);

    // Expose method via ref
    React.useImperativeHandle(ref, () => ({
      updateDriverLocation: handleLocationUpdate,
    }));

    useEffect(() => {
      if (!isMapReady) return;
      const pending = pendingLocationRef.current;
      if (pending) {
        handleLocationUpdate(pending.lat, pending.lng, driverId);
      }
    }, [isMapReady, handleLocationUpdate, driverId]);

    // 🆕 Fetch driver's route from backend (multi-stop deliveries)
    useEffect(() => {
      if (!visible || !driverId || multiStopMode === false) return;

      let isMounted = true;
      const loadRoute = async () => {
        try {
          const routeData = await fetchDriverRoute(Number(driverId));

          if (isMounted && routeData) {
            setFetchedRoute(routeData);
          }
        } catch (error) {
          // Silently handle 404s from backend - this just means multi-stop endpoint isn't available
          // The map will fall back to single-stop mode if route data isn't available
          const errorMsg = String(error);
          if (errorMsg.includes("404")) {
            console.log("⚠️ Multi-stop route endpoint not available, falling back to single-stop mode");
          } else {
            console.warn("⚠️ Failed to load driver route:", error);
          }
        }
      };

      loadRoute();
      return () => {
        isMounted = false;
      };
    }, [visible, driverId, multiStopMode]);

  // When route (or single delivery + driver location) is available, request an optimized polyline from backend
  // Memoize route to avoid re-running effect on every parent re-render
  const memoizedRoute = useMemo(() => fetchedRoute || route, [fetchedRoute, route]);
  const memoizedCurrentLat = useMemo(() => currentLat, [currentLat]);
  const memoizedCurrentLng = useMemo(() => currentLng, [currentLng]);

  useEffect(() => {
    let isMounted = true;
    const fetchPolyline = async () => {
      try {
        setEncodedPolyline(null);

        // Build origin/destination/waypoints depending on multiStopMode
        if (multiStopMode && memoizedRoute && memoizedRoute.stops.length > 0) {
          const r = memoizedRoute;
          if (r.stops.length >= 2) {
            // Build ordered stops (pickup first, then deliveries) to match footer/markers
            const rStopsRaw = r.stops || [];
            const pickupStop = rStopsRaw.find((s) => s.type === "pickup");
            const deliveryStops = rStopsRaw.filter((s) => s.type === "delivery");
            const orderedStops = [] as typeof rStopsRaw;
            if (pickupStop) orderedStops.push(pickupStop);
            for (const d of deliveryStops) orderedStops.push(d);

            // If we have the driver's current location, prefer it as the origin so the route includes driver->pickup
            const originIsDriver = !!(memoizedCurrentLat && memoizedCurrentLng);
            const origin = originIsDriver
              ? `${memoizedCurrentLat},${memoizedCurrentLng}`
              : `${orderedStops[0].latitude},${orderedStops[0].longitude}`;
            const destination = `${orderedStops[orderedStops.length - 1].latitude},${orderedStops[orderedStops.length - 1].longitude}`;

            // Build waypoints depending on whether origin is driver or first stop
            const waypointsStops = originIsDriver
              ? orderedStops.slice(0, orderedStops.length - 1)
              : orderedStops.slice(1, Math.max(1, orderedStops.length - 1));

            const waypointList = waypointsStops.map((s) => `${s.latitude},${s.longitude}`).join("|");
            const waypointsParam = waypointList ? `optimize:true|${waypointList}` : "";
            const url = `/drivers/google-directions?origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(
              waypointsParam
            )}`;

            const data: any = await secureFetch(url);
            const points = data?.routes?.[0]?.overview_polyline?.points;
            if (isMounted && points) setEncodedPolyline(points);

            // Compute per-stop ETAs from directions legs (Google provides leg durations)
            try {
              const legs = data?.routes?.[0]?.legs || [];
              if (legs.length > 0 && memoizedRoute) {
                const waypointOrder = data?.routes?.[0]?.waypoint_order || [];

                // Map legs to stops: legs[0..waypointsStops.length-1] -> waypointsStops (in returned order if optimize:true), last leg -> destination
                const arrivalStops: any[] = [];
                const waypointCount = waypointsStops.length;

                for (let i = 0; i < legs.length; i++) {
                  if (i < waypointCount) {
                    // If optimize was used, waypointOrder maps returned order to original index in waypointsStops
                    if (waypointOrder && waypointOrder.length) {
                      const returnedIndex = waypointOrder[i];
                      const stop = waypointsStops[returnedIndex];
                      if (stop) arrivalStops.push({ stop, leg: legs[i] });
                    } else {
                      const stop = waypointsStops[i];
                      if (stop) arrivalStops.push({ stop, leg: legs[i] });
                    }
                  } else {
                    // last leg -> destination stop
                    const destinationStop = orderedStops[orderedStops.length - 1];
                    arrivalStops.push({ stop: destinationStop, leg: legs[i] });
                  }
                }

                // Compute cumulative ETA seconds and attach to matching stops (by lat/lng or address)
                let cumulative = 0;
                const now = new Date();
                const updatedStops = rStopsRaw.map((s) => {
                  // 🔧 Preserve existing status from fetchedRoute to avoid losing "completed" markers when ETAs are updated
                  const existingStop = fetchedRoute?.stops?.find((fs) => {
                    const latMatch = fs.latitude && s.latitude && Math.abs(Number(fs.latitude) - Number(s.latitude)) < 0.00001;
                    const lngMatch = fs.longitude && s.longitude && Math.abs(Number(fs.longitude) - Number(s.longitude)) < 0.00001;
                    const addrMatch = fs.address && s.address && fs.address.trim() === s.address.trim();
                    return (latMatch && lngMatch) || addrMatch;
                  });
                  return {
                    ...s,
                    status: existingStop?.status ?? s.status,
                  };
                });

                for (const entry of arrivalStops) {
                  cumulative += (entry.leg.duration && entry.leg.duration.value) ? Number(entry.leg.duration.value) : 0;
                  const etaDate = new Date(now.getTime() + cumulative * 1000);
                  const minutes = Math.round(cumulative / 60);

                  // Find matching stop in updatedStops by lat/lng (fallback to address)
                  const matchIndex = updatedStops.findIndex((us) => {
                    const latMatch = us.latitude && entry.stop.latitude && Math.abs(Number(us.latitude) - Number(entry.stop.latitude)) < 0.00001;
                    const lngMatch = us.longitude && entry.stop.longitude && Math.abs(Number(us.longitude) - Number(entry.stop.longitude)) < 0.00001;
                    const addrMatch = us.address && entry.stop.address && us.address.trim() === entry.stop.address.trim();
                    return (latMatch && lngMatch) || addrMatch;
                  });

                  if (matchIndex !== -1) {
                    updatedStops[matchIndex] = {
                      ...updatedStops[matchIndex],
                      estimatedArrivalTime: minutes,
                    };
                  }
                }

                // Update fetchedRoute so UI footer and markers can read ETAs
                if (isMounted) {
                  const newRoute = { ...memoizedRoute, stops: updatedStops } as RouteInfo;
                  setFetchedRoute(newRoute);
                }
              }
            } catch (etaErr) {
              console.warn('Could not compute ETAs from directions response', etaErr);
            }
          }
        } else {
          // Single delivery: fetch two segments when pickup coordinates exist:
          // 1) driver/current -> pickup (draw in orange)
          // 2) pickup -> delivery (draw in blue)
          const pickupLatNum = pickupLat ? Number(pickupLat) : pickupLat;
          const pickupLngNum = pickupLng ? Number(pickupLng) : pickupLng;
          const deliveryLatNum = deliveryLat ? Number(deliveryLat) : deliveryLat;
          const deliveryLngNum = deliveryLng ? Number(deliveryLng) : deliveryLng;

          const finalPickupLat = geocodedPickupLat || (pickupLatNum && pickupLatNum !== 0 ? pickupLatNum : null);
          const finalPickupLng = geocodedPickupLng || (pickupLngNum && pickupLngNum !== 0 ? pickupLngNum : null);
          const finalDeliveryLat = geocodedDeliveryLat || (deliveryLatNum && deliveryLatNum !== 0 ? deliveryLatNum : 0);
          const finalDeliveryLng = geocodedDeliveryLng || (deliveryLngNum && deliveryLngNum !== 0 ? deliveryLngNum : 0);

          const originLat = currentLat || finalDeliveryLat || finalPickupLat || 0;
          const originLng = currentLng || finalDeliveryLng || finalPickupLng || 0;

          // If we have a pickup location, fetch two separate polylines; otherwise fallback to single origin->delivery
          if (finalPickupLat && finalPickupLng) {
            // driver/current -> pickup
            try {
              if (originLat && originLng) {
                const origin = `${originLat},${originLng}`;
                const destination = `${finalPickupLat},${finalPickupLng}`;
                const url1 = `/drivers/google-directions?origin=${origin}&destination=${destination}`;
                const d1: any = await secureFetch(url1);
                const pts1 = d1?.routes?.[0]?.overview_polyline?.points;
                if (isMounted && pts1) setEncodedPolylineToPickup(pts1);
                // Extract pickup ETA from first leg duration
                const pickupDuration = d1?.routes?.[0]?.legs?.[0]?.duration?.value;
                if (isMounted && pickupDuration) {
                  const pickupMinutes = Math.round(Number(pickupDuration) / 60);
                  setPickupETA(pickupMinutes);
                }
              }
            } catch (e) {
              console.warn('Could not fetch driver->pickup polyline', e);
            }

            // pickup -> delivery
            try {
              if (finalDeliveryLat && finalDeliveryLng) {
                const origin2 = `${finalPickupLat},${finalPickupLng}`;
                const destination2 = `${finalDeliveryLat},${finalDeliveryLng}`;
                const url2 = `/drivers/google-directions?origin=${origin2}&destination=${destination2}`;
                const d2: any = await secureFetch(url2);
                const pts2 = d2?.routes?.[0]?.overview_polyline?.points;
                if (isMounted && pts2) setEncodedPolylineToDelivery(pts2);
                // Extract delivery ETA from first leg duration (time from pickup to delivery)
                const deliveryDuration = d2?.routes?.[0]?.legs?.[0]?.duration?.value;
                if (isMounted && deliveryDuration) {
                  const deliveryMinutes = Math.round(Number(deliveryDuration) / 60);
                  setDeliveryETA(deliveryMinutes);
                }
              }
            } catch (e) {
              console.warn('Could not fetch pickup->delivery polyline', e);
            }
          } else {
            // Fallback: single polyline from origin->delivery (no pickup stop)
            if (originLat && originLng && finalDeliveryLat && finalDeliveryLng) {
              const origin = `${originLat},${originLng}`;
              const destination = `${finalDeliveryLat},${finalDeliveryLng}`;
              const url = `/drivers/google-directions?origin=${origin}&destination=${destination}`;
              const data: any = await secureFetch(url);
              const points = data?.routes?.[0]?.overview_polyline?.points;
              if (isMounted && points) setEncodedPolyline(points);
              // Extract delivery ETA from leg duration (no separate pickup in this case)
              const duration = data?.routes?.[0]?.legs?.[0]?.duration?.value;
              if (isMounted && duration) {
                const minutes = Math.round(Number(duration) / 60);
                setDeliveryETA(minutes);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch directions/polyline:", err);
        if (isMounted) setEncodedPolyline(null);
      }
    };

    if (visible) fetchPolyline();

    return () => {
      isMounted = false;
    };
  }, [visible, multiStopMode, memoizedRoute, memoizedCurrentLat, memoizedCurrentLng, pickupLat, pickupLng, geocodedPickupLat, geocodedPickupLng, deliveryLat, deliveryLng, geocodedDeliveryLat, geocodedDeliveryLng]);

  // When polylines change, inject them into the WebView (without regenerating HTML)
  useEffect(() => {
    if (mapReadyRef.current && webViewRef.current) {
      injectPolylinesIntoMap();
    }
  }, [encodedPolyline, encodedPolylineToPickup, encodedPolylineToDelivery]);


    // Handle swipe-to-deliver (accepts an orderId for single or multi-stop)
    const handleSwipeDeliver = async (targetOrderId?: number | null) => {
      const orderToDeliver = targetOrderId ?? currentStop?.orderId ?? orderId ?? null;
      if (!orderToDeliver || isDelivering) return;

      try {
        setIsDelivering(true);

        // Optimistically play a success haptic to indicate action started
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Try the API call with a small retry/backoff strategy for transient 5xx errors
        const maxAttempts = 3;
        let attempt = 0;
        let lastError: any = null;

        while (attempt < maxAttempts) {
          attempt += 1;
          try {
            await secureFetch(`/orders/${orderToDeliver}/status`, {
              method: "PATCH",
              body: JSON.stringify({ status: "delivered", driver_status: "delivered" }),
            });
            lastError = null;
            break; // success
          } catch (e) {
            lastError = e;
            console.warn(`Attempt ${attempt} failed for order ${orderToDeliver}:`, (e as any)?.message || e);
            // If not last attempt, wait a bit before retrying
            if (attempt < maxAttempts) {
              const waitMs = 150 * attempt; // 150ms, 300ms, ...
              await new Promise((res) => setTimeout(res, waitMs));
            }
          }
        }

        if (lastError) {
          // Final failure after retries
          console.error("❌ Swipe delivery failed after retries:", lastError);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          // Show server-provided message when available
          const msg = (lastError as any)?.message ? String((lastError as any).message) : "Failed to mark delivery. Please try again.";
          Alert.alert("Error", msg);

          Animated.spring(swipeProgressAnim, {
            toValue: 0,
            useNativeDriver: false,
          }).start(() => setSwipeProgress(0));
          return;
        }

        // Animate completion
        Animated.sequence([
          Animated.timing(swipeProgressAnim, {
            toValue: 300,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(swipeProgressAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => setSwipeProgress(0));

        console.log(`✅ Order ${orderToDeliver} delivered via swipe (MapModal)`);

        // Update local route UI: mark delivered stop as 'completed' (do not remove)
        try {
          // preserve UI location & selection
          const prevScroll = scrollPosRef.current;
          const prevSelected = selectedStopRef.current;

          if (fetchedRoute) {
            const updated = {
              ...fetchedRoute,
              stops: fetchedRoute.stops.map((s) =>
                s.orderId === orderToDeliver ? { ...s, status: "completed" as const } : s
              ),
            };
            setFetchedRoute(updated);
            console.log("🧭 Updated fetchedRoute, marked delivered stop", orderToDeliver);
          } else if (route) {
            // Create an optimistic local copy so UI updates immediately
            const updated = {
              ...route,
              stops: (route.stops || []).map((s) =>
                s.orderId === orderToDeliver ? { ...s, status: "completed" as const } : s
              ),
            } as RouteInfo;
            setFetchedRoute(updated);
            console.log("🧭 Created optimistic fetchedRoute, marked delivered stop", orderToDeliver);
          } else {
            // Single delivery mode: set a simple flag so footer and map reflect delivered state
            setSingleDelivered(true);
            console.log("🧭 Single delivery marked delivered", orderToDeliver);
          }

          // restore scroll / selection shortly after state update to avoid jump
          setTimeout(() => {
            try {
              if (stopsScrollRef.current) {
                stopsScrollRef.current.scrollTo({ y: prevScroll, animated: false });
              }
              if (typeof prevSelected !== "undefined") {
                setSelectedStop(prevSelected);
              }
            } catch (e) {
              // ignore
            }
          }, 50);
        } catch (e) {
          console.warn("Could not update fetchedRoute locally:", e);
        }
            // Notify parent (if provided) so it can update its UI (e.g. packet list)
            try {
              if (onOrderDelivered) onOrderDelivered(orderToDeliver);
            } catch (e) {
              console.warn("onOrderDelivered callback failed:", e);
            }
      } catch (err) {
        // Unexpected error path
        console.error("❌ Swipe delivery failed unexpected:", err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", "Failed to mark delivery. Please try again.");
        Animated.spring(swipeProgressAnim, {
          toValue: 0,
          useNativeDriver: false,
        }).start(() => setSwipeProgress(0));
      } finally {
        setIsDelivering(false);
      }
    };

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    const startLocationWatch = async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (isMounted) setLoading(false);
          return;
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 20,
          },
            async (position) => {
              if (!isMounted) return;
              const { latitude, longitude } = position.coords;
              const safeSpeed = typeof position.coords.speed === "number" && !Number.isNaN(position.coords.speed) ? position.coords.speed : 0;
              setCurrentSpeed(safeSpeed);
            
            // Send current position to WebView BEFORE updating state
            // so it sends even if state hasn't updated yet
            if (webViewRef.current && mapReadyRef.current) {
              console.log("📍 Sending location from watcher to WebView:", { latitude, longitude });
              handleLocationUpdate(latitude, longitude, driverId);
            } else {
              console.warn("⚠️ WebView not ready in location watcher", { mapReady: mapReadyRef.current, hasRef: !!webViewRef.current });
            }
            
            setCurrentLat(latitude);
            setCurrentLng(longitude);

            try {
              await secureFetch("/drivers/location", {
                method: "POST",
                body: JSON.stringify({
                  driver_id: driverId,
                  lat: latitude,
                  lng: longitude,
                }),
              });
            } catch (err) {
              console.log("Location update failed:", err);
            }
          }
        );

        locationWatcherRef.current = sub;
        if (isMounted) setLoading(false);
      } catch (err) {
        console.log("Location watch error:", err);
        if (isMounted) setLoading(false);
      }
    };

    startLocationWatch();

    return () => {
      isMounted = false;
      if (locationWatcherRef.current) {
        const sub: any = locationWatcherRef.current;
        try {
          if (typeof sub.remove === "function") {
            sub.remove();
          } else if (typeof sub.removeSubscription === "function") {
            sub.removeSubscription();
          } else if (typeof sub.unsubscribe === "function") {
            sub.unsubscribe();
          }
        } catch (e) {
          // ignore
        }
        locationWatcherRef.current = null;
      }
    };
  }, [visible, driverId, handleLocationUpdate]);

  useEffect(() => {
    if (currentLat && currentLng && !driverLocationKnown) {
      setDriverLocationKnown(true);
    }
  }, [currentLat, currentLng, driverLocationKnown]);

  useEffect(() => {
    if (
      !visible ||
      pickupEtaAnnounced ||
      !pickupETA ||
      multiStopMode ||
      !currentLat ||
      !currentLng ||
      !driverLocationKnown
    ) {
      return;
    }

    const minuteLabel = pickupETA === 1 ? (ttsLanguage === "tr" ? "1 dakika" : "1 minute") : `${pickupETA} ${ttsLanguage === "tr" ? "dakika" : "minutes"}`;
    const template = ANNOUNCEMENT_TEMPLATES[ttsLanguage] || ANNOUNCEMENT_TEMPLATES.en;
    const announcement = template.replace("{minutes}", minuteLabel);
    announceText(announcement);
    setPickupEtaAnnounced(true);
  }, [announceText, currentLat, currentLng, multiStopMode, pickupETA, pickupEtaAnnounced, visible, driverLocationKnown]);

  /**
   * Geocode addresses if coordinates are missing or invalid (0,0)
   * Also geocodes if pickup and delivery coords are identical (backend error case)
   */
  useEffect(() => {
    const geocodeIfNeeded = async () => {
      // Check if delivery coordinates are missing or invalid (0,0)
      const deliveryNeedsGeocoding =
        !deliveryLat || !deliveryLng || (deliveryLat === 0 && deliveryLng === 0);
      
      // Check if pickup coordinates are missing or invalid
      const pickupNeedsGeocoding =
        !pickupLat || !pickupLng || (pickupLat === 0 && pickupLng === 0);

      // 🔴 CRITICAL FIX: Check if pickup is using OLD WRONG coordinates (38.2716, 27.8016)
      // This is Tire city center, not the actual restaurant location
      const pickupIsWrongOldCoords = 
        pickupLat && pickupLng &&
        Math.abs(pickupLat - 38.2716) < 0.0001 && 
        Math.abs(pickupLng - 27.8016) < 0.0001;

      // 🔴 CRITICAL FIX: If pickup and delivery coords are IDENTICAL, geocode pickup
      // This happens when backend returns same coords for both locations
      const coordsAreIdentical =
        pickupLat && pickupLng && deliveryLat && deliveryLng &&
        Math.abs(pickupLat - deliveryLat) < 0.0001 && 
        Math.abs(pickupLng - deliveryLng) < 0.0001;
        
      // Geocoding now only needed if coords are missing
      const FORCE_DELIVERY_GEOCODE = false;
      const FORCE_PICKUP_GEOCODE = false;

      // Geocode delivery address if needed OR FORCE
      if ((deliveryNeedsGeocoding || FORCE_DELIVERY_GEOCODE) && deliveryAddress) {
        try {
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'https://hurrypos-backend.onrender.com/api'}/drivers/geocode?q=${encodeURIComponent(deliveryAddress)}`
          );
          
          if (response.ok) {
            const geo = await response.json();
            if (geo?.lat && geo?.lng) {
              setGeocodedDeliveryLat(geo.lat);
              setGeocodedDeliveryLng(geo.lng);
            } else {
              console.warn("⚠️ Backend geocode returned invalid data:", geo);
            }
          } else {
            console.warn("⚠️ Backend geocode failed, falling back to Nominatim");
            const result = await geocodeAddress(deliveryAddress);
            if (result) {
              setGeocodedDeliveryLat(result.lat);
              setGeocodedDeliveryLng(result.lng);
            }
          }
        } catch (error) {
          console.error("❌ Backend geocode error:", error);
          // Fallback to Nominatim
          const result = await geocodeAddress(deliveryAddress);
          if (result) {
            setGeocodedDeliveryLat(result.lat);
            setGeocodedDeliveryLng(result.lng);
          }
        }
      }

      // Geocode pickup address if needed OR if coords are identical (backend bug) OR using old wrong coords OR FORCE
      if ((pickupNeedsGeocoding || coordsAreIdentical || pickupIsWrongOldCoords || FORCE_PICKUP_GEOCODE) && pickupAddress) {
        try {
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'https://hurrypos-backend.onrender.com/api'}/drivers/geocode?q=${encodeURIComponent(pickupAddress)}`
          );
          
          if (response.ok) {
            const geo = await response.json();
            if (geo?.lat && geo?.lng) {
              setGeocodedPickupLat(geo.lat);
              setGeocodedPickupLng(geo.lng);
            } else {
              console.warn("⚠️ Backend geocode returned invalid data:", geo);
            }
          } else {
            console.warn("⚠️ Backend geocode failed, falling back to Nominatim");
            const result = await geocodeAddress(pickupAddress);
            if (result) {
              setGeocodedPickupLat(result.lat);
              setGeocodedPickupLng(result.lng);
            }
          }
        } catch (error) {
          console.error("❌ Backend geocode error:", error);
          // Fallback to Nominatim
          const result = await geocodeAddress(pickupAddress);
          if (result) {
            setGeocodedPickupLat(result.lat);
            setGeocodedPickupLng(result.lng);
          }
        }
      }
    };

    if (visible) {
      geocodeIfNeeded();
    }
  }, [
    visible,
    deliveryLat,
    deliveryLng,
    deliveryAddress,
    pickupLat,
    pickupLng,
    pickupAddress,
  ]);

  /**
   * Generate HTML for multi-stop map view
   * Displays numbered markers for all stops and polyline connecting them
   */
  const getMultiStopMapHTML = (
    lat: number,
    lng: number,
    route: RouteInfo
  ): string => {
    // Build markers array for stops in the same order we display them in the footer
    // (pickup first, then deliveries). This ensures marker letters (A, B, C...) match
    // the footer ordering. ALWAYS reserve letter 'A' for the driver (even if not present yet).
    // Stops start from 'B' to match the footer display when driver location appears.
    const offset = 1; // Always offset by 1 to reserve 'A' for driver

    // Compute ordered stops: prefer an explicit pickup stop first, then deliveries in original order
    const allStops = route.stops || [];
    const pickupStop = allStops.find((s) => s.type === 'pickup');
    const deliveryStops = allStops.filter((s) => s.type === 'delivery');
    const orderedStops = [];
    if (pickupStop) orderedStops.push(pickupStop);
    for (const d of deliveryStops) orderedStops.push(d);

    const stopMarkers = orderedStops
      .map((stop, idx) => {
        const letter = String.fromCharCode(65 + idx + offset); // B, C, D... (always offset 1 for driver at 'A')
        // ❗ IMPORTANT: Only mark DELIVERY stops as completed (greyed out)
        // NEVER grey out the pickup stop, even if it's marked as completed
        const isCompleted = stop.type === 'delivery' && stop.status === 'completed';
        const color = isCompleted ? '#6B7280' : (stop.type === 'pickup' ? '#F59E0B' : '#10B981');
        const bgColor = isCompleted ? '#CBD5E1' : (stop.type === 'pickup' ? '#FCD34D' : '#34D399');

        return `
      var stopText = ${JSON.stringify(`${letter} - ${stop.type} (${(stop.address||'').substring(0, 30)})`)};
      var stopSvg = '<svg class="svg-marker" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
        + '<defs><filter id="f1" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0b1220" flood-opacity="0.12"/></filter></defs>'
        + '<circle cx="24" cy="24" r="18" fill="${bgColor}" stroke="${color}" stroke-width="3" filter="url(#f1)"/>'
        + '<text x="24" y="28" font-size="16" font-weight="700" text-anchor="middle" fill="#111827">${letter}</text>'
        + '</svg>';
      window.mapMarkers['stop-${idx}'] = L.marker([${stop.latitude}, ${stop.longitude}], {
        icon: L.divIcon({
          html: stopSvg,
          iconSize: [48, 48],
          className: 'stop-marker'
        })
  }).addTo(m).bindPopup(stopText);
    `;
      })
      .join("\n");

    // Build polyline coordinates in the same orderedStops order.
    // NOTE: we intentionally DO NOT inline the driver's current coordinates into
    // the HTML string. Sending driver position via postMessage keeps the HTML
    // stable and prevents the WebView from reloading on every location update.
    const polylineCoords = orderedStops.map((stop) => `[${stop.latitude}, ${stop.longitude}]`).join(', ');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:;">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
*{margin:0;padding:0}
html,body{width:100%;height:100%;background:#fff;font-family:system-ui}
#map{width:100%;height:100%;background:#eee}
/* Move leaflet top controls (zoom buttons) below the modal header/notch */
.leaflet-top { top: ${mapControlTop}px !important; }
.stop-marker{display:flex!important}

/* Modern overlay & marker styling for a sleeker look */
.map-overlay { position: absolute; right: 12px; top: ${mapControlTop + 8}px; z-index:1200; background: rgba(255,255,255,0.9); padding:8px 12px; border-radius:10px; box-shadow: 0 6px 18px rgba(16,24,40,0.15); font-family: system-ui; }
.map-overlay .meta { font-weight:700; color:#0f172a; font-size:13px }
.map-overlay .sub { font-size:12px; color:#475569 }
.svg-marker { filter: drop-shadow(0 4px 12px rgba(15,23,42,0.25)); }
</style>
</head>
<body>
<div id="map"></div>
<div class="map-overlay" id="map-overlay">
  <div class="meta">Route</div>
  <div class="sub">Optimized route</div>
</div>
<div class="map-overlay">
  <div class="meta">${route.totalDistance ? route.totalDistance.toFixed(1) + ' km • ' + route.totalDuration + ' min' : 'Route'}</div>
  <div class="sub">Optimized route</div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
<script>

// Expose main driver identity (injected from React props) so the WebView JS
// can show the driver's name in popups instead of generic "Your Location".
window.mapMarkers={};
window.mapInstance=null;
window.boundsFitted=false;
// Inject driver identity for popup labels (available from React props)
window.mainDriverId = ${JSON.stringify(driverId)};
window.mainDriverName = ${JSON.stringify(effectiveDriverName)};
window.mainDriverId = ${JSON.stringify(driverId)};
window.mainDriverName = ${JSON.stringify(effectiveDriverName)};
window.mainDriverId = ${JSON.stringify(driverId)};
window.mainDriverName = ${JSON.stringify(effectiveDriverName)};

window.addEventListener('load',function(){
  try{
    console.log('Creating multi-stop map');
  var m=L.map('map',{center:[${lat},${lng}],zoom:14, zoomControl:false});
    window.mapInstance=m;
    
    // 🔧 Android WebView Tile Layer with Headers & Fallback
    var tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google Maps',
      crossOrigin: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Referer': 'https://maps.google.com/'
      }
    });
    
    tileLayer.addTo(m);
    
    // Fallback: If tiles don't load, use OpenStreetMap
    tileLayer.on('tileerror', function(error) {
      console.warn('🗺️ Google tiles failed, switching to OSM fallback');
      m.removeLayer(tileLayer);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
        crossOrigin: true
      }).addTo(m);
    });
    
  // Add stop markers (SVG-backed divIcons for modern look)
  ${stopMarkers}
    
    // NOTE: Polylines are now injected dynamically via injectPolylinesIntoMap()
    // This keeps the HTML stable and prevents WebView reloads when polyline states change
    
    // NOTE: Driver marker is intentionally NOT inlined here. Driver positions are
    // handled via postMessage (UPDATE_LOCATION) so the WebView HTML remains stable
    // and does not reload every time the driver's GPS updates.
    
    // Fit all markers in view (only once to avoid infinite zoom loops)
    if (!window.boundsFitted) {
      try {
        var group=new L.featureGroup(Object.values(window.mapMarkers));
        m.fitBounds(group.getBounds().pad(0.1));
        window.boundsFitted=true;
      } catch(e) {
        console.warn('fitBounds error:', e);
      }
    }
    
    console.log('Multi-stop map ready');
    window.mapReady=true;
  }catch(e){
    console.error(e);
    document.body.innerHTML='<div style="padding:20px;color:red;font-size:14px;">Error: '+e.message+'</div>';
  }
});

// Handle real-time location updates
console.log('🔔 Message listener attached to WebView');
window.addEventListener('message',function(e){
  try{
    var data=JSON.parse(e.data);
    console.log('📨 WebView received message:', data);
    if(data.type==='UPDATE_LOCATION'&&window.mapInstance){
      console.log('✅ Creating driver marker with driver_id:', data.driver_id);
      var markerId=data.driver_id;
      var lat=data.lat;
      var lng=data.lng;
      
      if(window.mapMarkers[markerId]){
        window.mapMarkers[markerId].setLatLng([lat,lng]);
      }else{
  var popupLabel = (window.mainDriverName && window.mainDriverName !== null && String(window.mainDriverName).trim() !== '') ? window.mainDriverName : ('Driver ' + markerId);
        var driverSvg = '<svg class="svg-marker" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 48 48">'
          + '<defs><filter id="f1" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0b1220" flood-opacity="0.12"/></filter></defs>'
          + '<circle cx="24" cy="24" r="18" fill="#3B82F6" stroke="#1E40AF" stroke-width="3" filter="url(#f1)"/>'
          + '<text x="24" y="28" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">A</text>'
          + '</svg>';
        window.mapMarkers[markerId]=L.marker([lat,lng],{icon:L.divIcon({html:driverSvg,iconSize:[44,44],iconAnchor:[22,22],className:'driver-marker'})}).addTo(window.mapInstance).bindPopup(popupLabel);
      }
      window.mapInstance.panTo([lat,lng]);
    }
  }catch(e){
    console.error('postMessage error:',e);
  }
});
</script>
</body>
</html>`;

    return html;
  };

  const [showDetails, setShowDetails] = useState(false);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);

  // keep ref in sync so earlier handlers can read current selectedStop
  React.useEffect(() => {
    selectedStopRef.current = selectedStop;
  }, [selectedStop]);

  // Zoom handlers that send JS into the WebView to control the Leaflet map
  const zoomIn = () => {
    try {
      webViewRef.current?.injectJavaScript(`(function(){ if(window.mapInstance){ window.mapInstance.setZoom(window.mapInstance.getZoom()+1); } })(); true;`);
    } catch (e) {
      console.warn('zoomIn error', e);
    }
  };

  const zoomOut = () => {
    try {
      webViewRef.current?.injectJavaScript(`(function(){ if(window.mapInstance){ window.mapInstance.setZoom(window.mapInstance.getZoom()-1); } })(); true;`);
    } catch (e) {
      console.warn('zoomOut error', e);
    }
  };

  // Inject polylines into the map after it loads (dynamic injection avoids HTML regeneration)
  const injectPolylinesIntoMap = () => {
    if (!webViewRef.current || !mapReadyRef.current) return;

    // Helper to decode polylines in the WebView
    const decodePolylineJS = `
      function decodePolyline(encoded) {
        if(!encoded) return [];
        var points = [];
        var index = 0, len = encoded.length;
        var lat = 0, lng = 0;
        while (index < len) {
          var b, shift = 0, result = 0;
          do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
          } while (b >= 0x20);
          var deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
          lat += deltaLat;
          shift = 0;
          result = 0;
          do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
          } while (b >= 0x20);
          var deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
          lng += deltaLng;
          points.push([lat / 1e5, lng / 1e5]);
        }
        return points;
      }
    `;

    try {
      if (multiStopMode && encodedPolyline) {
        // Multi-stop: draw single optimized polyline
        const coordsJS = `
          ${decodePolylineJS}
          (function() {
            if(!window.mapInstance) return;
            var coords = decodePolyline(${JSON.stringify(encodedPolyline)});
            if(coords && coords.length > 0) {
              // Remove old polylines (if any) to avoid duplicates
              if(window.polylineLayer1) window.mapInstance.removeLayer(window.polylineLayer1);
              if(window.polylineLayer2) window.mapInstance.removeLayer(window.polylineLayer2);
              // Draw glow and main polyline
              window.polylineLayer1 = L.polyline(coords, {color:'#3B82F6',weight:14,opacity:0.08,interactive:false}).addTo(window.mapInstance);
              window.polylineLayer2 = L.polyline(coords, {color:'#3B82F6',weight:4,opacity:0.95}).addTo(window.mapInstance);
            }
          })();
          true;
        `;
        webViewRef.current.injectJavaScript(coordsJS);
      } else if (!multiStopMode) {
        // Single delivery: draw two separate polylines if available
        const coordsJS = `
          ${decodePolylineJS}
          (function() {
            if(!window.mapInstance) return;
            // Remove old polylines to avoid duplicates
            if(window.polylineLayer1) window.mapInstance.removeLayer(window.polylineLayer1);
            if(window.polylineLayer2) window.mapInstance.removeLayer(window.polylineLayer2);
            if(window.polylineLayer3) window.mapInstance.removeLayer(window.polylineLayer3);
            if(window.polylineLayer4) window.mapInstance.removeLayer(window.polylineLayer4);
            
            var encodedToPickup = ${JSON.stringify(encodedPolylineToPickup)};
            var encodedToDelivery = ${JSON.stringify(encodedPolylineToDelivery)};
            
            if(encodedToPickup) {
              var coords1 = decodePolyline(encodedToPickup);
              if(coords1 && coords1.length > 0) {
                window.polylineLayer1 = L.polyline(coords1, {color:'#F59E0B',weight:12,opacity:0.08,interactive:false}).addTo(window.mapInstance);
                window.polylineLayer2 = L.polyline(coords1, {color:'#F59E0B',weight:4,opacity:0.95}).addTo(window.mapInstance);
              }
            }
            if(encodedToDelivery) {
              var coords2 = decodePolyline(encodedToDelivery);
              if(coords2 && coords2.length > 0) {
                window.polylineLayer3 = L.polyline(coords2, {color:'#3B82F6',weight:12,opacity:0.08,interactive:false}).addTo(window.mapInstance);
                window.polylineLayer4 = L.polyline(coords2, {color:'#3B82F6',weight:4,opacity:0.95}).addTo(window.mapInstance);
              }
            }
          })();
          true;
        `;
        webViewRef.current.injectJavaScript(coordsJS);
      }
    } catch (e) {
      console.warn('Failed to inject polylines:', e);
    }
  };

  const getMapHTML = () => {
    // Convert coordinates to numbers (in case they come as strings from DB)
    const pickupLatNum = pickupLat ? Number(pickupLat) : pickupLat;
    const pickupLngNum = pickupLng ? Number(pickupLng) : pickupLng;
    const deliveryLatNum = deliveryLat ? Number(deliveryLat) : deliveryLat;
    const deliveryLngNum = deliveryLng ? Number(deliveryLng) : deliveryLng;
    
    // 🔴 CRITICAL: Prefer geocoded coordinates over prop coordinates (backend often wrong)
    // Only use props if geocoding hasn't run yet
    const finalDeliveryLat = geocodedDeliveryLat || (deliveryLatNum && deliveryLatNum !== 0 ? deliveryLatNum : 0);
    const finalDeliveryLng = geocodedDeliveryLng || (deliveryLngNum && deliveryLngNum !== 0 ? deliveryLngNum : 0);
    const finalPickupLat = geocodedPickupLat || (pickupLatNum && pickupLatNum !== 0 ? pickupLatNum : null);
    const finalPickupLng = geocodedPickupLng || (pickupLngNum && pickupLngNum !== 0 ? pickupLngNum : null);

    // Prioritize: driver position > delivery > pickup > 0
    const lat = currentLat || finalDeliveryLat || finalPickupLat || 0;
    const lng = currentLng || finalDeliveryLng || finalPickupLng || 0;

    // Multi-stop mode: render all stops (use fetched route if available)
    const routeToUse = fetchedRoute || route;
    if (multiStopMode && routeToUse && routeToUse.stops.length > 0) {
      return getMultiStopMapHTML(lat, lng, routeToUse);
    }

  // Single stop mode (original)
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:;">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
*{margin:0;padding:0}
html,body{width:100%;height:100%;background:#fff;font-family:system-ui}
#map{width:100%;height:100%;background:#eee}
/* Ensure Leaflet top controls (zoom) are pushed below the header/notch */
.leaflet-top { top: ${mapControlTop}px !important; }
.marker-label{font-size:11px;font-weight:600;color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,0.5)}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
<script>
window.mapMarkers={};
window.mapInstance=null;
window.boundsFitted=false;
// Inject driver identity so popups show the driver name
window.mainDriverName = ${JSON.stringify(effectiveDriverName)};

window.addEventListener('load',function(){
  try{
  var m=L.map('map',{center:[${lat},${lng}],zoom:15, zoomControl:false});
    window.mapInstance=m;
    
    // 🔧 Android WebView Tile Layer with Headers & Fallback
    var tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google Maps',
      crossOrigin: true,
      // Android WebView requires User-Agent in tile requests
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Referer': 'https://maps.google.com/'
      }
    });
    
  // Add primary tile layer
    tileLayer.addTo(m);
    
    // Fallback: If tiles don't load, use OpenStreetMap
    tileLayer.on('tileerror', function(error) {
      m.removeLayer(tileLayer);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
        crossOrigin: true
      }).addTo(m);
    });
    
    // Clear old markers before creating new ones
    if(window.mapMarkers && Object.keys(window.mapMarkers).length > 0) {
      Object.values(window.mapMarkers).forEach(marker => {
        try { m.removeLayer(marker); } catch(e) {}
      });
    }
    window.mapMarkers={};
    
    // Create delivery marker - escape address for safe HTML
    // Normalize addresses to detect if delivery is same as pickup (avoid duplicate display on map)
    var normalize = function(s) { return s ? s.replace(/\\s+/g, " ").trim().toLowerCase() : ""; };
    var normPickupAddr = normalize(${JSON.stringify(pickupAddress || "")});
    var normDeliveryAddr = normalize(${JSON.stringify(deliveryAddress || "")});
    var displayDeliveryAddr = (!${JSON.stringify(deliveryAddress || "")}) ? "Delivery Location" 
      : (normDeliveryAddr === normPickupAddr && normPickupAddr !== "") ? "Same as pickup"
      : ${JSON.stringify(deliveryAddress)};
    
    ${finalDeliveryLat && finalDeliveryLng ? `
  var deliveryHtml = '📍 Delivery<br/>' + displayDeliveryAddr;
  var deliverySvg = '<svg class="svg-marker" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 48 48">'
    + '<circle cx="24" cy="20" r="12" fill="${singleOrderDelivered ? "#CBD5E1" : "#34D399"}" stroke="${singleOrderDelivered ? "#6B7280" : "#10B981"}" stroke-width="3"/>'
    + '<path d="M24 36c-6 0-10-4.5-10-10 0-5.5 4-10 10-10s10 4.5 10 10c0 5.5-4 10-10 10z" fill="rgba(0,0,0,0.02)"/>'
    + '<text x="24" y="24" font-size="12" font-weight="700" text-anchor="middle" fill="#fff">B</text>'
    + '</svg>';
  window.mapMarkers.delivery=L.marker([${finalDeliveryLat},${finalDeliveryLng}],{icon:L.divIcon({html:deliverySvg,iconSize:[44,44],className:'delivery-marker'})}).addTo(m).bindPopup(deliveryHtml);
    ` : ''}
    
    // Create pickup marker - escape address for safe HTML
    ${finalPickupLat && finalPickupLng ? `
  var pickupHtml = '📍 Pickup<br/>' + (${JSON.stringify(pickupAddress || 'Pickup Location')});
  var pickupSvg = '<svg class="svg-marker" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 48 48">'
    + '<circle cx="24" cy="20" r="12" fill="#FCD34D" stroke="#F59E0B" stroke-width="3"/>'
    + '<text x="24" y="24" font-size="12" font-weight="700" text-anchor="middle" fill="#111827">P</text>'
    + '</svg>';
  window.mapMarkers.pickup=L.marker([${finalPickupLat},${finalPickupLng}],{icon:L.divIcon({html:pickupSvg,iconSize:[44,44],className:'pickup-marker'})}).addTo(m).bindPopup(pickupHtml);
    ` : ''}
    
    // Create driver marker
    // NOTE: Driver marker is intentionally NOT inlined here. Driver positions are
    // handled via postMessage (UPDATE_LOCATION) so the WebView HTML remains stable
    // and does not reload every time the driver's GPS updates.
    
    // Fit all markers in view
    try {
      var markerList = Object.values(window.mapMarkers).filter(m => m && m._latlng);

      // NOTE: Polylines are now injected dynamically via injectPolylinesIntoMap()
      // This keeps the HTML stable and prevents WebView reloads when polyline states change

      if (markerList.length > 0) {
        if (!window.boundsFitted) {
          try {
            var group = new L.featureGroup(markerList);
            m.fitBounds(group.getBounds().pad(0.1));
            window.boundsFitted=true;
          } catch(e) {
            console.warn('fitBounds error:', e);
          }
        }
      }
      // Update overlay text for single delivery
      try {
        var overlay = document.getElementById('map-overlay');
        if (overlay) {
          var title = 'Direct delivery';
          if (encodedToPickup && encodedToDelivery) title = 'Route: pickup → delivery';
          else if (encodedToDelivery) title = 'Route: delivery';
          overlay.querySelector('.meta').innerText = title;
          overlay.querySelector('.sub').innerText = 'Tap Navigate to start';
        }
      } catch(e) {}
    } catch(e) {
      console.log('Could not fit bounds:', e);
    }
    
    window.mapReady=true;
  }catch(e){
    console.error(e);
    document.body.innerHTML='<div style="padding:20px;color:red;font-size:14px;">Error: '+e.message+'</div>';
  }
});

// Handle real-time location updates from parent
window.addEventListener('message',function(e){
  try{
    var data=JSON.parse(e.data);
    if(data.type==='UPDATE_LOCATION'&&window.mapInstance){
      var markerId=data.driver_id;
      var lat=data.lat;
      var lng=data.lng;
      
      if(window.mapMarkers[markerId]){
        // Update existing marker
        window.mapMarkers[markerId].setLatLng([lat,lng]);
      }else{
        // Create new marker for this driver
  var popupLabel = (window.mainDriverName && window.mainDriverName !== null && String(window.mainDriverName).trim() !== '') ? window.mainDriverName : ('Driver ' + markerId);
        var driverSvg = '<svg class="svg-marker" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 48 48">'
          + '<defs><filter id="f1" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0b1220" flood-opacity="0.12"/></filter></defs>'
          + '<circle cx="24" cy="24" r="18" fill="#3B82F6" stroke="#1E40AF" stroke-width="3" filter="url(#f1)"/>'
          + '<text x="24" y="28" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">A</text>'
          + '</svg>';
        window.mapMarkers[markerId]=L.marker([lat,lng],{icon:L.divIcon({html:driverSvg,iconSize:[44,44],iconAnchor:[22,22],className:'driver-marker'})}).addTo(window.mapInstance).bindPopup(popupLabel);
      }
      
      // Pan map to updated location
      window.mapInstance.panTo([lat,lng]);
    }
  }catch(e){
    console.error('postMessage error:',e);
  }
});
</script>
</body>
</html>`;

    return html;
  };

  // Memoize the generated HTML so the WebView source doesn't change on every
  // render (especially avoid including currentLat/currentLng here). We exclude
  // currentLat/currentLng from dependencies because driver position updates are
  // sent via postMessage instead. We also exclude fetchedRoute and encoded
  // polylines because updates to these (e.g., when ETAs are computed or when
  // polylines are fetched) would regenerate the HTML and force a WebView reload.
  // Instead, these values are read dynamically in getMapHTML() via closure.
  const memoizedMapHTML = useMemo(() => getMapHTML(), [
    multiStopMode,
    route,
    pickupLat,
    pickupLng,
    deliveryLat,
    deliveryLng,
    geocodedPickupLat,
    geocodedPickupLng,
    geocodedDeliveryLat,
    geocodedDeliveryLng,
    pickupAddress,
    deliveryAddress,
    effectiveDriverName,
    driverId,
    mapControlTop,
    singleOrderDelivered,
  ]);

  // Prepare safe display strings for footer addresses to avoid showing the same
  // address twice (backend sometimes returns duplicated values or slightly
  // different whitespace/casing). Normalize before comparing.
  const normalize = (s?: string) => (s ? s.replace(/\s+/g, " ").trim().toLowerCase() : "");
  const normPickup = normalize(pickupAddress);
  const normDelivery = normalize(deliveryAddress);
  const safePickupAddress = pickupAddress || "Pickup Location";
  let safeDeliveryAddress: string;
  if (!deliveryAddress) {
    safeDeliveryAddress = "Delivery Location";
  } else if (normDelivery === normPickup && normPickup !== "") {
    // If they're effectively identical, show an explicit note rather than repeating
    // the same pickup text; this avoids confusion in the footer.
    safeDeliveryAddress = "Same as pickup";
  } else {
    safeDeliveryAddress = deliveryAddress;
  }

  if (!visible) return null;

  // For single delivery UI: prefer geocoded pickup coords, or prop coords
  const singlePickupLat = geocodedPickupLat || (pickupLat ? Number(pickupLat) : null);
  const singlePickupLng = geocodedPickupLng || (pickupLng ? Number(pickupLng) : null);

  return (
    <View style={styles.container}>
      {/* HEADER - positioned at top of screen and below notch */}
      <View
        style={[
          styles.header,
          {
            position: "absolute",
            // Use safe-area inset when available; on Android fall back to StatusBar.currentHeight
            top: (insets.top && insets.top > 0) ? insets.top : (StatusBar.currentHeight || 12),
            left: 12,
            right: 12,
            zIndex: 1100,
            borderRadius: 10,
          },
        ]}
      >
        <View style={styles.headerTitle}>
          <Ionicons name="map-outline" size={20} color="#2563EB" />
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {multiStopMode
              ? `Route - ${route?.stops.length || 0} Stops`
              : `Order #${orderId}`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.headerVoiceControls}>
            <TouchableOpacity style={styles.langBtn} onPress={openLanguagePicker}>
              <Text style={styles.langBtnText}>{currentLanguage.label}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.stopSpeakBtn, speakingActive ? styles.stopSpeakActive : undefined]}
              onPress={stopSpeaking}
            >
              <Text style={styles.stopSpeakText}>Stop</Text>
              <View style={[styles.speakingDot, speakingActive ? styles.speakingOn : styles.speakingOff]} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        transparent
        visible={showLangPicker}
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLangPicker(false)}>
          <View style={styles.langModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.langPickerModal}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    style={styles.langPickerOption}
                    onPress={() => {
                      handleLanguageSelection(opt);
                      setShowLangPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.langPickerText,
                        opt.code === ttsLanguage && styles.langPickerTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.langPickerDivider} />
                <TouchableOpacity
                  style={styles.langPickerOption}
                  onPress={() => setShowLangPicker(false)}
                >
                  <Text style={styles.langPickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

  {/* MAP */}
  <View style={styles.mapContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html: memoizedMapHTML }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          startInLoadingState={true}
          // 🔧 Android WebView Configuration
          userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          mixedContentMode="always"
          // Allow external tile providers
          incognito={false}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
          onLoadEnd={() => {
            console.log("✅ Map ready");
            mapReadyRef.current = true;
            setIsMapReady(true);
            setLoading(false);
            // Location updates will be sent by the location watcher when map is ready
            // Inject polylines into the map after it loads (instead of embedding in HTML)
            // so the HTML remains stable and doesn't reload when polylines update.
            injectPolylinesIntoMap();
          }}
          onError={(e) => console.error("Map error:", e)}
          onMessage={(event) => {
            // Handle WebView messages
          }}
        />
        {/* Native zoom controls moved outside map container */}
      </View>

      {/* Native zoom controls (screen-anchored) - placed as sibling to header so they sit below it */}
      <View style={[styles.nativeZoomControls, { top: mapControlTop }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomBtn, { marginTop: 8 }]} onPress={zoomOut}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
      </View>

      {/* ENHANCED FOOTER - DELIVERY DETAILS PANEL */}
      <View style={styles.enhancedFooter}>
        {/* Header with Summary Info */}
        <View style={styles.panelHeader}>
          <View style={styles.summaryInfo}>
            {/* Use fetched route if available, otherwise use prop route */}
            {multiStopMode && (fetchedRoute || route) ? (
              <>
                <Text style={styles.summaryStops}>
                  {(fetchedRoute || route)!.stops.length} Active Deliveries
                </Text>
                <Text style={styles.summaryDistance}>
                  {(fetchedRoute || route)!.totalDistance.toFixed(1)} km •{" "}
                  {(fetchedRoute || route)!.totalDuration} min total
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.summaryStops}>1 Delivery</Text>
                <Text style={styles.summaryDistance}>Direct delivery</Text>
              </>
            )}
          </View>
        </View>
        {/* Stops List */}
        {multiStopMode && (fetchedRoute || route) ? (
          // Build a deduplicated display list for the footer: driver (if available) -> single pickup -> deliveries
          (() => {
            const srcStops = (fetchedRoute || route)!.stops || [];
            const normalizeAddr = (s?: string) => (s ? s.replace(/\s+/g, " ").trim().toLowerCase() : "");

            // Find a pickup candidate (first pickup-type stop)
            const firstPickup = srcStops.find((s) => s.type === "pickup");
            const pickupNorm = firstPickup ? normalizeAddr(firstPickup.address) : "";

            const displayStops: any[] = [];

            // 1) Driver location first (if we have a current position)
            if (currentLat && currentLng) {
              displayStops.push({
                id: "driver-location",
                type: "driver",
                address: driverName || "Driver location",
                latitude: currentLat,
                longitude: currentLng,
                status: "pending",
              } as any);
            }

            // 2) Single pickup (if any)
            if (pickupNorm) {
              // prefer the explicit pickup stop, otherwise find first stop matching the pickup address
              const pickupStop = firstPickup || srcStops.find((s) => normalizeAddr(s.address) === pickupNorm);
              if (pickupStop) displayStops.push(pickupStop as any);
            }

            // 3) Add delivery stops in original order (do not add extra pickup duplicates)
            for (const s of srcStops) {
              if (s.type === "delivery") {
                // Keep deliveries even if their address equals the pickup address, but do not add pickup twice
                displayStops.push(s as any);
              }
            }

            // Render the deduped displayStops
            return (
              <ScrollView
                ref={(r) => { stopsScrollRef.current = r; }}
                style={styles.stopsList}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { scrollPosRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {displayStops.map((stop, idx) => {
                  const letter = String.fromCharCode(65 + idx); // A, B, C...
                  const isPickup = stop.type === "pickup";
                  const isDriver = stop.type === "driver";
                  const bgColor = isDriver ? "#1E3A8A" : (isPickup ? "#FCD34D" : "#34D399");
                  // ❗ IMPORTANT: Only mark DELIVERY stops as completed (greyed out)
                  // NEVER grey out the pickup stop, even if it's marked as completed
                  const isCompleted = stop.type === "delivery" && stop.status === "completed";

                  // Determine whether pickup has been arrived: either status flag or proximity
                  const isArrived = isPickup && (
                    stop.status === 'arrived' || stop.status === 'completed' || (
                      currentLat && currentLng && stop.latitude && stop.longitude && distanceKm(currentLat, currentLng, Number(stop.latitude), Number(stop.longitude)) < 0.05
                    )
                  );

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.stopItem,
                        isCompleted && styles.stopItemCompleted,
                        selectedStop === idx && styles.stopItemSelected,
                      ]}
                      onPress={() => setSelectedStop(selectedStop === idx ? null : idx)}
                    >
                      <View style={[styles.stopBadge, { backgroundColor: bgColor }]}>
                        <View style={isCompleted ? styles.stopBadgeCompleted : undefined}>
                          <Text style={[styles.stopLetter, isCompleted && styles.stopLetterCompleted]}>{letter}</Text>
                        </View>
                      </View>

                      <View style={styles.stopContent}>
                        <Text style={[styles.stopTitle, isCompleted && styles.stopTitleCompleted]}>
                          {isDriver ? (driverName ? `Driver: ${driverName}` : "Driver location") : (isPickup ? "Restaurant Pickup" : stop.address?.split("\n")[0] || "Delivery")}
                        </Text>
                        <Text style={[styles.stopAddress, isCompleted && styles.stopAddressCompleted]} numberOfLines={1}>
                          {isDriver ? (driverName || "Driver location") : (stop.address?.substring(0, 50) || "")}
                        </Text>
                        {stop.estimatedArrivalTime && (
                          <Text style={styles.stopEta}>ETA: {stop.estimatedArrivalTime} min</Text>
                        )}
                      </View>

                      <View style={styles.stopRight}>
                        {isDriver ? (
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>Driver</Text>
                          </View>
                        ) : isPickup ? (
                          isArrived ? (
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusText}>Arrived</Text>
                            </View>
                          ) : (
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusText}>{stop.estimatedArrivalTime ? `${stop.estimatedArrivalTime} min` : 'Driver coming'}</Text>
                            </View>
                          )
                        ) : isCompleted ? (
                          <View style={styles.deliveredBadge}>
                            <Text style={styles.deliveredText}>Delivered</Text>
                          </View>
                        ) : (
                          <View>
                            <Text style={styles.stopTime}>
                              {stop.estimatedArrivalTime ? `${stop.estimatedArrivalTime} min` : "—"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            );
          })()
        ) : (
          /* Single Delivery View */
          <View style={styles.singleDelivery}>
            {/* Show driver location first if available */}
            {currentLat && currentLng && (
              <View style={styles.deliveryItem}>
                <View style={[styles.deliveryBadge, { backgroundColor: "#1E3A8A" }]}>
                  <Text style={styles.deliveryLetter}>A</Text>
                </View>
                <View style={styles.deliveryContent}>
                  <Text style={styles.deliveryTitle}>{driverName ? `Driver: ${driverName}` : "Driver location"}</Text>
                  <Text style={styles.deliveryAddress} numberOfLines={1}>
                    {driverName || "Current location"}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Driver</Text>
                </View>
              </View>
            )}

            {/* Pickup - shifts to B if driver shown, stays A if no driver */}
            <View style={styles.deliveryItem}>
              <View style={[styles.deliveryBadge, { backgroundColor: "#FCD34D" }]}>
                <Text style={styles.deliveryLetter}>{currentLat && currentLng ? "B" : "A"}</Text>
              </View>
              <View style={styles.deliveryContent}>
                <Text style={styles.deliveryTitle}>Restaurant Pickup</Text>
                <Text style={styles.deliveryAddress} numberOfLines={1}>
                  {safePickupAddress}
                </Text>
              </View>
              {/* Dynamic pickup arrival: proximity-based if driver's location available */}
              {currentLat && currentLng && singlePickupLat && singlePickupLng && distanceKm(currentLat, currentLng, singlePickupLat, singlePickupLng) < 0.05 ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Arrived</Text>
                </View>
              ) : (
                <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>{pickupETA ? `${pickupETA} min` : "—"}</Text>
                </View>
              )}
            </View>

            {/* Delivery - shifts to C if driver shown, stays B if no driver */}
            <View style={styles.deliveryItem}>
              <View style={[styles.deliveryBadge, { backgroundColor: singleOrderDelivered ? "#CBD5E1" : "#34D399" }]}>
                <Text style={[styles.deliveryLetter, singleOrderDelivered && styles.stopLetterCompleted]}>{currentLat && currentLng ? "C" : "B"}</Text>
              </View>
              <View style={styles.deliveryContent}>
                <Text style={[styles.deliveryTitle, singleOrderDelivered && styles.stopTitleCompleted]}>Delivery</Text>
                <Text style={[styles.deliveryAddress, singleOrderDelivered && styles.stopAddressCompleted]} numberOfLines={1}>
          {safeDeliveryAddress}
                </Text>
              </View>
              <View>
                {singleOrderDelivered ? (
                  <View style={styles.deliveredBadge}>
                    <Text style={styles.deliveredText}>Delivered</Text>
                  </View>
                ) : (
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeText}>{deliveryETA ? `${deliveryETA} min` : "—"}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ACTION BUTTON */}
      {/* DEBUG: Test View (currentStop presence) */}

      {/* Swipe-to-Deliver Gesture Area - Rendered Last to Stay On Top */}
      {swipeTargetOrderId && (
        <View
          style={styles.swipeContainer}
          pointerEvents="auto"
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.swipeSlider,
              {
                transform: [
                  {
                    translateX: swipeProgressAnim.interpolate({
                      inputRange: [0, 150],
                      outputRange: [0, 150],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                opacity: swipeProgressAnim.interpolate({
                  inputRange: [0, 150],
                  outputRange: [1, 0.5],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <Ionicons name="chevron-forward" size={24} color="#fff" />
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </Animated.View>

          <Text style={styles.swipeText}>
            {swipeProgress > 75 ? "Release to Deliver" : "Swipe to Deliver"}
          </Text>
        </View>
      )}
    </View>
  );
});

MapModal.displayName = "MapModal";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000cc",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    maxHeight: 56,
    minHeight: 44,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    overflow: "hidden",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flexShrink: 1,
    flex: 1,
  },
  closeButton: {
    padding: 6,
  },
  mapContainer: {
    height: screenHeight * 0.55,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },

  // ✨ ENHANCED FOOTER STYLES
  enhancedFooter: {
    backgroundColor: "#1F2937",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: screenHeight * 0.35,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryStops: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F3F4F6",
    marginBottom: 4,
  },
  summaryDistance: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  navigateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  navigateBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerVoiceControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  langBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  langModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  langPickerModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 12,
  },
  langPickerOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  langPickerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  langPickerTextActive: {
    color: "#0B69FF",
  },
  langPickerDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  langPickerCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
  stopSpeakBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  stopSpeakText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  speakingDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
  },
  speakingOn: {
    backgroundColor: "#10B981",
  },
  speakingOff: {
    backgroundColor: "#6B7280",
  },
  stopSpeakActive: {
    borderColor: "#10B981",
    borderWidth: 1,
  },

  // Stops List (Multi-Stop)
  stopsList: {
    flexGrow: 0,
    maxHeight: screenHeight * 0.25,
    marginBottom: 12,
    paddingBottom: 100,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#374151",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
  },
  stopItemSelected: {
    backgroundColor: "#4B5563",
    borderLeftColor: "#60A5FA",
  },
  stopBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stopLetter: {
    fontWeight: "700",
    fontSize: 14,
    color: "#111827",
  },
  stopContent: {
    flex: 1,
  },
  stopTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F3F4F6",
    marginBottom: 2,
  },
  stopAddress: {
    fontSize: 11,
    color: "#D1D5DB",
    marginBottom: 4,
  },
  stopEta: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  stopRight: {
    alignItems: "flex-end",
  },
  stopDistance: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F3F4F6",
  },
  stopTime: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  stopItemCompleted: {
    opacity: 0.7,
    backgroundColor: "#2F3944",
  },
  deliveredBadge: {
    backgroundColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  deliveredText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D1D5DB",
  },
  stopBadgeCompleted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "#9CA3AF",
    borderWidth: 1,
    borderColor: "#6B7280",
  },
  stopLetterCompleted: {
    color: "#374151",
    fontWeight: "700",
  },
  stopTitleCompleted: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  stopAddressCompleted: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },

  // Single Delivery View
  singleDelivery: {
    gap: 10,
    marginBottom: 12,
    paddingBottom: 100,
  },
  deliveryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#374151",
    borderRadius: 12,
  },
  deliveryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  deliveryLetter: {
    fontWeight: "700",
    fontSize: 16,
    color: "#111827",
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F3F4F6",
    marginBottom: 2,
  },
  deliveryAddress: {
    fontSize: 11,
    color: "#D1D5DB",
  },

  // Status & Time Badges
  statusBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  timeBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Swipe styles (overlay)
  swipeContainer: {
    position: "relative",
    marginTop: 16,
    marginBottom: 24,
    alignSelf: "center",
    width: "90%",
    height: 60,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#10B981",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  swipeSlider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swipeText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "600",
  },

  // Compact zoom buttons
  nativeZoomControls: {
    position: "absolute",
    right: 12,
    width: 36,
    alignItems: "center",
    zIndex: 1200,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(31,41,55,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 5,
  },
  zoomText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },

  // Old styles (kept for compatibility)
  footer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  address: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 4,
  },
  coords: {
    fontSize: 11,
    color: "#0C4A6E",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: "#F0F9FF",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  dismissBtn: {
    margin: 16,
    paddingVertical: 12,
    backgroundColor: "#2563EB",
    borderRadius: 8,
    alignItems: "center",
  },
  dismissText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
