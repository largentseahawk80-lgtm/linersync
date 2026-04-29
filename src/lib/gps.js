export function getHighAccuracyPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: "Geolocation unavailable" });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
        capturedAt: new Date().toISOString()
      }),
      (e) => resolve({ error: e.message || "GPS blocked" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
