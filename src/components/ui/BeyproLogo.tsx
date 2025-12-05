import React, { useEffect } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, G, Rect, Circle, Path } from 'react-native-svg';

export default function BeyproLogo({ size = 42, isDark = false }: { size?: number; isDark?: boolean }) {
  const pulse = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.03],
  });

  // Colors
  const gradientFrom = isDark ? '#22D3EE' : '#0EA5E9';
  const gradientTo = isDark ? '#8B5CF6' : '#6D28D9';
  const magenta = isDark ? '#F472B6' : '#EC4899';
  const spineColor = isDark ? '#38BDF8' : '#0EA5E9';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={size} height={size} viewBox={`0 0 42 42`}>
        <Defs>
          <LinearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientFrom} stopOpacity="1" />
            <Stop offset="100%" stopColor={gradientTo} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={magenta} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={gradientTo} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        <G>
          {/* Background rounded square */}
          <Rect x={1} y={1} rx={10} ry={10} width={40} height={40} fill={isDark ? '#071423' : '#FFFFFF'} opacity={isDark ? 0.065 : 1} />

          {/* Spine (left vertical) */}
          <Rect x={8} y={6} rx={3} ry={3} width={6} height={30} fill={spineColor} opacity={0.95} />

          {/* Upper loop */}
          <Path d="M15 7 C22 7 28 10 28 16 C28 20 24 22 19 22 C16 22 15 21 15 21 Z" fill="url(#g1)" opacity="0.96" />

          {/* Lower loop */}
          <Path d="M15 22 C21 22 28 23 28 29 C28 33 24 35 19 35 C16 35 15 34 15 34 Z" fill="url(#g2)" opacity="0.96" />

          {/* Accent dots representing network/scale */}
          <Circle cx={33} cy={10} r={1.6} fill={gradientFrom} opacity={0.96} />
          <Circle cx={37} cy={16} r={1.2} fill={magenta} opacity={0.9} />
          <Circle cx={34} cy={26} r={1} fill={gradientTo} opacity={0.9} />
        </G>
      </Svg>
    </Animated.View>
  );
}
