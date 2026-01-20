import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "background-location-task";

type Point = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

let SERVER_URL = "";
let DEVICE_ID = "";

export function setServerUrl(url: string) {
  SERVER_URL = url;
}

export function setDeviceId(id: string) {
  DEVICE_ID = id;
}

async function sendLocationToServer(p: Point) {
  if (!SERVER_URL || !DEVICE_ID) return;

  try {
    await fetch(`${SERVER_URL}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: DEVICE_ID, ...p }),
    });
  } catch (err) {
    console.log("❌ BG send error:", err);
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const locations = (data as any)?.locations as Location.LocationObject[] | undefined;
  if (!locations?.length) return;

  const loc = locations[0];

  const p: Point = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    timestamp: loc.timestamp,
  };

  console.log("[BG] sending:", p.latitude, p.longitude);
  await sendLocationToServer(p);
});

export async function startTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,
    distanceInterval: 50,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Rastreamento ativo",
      notificationBody: "Coletando localização em segundo plano.",
    },
  });
}

export async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
