import React, { useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  StyleSheet,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  Easing,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

const { height: screenHeight } = Dimensions.get("window");

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  snapPoints?: number[];
  backgroundColor?: string;
  borderRadius?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onDismiss,
  children,
  maxHeight = screenHeight * 0.85,
  snapPoints = [screenHeight * 0.3, screenHeight * 0.6, screenHeight * 0.85],
  backgroundColor = "#FFFFFF",
  borderRadius = 24,
}) => {
  const translateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);
  const currentSnapIndex = useSharedValue(snapPoints.length - 1);

  // Define handleDismiss first (before using it in gesture)
  const handleDismiss = () => {
    translateY.value = withSpring(screenHeight, {
      damping: 12,
      mass: 1,
      overshootClamping: true,
    });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onDismiss, 200);
  };

  // Backdrop pan gesture
  const backdropPan = Gesture.Tap()
    .onStart(() => {
      runOnJS(handleDismiss)();
    });

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(
        snapPoints[snapPoints.length - 1],
        {
          damping: 12,
          mass: 1,
          overshootClamping: true,
        }
      );
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      handleDismiss();
    }
  }, [visible]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* BACKDROP */}
      <GestureDetector gesture={backdropPan}>
        <Animated.View
          style={[styles.backdrop, animatedBackdropStyle]}
        />
      </GestureDetector>

      {/* BOTTOM SHEET */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor,
            maxHeight,
            borderRadius,
          },
          animatedSheetStyle,
        ]}
      >
        {/* DRAG HANDLE */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* CONTENT - SCROLLABLE */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          scrollEnabled={true}
          bounces={false}
        >
          {children}
        </ScrollView>

        {/* SAFE AREA BOTTOM */}
        <View style={{ height: 20 }} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  sheet: {
    width: "100%",
    paddingBottom: Platform.OS === "android" ? 0 : 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E5E7EB",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flex: 1,
  },
});
