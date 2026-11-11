import React, { useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { TrailModel } from '../constants/SeededTrails';
import { FieldColors } from '../constants/FieldTokens';
import { SoiCandidateTrail } from '../services/SoiAnalysisService';
import { SoiExtractionResult, ExtractedTrail } from '../services/soiAnalyzerService';
import { SquadMediaRecord } from '../services/DatabaseService';

export interface TopoMapViewHandle {
  focusSoiTrail: (trailId: string, coords: [number, number][]) => void;
  flyToRegion: (bounds: [number, number][]) => void;
}

interface TopoMapViewProps {
  trails: TrailModel[];
  selectedTrail?: TrailModel | null;
  baseLayer?: 'topo' | 'satellite' | 'dark' | 'osm';
  soiCandidateTrails?: SoiCandidateTrail[];
  soiOverlayData?: SoiExtractionResult | null;
  soiOpacity?: number;
  layerVisibility?: {
    raw: boolean;
    footpaths: boolean;
    water: boolean;
    camps: boolean;
  };
  squadPhotos?: SquadMediaRecord[];
  onSelectTrail: (trail: TrailModel) => void;
  onSelectSoiTrail?: (trail: ExtractedTrail) => void;
  onDeselect: () => void;
  regionFocus?: string;
}

export const TopoMapView = forwardRef<TopoMapViewHandle, TopoMapViewProps>(({
  trails,
  selectedTrail,
  baseLayer = 'topo',
  soiCandidateTrails = [],
  soiOverlayData = null,
  soiOpacity = 0.72,
  layerVisibility = { raw: true, footpaths: true, water: true, camps: true },
  squadPhotos = [],
  onSelectTrail,
  onSelectSoiTrail,
  onDeselect,
  regionFocus,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isMapReadyRef = useRef<boolean>(false);

  // CRITICAL: Memoize HTML with EMPTY dependencies [] so WebView NEVER unmounts or reloads!
  const initialMapHtml = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0F1210; }
    .custom-pill {
      background: #4ADE80;
      color: #0F1210;
      font-family: monospace;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 6px;
      border-radius: 4px;
      border: 1.5px solid #0F1210;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .summit-pill {
      background: #FF5500;
      color: #FFFFFF;
      font-family: monospace;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 6px;
      border-radius: 4px;
      border: 1.5px solid #FFFFFF;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .photo-pin {
      background: #0F1210;
      color: #38BDF8;
      border: 1.8px solid #38BDF8;
      font-family: monospace;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.7);
    }
    .leaflet-popup-content-wrapper {
      background: #171D19 !important;
      color: #F7F5F0 !important;
      border: 1px solid #D99B26;
      border-radius: 6px;
      font-family: monospace;
      font-size: 11px;
    }
    .leaflet-popup-tip {
      background: #171D19 !important;
    }
    .leaflet-control-attribution { background: rgba(15,18,16,0.8) !important; color: #888 !important; font-size: 8px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map centered broadly on India
    var map = L.map('map', { zoomControl: false }).setView([22.5, 79.5], 5);

    // Multi-source Base Tile Layers (Topo, Esri Satellite, CartoDB Dark, OpenStreetMap)
    var baseLayers = {
      topo: L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenStreetMap, SRTM | OpenTopoMap',
        errorTileUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%230F1210"/><path d="M0 0 L256 256" stroke="%23222" stroke-width="1"/></svg>'
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Esri World Imagery'
      }),
      dark: L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', {
        maxZoom: 19,
        attribution: 'CartoDB Dark Basalt'
      }),
      osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      })
    };

    var currentBaseLayer = (baseLayers['topo'] || baseLayers.osm).addTo(map);

    window.setBaseLayer = function(layerName) {
      if (baseLayers[layerName] && currentBaseLayer !== baseLayers[layerName]) {
        map.removeLayer(currentBaseLayer);
        currentBaseLayer = baseLayers[layerName].addTo(map);
        currentBaseLayer.bringToBack();
      }
    };

    var trailsData = [];
    var selectedId = '';
    var candidateTrails = [];
    var layersGroup = L.featureGroup().addTo(map);

    // SOI Overlay Layers
    window.soiImageLayer = null;
    window.soiExtractedLayer = L.layerGroup().addTo(map);
    window.soiFootpathsSublayer = L.layerGroup().addTo(window.soiExtractedLayer);
    window.soiWaterSublayer = L.layerGroup().addTo(window.soiExtractedLayer);
    window.soiCampsSublayer = L.layerGroup().addTo(window.soiExtractedLayer);
    window.soiPeaksSublayer = L.layerGroup().addTo(window.soiExtractedLayer);

    // Squad Photo Pins Layer
    window.squadPhotosLayer = L.layerGroup().addTo(map);

    function renderTrails() {
      layersGroup.clearLayers();

      (trailsData || []).forEach(function(trail) {
        if (!trail || !trail.routeCoords || trail.routeCoords.length === 0) return;

        var isSelected = (trail.id === selectedId);
        var isImported = !!trail.isImported;
        var latLngs = (trail.routeCoords || []).map(function(c) { return [c[0], c[1]]; });

        var color = isImported ? "${FieldColors.glacierCyan}" : "${FieldColors.rescueOrange}";
        var weight = isSelected ? 5.5 : (isImported ? 4.0 : 3.5);
        var opacity = isSelected ? 1.0 : (selectedId ? 0.25 : 0.70);

        // Glow halo line if selected
        if (isSelected) {
          L.polyline(latLngs, {
            color: color,
            weight: 12,
            opacity: 0.40,
            lineCap: 'round'
          }).addTo(layersGroup);
        }

        // Active Polyline
        var polyline = L.polyline(latLngs, {
          color: color,
          weight: weight,
          opacity: opacity,
          lineCap: 'round'
        }).addTo(layersGroup);

        polyline.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_TRAIL', id: trail.id }));
        });

        // Trailhead Marker (Green Pill)
        var startCoord = latLngs[0];
        if (startCoord) {
          var startIcon = L.divIcon({
            className: 'custom-pill',
            html: '▲ ' + ((trail.name || 'Trail').split(' ')[0] || 'Start'),
            iconSize: null
          });
          var startMarker = L.marker(startCoord, {
            icon: startIcon,
            opacity: isSelected ? 1.0 : (selectedId ? 0.35 : 0.95)
          }).addTo(layersGroup);

          startMarker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_TRAIL', id: trail.id }));
          });
        }

        // Summit Marker (Orange Pill)
        var summitCoord = latLngs[latLngs.length - 1];
        if (summitCoord) {
          var altM = trail.maxAltM || trail.maxAltitudeM || (latLngs[latLngs.length - 1][2]) || 3000;
          var summitIcon = L.divIcon({
            className: 'summit-pill',
            html: '🏔 ' + Math.round(altM) + 'm',
            iconSize: null
          });
          var summitMarker = L.marker(summitCoord, {
            icon: summitIcon,
            opacity: isSelected ? 1.0 : (selectedId ? 0.35 : 0.95)
          }).addTo(layersGroup);

          summitMarker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_TRAIL', id: trail.id }));
          });
        }
      });

      // Render AI-Detected SOI Ridgeline Candidate Trails (Dashed Violet)
      (candidateTrails || []).forEach(function(cand) {
        if (!cand) return;
        var coords = cand.coordinates || (cand.points ? cand.points.map(function(p){ return [p.latitude, p.longitude]; }) : []);
        if (!coords || coords.length === 0) return;
        var latLngs = coords.map(function(c) { return [c[0], c[1]]; });
        var poly = L.polyline(latLngs, {
          color: "${FieldColors.soiRidgeViolet}",
          weight: 4.0,
          opacity: 0.85,
          dashArray: '8, 6'
        }).addTo(layersGroup);

        poly.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_SOI_CANDIDATE', id: cand.id }));
        });
      });
    }

    // Map tap deselects
    map.on('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DESELECT' }));
    });

    // Global APIs exposed for injectJavaScript (Zero Reloads)
    window.flyToRegion = function(boundsArray) {
      if (boundsArray && boundsArray.length > 0) {
        map.flyToBounds(boundsArray, { padding: [40, 40], maxZoom: 13, duration: 1.2 });
      }
    };

    window.selectTrailOnMap = function(trailId, coords) {
      selectedId = trailId || '';
      renderTrails();
      if (coords && coords.length > 0) {
        map.flyToBounds(coords, { padding: [50, 50], maxZoom: 14, duration: 1.0 });
      }
    };

    window.updateVisibleTrails = function(trailsArr, selId, candArr, shouldFitBounds) {
      trailsData = trailsArr || [];
      selectedId = selId || '';
      candidateTrails = candArr || [];
      renderTrails();

      if (shouldFitBounds && trailsData.length > 0) {
        var allCoords = [];
        trailsData.forEach(function(t) {
          if (t.routeCoords) {
            t.routeCoords.forEach(function(c) {
              allCoords.push([c[0], c[1]]);
            });
          }
        });
        if (allCoords.length > 0) {
          map.flyToBounds(allCoords, { padding: [40, 40], maxZoom: 13, duration: 1.2 });
        }
      }
    };

    // FEATURE 2: SOI Raster Image Overlay & Vector Extraction Engine
    window.overlaySoiSheet = function(imageDataUri, bounds, extractedFeatures, opacity) {
      if (window.soiImageLayer) {
        map.removeLayer(window.soiImageLayer);
        window.soiImageLayer = null;
      }

      // Add true georeferenced raster image overlay
      window.soiImageLayer = L.imageOverlay(imageDataUri, bounds, {
        opacity: opacity !== undefined ? opacity : 0.72,
        interactive: true
      }).addTo(map);

      // Clear existing sublayers
      window.soiTrailPolylines = {};
      window.soiFootpathsSublayer.clearLayers();
      window.soiWaterSublayer.clearLayers();
      window.soiCampsSublayer.clearLayers();
      window.soiPeaksSublayer.clearLayers();

      // 1. Extracted Footpaths / Candidate Treks (Dashed Violet/Magenta)
      (extractedFeatures.trails || []).forEach(function(t) {
        var latLngs = (t.coords || []).map(function(c) { return [c[0], c[1]]; });
        var poly = L.polyline(latLngs, {
          color: '#A855F7',
          weight: 4.5,
          opacity: 0.95,
          dashArray: '8, 6'
        }).bindPopup(
          '<div style=\"padding:4px;\">' +
          '<b style=\"color:#A855F7;\">🗺 SOI EXTRACTED TRAIL</b><br/>' +
          '<b style=\"font-size:12px;\">' + t.name + '</b><br/>' +
          'Confidence: <b style=\"color:#4ADE80;\">' + t.confidence + '%</b><br/>' +
          'Elev Gain: +' + t.gain + 'm | ' + t.waterCount + ' Water Crossings<br/>' +
          '<span style=\"color:#888;\">Distance: ' + (t.distanceKm || 0) + ' km</span>' +
          '</div>'
        );

        poly.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_SOI_FEATURE', id: t.id, trail: t }));
        });

        window.soiTrailPolylines[t.id] = poly;
        window.soiFootpathsSublayer.addLayer(poly);
      });

      // 2. Extracted Waterway Streams (Cyan Polyline)
      (extractedFeatures.waterways || []).forEach(function(w) {
        var latLngs = (w.coords || []).map(function(c) { return [c[0], c[1]]; });
        var poly = L.polyline(latLngs, {
          color: '#38BDF8',
          weight: 2.5,
          opacity: 0.85
        }).bindPopup(
          '<div style=\"padding:4px;\">' +
          '<b style=\"color:#38BDF8;\">💧 ' + (w.name || 'Stream / Waterway') + '</b>' +
          '</div>'
        );
        window.soiWaterSublayer.addLayer(poly);
      });

      // 3. Extracted Water Springs, Campsites & Spot Heights
      (extractedFeatures.pois || []).forEach(function(p) {
        var color = p.type === 'water' ? '#38BDF8' : p.type === 'camp' ? '#FACC15' : '#FF5500';
        var marker = L.circleMarker([p.lat, p.lon], {
          radius: 7,
          fillColor: color,
          color: '#0F1210',
          weight: 2,
          fillOpacity: 0.95
        }).bindPopup(
          '<div style=\"padding:4px;\">' +
          '<b style=\"color:' + color + ';\">● ' + p.type.toUpperCase() + ' POINT</b><br/>' +
          '<b>' + p.label + '</b><br/>' +
          'Elevation: ' + p.ele + 'm (SOI Sheet)' +
          '</div>'
        );

        if (p.type === 'water') {
          window.soiWaterSublayer.addLayer(marker);
        } else if (p.type === 'camp') {
          window.soiCampsSublayer.addLayer(marker);
        } else {
          window.soiPeaksSublayer.addLayer(marker);
        }
      });

      map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 13, duration: 1.2 });
    };

    window.focusSoiTrail = function(trailId, coords) {
      if (window.soiTrailPolylines) {
        Object.keys(window.soiTrailPolylines).forEach(function(id) {
          var p = window.soiTrailPolylines[id];
          if (p) {
            p.setStyle({ color: '#A855F7', weight: 4.5, opacity: 0.85, dashArray: '8, 6' });
          }
        });
        if (window.soiTrailPolylines[trailId]) {
          window.soiTrailPolylines[trailId].setStyle({
            color: '#FF5500',
            weight: 7.0,
            opacity: 1.0,
            dashArray: null
          });
          window.soiTrailPolylines[trailId].bringToFront();
        }
      }
      if (coords && coords.length > 0) {
        map.flyToBounds(coords, { padding: [50, 50], maxZoom: 14, duration: 1.0 });
      }
    };

    window.setSoiOverlayOpacity = function(val) {
      if (window.soiImageLayer) {
        window.soiImageLayer.setOpacity(val);
      }
    };

    window.toggleSoiLayer = function(layerType, isVisible) {
      if (layerType === 'raw' && window.soiImageLayer) {
        if (isVisible) {
          if (!map.hasLayer(window.soiImageLayer)) map.addLayer(window.soiImageLayer);
        } else {
          if (map.hasLayer(window.soiImageLayer)) map.removeLayer(window.soiImageLayer);
        }
      } else if (layerType === 'footpaths') {
        if (isVisible) {
          if (!window.soiExtractedLayer.hasLayer(window.soiFootpathsSublayer)) window.soiExtractedLayer.addLayer(window.soiFootpathsSublayer);
        } else {
          if (window.soiExtractedLayer.hasLayer(window.soiFootpathsSublayer)) window.soiExtractedLayer.removeLayer(window.soiFootpathsSublayer);
        }
      } else if (layerType === 'water') {
        if (isVisible) {
          if (!window.soiExtractedLayer.hasLayer(window.soiWaterSublayer)) window.soiExtractedLayer.addLayer(window.soiWaterSublayer);
        } else {
          if (window.soiExtractedLayer.hasLayer(window.soiWaterSublayer)) window.soiExtractedLayer.removeLayer(window.soiWaterSublayer);
        }
      } else if (layerType === 'camps') {
        if (isVisible) {
          if (!window.soiExtractedLayer.hasLayer(window.soiCampsSublayer)) window.soiExtractedLayer.addLayer(window.soiCampsSublayer);
        } else {
          if (window.soiExtractedLayer.hasLayer(window.soiCampsSublayer)) window.soiExtractedLayer.removeLayer(window.soiCampsSublayer);
        }
      }
    };

    window.removeSoiOverlay = function() {
      if (window.soiImageLayer) {
        map.removeLayer(window.soiImageLayer);
        window.soiImageLayer = null;
      }
      window.soiTrailPolylines = {};
      window.soiFootpathsSublayer.clearLayers();
      window.soiWaterSublayer.clearLayers();
      window.soiCampsSublayer.clearLayers();
      window.soiPeaksSublayer.clearLayers();
    };

    // Render Synced Squad Photos directly onto the map
    window.renderSquadPhotoPins = function(photosList) {
      window.squadPhotosLayer.clearLayers();
      (photosList || []).forEach(function(photo) {
        if (!photo.lat || !photo.lon) return;

        var iconHtml = '<div class=\"photo-pin\">📸 ' + (photo.name || 'Photo').split('.')[0].substring(0, 10) + '</div>';
        var pinIcon = L.divIcon({
          className: 'photo-icon-wrapper',
          html: iconHtml,
          iconSize: null
        });

        var marker = L.marker([photo.lat, photo.lon], { icon: pinIcon })
          .bindPopup(
            '<div style=\"padding:4px;\">' +
            '<b style=\"color:#38BDF8;\">📸 SQUAD PHOTO PIN</b><br/>' +
            '<b>' + photo.name + '</b><br/>' +
            'Sender: ' + photo.senderName + '<br/>' +
            'Altitude: ' + Math.round(photo.ele || 0) + 'm<br/>' +
            'SHA-256: ' + (photo.sha256 ? photo.sha256.substring(0, 12) + '...' : 'N/A') +
            '</div>'
          );

        window.squadPhotosLayer.addLayer(marker);
      });
    };

    // Notify React Native that Leaflet engine is mounted
    setTimeout(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
    }, 200);
  </script>
</body>
</html>
    `;
  }, []);

  // Helper to execute JavaScript safely inside WebView
  const runScript = (script: string) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`${script}; true;`);
    }
  };

  // Synchronize visible trails & candidates via injectJavaScript (NEVER reloads HTML)
  const syncTrailsToMap = (fitBounds = false) => {
    const payload = JSON.stringify(trails ?? []);
    const selId = selectedTrail?.id || '';
    const candPayload = JSON.stringify(soiCandidateTrails ?? []);
    runScript(`window.updateVisibleTrails(${payload}, '${selId}', ${candPayload}, ${fitBounds})`);
  };

  // On WebView load completion
  const handleLoadEnd = () => {
    isMapReadyRef.current = true;
    syncTrailsToMap(true);
    if (soiOverlayData) {
      applySoiOverlay(soiOverlayData, soiOpacity);
    }
    if (squadPhotos.length > 0) {
      syncSquadPhotos(squadPhotos);
    }
  };

  const applySoiOverlay = (data: SoiExtractionResult, opacity: number) => {
    const boundsJson = JSON.stringify(data.bounds);
    const featuresJson = JSON.stringify({
      trails: data.trails,
      pois: data.pois,
      waterways: data.waterways || [],
    });
    runScript(`window.overlaySoiSheet('${data.imageDataUri}', ${boundsJson}, ${featuresJson}, ${opacity})`);
  };

  useImperativeHandle(ref, () => ({
    focusSoiTrail: (trailId: string, coords: [number, number][]) => {
      runScript(`window.focusSoiTrail('${trailId}', ${JSON.stringify(coords)})`);
    },
    flyToRegion: (bounds: [number, number][]) => {
      runScript(`window.flyToRegion(${JSON.stringify(bounds)})`);
    },
  }));

  const syncSquadPhotos = (photos: SquadMediaRecord[]) => {
    const payload = JSON.stringify(photos);
    runScript(`window.renderSquadPhotoPins(${payload})`);
  };

  // Sync trails when dataset or candidates change
  useEffect(() => {
    if (isMapReadyRef.current) {
      syncTrailsToMap(false);
    }
  }, [trails, soiCandidateTrails]);

  // Handle SOI Overlay Data Changes
  useEffect(() => {
    if (!isMapReadyRef.current) return;
    if (soiOverlayData) {
      applySoiOverlay(soiOverlayData, soiOpacity);
    } else {
      runScript(`window.removeSoiOverlay()`);
    }
  }, [soiOverlayData]);

  // Handle Opacity Changes smoothly
  useEffect(() => {
    if (!isMapReadyRef.current) return;
    runScript(`window.setSoiOverlayOpacity(${soiOpacity})`);
  }, [soiOpacity]);

  // Handle Layer Visibility Toggles
  useEffect(() => {
    if (!isMapReadyRef.current || !layerVisibility) return;
    runScript(`window.toggleSoiLayer('raw', ${layerVisibility.raw})`);
    runScript(`window.toggleSoiLayer('footpaths', ${layerVisibility.footpaths})`);
    runScript(`window.toggleSoiLayer('water', ${layerVisibility.water})`);
    runScript(`window.toggleSoiLayer('camps', ${layerVisibility.camps})`);
  }, [layerVisibility]);

  // Handle Squad Photos
  useEffect(() => {
    if (!isMapReadyRef.current) return;
    syncSquadPhotos(squadPhotos);
  }, [squadPhotos]);

  // Handle Base Layer Switch (Topo, Satellite, Dark, OSM)
  useEffect(() => {
    if (!isMapReadyRef.current) return;
    runScript(`window.setBaseLayer('${baseLayer}')`);
  }, [baseLayer]);

  // Handle Trail Selection & Camera Lock (Smooth flyToBounds without resetting)
  useEffect(() => {
    if (!isMapReadyRef.current) return;

    if (selectedTrail && Array.isArray(selectedTrail.routeCoords) && selectedTrail.routeCoords.length > 0) {
      const coords = selectedTrail.routeCoords.map((c) => [c[0], c[1]]);
      runScript(`window.selectTrailOnMap('${selectedTrail.id}', ${JSON.stringify(coords)})`);
    } else {
      runScript(`window.selectTrailOnMap('', [])`);
    }
  }, [selectedTrail]);

  // Handle Regional Filter Camera Flight
  useEffect(() => {
    if (!regionFocus || !isMapReadyRef.current) return;

    const rf = regionFocus.toUpperCase();
    let bounds: [number, number][] = [];

    if (rf === 'HIMALAYAS') {
      bounds = [
        [27.0, 74.0],
        [35.5, 89.0],
      ];
    } else if (rf === 'WESTERN_GHATS' || rf === 'WESTERN GHATS') {
      bounds = [
        [12.66, 73.39],
        [19.63, 75.69],
      ];
    } else if (rf === 'NORTH_EAST' || rf === 'NORTH-EAST') {
      bounds = [
        [25.38, 91.73],
        [25.57, 94.12],
      ];
    } else if (rf === 'IMPORTED' || rf === 'USER IMPORTED') {
      const imported = (trails || []).filter((t) => t.isImported);
      const coords: [number, number][] = [];
      imported.forEach((t) => {
        (t.routeCoords || []).forEach((c) => coords.push([c[0], c[1]]));
      });
      if (coords.length > 0) {
        bounds = coords;
      } else {
        bounds = [
          [20.0, 72.0],
          [32.0, 85.0],
        ];
      }
    } else if (rf === 'ALL' || rf === 'ALL TRAILS') {
      const coords: [number, number][] = [];
      (trails || []).forEach((t) => {
        (t.routeCoords || []).forEach((c) => coords.push([c[0], c[1]]));
      });
      if (coords.length > 0) {
        bounds = coords;
      }
    }

    if (bounds.length > 0) {
      runScript(`window.flyToRegion(${JSON.stringify(bounds)})`);
    }
  }, [regionFocus]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        isMapReadyRef.current = true;
        syncTrailsToMap(true);
        if (soiOverlayData) {
          applySoiOverlay(soiOverlayData, soiOpacity);
        }
        if (squadPhotos.length > 0) {
          syncSquadPhotos(squadPhotos);
        }
      } else if (data.type === 'SELECT_TRAIL') {
        const found = (trails || []).find((t) => t.id === data.id);
        if (found) {
          onSelectTrail(found);
        }
      } else if (data.type === 'SELECT_SOI_FEATURE') {
        if (data.trail && onSelectSoiTrail) {
          onSelectSoiTrail(data.trail);
        }
      } else if (data.type === 'DESELECT') {
        onDeselect();
      }
    } catch (_) {}
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: initialMapHtml }}
        style={styles.webview}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FieldColors.basaltBackground,
  },
  webview: {
    flex: 1,
    backgroundColor: FieldColors.basaltBackground,
  },
});
