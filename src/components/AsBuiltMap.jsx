import React from "react";
export default function AsBuiltMap({ points, addPoint }) { return <section className="page"><h3>As-Built</h3><div className="mapbox" onClick={addPoint}>{points.map((p)=><div key={p.id} className="pin" style={{left:`${p.x}%`, top:`${p.y}%`, background:p.color}}>{p.kind[0]}</div>)}</div></section>; }
