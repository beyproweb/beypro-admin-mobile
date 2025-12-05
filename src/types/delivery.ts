/**
 * Delivery Stop Type Definition
 * Represents a single stop in a driver's route (pickup or delivery)
 */
export interface DeliveryStop {
  id: string;
  orderId: number;
  type: "pickup" | "delivery";
  stopNumber: number; // 0 = A, 1 = B, 2 = C...
  address: string;
  latitude: number;
  longitude: number;
  status: "pending" | "in_progress" | "completed";
  customerName?: string;
  orderNumber?: string;
  notes?: string;
  estimatedArrivalTime?: number; // minutes from now
  timeSpent?: number; // minutes spent at this stop
}

/**
 * Route Information Type
 * Contains all stops and route metadata
 */
export interface RouteInfo {
  totalDistance: number; // km
  totalDuration: number; // minutes
  stops: DeliveryStop[];
  driverId?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * API Response for route data
 * Includes polyline encoding for efficient transmission
 */
export interface RouteResponse {
  route: RouteInfo;
  polylinePoints?: string;
  status: "success" | "error";
  message?: string;
}

/**
 * Stop completion event
 * Sent when driver marks a stop as completed
 */
export interface StopCompletionEvent {
  stopId: string;
  orderId: number;
  completedAt: Date;
  notes?: string;
  signature?: string;
}

/**
 * Route update event
 * Sent when route information changes
 */
export interface RouteUpdateEvent {
  driverId: string;
  route: RouteInfo;
  timestamp: Date;
}
