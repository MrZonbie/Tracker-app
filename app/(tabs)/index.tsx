import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { getOrCreateDeviceId } from "../../src/device/deviceId";
import {
  setDeviceId as setDeviceIdForTracking,
  setServerUrl,
  startTracking,
  stopTracking,
} from "../../src/location/tracking";

const SERVER_URL = "https://tracker-backend-kyf7.onrender.com";
setServerUrl(SERVER_URL);

// ---------- TIPOS ----------
type Point = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

type Device = {
  deviceId: string;
  last: Point | null;
};

type ViewMode = "single" | "all";

// ---------- CORES ----------
const COLORS = ["red", "blue", "green", "orange", "purple", "brown"];

export default function HomeScreen() {
  const mapRef = useRef<MapView>(null);

  const [deviceId, setDeviceId] = useState<string>("—");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [menuOpen, setMenuOpen] = useState(false);

  const [history, setHistory] = useState<Point[]>([]);
  const [last, setLast] = useState<Point | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  // ---------- INIT ----------
  useEffect(() => {
    (async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        Alert.alert("Permissão negada");
        return;
      }

      await Location.requestBackgroundPermissionsAsync();

      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      setDeviceIdForTracking(id);
    })();
  }, []);

  // ---------- MAP DATA ----------
  const routeCoords = useMemo(
    () =>
      history.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    [history]
  );

  // ---------- API ----------
  async function fetchHistory() {
    if (!deviceId || deviceId === "—") return;

    const res = await fetch(
      `${SERVER_URL}/history?deviceId=${deviceId}&limit=300`
    );
    const json = await res.json();

    if (json?.ok) {
      const points: Point[] = json.points ?? [];
      setHistory(points);

      if (points.length) setLast(points[points.length - 1]);

      const coords = points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      setTimeout(() => {
        if (coords.length >= 2) {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }
      }, 200);
    }
  }

  async function fetchDevices() {
    const res = await fetch(`${SERVER_URL}/devices`);
    const json = await res.json();
    if (json?.ok) setDevices(json.devices ?? []);
  }

  async function centerOnMe() {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    mapRef.current?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  }

  // ---------- UI ----------
  return (
    <View style={styles.container}>
      {/* MAPA */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: -23.55,
          longitude: -46.63,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* SINGLE */}
        {viewMode === "single" && routeCoords.length >= 2 && (
          <Polyline coordinates={routeCoords} strokeWidth={4} />
        )}

        {viewMode === "single" && last && (
          <Marker
            coordinate={{ latitude: last.latitude, longitude: last.longitude }}
            title="Minha posição"
          />
        )}

        {/* ALL */}
        {viewMode === "all" &&
          devices.map((d, i) =>
            d.last ? (
              <Marker
                key={d.deviceId}
                coordinate={{
                  latitude: d.last.latitude,
                  longitude: d.last.longitude,
                }}
                title={`Device ${i + 1}`}
                pinColor={COLORS[i % COLORS.length]}
              />
            ) : null
          )}
      </MapView>

      {/* BOTÕES FLUTUANTES */}
      <View style={styles.fabGroup}>
        {/* MENU */}
        <TouchableOpacity onPress={() => setMenuOpen(true)}>
          <ThemedView style={styles.fabInner}>
            <ThemedText style={styles.fabIcon}>☰</ThemedText>
          </ThemedView>
        </TouchableOpacity>

        {/* MODE */}
        <TouchableOpacity
          onPress={async () => {
            if (viewMode === "single") {
              setViewMode("all");
              await fetchDevices();
            } else {
              setViewMode("single");
              await fetchHistory();
            }
          }}
        >
          <ThemedView style={styles.fabInner}>
            <ThemedText style={styles.fabIcon}>
              {viewMode === "single" ? "👥" : "📍"}
            </ThemedText>
          </ThemedView>
        </TouchableOpacity>

        {/* CENTER */}
        <TouchableOpacity onPress={centerOnMe}>
          <ThemedView style={styles.fabInner}>
            <ThemedText style={styles.fabIcon}>📍</ThemedText>
          </ThemedView>
        </TouchableOpacity>
      </View>

      {/* MENU / BOTTOM SHEET */}
      <Modal transparent visible={menuOpen} animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setMenuOpen(false)}
        />

        <ThemedView style={styles.sheet}>
          <ThemedText type="subtitle">Ações</ThemedText>

          <Pressable
            style={styles.sheetItem}
            onPress={async () => {
              setMenuOpen(false);
              await startTracking();
              Alert.alert("Rastreamento iniciado");
            }}
          >
            <ThemedText>▶️ Iniciar rastreio</ThemedText>
          </Pressable>

          <Pressable
            style={styles.sheetItem}
            onPress={async () => {
              setMenuOpen(false);
              await stopTracking();
              Alert.alert("Rastreamento parado");
            }}
          >
            <ThemedText>⏸️ Parar rastreio</ThemedText>
          </Pressable>

          <Pressable
            style={styles.sheetItem}
            onPress={async () => {
              setMenuOpen(false);
              setViewMode("single");
              await fetchHistory();
            }}
          >
            <ThemedText>🕓 Buscar histórico</ThemedText>
          </Pressable>
        </ThemedView>
      </Modal>
    </View>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  fabGroup: {
    position: "absolute",
    bottom: 30,
    right: 20,
    gap: 12,
  },

  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },

  fabIcon: {
    fontSize: 22,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  sheet: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },

  sheetItem: {
    paddingVertical: 14,
  },
});
