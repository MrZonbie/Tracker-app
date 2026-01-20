import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, StyleSheet } from "react-native";

import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";

import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";
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
  count: number;
};

type ViewMode = "single" | "all";

// ---------- CORES ----------
const COLORS = ["red", "blue", "green", "orange", "purple", "pink", "brown"];

export default function HomeScreen() {
  const [permission, setPermission] = useState("—");
  const [deviceId, setDeviceId] = useState("—");
  const [viewMode, setViewMode] = useState<ViewMode>("single");

  const [history, setHistory] = useState<Point[]>([]);
  const [last, setLast] = useState<Point | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  const mapRef = useRef<MapView>(null!);

  // ---------- INIT ----------
  useEffect(() => {
    (async () => {
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
    if (!deviceId) return;

    const res = await fetch(
      `${SERVER_URL}/history?deviceId=${deviceId}&limit=200`
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

  // ---------- LOCATION ----------
  async function requestPermission() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      Alert.alert("Permissão negada");
      return;
    }
    await Location.requestBackgroundPermissionsAsync();
    setPermission("ok");
  }

  async function sendCurrentLocation() {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const p: Point = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      timestamp: loc.timestamp,
    };

    setLast(p);

    await fetch(`${SERVER_URL}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, ...p }),
    });
  }

  // ---------- UI ----------
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Tracker</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText>DeviceId:</ThemedText>
        <ThemedText numberOfLines={1}>{deviceId}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <Button title="Pedir permissões" onPress={requestPermission} />
        <Button title="Enviar localização atual" onPress={sendCurrentLocation} />
      </ThemedView>

      {/* --------- MODO --------- */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Visualização</ThemedText>
        <Button
          title="Este dispositivo"
          onPress={() => {
            setViewMode("single");
            fetchHistory();
          }}
        />
        <Button
          title="Todos os dispositivos"
          onPress={() => {
            setViewMode("all");
            fetchDevices();
          }}
        />
      </ThemedView>

      {/* --------- MAPA --------- */}
      <ThemedView style={{ height: 350, borderRadius: 12, overflow: "hidden" }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
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
              title="Última posição"
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
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <Button title="Iniciar BG" onPress={startTracking} />
        <Button title="Parar BG" onPress={stopTracking} />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText>
          {viewMode === "single"
            ? `Pontos na rota: ${routeCoords.length}`
            : `Dispositivos visíveis: ${devices.length}`}
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 12,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
