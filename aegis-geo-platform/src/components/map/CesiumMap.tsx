import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Viewer, Ion,
  UrlTemplateImageryProvider, WebMercatorTilingScheme,
  Cartesian3, Math as CesiumMath, Color, CallbackProperty,
  GeoJsonDataSource,
  Entity, PolygonHierarchy, ColorMaterialProperty,
  HeightReference, LabelStyle, VerticalOrigin, NearFarScalar,
  EllipsoidTerrainProvider, PolylineGlowMaterialProperty, JulianDate,
  StripeMaterialProperty, StripeOrientation,
  SampledPositionProperty, TimeIntervalCollection, TimeInterval,
  VelocityOrientationProperty, ClockRange, Cartographic,
  PostProcessStageLibrary
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { DisasterAlert } from '../../hooks/useDisasterAlerts';
import type { FireSimFrame } from '../../store/AegisContext';
import { generateMockCityBuildings } from '../../utils/geoUtils';

Ion.defaultAccessToken = '';

export interface CesiumMapHandle {
  viewer: Viewer | null;
  flyToAlert: (alert: DisasterAlert) => void;
  flyToLuzhou: (pitchDegree?: number) => void;
  addFloodPolygon: (coords: number[][], maxWaterLevel: number) => void;
  setFloodHeight: (height: number) => void;
  clearFloodPolygons: () => void;
  renderFireFrame: (frame: FireSimFrame | null) => void;
  clearFirePolygons: () => void;
  syncAlertEntities: (alerts: DisasterAlert[], activeLayers: Record<string, boolean>) => void;
}

const ALERT_COLORS: Record<string, Color> = {
  flood: Color.fromCssColorString('#3b82f6').withAlpha(0.8),
  fire: Color.fromCssColorString('#ef4444').withAlpha(0.8),
  landslide: Color.fromCssColorString('#f59e0b').withAlpha(0.8),
  chemical: Color.fromCssColorString('#a855f7').withAlpha(0.8),
};

const ALERT_GLOW_COLORS: Record<string, string> = {
  flood: '#3b82f6', fire: '#ef4444', landslide: '#f59e0b', chemical: '#a855f7',
};

interface CesiumMapProps {
  floodProgress?: number;
}

const CesiumMap = forwardRef<CesiumMapHandle, CesiumMapProps>(({ floodProgress = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const rainStageRef = useRef<any>(null);
  const floodEntitiesRef = useRef<Entity[]>([]);
  const focusAlertEntitiesRef = useRef<Entity[]>([]);
  const persistentAlertEntitiesRef = useRef<Entity[]>([]);
  const fireEntitiesRef = useRef<Entity[]>([]);
  const floodStateRef = useRef({ currentHeight: 0 });

  // ── Alert focus (fly-to with detailed visual) ──────────────

  const flyToAlert = useCallback((alert: DisasterAlert) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    focusAlertEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    focusAlertEntitiesRef.current = [];

    const cstr = ALERT_GLOW_COLORS[alert.type] || '#ef4444';

    const cylinder = viewer.entities.add({
      position: Cartesian3.fromDegrees(alert.lng, alert.lat, 0),
      cylinder: {
        length: 4000,
        topRadius: 1500,
        bottomRadius: 1500,
        material: new ColorMaterialProperty(Color.fromCssColorString(cstr).withAlpha(0.2)),
        outline: true,
        outlineColor: new ColorMaterialProperty(Color.fromCssColorString(cstr).withAlpha(0.8)) as any,
        outlineWidth: 4,
        heightReference: HeightReference.NONE,
      },
      label: {
        text: `[ ${alert.title} ]\n隔离半径 1500m`,
        font: 'bold 24px Helvetica',
        style: LabelStyle.FILL_AND_OUTLINE,
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString(cstr),
        outlineWidth: 3,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: { x: 0, y: -200 } as any,
        distanceDisplayCondition: { near: 0, far: 80000 } as any,
      },
    });

    const laser = viewer.entities.add({
      position: Cartesian3.fromDegrees(alert.lng, alert.lat, 0),
      polyline: {
        positions: [
          Cartesian3.fromDegrees(alert.lng, alert.lat, 0),
          Cartesian3.fromDegrees(alert.lng, alert.lat, 5000),
        ],
        width: 10,
        material: new PolylineGlowMaterialProperty({ glowPower: 0.5, color: Color.fromCssColorString(cstr) }),
      },
    });

    focusAlertEntitiesRef.current.push(cylinder, laser);

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(alert.lng, alert.lat - 0.05, 5000),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-25), roll: 0 },
      duration: 2,
    });
  }, []);

  // ── Persistent alert markers (auto-synced) ────────────────

  const syncAlertEntities = useCallback((alerts: DisasterAlert[], activeLayers: Record<string, boolean>) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    persistentAlertEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    persistentAlertEntitiesRef.current = [];

    const visible = alerts.filter(a => activeLayers[a.type] !== false);

    visible.forEach(alert => {
      const cstr = ALERT_GLOW_COLORS[alert.type] || '#ef4444';
      const isRed = alert.level === 'red';
      const radius = isRed ? 1200 : 800;

      const ring = viewer.entities.add({
        position: Cartesian3.fromDegrees(alert.lng, alert.lat, 0),
        ellipse: {
          semiMinorAxis: radius,
          semiMajorAxis: radius,
          material: new ColorMaterialProperty(Color.fromCssColorString(cstr).withAlpha(isRed ? 0.18 : 0.10)),
          outline: true,
          outlineColor: new ColorMaterialProperty(Color.fromCssColorString(cstr).withAlpha(0.6)) as any,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      });

      const dot = viewer.entities.add({
        position: Cartesian3.fromDegrees(alert.lng, alert.lat, 0),
        point: {
          pixelSize: isRed ? 12 : 8,
          color: Color.fromCssColorString(cstr),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          scaleByDistance: new NearFarScalar(5000, 1.0, 300000, 0.3),
        },
        label: {
          text: alert.title,
          font: `bold ${isRed ? 14 : 12}px "Noto Sans SC", sans-serif`,
          fillColor: Color.WHITE,
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Color.fromCssColorString(cstr).withAlpha(0.9),
          outlineWidth: 3,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: { x: 0, y: -16 } as any,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#020617').withAlpha(0.85),
          backgroundPadding: { x: 6, y: 4 } as any,
          scaleByDistance: new NearFarScalar(5000, 1.0, 200000, 0.0),
        },
      });

      persistentAlertEntitiesRef.current.push(ring, dot);
    });
  }, []);

  // ── Navigation ─────────────────────────────────────────────

  const flyToLuzhou = useCallback((pitchDegree: number = -45) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(105.44, 28.89, 80000),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(pitchDegree), roll: 0 },
      duration: 1.5,
    });
  }, []);

  // ── Flood simulation ───────────────────────────────────────

  const addFloodPolygon = useCallback((coords: number[][], maxWaterLevel: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    floodStateRef.current.currentHeight = 0;
    const positions = coords.map(c => Cartesian3.fromDegrees(c[0], c[1], 0));
    const entity = viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: new ColorMaterialProperty(Color.fromCssColorString('#0ea5e9').withAlpha(0.45)),
        height: new CallbackProperty(() => Math.min(floodStateRef.current.currentHeight, maxWaterLevel), false) as any,
        heightReference: HeightReference.NONE,
      },
    });
    floodEntitiesRef.current.push(entity);
  }, []);

  const setFloodHeight = useCallback((height: number) => {
    floodStateRef.current.currentHeight = height;
  }, []);

  const clearFloodPolygons = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    floodEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    floodEntitiesRef.current = [];
    floodStateRef.current.currentHeight = 0;
  }, []);

  // ── Fire simulation ────────────────────────────────────────

  const renderFireFrame = useCallback((frame: FireSimFrame | null) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    fireEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    fireEntitiesRef.current = [];

    if (!frame || frame.polygon.length < 3) return;

    const positions = frame.polygon.map(c => Cartesian3.fromDegrees(c[0], c[1], 0));

    const fill = viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: new ColorMaterialProperty(Color.fromCssColorString('#ef4444').withAlpha(0.35)),
        height: 0,
        extrudedHeight: 200,
        heightReference: HeightReference.NONE,
      },
    });

    const border = viewer.entities.add({
      polyline: {
        positions: [...positions, positions[0]],
        width: 6,
        material: new PolylineGlowMaterialProperty({ glowPower: 0.4, color: Color.fromCssColorString('#f97316') }),
        clampToGround: true,
      },
    });

    const center = frame.polygon.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
    center[0] /= frame.polygon.length;
    center[1] /= frame.polygon.length;

    const label = viewer.entities.add({
      position: Cartesian3.fromDegrees(center[0], center[1], 500),
      label: {
        text: `${frame.timeLabel} | ${frame.areaKm2} km²`,
        font: 'bold 16px monospace',
        fillColor: Color.WHITE,
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Color.fromCssColorString('#ef4444'),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#7f1d1d').withAlpha(0.9),
        backgroundPadding: { x: 8, y: 5 } as any,
      } as any,
    });

    fireEntitiesRef.current.push(fill, border, label);
  }, []);

  const clearFirePolygons = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    fireEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    fireEntitiesRef.current = [];
  }, []);

  // ── Expose handle ──────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    viewer: viewerRef.current,
    flyToAlert,
    flyToLuzhou,
    addFloodPolygon,
    setFloodHeight,
    clearFloodPolygons,
    renderFireFrame,
    clearFirePolygons,
    syncAlertEntities,
  }));

  // ── Init Viewer ────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const tk = import.meta.env.VITE_TIANDITU_TOKEN;
    const subdomains = ['t0','t1','t2','t3','t4','t5','t6','t7'];

    const tiandituImg = new UrlTemplateImageryProvider({
      url: `http://{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
      subdomains, maximumLevel: 18, tilingScheme: new WebMercatorTilingScheme(),
    });

    const viewer = new Viewer(containerRef.current, {
      terrainProvider: new EllipsoidTerrainProvider(),
      baseLayerPicker: false, timeline: false, animation: false,
      fullscreenButton: false, geocoder: false, homeButton: false,
      infoBox: false, sceneModePicker: false, selectionIndicator: false,
      navigationHelpButton: false, navigationInstructionsInitiallyVisible: false,
      baseLayer: false, requestRenderMode: true, maximumRenderTimeChange: 0.0,
    });

    viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    viewer.imageryLayers.addImageryProvider(tiandituImg);
    viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
      url: `http://{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${tk}`,
      subdomains, maximumLevel: 18, tilingScheme: new WebMercatorTilingScheme(),
    }));

    // Scene atmosphere
    viewer.scene.globe.enableLighting = false;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0005;
    viewer.scene.fog.screenSpaceErrorFactor = 2.0;
    viewer.scene.globe.baseColor = Color.fromCssColorString('#0f172a');
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = -0.7;
      viewer.scene.skyAtmosphere.hueShift = 0.5;
      viewer.scene.skyAtmosphere.saturationShift = -0.3;
    }
    viewer.scene.backgroundColor = Color.fromCssColorString('#020617');

    const bloom = viewer.scene.postProcessStages.bloom;
    bloom.enabled = true;
    bloom.uniforms.contrast = 135;
    bloom.uniforms.brightness = -0.3;
    bloom.uniforms.delta = 0.9;
    bloom.uniforms.sigma = 2.5;

    // Mock 3D buildings
    generateMockCityBuildings(105.44, 28.89, 5).forEach(b => {
      const positions = b.polygon.map(c => Cartesian3.fromDegrees(c[0], c[1], 0));
      viewer.entities.add({
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          material: new ColorMaterialProperty(Color.fromCssColorString('#0ea5e9').withAlpha(0.15)),
          extrudedHeight: b.height, height: 0, outline: true,
          outlineColor: new ColorMaterialProperty(Color.fromCssColorString('#38bdf8').withAlpha(0.8)) as any,
        },
      });
    });

    // Luzhou admin boundaries
    GeoJsonDataSource.load('https://geo.datav.aliyun.com/areas_v3/bound/510500_full.json', {
      stroke: Color.TRANSPARENT,
      fill: Color.fromCssColorString('#0284c7').withAlpha(0.08),
      strokeWidth: 0,
    }).then(dataSource => {
      if (viewer.isDestroyed()) return;
      viewer.dataSources.add(dataSource);
      for (const entity of dataSource.entities.values) {
        if (entity.polygon) {
          const hierarchy = entity.polygon.hierarchy?.getValue(JulianDate.now());
          if (hierarchy?.positions) {
            entity.polyline = {
              positions: hierarchy.positions, width: 4,
              material: new PolylineGlowMaterialProperty({ glowPower: 0.15, color: Color.fromCssColorString('#38bdf8') }),
              clampToGround: true,
            } as any;
          }
        }
        if (entity.name) {
          entity.label = {
            text: entity.name,
            font: 'bold 20px "Noto Sans SC", sans-serif',
            fillColor: Color.fromCssColorString('#f0f9ff'),
            style: LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Color.fromCssColorString('#0284c7').withAlpha(0.9),
            outlineWidth: 5,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new NearFarScalar(10000, 1.2, 500000, 0.0),
          } as any;
        }
      }
    }).catch(console.error);

    // Initial fly-to
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(105.44, 28.89, 80000),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-45), roll: 0 },
      duration: 3,
    });

    // Idle orbit
    let lastInteractionTime = Date.now();
    const handleInteraction = () => { lastInteractionTime = Date.now(); };
    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);

    viewer.clock.onTick.addEventListener(() => {
      if (Date.now() - lastInteractionTime > 15000) {
        const h = viewer.camera.positionCartographic.height;
        if (h > 15000 && h < 500000) viewer.camera.rotate(Cartesian3.UNIT_Z, 0.001);
      }
    });

    // Heatmap spots
    for (let i = 0; i < 35; i++) {
      const lat = 28.0 + Math.random() * 1.5;
      const lng = 105.0 + Math.random() * 1.0;
      const w = Math.random();
      const colorStr = w > 0.8 ? '#ef4444' : w > 0.4 ? '#f59e0b' : '#0ea5e9';
      viewer.entities.add({
        position: Cartesian3.fromDegrees(lng, lat, 0),
        ellipse: {
          semiMinorAxis: 2500 + w * 6000, semiMajorAxis: 2500 + w * 6000,
          material: new ColorMaterialProperty(Color.fromCssColorString(colorStr).withAlpha(w * 0.2)),
          height: 0, heightReference: HeightReference.NONE,
        },
      });
    }

    // Radar sweep
    viewer.entities.add({
      position: Cartesian3.fromDegrees(105.44, 28.89, 0),
      ellipse: {
        semiMinorAxis: 20000, semiMajorAxis: 20000,
        material: new StripeMaterialProperty({
          evenColor: Color.fromCssColorString('#0284c7').withAlpha(0.15),
          oddColor: Color.TRANSPARENT, repeat: 12, orientation: StripeOrientation.VERTICAL, offset: 0,
        }),
        stRotation: new CallbackProperty(() => -Date.now() / 2000.0, false) as any,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        outline: true,
        outlineColor: new ColorMaterialProperty(Color.fromCssColorString('#38bdf8').withAlpha(0.5)) as any,
      },
    });

    // POIs
    const REAL_POIS = [
      { name: "泸州云龙机场", lng: 105.474, lat: 29.033 },
      { name: "西南医科大学附院", lng: 105.4468, lat: 28.8797 },
      { name: "国窖广场(1573)", lng: 105.4535, lat: 28.8847 },
      { name: "泸州港国际集装箱码头", lng: 105.410, lat: 28.880 },
    ];

    REAL_POIS.forEach(poi => {
      viewer.entities.add({
        position: Cartesian3.fromDegrees(poi.lng, poi.lat, 0),
        point: { pixelSize: 10, color: Color.CYAN, outlineColor: Color.fromCssColorString('#0284c7'), outlineWidth: 2, scaleByDistance: new NearFarScalar(1000, 1.2, 500000, 0.4) },
        label: {
          text: `✦ ${poi.name}`, font: 'bold 16px "Noto Sans SC", "Courier New", monospace',
          fillColor: Color.WHITE, style: LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Color.fromCssColorString('#0284c7').withAlpha(0.9), outlineWidth: 4,
          verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: { x: 0, y: -18 } as any,
          showBackground: true, backgroundColor: Color.fromCssColorString('#020617').withAlpha(0.85),
          backgroundPadding: { x: 8, y: 5 } as any,
        },
      });
      viewer.entities.add({
        position: Cartesian3.fromDegrees(poi.lng, poi.lat, 0),
        ellipse: {
          semiMinorAxis: 300, semiMajorAxis: 300,
          material: new ColorMaterialProperty(Color.fromCssColorString('#22d3ee').withAlpha(0.4)),
          outline: true, outlineColor: new ColorMaterialProperty(Color.fromCssColorString('#06b6d4').withAlpha(0.8)) as any,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      });
    });

    // UAV patrol
    viewer.clock.shouldAnimate = true;
    const start = JulianDate.fromDate(new Date());
    const stop = JulianDate.addSeconds(start, 240, new JulianDate());
    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 1.0;

    const positionProperty = new SampledPositionProperty();
    const flightLegs = 60;
    [
      { lng: 105.474, lat: 29.033, alt: 3500 },
      { lng: 105.4468, lat: 28.8797, alt: 3500 },
      { lng: 105.410, lat: 28.880, alt: 3500 },
      { lng: 105.4535, lat: 28.8847, alt: 3500 },
      { lng: 105.474, lat: 29.033, alt: 3500 },
    ].forEach((wp, idx) => {
      positionProperty.addSample(JulianDate.addSeconds(start, idx * flightLegs, new JulianDate()), Cartesian3.fromDegrees(wp.lng, wp.lat, wp.alt));
    });

    viewer.entities.add({
      availability: new TimeIntervalCollection([new TimeInterval({ start, stop })]),
      position: positionProperty, orientation: new VelocityOrientationProperty(positionProperty),
      point: { pixelSize: 12, color: Color.GREENYELLOW, outlineColor: Color.WHITE, outlineWidth: 3 },
      label: {
        text: '⚠ [无人机编队-侦查一型]', font: 'bold 12px monospace',
        style: LabelStyle.FILL_AND_OUTLINE, fillColor: Color.GREENYELLOW,
        outlineColor: Color.BLACK, outlineWidth: 2,
        pixelOffset: { x: 0, y: -20 } as any, showBackground: true,
        backgroundColor: Color.fromCssColorString('#022c22').withAlpha(0.7),
      },
      path: {
        resolution: 1, material: new PolylineGlowMaterialProperty({ glowPower: 0.3, color: Color.fromCssColorString('#10b981') }),
        width: 8, leadTime: 0, trailTime: 120,
      },
    });

    viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(() => {
          const pos = positionProperty.getValue(viewer.clock.currentTime);
          if (!pos) return [];
          const carto = Cartographic.fromCartesian(pos);
          return [pos, Cartesian3.fromRadians(carto.longitude, carto.latitude, 0)];
        }, false) as any,
        width: 15,
        material: new PolylineGlowMaterialProperty({ glowPower: 0.6, taperPower: 0.7, color: Color.GREENYELLOW }),
      },
    });

    // Geo-fence
    const fencePositions = Cartesian3.fromDegreesArray([105.35,29.10,105.60,29.10,105.65,28.85,105.50,28.75,105.35,28.85,105.35,29.10]);
    viewer.entities.add({
      name: 'Digital Security Perimeter',
      wall: {
        positions: fencePositions,
        maximumHeights: [3000,3000,3000,3000,3000,3000],
        minimumHeights: [0,0,0,0,0,0],
        material: new StripeMaterialProperty({
          evenColor: Color.fromCssColorString('#3b82f6').withAlpha(0.15),
          oddColor: Color.TRANSPARENT, repeat: 50, orientation: StripeOrientation.VERTICAL,
          offset: new CallbackProperty(() => -(Date.now() % 100000) / 2000.0, false) as any,
        }),
        outline: true, outlineColor: Color.fromCssColorString('#60a5fa').withAlpha(0.7),
      },
    });

    // Rain post-process
    try {
      const pLib = PostProcessStageLibrary as any;
      if (pLib?.createRainStage) {
        const rainStage = pLib.createRainStage();
        rainStage.name = "AegisRainPostProcess";
        rainStage.uniforms.density = 0.0;
        rainStage.uniforms.angle = -0.3;
        rainStage.uniforms.speed = 12.0;
        viewer.scene.postProcessStages.add(rainStage);
        rainStageRef.current = rainStage;
      }
    } catch (err) {
      console.warn("Rain stage not supported", err);
    }

    viewerRef.current = viewer;

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null; }
    };
  }, []);

  // ── 4D timeline sync ───────────────────────────────────────

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const stage = rainStageRef.current;
    if (stage) {
      if (floodProgress < 30) {
        stage.uniforms.density = 0.0;
      } else {
        stage.uniforms.density = Math.min(((floodProgress - 30) / 70) * 1.5, 1.5);
        stage.uniforms.speed = 8.0 + ((floodProgress - 30) / 70) * 8.0;
      }
    }

    const rootEl = document.getElementById("root");
    if (rootEl) {
      if (floodProgress > 75) {
        rootEl.style.boxShadow = `inset 0 0 ${Math.sin(Date.now() / 200) * 50 + 50}px rgba(220,38,38,${Math.min((floodProgress - 75) / 25 * 0.4, 0.4)})`;
      } else {
        rootEl.style.boxShadow = "none";
      }
    }
  }, [floodProgress]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
});

CesiumMap.displayName = 'CesiumMap';
export default CesiumMap;
