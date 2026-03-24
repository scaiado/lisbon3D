# 🇵🇹 Lisbon 3D Explorer

A web-based 3D map of Lisbon built entirely with open data and open-source tools.

**🔗 Live Demo:** https://lisbon.tinylittlelab.com

![Lisbon 3D Screenshot](docs/assets/snapshot-v0.png)

---

## ✨ Features

- **3D Terrain** — Real elevation data from Portuguese government LiDAR
- **3D Buildings** — Extruded building footprints with height data
- **POV Walking Mode** — Walk through Lisbon streets in first-person (WASD controls)
- **Landmark Markers** — São Jorge Castle, Belém Tower, Cristo Rei
- **100% Open Data** — No proprietary sources, no paid APIs

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **3D Rendering** | [MapLibre GL JS](https://maplibre.org/) |
| **Terrain Data** | DGT (Direção-Geral do Território) LiDAR |
| **Building Data** | MapTiler + OpenStreetMap |
| **Base Tiles** | OpenStreetMap |
| **Hosting** | Vercel |
| **Domain** | Tiny Little Lab |

---

## 📊 Data Sources

- **DGT LiDAR** — Portuguese government open data (terrain elevation)
- **CML (Câmara Municipal de Lisboa)** — Building footprints and heights
- **OpenStreetMap** — Base map tiles and geographic data
- **MapTiler** — 3D building extrusions and terrain tiles

All data is **openly licensed** and free to use.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A free [MapTiler](https://cloud.maptiler.com/account/keys/) API key

### Installation

```bash
# Clone the repo
git clone https://github.com/scaiado/lisbon3D.git
cd lisbon3D

# Install dependencies
npm install

# Add your MapTiler key (optional - for full 3D terrain)
# Edit main.js and replace MAPTILER_KEY

# Start dev server
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| **WASD** | Walk (in POV mode) |
| **P** | Toggle POV / Aerial mode |
| **R** | Reset view to center |
| **Mouse Drag** | Rotate view |
| **Scroll** | Zoom in/out |
| **Pitch Slider** | Adjust camera angle |

---

## 🗺️ Roadmap

- [x] v0.0 — Basic 3D viewer with terrain
- [ ] v0.1 — Add CML municipal building data
- [ ] v0.2 — Custom Lisbon-inspired UI design
- [ ] v0.3 — Full DGT LiDAR resolution
- [ ] v1.0 — Complete city experience with search

---

## 🏗️ Build in Public

This project was built in public over 37 minutes using a team of AI agents:

- **Scout** — Data acquisition (DGT LiDAR, CML buildings)
- **Forge** — 3D web visualization
- **Pixel** — UI/UX design
- **Peter** — Project coordination

Follow the build journey: [@scaiado](https://x.com/scaiado)

---

## 📄 License

- **Code:** MIT License
- **Data:** Open Data (CC-BY where applicable)

---

Built with ❤️ in Lisbon by [Tiny Little Lab](https://tinylittlelab.com)
