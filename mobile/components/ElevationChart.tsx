import React, { useState } from 'react';
import { StyleSheet, View, Text, PanResponder } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { FieldColors, FieldTypography } from '../constants/FieldTokens';

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  heartRate?: number;
}

export interface ElevationChartProps {
  points?: ElevationPoint[];
  routeCoords?: [number, number, number][];
  onScrubAltitude?: (alt: number) => void;
  height?: number;
}

export const ElevationChart: React.FC<ElevationChartProps> = ({
  points,
  routeCoords,
  onScrubAltitude,
  height = 180,
}) => {
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(300);

  // Derive points from routeCoords if points array not directly provided
  const derivedPoints: ElevationPoint[] = React.useMemo(() => {
    if (Array.isArray(points) && points.length > 0) {
      return points;
    }
    if (Array.isArray(routeCoords) && routeCoords.length > 0) {
      let cumulativeKm = 0;
      return routeCoords.map((coord, idx) => {
        if (idx > 0) {
          const prev = routeCoords[idx - 1];
          // Approximate haversine distance
          const dLat = (coord[0] - prev[0]) * 111.0;
          const dLon = (coord[1] - prev[1]) * 111.0 * Math.cos((coord[0] * Math.PI) / 180);
          cumulativeKm += Math.sqrt(dLat * dLat + dLon * dLon);
        }
        return {
          distanceKm: cumulativeKm,
          elevationM: coord[2] ?? 2000,
        };
      });
    }
    return [];
  }, [points, routeCoords]);

  if (!derivedPoints || derivedPoints.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>NO ELEVATION PROFILE AVAILABLE</Text>
      </View>
    );
  }

  const elevations = derivedPoints.map((p) => p.elevationM ?? 0);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const eleRange = Math.max(1, maxEle - minEle);

  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 25;
  const graphW = Math.max(10, chartWidth - paddingLeft - paddingRight);
  const graphH = Math.max(10, height - paddingTop - paddingBottom);

  // Compute SVG Path points
  const svgCoords = derivedPoints.map((p, idx) => {
    const x = paddingLeft + (idx / Math.max(1, derivedPoints.length - 1)) * graphW;
    const y = paddingTop + graphH - (((p.elevationM ?? 0) - minEle) / eleRange) * graphH;
    return { x, y, point: p };
  });

  const pathD = svgCoords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${paddingLeft + graphW} ${paddingTop + graphH} L ${paddingLeft} ${paddingTop + graphH} Z`;

  // Pan Responder for touch scrubbing
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => handleTouch(evt.nativeEvent.locationX),
    onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.locationX),
    onPanResponderRelease: () => setScrubIndex(null),
  });

  const handleTouch = (touchX: number) => {
    const ratio = Math.max(0, Math.min(1, (touchX - paddingLeft) / graphW));
    const targetIdx = Math.round(ratio * (derivedPoints.length - 1));
    setScrubIndex(targetIdx);
    if (onScrubAltitude && derivedPoints[targetIdx]) {
      onScrubAltitude(derivedPoints[targetIdx].elevationM);
    }
  };

  const activeCoord = scrubIndex !== null && svgCoords[scrubIndex]
    ? svgCoords[scrubIndex]
    : svgCoords[svgCoords.length - 1];

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      {/* Top Telemetry Overlay */}
      {activeCoord && activeCoord.point && (
        <View style={styles.telemetryRow}>
          <View>
            <Text style={styles.telemetryLabel}>TELEMETRY</Text>
            <Text style={styles.telemetryValue}>
              {(activeCoord.point.distanceKm ?? 0).toFixed(1)} KM • {Math.round(activeCoord.point.elevationM ?? 0)} M
            </Text>
          </View>
          {activeCoord.point.heartRate ? (
            <View style={styles.hrBadge}>
              <Text style={styles.hrText}>♥ {activeCoord.point.heartRate} BPM</Text>
            </View>
          ) : null}
        </View>
      )}

      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FieldColors.rescueOrange} stopOpacity="0.45" />
            <Stop offset="1" stopColor={FieldColors.contourOchre} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Base Grid Line */}
        <Line
          x1={paddingLeft}
          y1={paddingTop + graphH}
          x2={paddingLeft + graphW}
          y2={paddingTop + graphH}
          stroke={FieldColors.pineSurfaceBorder}
          strokeWidth="1.5"
        />

        {/* Gradient Relief Area */}
        <Path d={areaD} fill="url(#eleGrad)" />

        {/* Spline Polyline */}
        <Path d={pathD} fill="none" stroke={FieldColors.rescueOrange} strokeWidth="2.5" strokeLinecap="round" />

        {/* Active Scrub Pin Line */}
        {activeCoord && (
          <>
            <Line
              x1={activeCoord.x}
              y1={paddingTop}
              x2={activeCoord.x}
              y2={paddingTop + graphH}
              stroke={FieldColors.glacierCyan}
              strokeWidth="1.5"
              strokeDasharray="4, 3"
            />
            <Circle cx={activeCoord.x} cy={activeCoord.y} r="5" fill={FieldColors.glacierCyan} stroke="#FFFFFF" strokeWidth="2" />
          </>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: FieldColors.pineSurface,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: FieldColors.pineSurfaceBorder,
    overflow: 'hidden',
    paddingTop: 8,
  },
  emptyText: {
    color: '#888',
    fontFamily: FieldTypography.monospace,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 60,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  telemetryLabel: {
    fontFamily: FieldTypography.monospace,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
  telemetryValue: {
    fontFamily: FieldTypography.monospace,
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hrBadge: {
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: FieldColors.rescueOrange,
  },
  hrText: {
    fontFamily: FieldTypography.monospace,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.rescueOrange,
  },
});
