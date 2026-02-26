import { useApp } from '@/contexts/AppContext';
import { Network as NetworkIcon, Circle } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  PanResponder,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Line, Text as SvgText, G, Path, Polygon } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Sector, ContactDossier, FunctionalCircle } from '@/types';

const { width, height } = Dimensions.get('window');
const MAP_SIZE = Math.min(width, height * 0.67);

export default function NetworkScreen() {
  const { dossiers, sectors, theme, powerGroupings, t, currentTheme } = useApp();
  const router = useRouter();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [filterSectors, setFilterSectors] = useState<Sector[]>([]);
  const [filterCircle, setFilterCircle] = useState<string | null>(null);
  const [filterPowerGroupings, setFilterPowerGroupings] = useState<string[]>([]);

  const [isFullscreenMap, setIsFullscreenMap] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);

  const animatedScale = useRef<Animated.Value>(new Animated.Value(1)).current;
  const animatedOffsetX = useRef<Animated.Value>(new Animated.Value(0)).current;
  const animatedOffsetY = useRef<Animated.Value>(new Animated.Value(0)).current;

  const panStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const mapBaseSize = isFullscreenMap ? Math.min(winWidth, winHeight) : MAP_SIZE;
  const canvasWidth = isFullscreenMap ? winWidth : MAP_SIZE;
  const canvasHeight = isFullscreenMap ? winHeight : MAP_SIZE;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  const scaleRef = useRef(1);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const lastDistance = useRef<number | null>(null);
  const isPinching = useRef(false);
  const isFullscreenRef = useRef<boolean>(false);
  const mapContainerRef = useRef<any>(null);

  const styles = createStyles(theme);

  useEffect(() => {
    isFullscreenRef.current = isFullscreenMap;
  }, [isFullscreenMap]);

  // Wheel zoom для веб-версии (mouse scroll)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = mapContainerRef.current;
    if (!el) return;
    const node = el as unknown as HTMLElement;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scaleRef.current * delta, 1), 4);
      scaleRef.current = newScale;
      animatedScale.setValue(newScale);
      if (newScale <= 1) {
        scaleRef.current = 1;
        offsetXRef.current = 0;
        offsetYRef.current = 0;
        animatedScale.setValue(1);
        animatedOffsetX.setValue(0);
        animatedOffsetY.setValue(0);
      }
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [animatedScale, animatedOffsetX, animatedOffsetY]);

  const circles = ['support', 'productivity', 'development'];

  const filteredDossiers = useMemo(() => {
    return dossiers.filter((d) => {
      if (filterSectors.length > 0 && !filterSectors.some(s => d.sectors.includes(s))) return false;
      if (filterCircle && d.functionalCircle !== filterCircle) return false;
      if (filterPowerGroupings.length > 0) {
        if (!d.powerGrouping?.groupName || !filterPowerGroupings.includes(d.powerGrouping.groupName)) return false;
      }
      return true;
    });
  }, [dossiers, filterSectors, filterCircle, filterPowerGroupings]);

  const sectorData = useMemo(() => {
    const sectorCounts = new Map<string, number>();
    sectors.forEach(sector => sectorCounts.set(sector, 0));

    filteredDossiers.forEach(d => {
      d.sectors.forEach(sector => {
        if (sectorCounts.has(sector)) {
          sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);
        }
      });
    });

    const totalContacts = Array.from(sectorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    let currentAngle = -Math.PI / 2;
    const sectorAngles: { sector: string; startAngle: number; endAngle: number; count: number }[] = [];

    sectors.forEach(sector => {
      const count = sectorCounts.get(sector) || 0;
      const angleSize = totalContacts > 0 ? (count / totalContacts) * 2 * Math.PI : (2 * Math.PI) / sectors.length;
      
      sectorAngles.push({
        sector,
        startAngle: currentAngle,
        endAngle: currentAngle + angleSize,
        count,
      });
      
      currentAngle += angleSize;
    });

    return { sectorAngles, sectorCounts };
  }, [filteredDossiers, sectors]);

  const ringData = useMemo(() => {
    const circleNames: FunctionalCircle[] = ['support', 'productivity', 'development'];
    const ringRadii = {
      support: { inner: mapBaseSize * 0.05, outer: mapBaseSize * 0.15 },
      productivity: { inner: mapBaseSize * 0.15, outer: mapBaseSize * 0.25 },
      development: { inner: mapBaseSize * 0.25, outer: mapBaseSize * 0.35 },
    };

    return circleNames.map((circle) => {
      const sectorCircleCounts = new Map<string, number>();
      sectors.forEach((sector) => sectorCircleCounts.set(sector, 0));

      filteredDossiers.forEach((d) => {
        if (d.functionalCircle === circle) {
          d.sectors.forEach((sector) => {
            if (sectorCircleCounts.has(sector)) {
              sectorCircleCounts.set(sector, (sectorCircleCounts.get(sector) || 0) + 1);
            }
          });
        }
      });

      const totalInCircle = Array.from(sectorCircleCounts.values()).reduce((sum, count) => sum + count, 0);
      let currentAngle = -Math.PI / 2;
      const segments: { sector: string; startAngle: number; endAngle: number; count: number }[] = [];

      sectors.forEach((sector) => {
        const count = sectorCircleCounts.get(sector) || 0;
        const angleSize = totalInCircle > 0 ? (count / totalInCircle) * 2 * Math.PI : (2 * Math.PI) / sectors.length;

        segments.push({
          sector,
          startAngle: currentAngle,
          endAngle: currentAngle + angleSize,
          count,
        });

        currentAngle += angleSize;
      });

      return {
        circle,
        innerRadius: ringRadii[circle].inner,
        outerRadius: ringRadii[circle].outer,
        segments,
        sectorCircleCounts,
      };
    });
  }, [filteredDossiers, mapBaseSize, sectors]);

  const positions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    
    const circleRanges = {
      development: { inner: mapBaseSize * 0.25, outer: mapBaseSize * 0.35 },
      productivity: { inner: mapBaseSize * 0.15, outer: mapBaseSize * 0.25 },
      support: { inner: mapBaseSize * 0.05, outer: mapBaseSize * 0.15 },
    };

    const contactsInSectors = new Map<string, ContactDossier[]>();
    sectors.forEach(sector => contactsInSectors.set(sector, []));

    filteredDossiers.forEach(d => {
      d.sectors.forEach(sector => {
        if (contactsInSectors.has(sector)) {
          contactsInSectors.get(sector)!.push(d);
        }
      });
    });

    const contactsByCircle = new Map<FunctionalCircle, ContactDossier[]>();
    filteredDossiers.forEach(d => {
      if (!contactsByCircle.has(d.functionalCircle)) {
        contactsByCircle.set(d.functionalCircle, []);
      }
      contactsByCircle.get(d.functionalCircle)!.push(d);
    });

    const maxDiaryCountByCircle = new Map<FunctionalCircle, number>();
    contactsByCircle.forEach((contacts, circle) => {
      const maxCount = Math.max(...contacts.map(d => d.diary.length), 1);
      maxDiaryCountByCircle.set(circle, maxCount);
    });

    sectorData.sectorAngles.forEach(({ sector, startAngle, endAngle }) => {
      const contactsInSector = contactsInSectors.get(sector) || [];
      
      contactsInSector.forEach((contact, index) => {
        if (posMap.has(contact.contact.id)) return;

        const range = circleRanges[contact.functionalCircle as keyof typeof circleRanges];
        const diaryCount = contact.diary.length;
        const maxDiaryCount = maxDiaryCountByCircle.get(contact.functionalCircle) || 1;
        
        const normalizedDiary = diaryCount / maxDiaryCount;
        const radius = range.outer - (normalizedDiary * (range.outer - range.inner));
        
        const angleRange = endAngle - startAngle;
        const angle = startAngle + (angleRange * (index + 0.5)) / Math.max(1, contactsInSector.length);
        
        posMap.set(contact.contact.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });
    });

    return posMap;
  }, [centerX, centerY, filteredDossiers, mapBaseSize, sectorData, sectors]);

  const connections = useMemo(() => {
    const conns: {
      from: { x: number; y: number };
      to: { x: number; y: number };
      strength: number;
    }[] = [];

    filteredDossiers.forEach((dossier) => {
      const fromPos = positions.get(dossier.contact.id);
      if (!fromPos) return;

      dossier.relations.forEach((relation) => {
        const toPos = positions.get(relation.contactId);
        if (toPos) {
          conns.push({
            from: fromPos,
            to: toPos,
            strength: relation.strength,
          });
        }
      });
    });

    return conns;
  }, [filteredDossiers, positions]);

  const powerConnections = useMemo(() => {
    const powerConns: {
      from: { x: number; y: number };
      to: { x: number; y: number };
    }[] = [];

    filteredDossiers.forEach((dossier) => {
      if (dossier.powerGrouping?.suzerainId) {
        const fromPos = positions.get(dossier.contact.id);
        const toPos = positions.get(dossier.powerGrouping.suzerainId);
        if (fromPos && toPos) {
          powerConns.push({
            from: fromPos,
            to: toPos,
          });
        }
      }
    });

    return powerConns;
  }, [filteredDossiers, positions]);

  const getDistance = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const [touch1, touch2] = touches;
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const animateTransformTo = useCallback(
    (next: { scale?: number; x?: number; y?: number }, opts?: { immediate?: boolean }) => {
      const immediate = opts?.immediate ?? false;

      if (typeof next.scale === 'number') {
        if (immediate) {
          animatedScale.setValue(next.scale);
        } else {
          Animated.timing(animatedScale, {
            toValue: next.scale,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
        }
      }

      if (typeof next.x === 'number') {
        if (immediate) {
          animatedOffsetX.setValue(next.x);
        } else {
          Animated.timing(animatedOffsetX, {
            toValue: next.x,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
        }
      }

      if (typeof next.y === 'number') {
        if (immediate) {
          animatedOffsetY.setValue(next.y);
        } else {
          Animated.timing(animatedOffsetY, {
            toValue: next.y,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
        }
      }
    },
    [animatedOffsetX, animatedOffsetY, animatedScale],
  );

  const resetMapTransform = useCallback(() => {
    console.log('[NetworkMap] resetMapTransform');
    scaleRef.current = 1;
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    panStartOffset.current = { x: 0, y: 0 };
    lastDistance.current = null;
    isPinching.current = false;
    isFullscreenRef.current = false;
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setIsFullscreenMap(false);
    animateTransformTo({ scale: 1, x: 0, y: 0 });
  }, [animateTransformTo, panStartOffset]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          isPinching.current = true;
          lastDistance.current = getDistance(evt.nativeEvent.touches);
        } else {
          isPinching.current = false;
          panStartOffset.current = { x: offsetXRef.current, y: offsetYRef.current };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          isPinching.current = true;
          const currentDistance = getDistance(evt.nativeEvent.touches);
          if (lastDistance.current && lastDistance.current > 0) {
            const scaleDelta = currentDistance / lastDistance.current;
            const newScale = Math.min(Math.max(scaleRef.current * scaleDelta, 1), 3);
            scaleRef.current = newScale;
            setScale(newScale);
            animateTransformTo({ scale: newScale });

            const shouldFullscreen = newScale > 1.2;
            if (shouldFullscreen !== isFullscreenRef.current) {
              console.log('[NetworkMap] fullscreen toggle via scale', {
                newScale,
                shouldFullscreen,
              });
              isFullscreenRef.current = shouldFullscreen;
              setIsFullscreenMap(shouldFullscreen);
            }

            if (isFullscreenRef.current && newScale <= 1.05) {
              console.log('[NetworkMap] auto-exit fullscreen via scale', { newScale });
              resetMapTransform();
              return;
            }

            if (!shouldFullscreen && newScale <= 1.02) {
              offsetXRef.current = 0;
              offsetYRef.current = 0;
              panStartOffset.current = { x: 0, y: 0 };
              setOffsetX(0);
              setOffsetY(0);
              animateTransformTo({ x: 0, y: 0 });
            }
          }
          lastDistance.current = currentDistance;
        } else if (!isPinching.current && scaleRef.current > 1) {
          const newOffsetX = panStartOffset.current.x + gestureState.dx;
          const newOffsetY = panStartOffset.current.y + gestureState.dy;

          const maxOffsetX = (canvasWidth * (scaleRef.current - 1)) / 2;
          const maxOffsetY = (canvasHeight * (scaleRef.current - 1)) / 2;
          const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX));
          const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, newOffsetY));

          offsetXRef.current = clampedX;
          offsetYRef.current = clampedY;
          setOffsetX(clampedX);
          setOffsetY(clampedY);
          animateTransformTo({ x: clampedX, y: clampedY }, { immediate: true });
        }
      },
      onPanResponderRelease: () => {
        lastDistance.current = null;
        isPinching.current = false;

        if (scaleRef.current <= 1.05 && isFullscreenRef.current) {
          console.log('[NetworkMap] exit fullscreen on release', {
            scale: scaleRef.current,
          });
          resetMapTransform();
          return;
        }

        if (scaleRef.current <= 1.02) {
          scaleRef.current = 1;
          offsetXRef.current = 0;
          offsetYRef.current = 0;
          panStartOffset.current = { x: 0, y: 0 };
          setScale(1);
          setOffsetX(0);
          setOffsetY(0);
          animateTransformTo({ scale: 1, x: 0, y: 0 });
          return;
        }

        const maxOffsetX = (canvasWidth * (scaleRef.current - 1)) / 2;
        const maxOffsetY = (canvasHeight * (scaleRef.current - 1)) / 2;
        const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetXRef.current));
        const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetYRef.current));
        if (clampedX !== offsetXRef.current || clampedY !== offsetYRef.current) {
          offsetXRef.current = clampedX;
          offsetYRef.current = clampedY;
          setOffsetX(clampedX);
          setOffsetY(clampedY);
          animateTransformTo({ x: clampedX, y: clampedY });
        }
      },
    })
  ).current;

  const handleContactPress = useCallback(
    (contactId: string) => {
      router.push(`/dossier/${contactId}`);
    },
    [router],
  );

  const renderMap = useCallback(
    (containerStyle: any, mapTestId: string) => {
      return (
        <View
          ref={mapContainerRef}
          style={containerStyle}
          {...panResponder.panHandlers}
          testID={mapTestId}
        >
          <Animated.View
            style={{
              transform: [
                { scale: animatedScale },
                { translateX: animatedOffsetX },
                { translateY: animatedOffsetY },
              ],
            }}
          >
            <Svg width={canvasWidth} height={canvasHeight}>
              {ringData
                .filter(({ circle }) => filterCircle === null || circle === filterCircle)
                .map(({ circle, innerRadius, outerRadius, segments, sectorCircleCounts }) => {
                  const angleSource =
                    filterCircle === null ? sectorData.sectorAngles : segments;

                  const ringStrokeColor =
                    currentTheme === 'spy' || currentTheme === 'genesis'
                      ? '#FFFFFF'
                      : currentTheme === 'business'
                        ? '#000000'
                        : theme.border;

                  return (
                    <G key={`ring-${circle}`}>
                      <SvgCircle
                        cx={centerX}
                        cy={centerY}
                        r={outerRadius}
                        fill="none"
                        stroke={ringStrokeColor}
                        strokeWidth={0.6 / scale}
                        opacity={0.9}
                      />
                      <SvgCircle
                        cx={centerX}
                        cy={centerY}
                        r={innerRadius}
                        fill="none"
                        stroke={ringStrokeColor}
                        strokeWidth={0.6 / scale}
                        opacity={0.9}
                      />
                      {angleSource.map(({ sector, startAngle, endAngle }) => {
                        const count = sectorCircleCounts.get(sector) || 0;

                        const x1Outer =
                          centerX + outerRadius * Math.cos(startAngle);
                        const y1Outer =
                          centerY + outerRadius * Math.sin(startAngle);
                        const x2Outer = centerX + outerRadius * Math.cos(endAngle);
                        const y2Outer = centerY + outerRadius * Math.sin(endAngle);

                        const x1Inner =
                          centerX + innerRadius * Math.cos(startAngle);
                        const y1Inner =
                          centerY + innerRadius * Math.sin(startAngle);
                        const x2Inner = centerX + innerRadius * Math.cos(endAngle);
                        const y2Inner = centerY + innerRadius * Math.sin(endAngle);

                        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

                        const pathData = [
                          `M ${x1Outer} ${y1Outer}`,
                          `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
                          `L ${x2Inner} ${y2Inner}`,
                          `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}`,
                          'Z',
                        ].join(' ');

                        return (
                          <Path
                            key={`segment-${circle}-${sector}`}
                            d={pathData}
                            fill="none"
                            stroke={ringStrokeColor}
                            strokeWidth={0.5 / scale}
                            opacity={count === 0 ? 0.25 : 0.9}
                          />
                        );
                      })}
                    </G>
                  );
                })}

              {sectorData.sectorAngles.map(
                ({ sector, startAngle, endAngle, count }, idx) => {
                  if (count === 0) return null;
                  const maxRadius = mapBaseSize * 0.4;
                  const midAngle = (startAngle + endAngle) / 2;
                  const labelRadius = maxRadius * 1.1;

                  const sectorColors = [
                    theme.primary,
                    theme.warning,
                    theme.danger,
                    '#4A90E2',
                    '#50C878',
                    '#FF6B9D',
                    '#FFD700',
                    '#9370DB',
                  ];
                  const sectorColor = sectorColors[idx % sectorColors.length];

                  return (
                    <G key={`sector-${sector}`}>
                      <Line
                        x1={centerX}
                        y1={centerY}
                        x2={centerX + maxRadius * Math.cos(startAngle)}
                        y2={centerY + maxRadius * Math.sin(startAngle)}
                        stroke={
                          currentTheme === 'genesis' || currentTheme === 'spy'
                            ? '#FFFFFF'
                            : currentTheme === 'business'
                              ? '#000000'
                              : theme.border
                        }
                        strokeWidth={1 / scale}
                        opacity="0.75"
                      />
                      <SvgText
                        x={centerX + labelRadius * Math.cos(midAngle)}
                        y={centerY + labelRadius * Math.sin(midAngle)}
                        fill={theme.primary}
                        fontSize="11"
                        fontFamily="monospace"
                        textAnchor="middle"
                        fontWeight="700"
                        opacity="0.9"
                        rotation={(midAngle * 180) / Math.PI + 90}
                        origin={`${centerX + labelRadius * Math.cos(midAngle)}, ${centerY + labelRadius * Math.sin(midAngle)}`}
                      >
                        {((t.network as any)[sector] || sector).toUpperCase()}
                      </SvgText>
                    </G>
                  );
                },
              )}

              {connections.map((conn, idx) => (
                <Line
                  key={`conn-${idx}`}
                  x1={conn.from.x}
                  y1={conn.from.y}
                  x2={conn.to.x}
                  y2={conn.to.y}
                  stroke={theme.primary}
                  strokeWidth={Math.max(0.5, Math.min(conn.strength, 10) / 2) / scale}
                  opacity={Math.min(0.6, Math.min(conn.strength, 10) / 10)}
                />
              ))}

              {powerConnections.map((conn, idx) => {
                const dx = conn.to.x - conn.from.x;
                const dy = conn.to.y - conn.from.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const arrowSize = 6 / scale;
                const arrowSpacing = 20 / scale;
                const numArrows = Math.floor(length / arrowSpacing);

                return (
                  <G key={`power-conn-${idx}`}>
                    <Line
                      x1={conn.from.x}
                      y1={conn.from.y}
                      x2={conn.to.x}
                      y2={conn.to.y}
                      stroke="#8B0000"
                      strokeWidth={2 / scale}
                      opacity={0.8}
                    />
                    {Array.from({ length: numArrows }).map((_, arrowIdx) => {
                      const tt = (arrowIdx + 1) / (numArrows + 1);
                      const x = conn.from.x + dx * tt;
                      const y = conn.from.y + dy * tt;
                      const angle = Math.atan2(dy, dx);

                      const arrowPoints = `
                          ${x},${y}
                          ${x - arrowSize * Math.cos(angle - Math.PI / 6)},${y - arrowSize * Math.sin(angle - Math.PI / 6)}
                          ${x - arrowSize * Math.cos(angle + Math.PI / 6)},${y - arrowSize * Math.sin(angle + Math.PI / 6)}
                        `;

                      return (
                        <Polygon
                          key={`arrow-${arrowIdx}`}
                          points={arrowPoints}
                          fill="#8B0000"
                          opacity={0.8}
                        />
                      );
                    })}
                  </G>
                );
              })}

              {filteredDossiers.map((dossier) => {
                const pos = positions.get(dossier.contact.id);
                if (!pos) return null;

                const color =
                  dossier.importance === 'critical'
                    ? theme.danger
                    : dossier.importance === 'high'
                      ? theme.warning
                      : dossier.importance === 'medium'
                        ? theme.primary
                        : theme.primaryDim;

                const baseNodeSize =
                  dossier.importance === 'critical'
                    ? 10
                    : dossier.importance === 'high'
                      ? 8
                      : 6;

                const nodeSize = baseNodeSize / 1.5 / scale;

                const firstName = dossier.contact.name.split(' ')[0];

                const isInPowerGroup = !!dossier.powerGrouping?.groupName;

                return (
                  <G key={`contact-${dossier.contact.id}`}>
                    {isInPowerGroup ? (
                      <Polygon
                        points={`${pos.x},${pos.y - nodeSize} ${pos.x + nodeSize * 0.866},${pos.y + nodeSize * 0.5} ${pos.x - nodeSize * 0.866},${pos.y + nodeSize * 0.5}`}
                        fill={theme.background}
                        stroke={color}
                        strokeWidth={2 / scale}
                      />
                    ) : (
                      <SvgCircle
                        cx={pos.x}
                        cy={pos.y}
                        r={nodeSize}
                        fill={theme.background}
                        stroke={color}
                        strokeWidth={2 / scale}
                      />
                    )}
                    <SvgText
                      x={pos.x}
                      y={pos.y + (baseNodeSize / 1.5 + 14) / scale}
                      fill={color}
                      fontSize={9 / scale}
                      fontFamily="monospace"
                      textAnchor="middle"
                      opacity="0.8"
                    >
                      {firstName.toUpperCase()}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>

            {filteredDossiers.map((dossier) => {
              const pos = positions.get(dossier.contact.id);
              if (!pos) return null;

              return (
                <TouchableOpacity
                  key={`touch-${dossier.contact.id}`}
                  style={[
                    styles.contactTouchable,
                    {
                      left: pos.x - 15,
                      top: pos.y - 15,
                      width: 30,
                      height: 30,
                    },
                  ]}
                  onPress={() => handleContactPress(dossier.contact.id)}
                  activeOpacity={0.6}
                  testID={`network-contact-${dossier.contact.id}`}
                />
              );
            })}
          </Animated.View>
        </View>
      );
    },
    [
      centerX,
      centerY,
      connections,
      currentTheme,
      filterCircle,
      filteredDossiers,
      handleContactPress,
      mapBaseSize,
      canvasHeight,
      canvasWidth,
      offsetX,
      offsetY,
      panResponder.panHandlers,
      positions,
      powerConnections,
      ringData,
      scale,
      sectorData.sectorAngles,
      styles.contactTouchable,
      t.network,
      theme,
    ],
  );

  return (
    <View style={styles.background}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <NetworkIcon size={28} color={theme.primary} strokeWidth={1.5} />
          <Text style={styles.title}>{t.network.title}</Text>
        </View>

        <View>
          <Text style={styles.filterLabel}>{t.network.sector}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterSectors.length === 0 && styles.filterButtonActive,
              ]}
              onPress={() => setFilterSectors([])}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  filterSectors.length === 0 && styles.filterTextActive,
                ]}
              >
                {t.network.all}
              </Text>
            </TouchableOpacity>
            {sectors.map((sector) => {
              const isSelected = filterSectors.includes(sector);
              const translatedSector = (t.network as any)[sector] || sector;
              return (
                <TouchableOpacity
                  key={sector}
                  style={[
                    styles.filterButton,
                    isSelected && styles.filterButtonActive,
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      setFilterSectors(filterSectors.filter(s => s !== sector));
                    } else {
                      setFilterSectors([...filterSectors, sector]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isSelected && styles.filterTextActive,
                    ]}
                  >
                    {translatedSector.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>{t.network.functionalCircle}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterCircle === null && styles.filterButtonActive,
              ]}
              onPress={() => setFilterCircle(null)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  filterCircle === null && styles.filterTextActive,
                ]}
              >
                {t.network.all}
              </Text>
            </TouchableOpacity>
            {circles.map((circle) => {
              const translatedCircle = (t.network as any)[circle] || circle;
              return (
                <TouchableOpacity
                  key={circle}
                  style={[
                    styles.filterButton,
                    filterCircle === circle && styles.filterButtonActive,
                  ]}
                  onPress={() => setFilterCircle(circle)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filterCircle === circle && styles.filterTextActive,
                    ]}
                  >
                    {translatedCircle.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>{t.network.powerGrouping}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterPowerGroupings.length === 0 && styles.filterButtonActive,
              ]}
              onPress={() => setFilterPowerGroupings([])}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  filterPowerGroupings.length === 0 && styles.filterTextActive,
                ]}
              >
                {t.network.all}
              </Text>
            </TouchableOpacity>
            {powerGroupings.map((grouping) => {
              const isSelected = filterPowerGroupings.includes(grouping);
              return (
                <TouchableOpacity
                  key={grouping}
                  style={[
                    styles.filterButton,
                    isSelected && styles.filterButtonActive,
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      setFilterPowerGroupings(filterPowerGroupings.filter(g => g !== grouping));
                    } else {
                      setFilterPowerGroupings([...filterPowerGroupings, grouping]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isSelected && styles.filterTextActive,
                    ]}
                  >
                    {grouping.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {dossiers.length === 0 ? (
          <View style={styles.emptyState}>
            <NetworkIcon size={64} color={theme.primaryDim} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{t.network.noNetworkData}</Text>
            <Text style={styles.emptyText}>
              {t.network.addContactsVisualize}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isFullscreenMap}
          >
            {!isFullscreenMap ? (
              renderMap(styles.visualization, 'network-map')
            ) : (
              <View
                style={[styles.visualizationPlaceholder, { height: MAP_SIZE }]}
                testID="network-map-placeholder"
              />
            )}

            <View style={styles.stats}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{dossiers.length}</Text>
                <Text style={styles.statLabel}>{t.network.totalContacts}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {dossiers.filter((d) => d.importance === 'critical').length}
                </Text>
                <Text style={styles.statLabel}>{t.network.critical}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {dossiers.reduce((sum, d) => sum + d.relations.length, 0)}
                </Text>
                <Text style={styles.statLabel}>{t.network.connections}</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>{t.network.importance}</Text>
                <View style={styles.infoItems}>
                  <View style={styles.infoItem}>
                    <Circle size={14} color={theme.danger} fill={theme.danger} />
                    <Text style={styles.infoText}>{t.network.critical}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Circle size={14} color={theme.warning} fill={theme.warning} />
                    <Text style={styles.infoText}>{t.network.high}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Circle size={14} color={theme.primary} fill={theme.primary} />
                    <Text style={styles.infoText}>{t.network.medium}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Circle size={14} color={theme.primaryDim} fill={theme.primaryDim} />
                    <Text style={styles.infoText}>{t.network.low}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>{t.network.circles}</Text>
                <View style={styles.infoItems}>
                  <View style={styles.infoItem}>
                    <Text style={styles.circleLabel}>{t.network.outer}</Text>
                    <Text style={styles.infoText}>{t.network.development}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.circleLabel}>{t.network.mid}</Text>
                    <Text style={styles.infoText}>{t.network.productivity}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.circleLabel}>{t.network.inner}</Text>
                    <Text style={styles.infoText}>{t.network.support}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {isFullscreenMap ? (
          <View style={styles.fullscreenOverlay} testID="network-map-fullscreen">
            <View style={styles.fullscreenHeader}>
              <TouchableOpacity
                onPress={resetMapTransform}
                activeOpacity={0.7}
                style={styles.fullscreenClose}
                testID="network-map-close"
              >
                <Text style={styles.fullscreenCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fullscreenBody}>
              {renderMap(styles.fullscreenVisualization, 'network-map-fullscreen-svg')}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 3,
  },
  filterLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  filters: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
  },
  filterButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.overlay,
  },
  filterText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  filterTextActive: {
    color: theme.text,
    fontWeight: '700' as const,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  visualization: {
    marginVertical: 20,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    overflow: 'hidden',
    position: 'relative' as const,
    width: MAP_SIZE,
    height: MAP_SIZE,
  },
  visualizationPlaceholder: {
    marginVertical: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
  },
  fullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.background,
    zIndex: 10000,
  },
  fullscreenHeader: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
  fullscreenClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
  },
  fullscreenCloseText: {
    color: theme.text,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
  },
  fullscreenBody: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  fullscreenVisualization: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: theme.overlay,
    overflow: 'hidden',
    position: 'relative' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTouchable: {
    position: 'absolute' as const,
    zIndex: 1000,
  },
  stats: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
  },
  statLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
    marginTop: 4,
    textAlign: 'center',
  },
  infoGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  infoSection: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.overlay,
    padding: 12,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  infoItems: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 10,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
  },
  circleLabel: {
    fontSize: 9,
    color: theme.text,
    fontFamily: 'monospace' as const,
    fontWeight: '700' as const,
    width: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: theme.text,
    fontFamily: 'monospace' as const,
    letterSpacing: 2,
    marginTop: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: 'monospace' as const,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
});
