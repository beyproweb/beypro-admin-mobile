import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getItem(key: string): Promise<string | null> {
  // Try SecureStore first (native secure storage)
  try {
    if (typeof SecureStore.getItemAsync === "function") {
      const v = await SecureStore.getItemAsync(key);
      if (v) return v;
    }
  } catch (e) {
    // Fallback to AsyncStorage on error
  }
  
  // Fall back to AsyncStorage (works on all platforms)
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn(`Storage getItem error for key "${key}":`, e);
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  // Try SecureStore first (native secure storage)
  try {
    if (typeof SecureStore.setItemAsync === "function") {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch (e) {
    // Fallback to AsyncStorage on error
  }
  
  // Fall back to AsyncStorage (works on all platforms)
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Storage setItem error for key "${key}":`, e);
  }
}

export async function deleteItem(key: string): Promise<void> {
  // Try SecureStore first (native secure storage)
  try {
    if (typeof SecureStore.deleteItemAsync === "function") {
      await SecureStore.deleteItemAsync(key);
      return;
    }
  } catch (e) {
    // Fallback to AsyncStorage on error
  }
  
  // Fall back to AsyncStorage (works on all platforms)
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn(`Storage deleteItem error for key "${key}":`, e);
  }
}

export default { getItem, setItem, deleteItem };
