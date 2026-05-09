# Brisbane Public Transport Heartbeat

Stop-level public-transport origin–destination flows across South-East Queensland, Jun 2016 → Mar 2026 (51 months). A daily-rhythm pulse animation: each weekday time bucket (early-AM / midday / PM-peak / evening) plays a wave of trips O→D; the **▶ Play** button walks month-by-month while the pulse cycles.

**Live:** https://whitehatnetizen.github.io/brisbane-translink-OD/

## What it shows

- 4 modes: **bus**, **rail**, **ferry**, **light rail** — switch with the mode pills
- 4 daily time buckets per weekday (early-AM, midday, PM-peak, evening)
- Top-2000 OD pairs per mode × bucket
- Particles route along **real infrastructure**:
  - **Ferry** along the Brisbane River polyline
  - **Rail** along per-line GTFS shapes
  - **Bus** along per-shape GTFS polylines (shortest-shared route)
  - Light Rail / G:link uses straight lines
- Volume-conserving: anchor area = sum of moving-dot areas; fixed `1 dot = 1000 trips` ratio with a 15k particle cap
- Two pulse styles: **Migrate** (one blob per flow shrinks into destination) and **Mass + stream** (anchors shrink/grow + continuous particle stream)
- **Doppler colouring**: each flow tagged by direction relative to CBD (red = toward, blue = away, neutral = lateral)
- Anomaly mode: brightness modulates above/below typical for that bucket

## Data

- **Source:** [TransLink Origin-Destination Trips (2022 onwards)](https://www.data.qld.gov.au/dataset/translink-origin-destination-trips-2022-onwards), CC BY 4.0
- **Period covered:** Jun 2016 – Mar 2026 (51 months)
- **GTFS shapes:** TransLink GTFS feed
- **River polyline:** OpenStreetMap (sourced via Overpass)
- **Excludes:** Airtrain
- **Caveats:** stops file dated Jan 2025; ~0.6% of Mar 2026 trips reference unmatched stop IDs

## Running locally

The dashboard is static. Serve from the repo root over HTTP (the JSON payloads are fetched, so `file://` won't work):

```bash
python -m http.server 8770
# then open http://localhost:8770/dashboard/
```

## Folder layout

```
brisbane-translink-OD/
├─ index.html           # redirects to dashboard/
├─ dashboard/
│  ├─ index.html        # main heartbeat dashboard
│  ├─ gallery.html      # visualisation gallery (sankey + alt views)
│  ├─ cbd-grid.html     # Q1 2026 CBD comparative grid
│  ├─ cbd-grid-data.json
│  ├─ sun-moon.json
│  └─ medical-dial.js   # day-arc dial component
└─ data/
   └─ build/            # ~21 MB total
      ├─ stops.json
      ├─ months.json
      ├─ stable_flows.json
      ├─ hubs.json
      ├─ network.json
      ├─ ferry_paths.json
      ├─ rail_paths.json
      ├─ bus_paths.json
      └─ cbd.json
```

## Stack

- [maplibre-gl](https://maplibre.org/) for the basemap (Stamen via Stadia Maps)
- [deck.gl](https://deck.gl/) for the particle layers and anchors
- [d3-sankey](https://github.com/d3/d3-sankey) on the gallery page
- [lottie-web](https://airbnb.io/lottie/) for the day-arc dial accents

## License

Code: MIT. Data: CC BY 4.0 (TransLink / Department of Transport and Main Roads, Queensland Government).
