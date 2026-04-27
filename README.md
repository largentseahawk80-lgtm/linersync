# LinerSync — MASTER APP

This is the master repo for the geosynthetic liner QC field app.

Live app target:

https://largentseahawk80-lgtm.github.io/linersync/

Repo:

https://github.com/largentseahawk80-lgtm/linersync

## Do not build the app anywhere else

This repo is the single source of truth.

Do not continue active LinerSync work in these older or side repos unless a file is being copied into this repo:

- GeoCore_QC
- GEOCORE-PRO
- geocorepro
- LINERSYNCV1
- LINERSYNCV2
- LINERSYNCV76
- LINERSYNC-FIELD
- LINERSYNC-FIELDV2
- linersync-react-base
- linersync-real-data-build
- field-app
- FieldMap

## Why this repo is the master

This version already contains the strongest field-app foundation:

- IndexedDB storage
- Legacy localStorage migration
- Photo vault logic
- GPS capture logic
- Panel records
- Seam records
- Air tests
- Trial welds
- Destructive tests
- Vacuum repairs
- Rolls
- Welders
- CSV export
- XLSX workbook export
- Daily report generation
- Drone photo EXIF GPS reading

## Current work order

1. Stabilize this master repo and live deploy.
2. Confirm all raw QC data fields match the work templates.
3. Fix and test exports.
4. Build Daily As-Built from saved logs.
5. Build Drone photo/map/as-built overlay workflow.
6. Build Mythos QC assistant checks.
7. Improve AR only after logs, exports, and as-built are stable.

## Raw data rule

No personal preset data should be hardcoded.

Fields can remember values only after the user enters them.

## Active QC records needed

- Project setup
- Roll inventory
- Panel placement
- Wedge welding
- Weld test
- Air test
- Destructive test
- Vacuum repair
- Daily as-built
- Drone photos / map points

## Confusion prevention rule

Before any future build work, confirm the repo name is:

`largentseahawk80-lgtm/linersync`

If the repo is not `linersync`, stop and switch back to this repo.
