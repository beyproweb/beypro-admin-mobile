import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  FlatList,
  Image,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { useAuth } from "../../src/context/AuthContext";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../../src/hooks/usePermissions";
import secureFetch from "../../src/utils/secureFetch";
import { useRouter } from "expo-router";
import BottomNav from "../../src/components/navigation/BottomNav";

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
const API_BASE_URL =
  expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://hurrypos-backend.onrender.com/api";

const ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

type MaintenanceIssue = {
  id: number;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  assigned_to?: number;
  photo_url?: string;
  created_at: string;
  resolved_at?: string;
};

type Staff = {
  id: number;
  name: string;
};

export default function MaintenanceTracker() {
  const { user } = useAuth();
  const { isDark, fontScale } = useAppearance();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const router = useRouter();

  const socketRef = useRef<Socket | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "medium",
  });

  const canAccess = hasPermission("maintenance");

  // Load data
  const loadData = useCallback(async () => {
    if (!canAccess) return;
    try {
      const [issueList, staffList] = await Promise.all([
        secureFetch("/maintenance"),
        secureFetch("/staff"),
      ]);
      setIssues(Array.isArray(issueList) ? issueList : []);
      setStaff(Array.isArray(staffList) ? staffList : []);
    } catch (err) {
      console.error("Failed to load maintenance data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canAccess]);

  // Initial load and socket setup
  useFocusEffect(
    useCallback(() => {
      loadData();

      // Setup socket connection
      const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");
      if (!socketRef.current) {
        socketRef.current = io(SOCKET_URL, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });
      }

      const socket = socketRef.current;

      // Socket listeners
      socket.on("maintenance_created", (row: MaintenanceIssue) =>
        setIssues((p) => [row, ...p])
      );
      socket.on("maintenance_updated", (row: MaintenanceIssue) =>
        setIssues((p) => p.map((it) => (it.id === row.id ? row : it)))
      );
      socket.on("maintenance_deleted", ({ id }) =>
        setIssues((p) => p.filter((it) => it.id !== id))
      );

      return () => {
        socket.off("maintenance_created");
        socket.off("maintenance_updated");
        socket.off("maintenance_deleted");
      };
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Submit issue
  const submitIssue = async () => {
    if (!form.title.trim()) {
      Alert.alert(t("Error"), t("Please enter an issue title"));
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: form.title.trim(),
        description: form.description || "",
        priority: form.priority || "medium",
        ...(form.assigned_to && {
          assigned_to: parseInt(form.assigned_to, 10),
        }),
      };

      await secureFetch("/maintenance", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setForm({
        title: "",
        description: "",
        assigned_to: "",
        priority: "medium",
      });
    } catch (err) {
      Alert.alert(t("Error"), t("Failed to create issue"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const startIssue = async (id: number) => {
    try {
      const row = await secureFetch(`/maintenance/${id}/start`, {
        method: "PATCH",
      });
      setIssues((p) => p.map((it) => (it.id === id ? row : it)));
    } catch (err) {
      Alert.alert(t("Error"), t("Failed to start issue"));
    }
  };

  const resolveIssue = async (id: number) => {
    try {
      const row = await secureFetch(`/maintenance/${id}/resolve`, {
        method: "PATCH",
      });
      setIssues((p) => p.map((it) => (it.id === id ? row : it)));
    } catch (err) {
      Alert.alert(t("Error"), t("Failed to resolve issue"));
    }
  };

  const deleteIssue = async (id: number) => {
    Alert.alert(
      t("Confirm Delete"),
      t("Are you sure you want to delete this issue?"),
      [
        { text: t("Cancel"), onPress: () => {}, style: "cancel" },
        {
          text: t("Delete"),
          onPress: async () => {
            try {
              await secureFetch(`/maintenance/${id}`, { method: "DELETE" });
              setIssues((p) => p.filter((it) => it.id !== id));
            } catch (err) {
              Alert.alert(t("Error"), t("Failed to delete issue"));
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const quickAssign = async (id: number, assigned_to: string) => {
    try {
      const row = await secureFetch(`/maintenance/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          assigned_to: assigned_to ? parseInt(assigned_to, 10) : null,
        }),
      });
      setIssues((p) => p.map((it) => (it.id === id ? row : it)));
    } catch (err) {
      Alert.alert(t("Error"), t("Failed to assign issue"));
    }
  };

  // Filter
  const filtered = useMemo(() => {
    return issues.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      const hay = `${it.title ?? ""} ${it.description ?? ""}`.toLowerCase();
      return !search || hay.includes(search.toLowerCase());
    });
  }, [issues, statusFilter, search]);

  if (!canAccess) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <ScrollView
          contentContainerStyle={styles.centerContent}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => {}} />
          }
        >
          <Text style={[styles.errorText, { fontSize: 16 * fontScale }]}>
            {t(
              "Access Denied: You do not have permission to view Maintenance Tracker."
            )}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    open: { bg: "#FEE2E2", text: "#991B1B" },
    in_progress: { bg: "#FEF3C7", text: "#92400E" },
    resolved: { bg: "#DCFCE7", text: "#15803D" },
  };

  const statusIcons: { [key: string]: string } = {
    open: "🕐",
    in_progress: "⏳",
    resolved: "✅",
  };

  return (
    <View style={[styles.mainContainer, isDark && styles.mainContainerDark]}>
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { fontSize: 24 * fontScale, color: isDark ? "#fff" : "#000" },
              ]}
            >
              🔧 {t("Maintenance")}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { fontSize: 13 * fontScale, color: isDark ? "#aaa" : "#666" },
              ]}
            >
              {t("Track & resolve issues fast")}
            </Text>
          </View>

          {/* Filters */}
          <View style={styles.filtersContainer}>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                isDark && styles.filterBtnDark,
                statusFilter === "all" && styles.filterBtnActive,
              ]}
              onPress={() => setStatusFilter("all")}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  statusFilter === "all" && styles.filterBtnTextActive,
                ]}
              >
                {t("All")}
              </Text>
            </TouchableOpacity>
            {["open", "in_progress", "resolved"].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterBtn,
                  isDark && styles.filterBtnDark,
                  statusFilter === status && styles.filterBtnActive,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    statusFilter === status && styles.filterBtnTextActive,
                  ]}
                >
                  {statusIcons[status]} {status.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search */}
          <View
            style={[
              styles.searchContainer,
              isDark && styles.searchContainerDark,
            ]}
          >
            <TextInput
              style={[styles.searchInput, { fontSize: 13 * fontScale }]}
              placeholder={t("Search…")}
              placeholderTextColor={isDark ? "#888" : "#aaa"}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Add button */}
          <TouchableOpacity
            style={[styles.addBtn, showForm && styles.addBtnActive]}
            onPress={() => setShowForm(!showForm)}
          >
            <Text style={[styles.addBtnText, { fontSize: 14 * fontScale }]}>
              {showForm ? "✕ Cancel" : "+ Add Issue"}
            </Text>
          </TouchableOpacity>

          {/* Form */}
          {showForm && (
            <View style={[styles.form, isDark && styles.formDark]}>
              <TextInput
                style={[styles.input, { fontSize: 13 * fontScale }]}
                placeholder={t("Issue title")}
                placeholderTextColor={isDark ? "#888" : "#aaa"}
                value={form.title}
                onChangeText={(txt) => setForm((f) => ({ ...f, title: txt }))}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { fontSize: 13 * fontScale },
                ]}
                placeholder={t("Description")}
                placeholderTextColor={isDark ? "#888" : "#aaa"}
                multiline
                numberOfLines={3}
                value={form.description}
                onChangeText={(txt) =>
                  setForm((f) => ({ ...f, description: txt }))
                }
              />
              <View style={styles.formRow}>
                <TouchableOpacity
                  style={[
                    styles.priorityBtn,
                    form.priority === "low" && styles.priorityBtnActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, priority: "low" }))}
                >
                  <Text style={styles.priorityBtnText}>Low</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.priorityBtn,
                    form.priority === "medium" && styles.priorityBtnActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, priority: "medium" }))}
                >
                  <Text style={styles.priorityBtnText}>Med</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.priorityBtn,
                    form.priority === "high" && styles.priorityBtnActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, priority: "high" }))}
                >
                  <Text style={styles.priorityBtnText}>High</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={submitIssue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[styles.submitBtnText, { fontSize: 14 * fontScale }]}
                  >
                    {t("Submit Issue")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Issues List */}
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator
                size="large"
                color={isDark ? "#4f46e5" : "#6366f1"}
              />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.centerContent}>
              <Text
                style={[
                  styles.emptyText,
                  { fontSize: 14 * fontScale, color: isDark ? "#999" : "#ccc" },
                ]}
              >
                {t("No issues found")}
              </Text>
            </View>
          ) : (
            <View style={styles.issuesList}>
              {filtered.map((issue) => {
                const assignee = staff.find((s) => s.id === issue.assigned_to);
                const colors = statusColors[issue.status] || statusColors.open;

                return (
                  <View
                    key={issue.id}
                    style={[styles.issueCard, isDark && styles.issueCardDark]}
                  >
                    {/* Status & Title */}
                    <View style={styles.issueHeader}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: colors.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: colors.text, fontSize: 11 * fontScale },
                          ]}
                        >
                          {statusIcons[issue.status]}{" "}
                          {issue.status.replace("_", " ")}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.issueTitle,
                          {
                            fontSize: 14 * fontScale,
                            color: isDark ? "#fff" : "#000",
                          },
                        ]}
                      >
                        {issue.title}
                      </Text>
                    </View>

                    {/* Description */}
                    {issue.description && (
                      <Text
                        style={[
                          styles.issueDesc,
                          {
                            fontSize: 12 * fontScale,
                            color: isDark ? "#aaa" : "#666",
                          },
                        ]}
                      >
                        {issue.description}
                      </Text>
                    )}

                    {/* Photo */}
                    {issue.photo_url && (
                      <Image
                        source={{ uri: `${ORIGIN}${issue.photo_url}` }}
                        style={styles.issuePhoto}
                      />
                    )}

                    {/* Meta */}
                    <View style={styles.issueMeta}>
                      <Text
                        style={[
                          styles.metaText,
                          {
                            fontSize: 11 * fontScale,
                            color: isDark ? "#999" : "#999",
                          },
                        ]}
                      >
                        Priority:{" "}
                        <Text style={{ fontWeight: "600" }}>
                          {issue.priority}
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.metaText,
                          {
                            fontSize: 11 * fontScale,
                            color: isDark ? "#999" : "#999",
                          },
                        ]}
                      >
                        {new Date(issue.created_at).toLocaleString()}
                      </Text>
                    </View>

                    {/* Assign & Actions */}
                    <View style={styles.issueActions}>
                      <View style={styles.assignContainer}>
                        <Text
                          style={[
                            styles.assignLabel,
                            { fontSize: 11 * fontScale },
                          ]}
                        >
                          {t("Assign")}:
                        </Text>
                        {/* Assign picker - simplified for mobile */}
                        <TouchableOpacity
                          onPress={() => {
                            // In a real app, use a picker modal
                            Alert.alert(t("Assign to staff"), "", [
                              {
                                text: t("Cancel"),
                                onPress: () => {},
                                style: "cancel",
                              },
                              {
                                text: t("Unassigned"),
                                onPress: () => quickAssign(issue.id, ""),
                              },
                              ...staff.map((s) => ({
                                text: s.name,
                                onPress: () =>
                                  quickAssign(issue.id, String(s.id)),
                              })),
                            ]);
                          }}
                        >
                          <Text
                            style={[
                              styles.assignValue,
                              { fontSize: 11 * fontScale },
                            ]}
                          >
                            {assignee?.name || "Unassigned"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.actionButtons}>
                        {issue.status === "open" && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => startIssue(issue.id)}
                          >
                            <Text
                              style={[
                                styles.actionBtnText,
                                { fontSize: 11 * fontScale },
                              ]}
                            >
                              ▶ Start
                            </Text>
                          </TouchableOpacity>
                        )}
                        {issue.status !== "resolved" && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => resolveIssue(issue.id)}
                          >
                            <Text
                              style={[
                                styles.actionBtnText,
                                { fontSize: 11 * fontScale },
                              ]}
                            >
                              ✓ Resolve
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.actionBtnDelete}
                          onPress={() => deleteIssue(issue.id)}
                        >
                          <Text
                            style={[
                              styles.actionBtnDeleteText,
                              { fontSize: 11 * fontScale },
                            ]}
                          >
                            🗑 Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
      <BottomNav />
    </View>
  );
}

const styles = {
  mainContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  } as any,
  mainContainerDark: {
    backgroundColor: "#0a0a0a",
  } as any,
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  } as any,
  containerDark: {
    backgroundColor: "#1a1a1a",
  } as any,
  centerContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  } as any,
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  } as any,
  title: {
    fontWeight: "700",
    marginBottom: 4,
  } as any,
  subtitle: {
    fontWeight: "400",
  } as any,
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  } as any,
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  } as any,
  filterBtnDark: {
    backgroundColor: "#333",
    borderColor: "#555",
  } as any,
  filterBtnActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  } as any,
  filterBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  } as any,
  filterBtnTextActive: {
    color: "#fff",
  } as any,
  searchContainer: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  } as any,
  searchContainerDark: {
    backgroundColor: "#333",
    borderColor: "#555",
  } as any,
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#000",
  } as any,
  addBtn: {
    marginHorizontal: 12,
    marginVertical: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#6366f1",
    alignItems: "center",
  } as any,
  addBtnActive: {
    backgroundColor: "#dc2626",
  } as any,
  addBtnText: {
    fontWeight: "600",
    color: "#fff",
  } as any,
  form: {
    marginHorizontal: 12,
    marginVertical: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    gap: 10,
  } as any,
  formDark: {
    backgroundColor: "#333",
  } as any,
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f9f9f9",
    color: "#000",
  } as any,
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  } as any,
  formRow: {
    flexDirection: "row",
    gap: 8,
  } as any,
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  } as any,
  priorityBtnActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  } as any,
  priorityBtnText: {
    fontWeight: "600",
    color: "#000",
    fontSize: 12,
  } as any,
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#059669",
    alignItems: "center",
  } as any,
  submitBtnDisabled: {
    opacity: 0.6,
  } as any,
  submitBtnText: {
    fontWeight: "600",
    color: "#fff",
  } as any,
  issuesList: {
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 12,
  } as any,
  issueCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  } as any,
  issueCardDark: {
    backgroundColor: "#333",
  } as any,
  issueHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  } as any,
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 70,
  } as any,
  statusBadgeText: {
    fontWeight: "600",
  } as any,
  issueTitle: {
    flex: 1,
    fontWeight: "600",
  } as any,
  issueDesc: {
    marginTop: 4,
  } as any,
  issuePhoto: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginVertical: 4,
  } as any,
  issueMeta: {
    gap: 4,
  } as any,
  metaText: {
    fontWeight: "400",
  } as any,
  issueActions: {
    gap: 8,
    marginTop: 8,
  } as any,
  assignContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as any,
  assignLabel: {
    fontWeight: "600",
    color: "#666",
  } as any,
  assignValue: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    color: "#000",
    fontWeight: "500",
  } as any,
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  } as any,
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#dbeafe",
  } as any,
  actionBtnText: {
    fontWeight: "600",
    color: "#0369a1",
  } as any,
  actionBtnDelete: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  } as any,
  actionBtnDeleteText: {
    fontWeight: "600",
    color: "#991b1b",
  } as any,
  errorText: {
    color: "#991b1b",
    textAlign: "center",
  } as any,
  emptyText: {
    textAlign: "center",
  } as any,
};
