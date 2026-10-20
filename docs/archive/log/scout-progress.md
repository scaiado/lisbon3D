# Lisbon 3D Explorer - Scout Progress Log

**Date:** 2026-03-24  
**Status:** Research Phase - Data Sources Identified

## Summary
This log tracks the data acquisition progress for the Lisbon 3D Explorer project.

---

## 1. DGT LiDAR Data

### Source
- **URL:** https://cdd.dgterritorio.gov.pt/
- **Organization:** Direção-Geral do Território (DGT)

### Data Available
1. **MDT-50cm** - Digital Terrain Model (bare earth), 50cm resolution
2. **MDT-2m** - Digital Terrain Model, 2m resolution
3. **MDS-50cm** - Digital Surface Model (includes buildings/trees), 50cm resolution
4. **MDS-2m** - Digital Surface Model, 2m resolution
5. **LAZ** - Point cloud data (10 points/m² density)

### CRS
EPSG:3763 (PT-TM06/ETRS89)

### Download Method
The DGT portal uses a tile-based selection system:
1. Navigate to map interface
2. Draw selection polygon (max 200 km² per request)
3. Add tiles to download cart
4. Process and download (24h availability window)

### Tile Index
Tile reference file available at:  
`https://cdd.dgterritorio.gov.pt/dgt-fe/data/LiDAR2024_2025_Seccionamento.rar`

### QGIS Plugin
Community plugin available: `dgt_cdd_downloader`  
- Handles authentication
- Splits large areas
- Organizes downloads
- Creates VRTs for raster data

### Blockers
- Requires user registration for downloads
- Web interface requires interactive tile selection
- No direct FTP/HTTP bulk download discovered yet

---

## 2. CML Building Data

### Source
- **Primary:** https://geodados-cml.hub.arcgis.com/
- **Organization:** Câmara Municipal de Lisboa (CML)

### Platform
ArcGIS Hub with 77 datasets including:
- Administrative boundaries
- Urban equipment
- Environmental data
- Transport networks

### Data Format
Feature Services (ArcGIS REST API)

### Building Data Search
Searching for "edifícios" (buildings) - results pending

### Download Method
- Direct ArcGIS Feature Service access
- Export to Shapefile/GeoJSON available
- API endpoint: `https://cml.maps.arcgis.com/`

---

## 3. Orthophoto Imagery

### Source
- **URL:** https://smos.dgterritorio.gov.pt/cartografia-de-base
- **Organization:** DGT / SMOS (Sistema de Monitorização da Ocupação do Solo)

### Available Products

#### OrtoSat2023 ⭐ RECOMMENDED
- **Resolution:** 30cm (very high resolution)
- **Source:** Pléiades-Neo satellites (2023 acquisition)
- **Coverage:** All mainland Portugal
- **Format:** Mosaic (equalized, cloud-free)
- **Compositions:** True color + False color
- **WMS Access:** Public via SNIG
- **Download:** Restricted to Public Administration entities

#### Ortofotomapas
- **Resolution:** 25cm to 1m
- **Source:** Aerial photography (photogrammetric cameras)
- **Editions:** 1995, 2007, 2010, 2015, 2018
- **Coverage:** Mainland Portugal
- **Coincides with:** Carta de Uso e Ocupação do Solo (COS)

#### Mosaicos Sentinel-2
- **Resolution:** 10m
- **Frequency:** Monthly
- **Since:** 2018
- **Coverage:** All mainland Portugal

### WMS Service (Public Access)
OrtoSat2023 available via WMS from SNIG:
- `https://cartografia.dgterritorio.gov.pt/wms/ortos2021`
- See JOSM/Maps/Portugal for layer parameters

### For 3D Project
**Recommendation:** Use OrtoSat2023 (30cm) via WMS or request download access

---

## Next Steps

### Option 1: Manual Download via DGT Portal
1. Register at cdd.dgterritorio.gov.pt
2. Select Lisbon tiles on map interface
3. Download DTM + DSM (50cm)
4. Download orthophoto

### Option 2: QGIS Plugin
1. Install dgt_cdd_downloader plugin
2. Authenticate with DGT credentials
3. Select Lisbon area
4. Batch download

### Option 3: Direct API/REST
Research direct WMS/WFS endpoints for:
- DGT raster data
- CML building vectors

### Option 4: OSM Fallback
If CML 3D buildings unavailable:
- Geofabrik OSM extracts for Portugal
- Building footprints from OSM
- Height data from LiDAR DSM

---

## Questions for Main Agent
1. **DGT Registration:** Should I register an account for automated downloads?
2. **Area Definition:** Exact bounding box for Lisbon (city center vs metropolitan)?
3. **Resolution Trade-off:** 50cm = better quality but ~25x larger files than 2m
4. **OSM vs CML:** Preference for building data source?
