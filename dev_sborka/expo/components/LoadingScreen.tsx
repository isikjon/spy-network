import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Theme } from '@/constants/colors';

interface LoadingScreenProps {
  theme?: Theme;
}

export default function LoadingScreen({ theme }: LoadingScreenProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    pulseAnimation.start();

    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const opacity = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const backgroundColor = theme?.background || '#000000';
  const primaryColor = theme?.primary || '#00FF41';
  const overlayColor = theme?.overlay || 'rgba(0, 255, 65, 0.1)';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Animated.View 
        style={[
          styles.outerCircle,
          { 
            borderColor: overlayColor,
            transform: [{ rotate: spin }],
          }
        ]}
      />
      
      <Animated.View 
        style={[
          styles.middleCircle,
          { 
            borderColor: primaryColor,
            opacity,
            transform: [{ scale }],
          }
        ]}
      />
      
      <View style={[styles.innerCircle, { backgroundColor: primaryColor }]} />
      
      <Animated.View 
        style={[
          styles.dot,
          styles.dot1,
          { 
            backgroundColor: primaryColor,
            transform: [{ rotate: spin }],
          }
        ]}
      />
      <Animated.View 
        style={[
          styles.dot,
          styles.dot2,
          { 
            backgroundColor: primaryColor,
            transform: [{ rotate: spin }],
          }
        ]}
      />
      <Animated.View 
        style={[
          styles.dot,
          styles.dot3,
          { 
            backgroundColor: primaryColor,
            transform: [{ rotate: spin }],
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
  },
  middleCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
  },
  innerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dot1: {
    top: '50%',
    left: '50%',
    marginTop: -86,
    marginLeft: -6,
  },
  dot2: {
    top: '50%',
    left: '50%',
    marginTop: 74,
    marginLeft: -6,
  },
  dot3: {
    top: '50%',
    left: '50%',
    marginTop: -6,
    marginLeft: 94,
  },
});
