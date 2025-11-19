import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { useAuth } from "../src/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError("Invalid credentials");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.inner}>
        {/* LOGO TEXT */}
        <Text style={styles.brand}>BEYPRO</Text>
        <Text style={styles.subtitle}>Admin Access</Text>

        {/* CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="admin@yourstore.com"
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={setEmail}
            value={email}
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.label, { marginTop: 18 }]}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry
            onChangeText={setPassword}
            value={password}
            placeholderTextColor="#9CA3AF"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>© Beypro • Professional POS System</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
  },

  inner: {
    paddingHorizontal: 28,
  },

  brand: {
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 1,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
    color: "#6B7280",
    fontWeight: "500",
  },

  card: {
    backgroundColor: "white",
    marginTop: 34,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  label: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 6,
  },

  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: "#F3F4F6",
    color: "#111827",
  },

  button: {
    marginTop: 26,
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  error: {
    marginTop: 12,
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "500",
  },

  footer: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
  },
});
