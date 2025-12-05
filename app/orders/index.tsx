import { View } from "react-native";
import OrdersIndex from "../../src/components/orders";
import BottomNav from "../../src/components/navigation/BottomNav";

export default function OrdersScreen() {
  return (
    <View style={{ flex: 1 }}>
      <OrdersIndex />
      <BottomNav />
    </View>
  );
}
