const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * devices = {
 *   [deviceId]: { last: point|null, history: point[] }
 * }
 */
const devices = {};

function ensureDevice(deviceId) {
  if (!devices[deviceId]) devices[deviceId] = { last: null, history: [] };
  return devices[deviceId];
}

app.post("/locations", (req, res) => {
  const { deviceId, latitude, longitude, accuracy, timestamp } = req.body || {};

  if (!deviceId) return res.status(400).json({ ok: false, error: "deviceId required" });
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ ok: false, error: "latitude/longitude required" });
  }

  const point = {
    deviceId,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    timestamp: timestamp ?? Date.now(),
    receivedAt: Date.now(),
  };

  const d = ensureDevice(deviceId);
  d.last = point;
  d.history.push(point);
  if (d.history.length > 5000) d.history = d.history.slice(-5000);

  console.log("📍", deviceId, latitude, longitude);
  res.json({ ok: true });
});

app.get("/devices", (req, res) => {
  const list = Object.entries(devices).map(([deviceId, v]) => ({
    deviceId,
    last: v.last,
    count: v.history.length,
  }));
  res.json({ ok: true, devices: list });
});

app.get("/last", (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) return res.status(400).json({ ok: false, error: "deviceId required" });

  const d = devices[deviceId];
  res.json(d?.last ?? { ok: false });
});

app.get("/history", (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) return res.status(400).json({ ok: false, error: "deviceId required" });

  const limit = Math.max(1, Math.min(parseInt(req.query.limit || "200", 10), 5000));
  const d = devices[deviceId];
  const points = (d?.history ?? []).slice(-limit);
  res.json({ ok: true, deviceId, count: points.length, points });
});

// opcional: limpar tudo
app.delete("/reset", (req, res) => {
  for (const k of Object.keys(devices)) delete devices[k];
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log("Server running on port", PORT));

