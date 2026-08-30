import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { loginAndLoad } from "../lib/api";
import { setupNotifications } from "../lib/notifications";

export default function LoginScreen() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync("dash_pwd");
        if (saved) {
          await loginAndLoad(saved);
          await setupNotifications(saved).catch(() => null);
          router.replace("/home");
          return;
        }
      } catch {
        /* precisa login */
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function entrar() {
    setLoading(true);
    setError("");
    try {
      await loginAndLoad(password);
      await SecureStore.setItemAsync("dash_pwd", password);
      await setupNotifications(password).catch(() => null);
      router.replace("/home");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha no login";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0d9488" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.center}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>MA</Text>
        </View>
        <Text style={styles.title}>Mundo Atleta</Text>
        <Text style={styles.sub}>Dashboard mobile</Text>

        <TextInput
          style={styles.input}
          placeholder="Senha do dashboard"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={entrar}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, (!password || loading) && { opacity: 0.5 }]}
          disabled={!password || loading}
          onPress={entrar}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#f4f6f8",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0d9488",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  title: { fontSize: 20, fontWeight: "800", color: "#111" },
  sub: { fontSize: 13, color: "#888", marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  error: { color: "#dc2626", marginBottom: 8, fontSize: 13 },
  btn: {
    backgroundColor: "#0d9488",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
