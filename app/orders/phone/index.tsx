import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
  Keyboard,
} from "react-native";
import { useTranslation } from "react-i18next";
import BottomNav from "../../../src/components/navigation/BottomNav";
import secureFetch from "../../../src/api/secureFetch";
import { useAppearance } from "../../../src/context/AppearanceContext";
import { usePermissions } from "../../../src/context/PermissionsContext";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type Customer = {
  id: number;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  birthday?: string | null;
  visit_count?: number;
  lifetime_value?: number;
  last_visit?: string | null;
  addresses?: {
    id: number;
    label: string;
    address: string;
    is_default: boolean;
  }[];
};

type FormState = {
  name: string;
  phone: string;
  address: string;
  birthday: string;
};

type PaymentMethod = {
  id: string;
  label: string;
  icon?: string;
  enabled?: boolean;
};

const normalizePaymentMethods = (payload: any): PaymentMethod[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.methods)) {
    return payload.methods;
  }
  if (payload.enabledMethods && typeof payload.enabledMethods === "object") {
    return Object.entries(payload.enabledMethods).map(([id, enabled]) => ({
      id,
      label: String(id)
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      enabled: Boolean(enabled),
    }));
  }
  return [];
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Cash", enabled: true },
  { id: "card", label: "Card", enabled: true },
  { id: "online", label: "Online", enabled: true },
];

const getPrimaryAddressFromCustomer = (customer: Customer) => {
  return (
    customer.address ||
    customer.addresses?.find((addr) => addr.is_default)?.address ||
    customer.addresses?.[0]?.address ||
    ""
  );
};

export default function PhoneOrdersScreen() {
  const { appearance, isDark, fontScale } = useAppearance();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const highContrast = appearance.highContrast;
  const [modalVisible, setModalVisible] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [formState, setFormState] = useState<FormState>({
    name: "",
    phone: "",
    address: "",
    birthday: "",
  });
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [addressReady, setAddressReady] = useState(true);
  const [phoneOrders, setPhoneOrders] = useState<any[]>([]);
  const [phoneOrdersLoading, setPhoneOrdersLoading] = useState(false);
  const paymentSectionRef = useRef<ScrollView>(null);
  // =========================
  // EDIT CUSTOMER INFORMATION
  // =========================

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return;

    setFormError("");
    setSaving(true);

    try {
      // 1️⃣ Update the main customer info
      const updatedCustomer = await secureFetch(
        `/customers/${selectedCustomer.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: formState.name.trim(),
            phone: formState.phone.trim(),
            birthday: formState.birthday.trim() || null,
          }),
        }
      );

      // 2️⃣ Update default address
      const newAddress = formState.address.trim();

      if (newAddress.length) {
        // Fetch all existing addresses
        const existing = await secureFetch(
          `/customerAddresses/customers/${selectedCustomer.id}/addresses`
        );

        // Delete old default addresses
        for (const addr of existing) {
          if (addr.is_default) {
            await secureFetch(
              `/customerAddresses/customer-addresses/${addr.id}`, // ✅ PLURAL FIX
              { method: "DELETE" }
            );
          }
        }

        // Create new default address
        await secureFetch(
          `/customerAddresses/customers/${selectedCustomer.id}/addresses`,
          {
            method: "POST",
            body: JSON.stringify({
              address: newAddress,
              label: "Phone order",
              is_default: true,
            }),
          }
        );
      }

      // Update local UI state
      setSelectedCustomer({
        ...updatedCustomer,
        addresses: [{ address: newAddress, is_default: true }],
      });

      setStatusMessage(t("Customer updated successfully."));
      setShowNewCustomerForm(false);
      setCustomers([]);
    } catch (err) {
      console.log("❌ Failed to edit customer:", err);
      setFormError(t("Could not update customer."));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setModalVisible(true);
  }, []);
  const fetchCustomerAddress = useCallback(async (customer: Customer) => {
    try {
      const list = await secureFetch(
        `/customerAddresses/customers/${customer.id}/addresses`
      );

      if (Array.isArray(list) && list.length > 0) {
        // default OR first
        const def = list.find((a) => a.is_default) || list[0];
        return def.address;
      }
    } catch (err) {
      console.log("❌ Failed to load addresses:", err);
    }

    // fallback
    return customer.address || "";
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPaymentMethods = async () => {
      setPaymentLoading(true);
      setPaymentError("");
      try {
        const data = await secureFetch("/settings/payments");
        if (!isMounted) return;
        let methods = normalizePaymentMethods(data);
        if (!methods.length) {
          methods = DEFAULT_PAYMENT_METHODS;
        }
        const enabledMethods = methods.filter(
          (method) => method.enabled !== false
        );
        const resolvedMethods =
          enabledMethods.length > 0 ? enabledMethods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(resolvedMethods);
        setSelectedPaymentMethodId(
          (prev) => prev || resolvedMethods[0]?.id || null
        );
      } catch (err) {
        console.log("❌ Failed to load payment methods:", err);
        if (isMounted) {
          setPaymentError(t("Could not load payment methods."));
        }
      } finally {
        if (isMounted) {
          setPaymentLoading(false);
        }
      }
    };

    loadPaymentMethods();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load phone orders made
  useEffect(() => {
    let isMounted = true;

    const loadPhoneOrders = async () => {
      setPhoneOrdersLoading(true);
      try {
        const data = await secureFetch("/orders?status=open_phone");
        if (isMounted && Array.isArray(data)) {
          setPhoneOrders(data);
        }
      } catch (err) {
        console.log("❌ Failed to load phone orders:", err);
      } finally {
        if (isMounted) {
          setPhoneOrdersLoading(false);
        }
      }
    };

    loadPhoneOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  const searchCustomers = useCallback(async (query: string) => {
    setSearchLoading(true);
    setSearchError("");
    try {
      const data = await secureFetch(
        `/customers?search=${encodeURIComponent(query)}`
      );
      if (!Array.isArray(data)) {
        setCustomers([]);
        setSearchError(t("No matching customers yet."));
        return;
      }
      setCustomers(data);
      if (!data.length) {
        setSearchError(t("No saved customers found."));
      }
    } catch (err) {
      console.log("❌ Customer search failed:", err);
      setSearchError(t("Search failed. Try again."));
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query) {
      setCustomers([]);
      setSearchError("");
      return;
    }

    const handler = setTimeout(() => {
      searchCustomers(query);
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm, searchCustomers]);

  const handleSelectCustomer = useCallback(
    async (customer: Customer) => {
      // Dismiss keyboard immediately
      Keyboard.dismiss();

      setAddressReady(false);
      const primaryAddress = await fetchCustomerAddress(customer);
      setSelectedCustomer(customer);
      setShowNewCustomerForm(false);
      setSearchTerm(customer.name || customer.phone || "");
      setCustomers([]);
      setFormState((prev) => ({
        ...prev,
        name: customer.name || "",
        phone: customer.phone || "",
        address: primaryAddress,
        birthday: customer.birthday || "",
      }));
      const customerLabel =
        customer.name || customer.phone || t("saved customer");
      setStatusMessage(
        `${t("Loaded")} ${customerLabel}. ${t("Select a payment method to continue.")}`
      );
      setFormError("");
      setSelectedPaymentMethodId(null);
      setAddressReady(true);

      // Scroll to payment section
      setTimeout(() => {
        paymentSectionRef.current?.scrollToEnd({ animated: true });
      }, 300);
    },
    [fetchCustomerAddress]
  );

  const handleSaveCustomer = async () => {
    setFormError("");
    if (!formState.name.trim() || !formState.phone.trim()) {
      setFormError(t("Name and phone are required."));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formState.name.trim(),
        phone: formState.phone.trim(),
        birthday: formState.birthday.trim() || null,
      };
      const customer: Customer = await secureFetch("/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (formState.address.trim()) {
        try {
          await secureFetch(
            `/customerAddresses/customers/${customer.id}/addresses`,
            {
              method: "POST",
              body: JSON.stringify({
                address: formState.address.trim(),
                label: "Phone order",
                is_default: true,
              }),
            }
          );
        } catch (err) {
          console.log("❌ Failed to save address:", err);
        }
      }
      const savedLabel = customer.name || customer.phone || t("saved customer");
      setStatusMessage(
        `${t("Customer")} ${savedLabel} ${t("saved. Select a payment method to continue.")}`
      );
      setSelectedCustomer(customer);
      setShowNewCustomerForm(false);
      setSearchTerm(customer.name || customer.phone || "");
      setCustomers([]);
      setSelectedPaymentMethodId(null);
      setAddressReady(true);
    } catch (err) {
      console.log("❌ Save customer failed:", err);
      setFormError(t("Could not save customer."));
    } finally {
      setSaving(false);
    }
  };

  const startOrderForCustomer = useCallback(
    (customer: Customer, paymentMethodId: string | null, address?: string) => {
      if (!customer) return;
      setModalVisible(false);
      setStatusMessage(
        `${t("Starting order for")} ${customer.name || customer.phone}`
      );
      const params = new URLSearchParams({
        orderContext: "phone",
        customerId: customer.id.toString(),
      });
      if (customer.phone) {
        params.set("customerPhone", customer.phone);
      }
      if (customer.name) {
        params.set("customerName", customer.name);
      }
      if (paymentMethodId) {
        params.set("paymentMethod", paymentMethodId);
      }
      if (address) {
        params.set("customerAddress", address);
      }

      router.push(`/orders/table/phone?${params.toString()}`);
    },
    [router]
  );

  const selectedPaymentMethodLabel = paymentMethods.find(
    (method) => method.id === selectedPaymentMethodId
  )?.label;

  useEffect(() => {
    if (
      showNewCustomerForm ||
      !selectedCustomer ||
      !selectedPaymentMethodId ||
      !addressReady
    ) {
      return;
    }
    startOrderForCustomer(
      selectedCustomer,
      selectedPaymentMethodId,
      formState.address.trim()
    );
  }, [
    selectedCustomer,
    selectedPaymentMethodId,
    showNewCustomerForm,
    startOrderForCustomer,
    formState.address,
    addressReady,
  ]);

  const handleFormChange = (key: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        highContrast && styles.containerHighContrast,
      ]}
    >
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View>
          <View style={styles.headerTop}>
            <Ionicons name="call" size={28} color="#4F46E5" />
            <Text
              style={[
                styles.headerTitle,
                isDark && styles.headerTitleDark,
                { fontSize: 26 * fontScale },
              ]}
            >
              {t("Phone Orders")}
            </Text>
          </View>
          <Text
            style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}
          >
            {t("Quick order intake • Fast checkout")}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {statusMessage ? (
          <Text style={styles.statusText}>{statusMessage}</Text>
        ) : null}

        {selectedCustomer && (
          <View style={[styles.summaryCard, isDark && styles.summaryCardDark]}>
            <Text
              style={[styles.summaryLabel, isDark && styles.summaryLabelDark]}
            >
              {t("Ready customer")}
            </Text>
            <Text
              style={[styles.summaryName, isDark && styles.summaryNameDark]}
            >
              {selectedCustomer.name || t("Unnamed customer")}
            </Text>
            <Text
              style={[styles.summaryMeta, isDark && styles.summaryMetaDark]}
            >
              {selectedCustomer.phone}
            </Text>
            {selectedCustomer.address && (
              <Text
                style={[styles.summaryMeta, isDark && styles.summaryMetaDark]}
              >
                {selectedCustomer.address}
              </Text>
            )}
            {selectedCustomer.birthday && (
              <Text
                style={[styles.summaryMeta, isDark && styles.summaryMetaDark]}
              >
                {t("Birthday:")}: {selectedCustomer.birthday}
              </Text>
            )}
            <Text
              style={[styles.summaryMeta, isDark && styles.summaryMetaDark]}
            >
              {t("Payment:")}: {selectedPaymentMethodLabel ?? t("Not selected")}
            </Text>
          </View>
        )}

        {/* PHONE ORDERS LIST */}
        <View style={{ marginTop: 32 }}>
          <Text
            style={[
              styles.headerTitle,
              isDark && styles.headerTitleDark,
              { fontSize: 18, marginBottom: 16 },
            ]}
          ></Text>

          {phoneOrdersLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator color="#4F46E5" size="large" />
              <Text style={[styles.infoText, { marginTop: 12 }]}>
                {t("Loading orders...")}
              </Text>
            </View>
          ) : phoneOrders.length === 0 ? (
            <Text
              style={[
                styles.infoText,
                { textAlign: "center", paddingVertical: 24 },
              ]}
            >
              {t("No phone orders yet")}
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {phoneOrders.map((order) => (
                <View
                  key={order.id}
                  style={[
                    styles.summaryCard,
                    isDark && styles.summaryCardDark,
                    { marginBottom: 0 },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.summaryLabel,
                          isDark && styles.summaryLabelDark,
                        ]}
                      >
                        {t("Order #")}
                        {order.id}
                      </Text>
                      <Text
                        style={[
                          styles.summaryName,
                          isDark && styles.summaryNameDark,
                        ]}
                      >
                        {order.customer_name || t("Unnamed")}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.summaryMeta,
                        isDark && styles.summaryMetaDark,
                        { fontSize: 16, fontWeight: "600" },
                      ]}
                    >
                      ₺{parseFloat(order.total || 0).toFixed(2)}
                    </Text>
                  </View>
                  {order.phone_number && (
                    <Text
                      style={[
                        styles.summaryMeta,
                        isDark && styles.summaryMetaDark,
                      ]}
                    >
                      📱 {order.phone_number}
                    </Text>
                  )}
                  {order.address && (
                    <Text
                      style={[
                        styles.summaryMeta,
                        isDark && styles.summaryMetaDark,
                      ]}
                    >
                      📍 {order.address}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {hasPermission("orders") && <BottomNav />}

      <Modal visible={modalVisible} animationType="none" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalWrapperCenter}
          >
            <View
              style={[
                styles.modalContentCenter,
                isDark && styles.modalContentDark,
              ]}
            >
              {/* HEADER WITH STEPS */}
              <View style={styles.modalHeader}>
                <Text
                  style={[styles.modalTitle, isDark && styles.modalTitleDark]}
                >
                  {t("Quick Phone Order")}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? "#F9FAFB" : "#111827"}
                  />
                </TouchableOpacity>
              </View>

              {/* STEP INDICATORS */}
              <View
                style={[
                  styles.stepsContainer,
                  isDark && styles.stepsContainerDark,
                ]}
              >
                <View
                  style={[
                    styles.step,
                    showNewCustomerForm
                      ? styles.stepInactive
                      : styles.stepActive,
                  ]}
                >
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text
                    style={[styles.stepLabel, isDark && styles.stepLabelDark]}
                  >
                    {t("Customer")}
                  </Text>
                </View>

                <View
                  style={[
                    styles.stepConnector,
                    isDark && styles.stepConnectorDark,
                  ]}
                />

                <View
                  style={[
                    styles.step,
                    !selectedCustomer ? styles.stepInactive : styles.stepActive,
                  ]}
                >
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text
                    style={[styles.stepLabel, isDark && styles.stepLabelDark]}
                  >
                    {t("Payment")}
                  </Text>
                </View>

                <View
                  style={[
                    styles.stepConnector,
                    isDark && styles.stepConnectorDark,
                  ]}
                />

                <View
                  style={[
                    styles.step,
                    !selectedPaymentMethodId
                      ? styles.stepInactive
                      : styles.stepActive,
                  ]}
                >
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text
                    style={[styles.stepLabel, isDark && styles.stepLabelDark]}
                  >
                    {t("Start")}
                  </Text>
                </View>
              </View>

              <ScrollView
                ref={paymentSectionRef}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
              >
                {!showNewCustomerForm ? (
                  <>
                    {/* STEP 1: CUSTOMER SELECTION */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Ionicons name="person" size={20} color="#4F46E5" />
                        <Text
                          style={[
                            styles.sectionLabel,
                            isDark && styles.sectionLabelDark,
                            { marginLeft: 8 },
                          ]}
                        >
                          {t("Select or Create Customer")}
                        </Text>
                      </View>

                      <TextInput
                        style={[
                          styles.input,
                          isDark && styles.inputDark,
                          isDark && styles.sectionLabelDark,
                        ]}
                        placeholder={t("Search by name or phone...")}
                        placeholderTextColor={isDark ? "#6B7280" : "#A1A1AA"}
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        keyboardType="default"
                      />

                      {searchLoading && (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator color="#4F46E5" size="small" />
                          <Text style={styles.searchLoadingText}>
                            {t("Searching…")}
                          </Text>
                        </View>
                      )}

                      {searchError && !searchLoading && (
                        <View style={styles.infoBox}>
                          <Text style={styles.infoBoxText}>{searchError}</Text>
                        </View>
                      )}

                      {customers.map((customer) => (
                        <Pressable
                          key={customer.id}
                          style={[
                            styles.customerCard,
                            isDark && styles.customerCardDark,
                            selectedCustomer?.id === customer.id &&
                              styles.customerCardActive,
                            selectedCustomer?.id === customer.id &&
                              isDark &&
                              styles.customerCardActiveDark,
                          ]}
                          onPress={() => handleSelectCustomer(customer)}
                        >
                          <View style={styles.customerCardContent}>
                            <View style={styles.customerCardLeft}>
                              <Ionicons
                                name="person-circle"
                                size={40}
                                color={
                                  selectedCustomer?.id === customer.id
                                    ? "#4F46E5"
                                    : isDark
                                      ? "#4B5563"
                                      : "#D1D5DB"
                                }
                              />
                            </View>
                            <View style={styles.customerCardDetails}>
                              <Text
                                style={[
                                  styles.customerCardName,
                                  isDark && styles.customerCardNameDark,
                                ]}
                              >
                                {customer.name || "Unnamed"}
                              </Text>
                              <Text
                                style={[
                                  styles.customerCardPhone,
                                  isDark && styles.customerCardPhoneDark,
                                ]}
                              >
                                {customer.phone}
                              </Text>
                              {customer.visit_count ? (
                                <Text
                                  style={[
                                    styles.customerCardMeta,
                                    isDark && styles.customerCardMetaDark,
                                  ]}
                                >
                                  {customer.visit_count} visit
                                  {customer.visit_count > 1 ? "s" : ""}
                                </Text>
                              ) : null}
                            </View>
                            {selectedCustomer?.id === customer.id && (
                              <Ionicons
                                name="checkmark-circle"
                                size={24}
                                color="#4F46E5"
                              />
                            )}
                          </View>
                        </Pressable>
                      ))}

                      {selectedCustomer && (
                        <View
                          style={[
                            styles.selectedBanner,
                            isDark && styles.selectedBannerDark,
                          ]}
                        >
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color="#15803D"
                          />
                          <Text style={styles.selectedBannerText}>
                            {selectedCustomer.name || selectedCustomer.phone}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowNewCustomerForm(true);
                              setFormError("");
                            }}
                          >
                            <Text style={styles.editLink}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.addButton,
                          isDark && styles.addButtonDark,
                        ]}
                        onPress={() => {
                          setShowNewCustomerForm(true);
                          setFormError("");
                        }}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color="#4F46E5"
                        />
                        <Text style={styles.addButtonText}>
                          {t("Add New Customer")}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* STEP 2: PAYMENT METHOD */}
                    {selectedCustomer && (
                      <View
                        style={[
                          styles.section,
                          styles.paymentSectionEnhanced,
                          isDark && styles.paymentSectionEnhancedDark,
                        ]}
                      >
                        <View style={styles.sectionHeader}>
                          <Ionicons name="card" size={20} color="#4F46E5" />
                          <Text
                            style={[
                              styles.sectionLabel,
                              isDark && styles.sectionLabelDark,
                              { marginLeft: 8 },
                            ]}
                          >
                            {t("Select Payment Method")}
                          </Text>
                        </View>

                        {paymentLoading ? (
                          <View style={styles.loadingContainer}>
                            <ActivityIndicator color="#4F46E5" size="small" />
                            <Text style={styles.searchLoadingText}>
                              {t("Loading methods…")}
                            </Text>
                          </View>
                        ) : paymentMethods.length ? (
                          <View style={styles.paymentGrid}>
                            {paymentMethods.map((method) => {
                              const isActive =
                                selectedPaymentMethodId === method.id;
                              return (
                                <Pressable
                                  key={method.id}
                                  style={[
                                    styles.paymentCard,
                                    isDark && styles.paymentCardDark,
                                    isActive && styles.paymentCardActive,
                                    isActive &&
                                      isDark &&
                                      styles.paymentCardActiveDark,
                                  ]}
                                  onPress={() =>
                                    setSelectedPaymentMethodId(method.id)
                                  }
                                >
                                  <View style={styles.paymentCardContent}>
                                    <Text style={styles.paymentCardIcon}>
                                      {method.icon || "💳"}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.paymentCardLabel,
                                        isDark && styles.paymentCardLabelDark,
                                        isActive &&
                                          styles.paymentCardLabelActive,
                                      ]}
                                    >
                                      {method.label}
                                    </Text>
                                    {isActive && (
                                      <View style={styles.paymentCheckmark}>
                                        <Ionicons
                                          name="checkmark"
                                          size={16}
                                          color="#fff"
                                        />
                                      </View>
                                    )}
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : (
                          <Text
                            style={[
                              styles.infoText,
                              isDark && styles.infoTextDark,
                            ]}
                          >
                            {paymentError || "No payment methods configured."}
                          </Text>
                        )}

                        {selectedPaymentMethodId ? (
                          <View
                            style={[
                              styles.successBanner,
                              isDark && styles.successBannerDark,
                            ]}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color="#15803D"
                            />
                            <Text
                              style={[
                                styles.successBannerText,
                                isDark && styles.successBannerTextDark,
                              ]}
                            >
                              {t("Ready to start order!")}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.warningBanner,
                              isDark && styles.warningBannerDark,
                            ]}
                          >
                            <Ionicons
                              name="alert-circle"
                              size={16}
                              color="#D97706"
                            />
                            <Text
                              style={[
                                styles.warningBannerText,
                                isDark && styles.warningBannerTextDark,
                              ]}
                            >
                              {t("Select a payment method to continue")}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {/* STEP 1 EDIT: NEW/EDIT CUSTOMER FORM */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Ionicons name="create" size={20} color="#4F46E5" />
                        <Text
                          style={[
                            styles.sectionLabel,
                            isDark && styles.sectionLabelDark,
                            { marginLeft: 8 },
                          ]}
                        >
                          {selectedCustomer
                            ? t("Edit Customer")
                            : t("New Customer")}
                        </Text>
                      </View>

                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder={t("Full name")}
                        placeholderTextColor="#A1A1AA"
                        value={formState.name}
                        onChangeText={(value) =>
                          handleFormChange("name", value)
                        }
                        autoCapitalize="words"
                      />
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder={t("Phone number")}
                        placeholderTextColor="#A1A1AA"
                        value={formState.phone}
                        onChangeText={(value) =>
                          handleFormChange("phone", value)
                        }
                        keyboardType="phone-pad"
                      />
                      <TextInput
                        style={[
                          styles.input,
                          styles.multilineInput,
                          isDark && styles.inputDark,
                        ]}
                        placeholder={t("Delivery address")}
                        placeholderTextColor="#A1A1AA"
                        value={formState.address}
                        onChangeText={(value) =>
                          handleFormChange("address", value)
                        }
                        multiline
                      />
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder={t("Birthday (YYYY-MM-DD)")}
                        placeholderTextColor="#A1A1AA"
                        value={formState.birthday}
                        onChangeText={(value) =>
                          handleFormChange("birthday", value)
                        }
                        keyboardType="numbers-and-punctuation"
                      />

                      {formError && (
                        <View style={styles.errorBanner}>
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color="#DC2626"
                          />
                          <Text style={styles.errorBannerText}>
                            {formError}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.formSubmitButton,
                          saving && styles.formSubmitButtonDisabled,
                        ]}
                        onPress={
                          selectedCustomer
                            ? handleEditCustomer
                            : handleSaveCustomer
                        }
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.formSubmitButtonText}>
                            {selectedCustomer
                              ? t("Update & Continue")
                              : t("Save Customer & Next")}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {selectedCustomer && (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => {
                            setShowNewCustomerForm(false);
                            setFormError("");
                          }}
                        >
                          <Text style={styles.cancelButtonText}>
                            {t("Cancel")}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  containerHighContrast: {
    backgroundColor: "#000000",
  },

  header: {
    paddingTop: 60,
    paddingBottom: 22,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },

  content: {
    padding: 24,
    paddingBottom: 160,
  },

  primaryButton: {
    backgroundColor: "#C53030",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C53030",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  primaryButtonDark: {
    shadowColor: "#000",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  modalPrimaryButton: {
    marginTop: 12,
  },

  statusText: {
    marginTop: 16,
    fontSize: 14,
    color: "#15803D",
  },

  summaryCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryCardDark: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryLabelDark: {
    color: "#94A3B8",
  },
  summaryName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 4,
  },
  summaryNameDark: {
    color: "#F9FAFB",
  },
  summaryMeta: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 4,
  },
  summaryMetaDark: {
    color: "#D1D5DB",
  },

  infoText: {
    marginTop: 20,
    fontSize: 13,
    color: "#6B7280",
  },
  infoTextDark: {
    color: "#D1D5DB",
  },
  selectedCustomerTag: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 6,
  },
  selectedCustomerTagDark: {
    color: "#CBD5F5",
  },
  paymentPrompt: {
    fontSize: 13,
    color: "#B91C1C",
    marginTop: 4,
  },
  paymentPromptDark: {
    color: "#FECACA",
  },
  customerAddressTag: {
    marginTop: 4,
    fontSize: 13,
    color: "#4B5563",
  },
  customerAddressTagDark: {
    color: "#CBD5F5",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  modalContentDark: {
    backgroundColor: "#020617",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalTitleDark: {
    color: "#F9FAFB",
  },
  modalClose: {
    color: "#EF4444",
    fontWeight: "600",
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  modalWrapperCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalContentCenter: {
    width: "100%",
    maxHeight: "75%",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },

  section: {
    marginBottom: 24,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  inputDark: {
    borderColor: "#1F2937",
    backgroundColor: "#111827",
    color: "#F9FAFB",
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },

  searchLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  searchLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#6B7280",
  },

  customerRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerRowActive: {
    borderColor: "#C53030",
    backgroundColor: "#FEF2F2",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  customerPhone: {
    fontSize: 13,
    color: "#6B7280",
  },
  customerMeta: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  secondaryButton: {
    marginBottom: 14,
    backgroundColor: "#F3F4F6",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },

  paymentSection: {
    marginTop: 18,
  },
  paymentButtons: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 4,
  },
  paymentChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  paymentChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  paymentChipText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 14,
  },
  paymentChipActiveText: {
    color: "#fff",
  },
  addCustomerButton: {
    marginTop: 18,
  },

  errorText: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 6,
  },

  /* STEP INDICATORS */
  stepsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  stepsContainerDark: {
    borderBottomColor: "#1F2937",
  },
  step: {
    alignItems: "center",
    flex: 1,
  },
  stepActive: {
    opacity: 1,
  },
  stepInactive: {
    opacity: 0.5,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepNumberText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  stepLabelDark: {
    color: "#F9FAFB",
  },
  stepConnector: {
    height: 2,
    backgroundColor: "#E5E7EB",
    flex: 1,
    marginHorizontal: 4,
  },
  stepConnectorDark: {
    backgroundColor: "#1F2937",
  },

  /* SECTION HEADERS */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  sectionLabelDark: {
    color: "#F9FAFB",
  },

  /* CUSTOMER SELECTION */
  customerCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  customerCardDark: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },
  customerCardActive: {
    borderColor: "#4F46E5",
    backgroundColor: "#F3F4FF",
  },
  customerCardActiveDark: {
    backgroundColor: "#1E3A8A",
    borderColor: "#4F46E5",
  },
  customerCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerCardLeft: {
    marginRight: 12,
  },
  customerCardDetails: {
    flex: 1,
  },
  customerCardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  customerCardNameDark: {
    color: "#F9FAFB",
  },
  customerCardPhone: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  customerCardPhoneDark: {
    color: "#D1D5DB",
  },
  customerCardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  customerCardMetaDark: {
    color: "#9CA3AF",
  },

  /* SUCCESS/WARNING BANNERS */
  selectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  selectedBannerDark: {
    backgroundColor: "#064E3B",
    borderColor: "#10B981",
  },
  selectedBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#15803D",
    marginLeft: 8,
  },
  editLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F46E5",
  },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  successBannerDark: {
    backgroundColor: "#064E3B",
    borderColor: "#10B981",
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#15803D",
    marginLeft: 8,
  },
  successBannerTextDark: {
    color: "#86EFAC",
  },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  warningBannerDark: {
    backgroundColor: "#78350F",
    borderColor: "#F59E0B",
  },
  warningBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D97706",
    marginLeft: 8,
  },
  warningBannerTextDark: {
    color: "#FCD34D",
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
    marginLeft: 8,
  },

  infoBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoBoxText: {
    fontSize: 13,
    color: "#1E40AF",
  },

  /* LOADING */
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },

  /* PAYMENT GRID */
  paymentSectionEnhanced: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paymentSectionEnhancedDark: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
  },
  paymentCard: {
    width: "48%",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  paymentCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  paymentCardActive: {
    borderColor: "#4F46E5",
    backgroundColor: "#F3F4FF",
  },
  paymentCardActiveDark: {
    backgroundColor: "#1E3A8A",
    borderColor: "#4F46E5",
  },
  paymentCardContent: {
    alignItems: "center",
    width: "100%",
  },
  paymentCardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  paymentCardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  paymentCardLabelDark: {
    color: "#F9FAFB",
  },
  paymentCardLabelActive: {
    color: "#4F46E5",
  },
  paymentCheckmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },

  /* BUTTONS */
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4FF",
    borderWidth: 2,
    borderColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  addButtonDark: {
    backgroundColor: "#1F2937",
    borderColor: "#4F46E5",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
    marginLeft: 8,
  },

  formSubmitButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  formSubmitButtonDisabled: {
    opacity: 0.6,
  },
  formSubmitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  cancelButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 15,
  },
});
