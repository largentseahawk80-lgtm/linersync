import React from "react";
export default function Exports({ onCsv, onKml, onJson, onImport }) { return <section className="page"><div className="button-row"><button onClick={onCsv}>CSV export</button><button onClick={onKml}>KML export</button><button onClick={onJson}>JSON backup export</button><input type="file" accept="application/json,.json" onChange={onImport} /></div></section>; }
