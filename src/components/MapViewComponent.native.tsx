// Native-specific export for react-native-maps
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

try {
  const module = require("react-native-maps");
  MapView = module.default;
  Marker = module.Marker;
  Polyline = module.Polyline;
  PROVIDER_GOOGLE = module.PROVIDER_GOOGLE;
  console.log("✅ react-native-maps loaded successfully on native");
} catch (e) {
  console.error("❌ Failed to load react-native-maps:", e);
}

export { MapView, Marker, Polyline, PROVIDER_GOOGLE };
export default MapView;
