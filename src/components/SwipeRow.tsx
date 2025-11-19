import React from "react";
import { View, StyleSheet, Animated, Text } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

interface SwipeRowProps {
  children: React.ReactNode;
  onSwipeRight?: () => void; // preparing
  onSwipeLeft?: () => void;  // delivered
}

export default function SwipeRow({
  children,
  onSwipeLeft,
  onSwipeRight,
}: SwipeRowProps) {
  const translateX = new Animated.Value(0);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.setValue(event.translationX);
    })
    .onEnd((event) => {
      if (event.translationX > 80 && onSwipeRight) {
        onSwipeRight();
      } else if (event.translationX < -80 && onSwipeLeft) {
        onSwipeLeft();
      }

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
