import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { TrailModel } from '../constants/SeededTrails';
import { FieldColors } from '../constants/FieldTokens';
import { SoiCandidateTrail } from '../services/SoiAnalysisService';

interface TopoMapViewProps {
  trails: TrailModel[];
  selectedTrail?: TrailModel | null;
  soiCandidateTrails?: SoiCandidateTrail[];
  onSelectTrail: (trail: TrailModel) => void;
  onDeselect: () => void;
  regionFocus?: string;
}

export const TopoMapView: React.FC<TopoMapViewProps> = ({
  trails,
  selectedTrail,
  soiCandidateTrails = [],
  onSelectTrail,
  onDeselect,
  regionFocus,
}) => {
  const webViewRef = useRef<WebView>(null);
  const isMapReadyRef = useRef<boolean>(false);

  // CRITICAL FIX: Memoize HTML with EMPTY dependencies [] so WebView NEVER unmounts or reloads!
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
    .leaflet-control-attribution { background: rgba(15,18,16,0.8) !important; color: #888 !important; font-size: 8px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map centered broadly on India (NOT locked to Kedarkantha)
    var map = L.map('map', { zoomControl: false }).setView([22.5, 79.5], 5);

    // OpenTopoMap high-contrast contour tile layer
    L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap'
    }).addTo(map);

    var trailsData = [];
    var selectedId = '';
    var candidateTrails = [];
    var layersGroup = L.featureGroup().addTo(map);

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
  };

  // Sync trails when dataset or candidates change
  useEffect(() => {
    if (isMapReadyRef.current) {
      syncTrailsToMap(false);
    }
  }, [trails, soiCandidateTrails]);

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

  // Handle Regional Filter Camera Flight (Flies directly to target region bounds)
  useEffect(() => {
    if (!regionFocus || !isMapReadyRef.current) return;

    const rf = regionFocus.toUpperCase();
    let bounds: [number, number][] = [];

    if (rf === 'HIMALAYAS') {
      // Uttarakhand, Himachal, J&K, Ladakh, Sikkim
      bounds = [
        [27.0, 74.0],
        [35.5, 89.0],
      ];
    } else if (rf === 'WESTERN_GHATS' || rf === 'WESTERN GHATS') {
      // Maharashtra & Karnataka
      bounds = [
        [12.66, 73.39],
        [19.63, 75.69],
      ];
    } else if (rf === 'NORTH_EAST' || rf === 'NORTH-EAST') {
      // Meghalaya & Nagaland
      bounds = [
        [25.38, 91.73],
        [25.57, 94.12],
      ];
    } else if (rf === 'IMPORTED' || rf === 'USER IMPORTED') {
      // User imported tracks bounding box
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
      } else if (data.type === 'SELECT_TRAIL') {
        const found = (trails || []).find((t) => t.id === data.id);
        if (found) {
          onSelectTrail(found);
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
};

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
