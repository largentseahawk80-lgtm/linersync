# LINERSYNC FIELD CURRENT APP

Fully functional local preview repo for the LinerSync field QC application.

## What works

- Tap Capture for:
  - Roll Inventory
  - Panel Placement
  - Seam Log
  - Wedge Test
  - Extrusion Log
  - Air Test
  - Destructive Test
  - Repair Log
  - Daily Log
- Constant job data auto-fills until changed:
  - active roll number
  - active panel
  - active seam
  - liner type/thickness/width
  - crew/weather/machine/rod lot
- GPS/time capture
- Last Logs viewer
- Edit saved logs
- Lock/approve records
- Copy/delete/export individual records
- As-Built tap map
- AR Vision camera preview foundation
- Mythos QC checks
- CSV, JSON, KML exports
- Local browser storage

## Run locally

```bash
npm install
npm run dev
```

Open the shown local URL.

## Deploy

This is a Vite React app. Deploy to Netlify, Vercel, or GitHub Pages after build.

```bash
npm run build
```
