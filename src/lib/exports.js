export const download = (name, text, type) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

export const toCsv = (logs) => {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const headers = ["id","type","status","capturedAt","verifiedBy","lat","lng","mythosWarnings","mythosBlockers"];
  const rows = logs.map((l) => [l.id,l.type,l.status,l.capturedAt,l.verifiedBy||"",l.gps?.lat||"",l.gps?.lng||"",(l.mythosAudit?.warnings||[]).join("|"),(l.mythosAudit?.blockers||[]).join("|")]);
  return [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
};

export const toKml = (logs) => `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${logs.filter((l)=>l.gps?.lat&&l.gps?.lng).map((l)=>`<Placemark><name>${l.type} ${l.status}</name><description>${(l.mythosAudit?.warnings||[]).join("; ")}</description><Point><coordinates>${l.gps.lng},${l.gps.lat},0</coordinates></Point></Placemark>`).join("")}</Document></kml>`;
