import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { usePermissions } from "../../src/context/PermissionsContext";
import secureFetch from "../../src/api/secureFetch";
import { PermissionGate } from "../../src/components/PermissionGate";

type Task = {
  id: string | number;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed";
  priority?: "high" | "medium" | "low";
  assigned_to?: string | number;
  assigned_to_name?: string;
  due_at?: string;
  created_at?: string;
  updated_at?: string;
};

type Staff = {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
};

const DEFAULT_AVATAR =
  "https://www.pngkey.com/png/full/115-1150152_default-profile-picture-avatar-png-green.png";

const getAvatar = (url?: string) => {
  if (!url) return DEFAULT_AVATAR;
  if (url.startsWith("http://localhost") || url.startsWith("/uploads/"))
    return DEFAULT_AVATAR;
  if (url.startsWith("http")) return url;
  return DEFAULT_AVATAR;
};

export default function TasksScreen() {
  const { isDark } = useAppearance();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "todo" | "in_progress" | "completed"
  >("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");

  // Form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigned_to_name: "",
    due_at: "",
    priority: "medium" as const,
  });

  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  // Fetch tasks and staff
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, staffData] = await Promise.all([
        secureFetch("/tasks").catch(() => []),
        secureFetch("/staff").catch(() => []),
      ]);

      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setStaffList(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      console.error("❌ Failed to load tasks:", err);
      Alert.alert(t("Error"), t("Failed to load tasks"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add task
  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      Alert.alert(t("Error"), t("Task title is required"));
      return;
    }

    try {
      const payload = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        assigned_to_name: newTask.assigned_to_name || undefined,
        due_at: newTask.due_at
          ? new Date(newTask.due_at).toISOString()
          : undefined,
        priority: newTask.priority,
      };

      const created = await secureFetch("/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTasks((prev) => [created, ...prev]);
      setNewTask({
        title: "",
        description: "",
        assigned_to_name: "",
        due_at: "",
        priority: "medium",
      });
      setModalOpen(false);
      Alert.alert(t("Success"), t("Task created"));
    } catch (err) {
      console.error("❌ Failed to create task:", err);
      Alert.alert(t("Error"), t("Failed to create task"));
    }
  };

  // Start task
  const handleStartTask = async (id: string | number) => {
    try {
      const updated = await secureFetch(`/tasks/${id}/start`, {
        method: "PATCH",
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      Alert.alert(t("Success"), t("Task started"));
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(t("Error"), t("Failed to start task"));
    }
  };

  // Complete task
  const handleCompleteTask = async (id: string | number) => {
    try {
      const updated = await secureFetch(`/tasks/${id}/complete`, {
        method: "PATCH",
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      Alert.alert(t("Success"), t("Task completed"));
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(t("Error"), t("Failed to complete task"));
    }
  };

  // Update task
  const handleSaveEdit = async (id: string | number) => {
    try {
      const updated = await secureFetch(`/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify(editedTask),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingTaskId(null);
      setEditedTask({});
      Alert.alert(t("Success"), t("Task updated"));
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(t("Error"), t("Failed to update task"));
    }
  };

  // Delete task
  const handleDeleteTask = async (id: string | number) => {
    Alert.alert(t("Delete Task"), t("Are you sure?"), [
      { text: t("Cancel") },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await secureFetch(`/tasks/${id}`, { method: "DELETE" });
            setTasks((prev) => prev.filter((t) => t.id !== id));
            Alert.alert(t("Success"), t("Task deleted"));
          } catch (err) {
            console.error("❌ Failed:", err);
            Alert.alert(t("Error"), t("Failed to delete task"));
          }
        },
      },
    ]);
  };

  // Clear completed
  const handleClearCompleted = async () => {
    Alert.alert(t("Clear Completed"), t("Delete all completed tasks?"), [
      { text: t("Cancel") },
      {
        text: t("Clear"),
        style: "destructive",
        onPress: async () => {
          try {
            await secureFetch("/tasks/clear-completed", {
              method: "DELETE",
            });
            setTasks((prev) => prev.filter((t) => t.status !== "completed"));
            Alert.alert(t("Success"), t("Completed tasks cleared"));
          } catch (err) {
            console.error("❌ Failed:", err);
            Alert.alert(t("Error"), t("Failed to clear tasks"));
          }
        },
      },
    ]);
  };

  // Filter logic
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      !searchTerm.trim() ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;

    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Stats
  const totalCount = tasks.length;
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress"
  ).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#06B6D4" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading tasks...")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <PermissionGate permission={["orders", "staff"]}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, isDark && styles.headerTitleDark]}
            >
              ✅ {t("Task Hub")}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {t("Manage team tasks")}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("Total")}
              </Text>
              <Text style={styles.statValue}>{totalCount}</Text>
            </View>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>📝</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("To Do")}
              </Text>
              <Text style={styles.statValue}>{todoCount}</Text>
            </View>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>⚙️</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("In Progress")}
              </Text>
              <Text style={styles.statValue}>{inProgressCount}</Text>
            </View>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>✔️</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("Done")}
              </Text>
              <Text style={styles.statValue}>{completedCount}</Text>
            </View>
          </View>

          {/* Search and Filters */}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={18}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
              <TextInput
                style={[styles.searchInput, isDark && styles.searchInputDark]}
                placeholder={t("Search tasks...")}
                placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>

            {/* Filter buttons */}
            <View style={styles.filterRow}>
              {(["all", "todo", "in_progress", "completed"] as const).map(
                (status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterButton,
                      statusFilter === status && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        statusFilter === status &&
                          styles.filterButtonTextActive,
                      ]}
                    >
                      {t(status === "all" ? "All" : status.replace("_", " "))}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <View style={styles.filterRow}>
              {(["all", "high", "medium", "low"] as const).map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.filterButton,
                    priorityFilter === priority && styles.filterButtonActive,
                  ]}
                  onPress={() => setPriorityFilter(priority as any)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      priorityFilter === priority &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    {t(priority === "all" ? "All" : priority)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setModalOpen(true)}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.addButtonText}>{t("Add Task")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearCompleted}
              >
                <Ionicons name="trash" size={18} color="#EF4444" />
                <Text style={styles.clearButtonText}>{t("Clear")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                {t("No tasks found")}
              </Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {filteredTasks.map((task) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    isDark && styles.taskCardDark,
                    editingTaskId === task.id && styles.taskCardEditing,
                  ]}
                >
                  {editingTaskId === task.id ? (
                    <View style={styles.editForm}>
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        value={editedTask.title || ""}
                        onChangeText={(v) =>
                          setEditedTask({ ...editedTask, title: v })
                        }
                        placeholder={t("Title")}
                      />
                      <TextInput
                        style={[
                          styles.input,
                          styles.inputMultiline,
                          isDark && styles.inputDark,
                        ]}
                        value={editedTask.description || ""}
                        onChangeText={(v) =>
                          setEditedTask({ ...editedTask, description: v })
                        }
                        placeholder={t("Description")}
                        multiline
                        numberOfLines={2}
                      />

                      <View style={styles.editFormButtons}>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={() => handleSaveEdit(task.id)}
                        >
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color="#FFFFFF"
                          />
                          <Text style={styles.saveButtonText}>{t("Save")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => {
                            setEditingTaskId(null);
                            setEditedTask({});
                          }}
                        >
                          <Ionicons name="close" size={16} color="#6B7280" />
                          <Text style={styles.cancelButtonText}>
                            {t("Cancel")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.taskHeader}>
                        <View style={styles.taskInfo}>
                          <Text
                            style={[
                              styles.taskTitle,
                              isDark && styles.taskTitleDark,
                            ]}
                            numberOfLines={1}
                          >
                            {task.title}
                          </Text>
                          {task.description && (
                            <Text
                              style={[
                                styles.taskDescription,
                                isDark && styles.taskDescriptionDark,
                              ]}
                              numberOfLines={1}
                            >
                              {task.description}
                            </Text>
                          )}
                        </View>

                        <View
                          style={[
                            styles.priorityBadge,
                            task.priority === "high" && styles.priorityHigh,
                            task.priority === "medium" && styles.priorityMedium,
                            task.priority === "low" && styles.priorityLow,
                          ]}
                        >
                          <Text style={styles.priorityText}>
                            {task.priority?.[0].toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {task.assigned_to_name && (
                        <Text
                          style={[
                            styles.assignee,
                            isDark && styles.assigneeDark,
                          ]}
                        >
                          👤 {task.assigned_to_name}
                        </Text>
                      )}

                      {task.due_at && (
                        <Text
                          style={[styles.dueDate, isDark && styles.dueDateDark]}
                        >
                          📅 {new Date(task.due_at).toLocaleDateString()}
                        </Text>
                      )}

                      <View style={styles.statusBadge}>
                        <Text
                          style={[
                            styles.statusText,
                            task.status === "todo" && styles.statusTodoText,
                            task.status === "in_progress" &&
                              styles.statusProgressText,
                            task.status === "completed" &&
                              styles.statusCompletedText,
                          ]}
                        >
                          {t(task.status.replace("_", " "))}
                        </Text>
                      </View>

                      <View style={styles.taskActions}>
                        {task.status === "todo" && (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleStartTask(task.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              ▶️ {t("Start")}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {task.status === "in_progress" && (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleCompleteTask(task.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              ✅ {t("Done")}
                            </Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => {
                            setEditingTaskId(task.id);
                            setEditedTask(task);
                          }}
                        >
                          <Text style={styles.editButtonText}>✏️</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteTask(task.id)}
                        >
                          <Text style={styles.deleteButtonText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Add Task Modal */}
        <Modal
          visible={modalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setModalOpen(false)}
        >
          <View
            style={[styles.modalContainer, isDark && styles.modalContainerDark]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, isDark && styles.modalTitleDark]}
              >
                {t("Add New Task")}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Task Title *")}
                value={newTask.title}
                onChangeText={(v) => setNewTask({ ...newTask, title: v })}
              />

              <TextInput
                style={[
                  styles.input,
                  styles.inputMultiline,
                  isDark && styles.inputDark,
                ]}
                placeholder={t("Description")}
                value={newTask.description}
                onChangeText={(v) => setNewTask({ ...newTask, description: v })}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Priority")}
              </Text>
              <View style={styles.priorityOptions}>
                {(["high", "medium", "low"] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      newTask.priority === p && styles.priorityOptionSelected,
                    ]}
                    onPress={() => setNewTask({ ...newTask, priority: p })}
                  >
                    <Text
                      style={[
                        styles.priorityOptionText,
                        newTask.priority === p &&
                          styles.priorityOptionTextSelected,
                      ]}
                    >
                      {t(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Assign To")}
              </Text>
              <View style={styles.staffOptions}>
                {staffList.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={[
                      styles.staffOption,
                      newTask.assigned_to_name === staff.name &&
                        styles.staffOptionSelected,
                    ]}
                    onPress={() =>
                      setNewTask({ ...newTask, assigned_to_name: staff.name })
                    }
                  >
                    <Image
                      source={{ uri: getAvatar(staff.avatar) }}
                      style={styles.staffOptionAvatar}
                    />
                    <Text
                      style={[
                        styles.staffOptionText,
                        newTask.assigned_to_name === staff.name &&
                          styles.staffOptionTextSelected,
                      ]}
                    >
                      {staff.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={handleAddTask}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.addTaskButtonText}>{t("Create Task")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <BottomNav />
      </View>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F7",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  loadingTextDark: {
    color: "#9CA3AF",
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerTitleDark: {
    color: "#F3F4F6",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  statLabelDark: {
    color: "#9CA3AF",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: "#1F2937",
  },
  searchInputDark: {
    color: "#F3F4F6",
    backgroundColor: "#111827",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  filterButtonActive: {
    backgroundColor: "#06B6D4",
    borderColor: "#06B6D4",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  addButton: {
    flex: 1,
    backgroundColor: "#06B6D4",
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
  },
  clearButtonText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  taskCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  taskCardEditing: {
    borderColor: "#06B6D4",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  taskTitleDark: {
    color: "#F3F4F6",
  },
  taskDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  taskDescriptionDark: {
    color: "#9CA3AF",
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#FEE2E2",
  },
  priorityHigh: {
    backgroundColor: "#FEE2E2",
  },
  priorityMedium: {
    backgroundColor: "#FEF3C7",
  },
  priorityLow: {
    backgroundColor: "#DBEAFE",
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  assignee: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  assigneeDark: {
    color: "#9CA3AF",
  },
  dueDate: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  dueDateDark: {
    color: "#9CA3AF",
  },
  statusBadge: {
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#EEF2FF",
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4F46E5",
  },
  statusTodoText: {
    color: "#6B7280",
  },
  statusProgressText: {
    color: "#06B6D4",
  },
  statusCompletedText: {
    color: "#10B981",
  },
  taskActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0369A1",
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 13,
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 13,
  },
  editForm: {
    gap: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1F2937",
    marginBottom: 8,
  },
  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },
  inputMultiline: {
    height: 60,
    textAlignVertical: "top",
  },
  editFormButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 20,
  },
  modalContainerDark: {
    backgroundColor: "#1F2937",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalTitleDark: {
    color: "#F3F4F6",
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 8,
  },
  labelDark: {
    color: "#D1D5DB",
  },
  priorityOptions: {
    flexDirection: "row",
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  priorityOptionSelected: {
    backgroundColor: "#06B6D4",
    borderColor: "#06B6D4",
  },
  priorityOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  priorityOptionTextSelected: {
    color: "#FFFFFF",
  },
  staffOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  staffOption: {
    width: "31%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  staffOptionSelected: {
    backgroundColor: "#DBEAFE",
    borderColor: "#06B6D4",
  },
  staffOptionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  staffOptionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  staffOptionTextSelected: {
    color: "#06B6D4",
  },
  addTaskButton: {
    backgroundColor: "#06B6D4",
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  addTaskButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
