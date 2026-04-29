import React from "react";
export default function AppShell({ status, children }) { return <div className="app-shell" data-linersync-mounted="true"><main className="main">{children}</main><div className="status-bar">{status}</div></div>; }
