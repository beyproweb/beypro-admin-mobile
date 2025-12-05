import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { RouteInfo } from "../types/delivery";

interface RouteHeaderProps {
  route: RouteInfo | null;
  completedStops?: number;
  totalStops?: number;
}

/**
 * RouteHeader Component
 * Displays route summary: total distance, duration, stops completed
 * Positioned at top of map for quick reference
 */
export const RouteHeader: React.FC<RouteHeaderProps> = ({
  route,
  completedStops = 0,
  totalStops = 0,
}) => {
  const displayStats = useMemo(() => {
    if (!route) {
      return {
        distance: "0",
        duration: "0",
        stops: "0",
        completed: "0",
      };
    }

    return {
      distance: route.totalDistance.toFixed(1),
      duration: route.totalDuration.toString(),
      stops: route.stops.length.toString(),
      completed: completedStops.toString(),
    };
  }, [route, completedStops]);

  if (!route) return null;

  return (
    <View style={styles.container}>
      {/* Main Stats Row */}
      <View style={styles.statsRow}>
        {/* Distance */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{displayStats.distance} km</Text>
        </View>

        {/* Duration */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{displayStats.duration} min</Text>
        </View>

        {/* Stops */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Stops</Text>
          <Text style={styles.statValue}>
            {displayStats.completed}/{displayStats.stops}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      {totalStops > 0 && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${(completedStops / totalStops) * 100}%`,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  progressContainer: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
});

export default RouteHeader;
