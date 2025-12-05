import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Switch,
  FlatList,
  Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import secureFetch from "../../src/api/secureFetch";

type Staff = {
  id: number | string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  pin?: string;
  salary?: number;
  avatar?: string;
};

type NewStaff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  pin: string;
  salary: string;
  avatar: string;
};

type UsersConfig = {
  roles: Record<string, string[]>;
  pinRequired: boolean;
  allowedWifiIps: string[];
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

const isValidIp = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
  const ipv6 = /^[0-9a-fA-F:.]+$/;
  return ipv4.test(trimmed) || ipv6.test(trimmed);
};

export default function UserManagementSettings() {
  const { isDark } = useAppearance();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Staff Management
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editedStaff, setEditedStaff] = useState<Partial<Staff>>({});
  const [newStaffModalOpen, setNewStaffModalOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewStaff>({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    role: "cashier",
    pin: "",
    salary: "",
    avatar: "",
  });

  // Configuration
  const [usersConfig, setUsersConfig] = useState<UsersConfig>({
    roles: {
      admin: ["all"],
      cashier: ["orders", "payments"],
      driver: ["delivery"],
    },
    pinRequired: true,
    allowedWifiIps: [],
  });

  const [allowedIpInput, setAllowedIpInput] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedRoleForCopy, setSelectedRoleForCopy] = useState("");
  const [newRoleModalOpen, setNewRoleModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const STAFF_PER_PAGE = 5;
  const paginatedStaff = staffList.slice(
    currentPage * STAFF_PER_PAGE,
    currentPage * STAFF_PER_PAGE + STAFF_PER_PAGE
  );
  const totalPages = Math.ceil(staffList.length / STAFF_PER_PAGE);

  const roles = Object.keys(usersConfig.roles).map((r) => r.toLowerCase());
  const deletableRoles = roles.filter((role) => role !== "admin");

  // Fetch staff
  const fetchStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const data = await secureFetch("/staff");
      setStaffList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to fetch staff:", err);
      Alert.alert(t("Error"), t("Failed to load staff list"));
    } finally {
      setLoadingStaff(false);
    }
  }, [t]);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await secureFetch("/settings/users");
      if (res) {
        setUsersConfig((prev) => ({
          ...prev,
          ...res,
          roles: res.roles || prev.roles,
          pinRequired:
            typeof res.pinRequired === "boolean"
              ? res.pinRequired
              : prev.pinRequired,
          allowedWifiIps: Array.isArray(res.allowedWifiIps)
            ? res.allowedWifiIps
            : prev.allowedWifiIps,
        }));
      }
    } catch (err) {
      console.error("❌ Failed to fetch config:", err);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchConfig();
  }, [fetchStaff, fetchConfig]);

  // Save config
  const saveConfig = useCallback(
    async (data: UsersConfig) => {
      try {
        await secureFetch("/settings/users", {
          method: "POST",
          body: JSON.stringify(data),
        });
        return true;
      } catch (err) {
        console.error("❌ Failed to save config:", err);
        Alert.alert(t("Error"), t("Failed to save settings"));
        return false;
      }
    },
    [t]
  );

  // Handle add staff
  const handleAddUser = async () => {
    const { id, name, role, phone, address, email, pin, salary } = newUser;

    if (
      !id ||
      !name ||
      !email ||
      !phone ||
      !address ||
      !role ||
      !pin ||
      !salary
    ) {
      Alert.alert(t("Error"), t("All fields are required"));
      return;
    }

    try {
      await secureFetch("/staff", {
        method: "POST",
        body: JSON.stringify({
          id: parseInt(id),
          name,
          email,
          phone,
          address,
          role,
          pin,
          salary: parseFloat(salary),
          avatar: newUser.avatar,
          salary_model: "fixed",
          payment_type: "monthly",
          monthly_salary: parseFloat(salary),
        }),
      });

      Alert.alert(t("Success"), t("Staff member added"));
      await fetchStaff();
      setNewStaffModalOpen(false);
      setNewUser({
        id: "",
        name: "",
        email: "",
        phone: "",
        address: "",
        role: "cashier",
        pin: "",
        salary: "",
        avatar: "",
      });
    } catch (err) {
      console.error("❌ Error adding user:", err);
      Alert.alert(t("Error"), t("Failed to add staff member"));
    }
  };

  // Handle edit staff
  const handleEditStaff = async (staff: Staff) => {
    try {
      await secureFetch(`/staff/${staff.id}`, {
        method: "PUT",
        body: JSON.stringify(editedStaff),
      });

      Alert.alert(t("Success"), t("Staff updated"));
      await fetchStaff();
      setEditingStaffId(null);
    } catch (err) {
      console.error("❌ Error updating staff:", err);
      Alert.alert(t("Error"), t("Failed to update staff"));
    }
  };

  // Handle delete staff
  const handleDeleteStaff = async (staffId: string | number) => {
    Alert.alert(
      t("Delete Staff"),
      t(
        "Are you sure you want to delete this staff member? This cannot be undone."
      ),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await secureFetch(`/staff/${staffId}`, { method: "DELETE" });
              Alert.alert(t("Success"), t("Staff deleted"));
              await fetchStaff();
            } catch (err) {
              console.error("❌ Delete failed:", err);
              Alert.alert(t("Error"), t("Failed to delete staff"));
            }
          },
        },
      ]
    );
  };

  // Handle upload avatar
  const handleUploadAvatar = async (setAvatarPath: (path: string) => void) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const formData = new FormData();
        formData.append("file", {
          uri,
          type: "image/jpeg",
          name: `avatar-${Date.now()}.jpg`,
        } as any);

        const res = await secureFetch("/upload", {
          method: "POST",
          body: formData,
        });

        setAvatarPath(res.url);
        Alert.alert(t("Success"), t("Avatar uploaded"));
      }
    } catch (err) {
      console.error("❌ Upload failed:", err);
      Alert.alert(t("Error"), t("Failed to upload image"));
    }
  };

  // Handle add allowed IP
  const handleAddIp = async () => {
    const trimmed = allowedIpInput.trim();
    if (!trimmed) {
      Alert.alert(t("Error"), t("Please enter an IP address"));
      return;
    }

    if (!isValidIp(trimmed)) {
      Alert.alert(t("Error"), t("Enter a valid IPv4 or IPv6 address"));
      return;
    }

    if (usersConfig.allowedWifiIps.includes(trimmed)) {
      Alert.alert(t("Info"), t("This IP is already whitelisted"));
      return;
    }

    const updated = {
      ...usersConfig,
      allowedWifiIps: [...usersConfig.allowedWifiIps, trimmed],
    };

    setUsersConfig(updated);
    const saved = await saveConfig(updated);
    if (saved) {
      Alert.alert(t("Success"), t("IP added to whitelist"));
      setAllowedIpInput("");
    }
  };

  // Handle remove IP
  const handleRemoveIp = async (ip: string) => {
    const updatedIps = usersConfig.allowedWifiIps.filter(
      (entry) => entry !== ip
    );
    const updated = { ...usersConfig, allowedWifiIps: updatedIps };

    setUsersConfig(updated);
    const saved = await saveConfig(updated);
    if (saved) {
      Alert.alert(t("Success"), t("IP removed from whitelist"));
    }
  };

  // Handle create role
  const handleCreateRole = async () => {
    const role = newRoleName.trim().toLowerCase();
    if (usersConfig.roles[role]) {
      Alert.alert(t("Error"), t("Role already exists"));
      return;
    }

    const newPermissions = selectedRoleForCopy
      ? usersConfig.roles[selectedRoleForCopy]
      : [];

    const updated = {
      ...usersConfig,
      roles: {
        ...usersConfig.roles,
        [role]: newPermissions,
      },
    };

    setUsersConfig(updated);
    const saved = await saveConfig(updated);
    if (saved) {
      Alert.alert(t("Success"), `Role '${role}' created`);
      setNewRoleName("");
      setSelectedRoleForCopy("");
      setNewRoleModalOpen(false);
    }
  };

  // Handle delete role
  const handleDeleteRole = async (roleToDelete: string) => {
    if (roleToDelete === "admin") {
      Alert.alert(t("Error"), t("Default roles cannot be deleted"));
      return;
    }

    const isAssigned = staffList.some(
      (s) => s.role?.toLowerCase() === roleToDelete
    );

    if (isAssigned) {
      Alert.alert(t("Error"), t("Role is assigned to staff members"));
      return;
    }

    Alert.alert(t("Delete Role"), t("Are you sure?"), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          const updatedRoles = { ...usersConfig.roles };
          delete updatedRoles[roleToDelete];

          const updated = { ...usersConfig, roles: updatedRoles };
          setUsersConfig(updated);
          const saved = await saveConfig(updated);
          if (saved) {
            Alert.alert(t("Success"), t("Role deleted"));
          }
        },
      },
    ]);
  };

  if (loadingStaff) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading staff...")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            👥 {t("User Management")}
          </Text>
        </View>

        {/* PIN Setting */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.settingRow}>
            <Text
              style={[styles.settingLabel, isDark && styles.settingLabelDark]}
            >
              {t("Require PIN to Login")}
            </Text>
            <Switch
              value={usersConfig.pinRequired}
              onValueChange={async (value) => {
                const updated = { ...usersConfig, pinRequired: value };
                setUsersConfig(updated);
                await saveConfig(updated);
              }}
              trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
              thumbColor={usersConfig.pinRequired ? "#4F46E5" : "#9CA3AF"}
            />
          </View>
        </View>

        {/* Wi-Fi IP Whitelist */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
            🔒 {t("Restrict QR check-ins to Wi-Fi IP")}
          </Text>
          <Text style={[styles.cardDesc, isDark && styles.cardDescDark]}>
            {t("Enter the public IP of your restaurant Wi-Fi for QR check-ins")}
          </Text>

          <View style={styles.ipInputSection}>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("e.g. 203.0.113.45")}
              value={allowedIpInput}
              onChangeText={setAllowedIpInput}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddIp}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{t("Add")}</Text>
            </TouchableOpacity>
          </View>

          {/* IP List */}
          {usersConfig.allowedWifiIps.length > 0 ? (
            <View style={styles.ipList}>
              {usersConfig.allowedWifiIps.map((ip) => (
                <View
                  key={ip}
                  style={[styles.ipTag, isDark && styles.ipTagDark]}
                >
                  <Text
                    style={[styles.ipTagText, isDark && styles.ipTagTextDark]}
                  >
                    {ip}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveIp(ip)}
                    style={styles.removeIpButton}
                  >
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              {t("No Wi-Fi restrictions configured")}
            </Text>
          )}
        </View>

        {/* Staff List */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
              👥 {t("Staff Members")} ({staffList.length})
            </Text>
            <TouchableOpacity
              style={styles.addNewButton}
              onPress={() => setNewStaffModalOpen(true)}
            >
              <Ionicons name="add-circle" size={24} color="#4F46E5" />
            </TouchableOpacity>
          </View>

          {paginatedStaff.length > 0 ? (
            paginatedStaff.map((staff) => (
              <View key={staff.id} style={styles.staffItem}>
                <View style={styles.staffInfo}>
                  <Image
                    source={{ uri: getAvatar(staff.avatar) }}
                    style={styles.staffAvatar}
                  />
                  <View style={styles.staffDetails}>
                    <Text
                      style={[styles.staffName, isDark && styles.staffNameDark]}
                      numberOfLines={1}
                    >
                      {staff.name}
                    </Text>
                    <Text
                      style={[
                        styles.staffEmail,
                        isDark && styles.staffEmailDark,
                      ]}
                      numberOfLines={1}
                    >
                      {staff.email}
                    </Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{staff.role}</Text>
                    </View>
                  </View>
                </View>

                {editingStaffId === String(staff.id) ? (
                  <View style={styles.editForm}>
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      placeholder={t("Name")}
                      value={editedStaff.name || ""}
                      onChangeText={(v) =>
                        setEditedStaff({ ...editedStaff, name: v })
                      }
                    />
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      placeholder={t("Email")}
                      value={editedStaff.email || ""}
                      onChangeText={(v) =>
                        setEditedStaff({ ...editedStaff, email: v })
                      }
                    />
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      placeholder={t("Phone")}
                      value={editedStaff.phone || ""}
                      onChangeText={(v) =>
                        setEditedStaff({ ...editedStaff, phone: v })
                      }
                    />
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      placeholder={t("Address")}
                      value={editedStaff.address || ""}
                      onChangeText={(v) =>
                        setEditedStaff({ ...editedStaff, address: v })
                      }
                    />

                    <View style={styles.editFormButtons}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setEditingStaffId(null)}
                      >
                        <Text style={styles.cancelButtonText}>
                          {t("Cancel")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={() => handleEditStaff(staff)}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>{t("Save")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.staffActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setEditingStaffId(String(staff.id));
                        setEditedStaff(staff);
                      }}
                    >
                      <Ionicons name="pencil" size={18} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteStaff(staff.id)}
                    >
                      <Ionicons name="trash" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              {t("No staff members")}
            </Text>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.pageButton,
                    currentPage === idx && styles.pageButtonActive,
                  ]}
                  onPress={() => setCurrentPage(idx)}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      currentPage === idx && styles.pageButtonTextActive,
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Roles Management */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
              🔐 {t("Roles & Permissions")}
            </Text>
            <TouchableOpacity
              style={styles.addNewButton}
              onPress={() => setNewRoleModalOpen(true)}
            >
              <Ionicons name="add-circle" size={24} color="#4F46E5" />
            </TouchableOpacity>
          </View>

          {roles.map((role) => (
            <View key={role} style={styles.roleItem}>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleName, isDark && styles.roleNameDark]}>
                  {role}
                </Text>
                <Text
                  style={[styles.rolePerms, isDark && styles.rolePermsDark]}
                  numberOfLines={2}
                >
                  {usersConfig.roles[role]?.join(", ") || t("No permissions")}
                </Text>
              </View>
              {role !== "admin" && (
                <TouchableOpacity
                  style={styles.deleteRoleButton}
                  onPress={() => handleDeleteRole(role)}
                >
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add Staff Modal */}
      <Modal
        visible={newStaffModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNewStaffModalOpen(false)}
      >
        <View
          style={[styles.modalContainer, isDark && styles.modalContainerDark]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {t("Add Staff Member")}
            </Text>
            <TouchableOpacity onPress={() => setNewStaffModalOpen(false)}>
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
              placeholder={t("ID")}
              keyboardType="numeric"
              value={newUser.id}
              onChangeText={(v) => setNewUser({ ...newUser, id: v })}
            />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("Full Name")}
              value={newUser.name}
              onChangeText={(v) => setNewUser({ ...newUser, name: v })}
            />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("Email")}
              keyboardType="email-address"
              value={newUser.email}
              onChangeText={(v) => setNewUser({ ...newUser, email: v })}
            />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("Phone")}
              value={newUser.phone}
              onChangeText={(v) => setNewUser({ ...newUser, phone: v })}
            />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("Address")}
              value={newUser.address}
              onChangeText={(v) => setNewUser({ ...newUser, address: v })}
            />

            {/* Role Picker */}
            <View style={styles.pickerSection}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Role")}
              </Text>
              <View style={styles.roleOptions}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      newUser.role === role && styles.roleOptionSelected,
                    ]}
                    onPress={() => setNewUser({ ...newUser, role })}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        newUser.role === role && styles.roleOptionTextSelected,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("PIN")}
              secureTextEntry
              value={newUser.pin}
              onChangeText={(v) => setNewUser({ ...newUser, pin: v })}
            />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t("Salary")}
              keyboardType="decimal-pad"
              value={newUser.salary}
              onChangeText={(v) => setNewUser({ ...newUser, salary: v })}
            />

            {/* Avatar Upload */}
            <TouchableOpacity
              style={[styles.uploadButton, isDark && styles.uploadButtonDark]}
              onPress={() =>
                handleUploadAvatar((path) =>
                  setNewUser({ ...newUser, avatar: path })
                )
              }
            >
              <Ionicons name="image-outline" size={20} color="#4F46E5" />
              <Text
                style={[
                  styles.uploadButtonText,
                  isDark && styles.uploadButtonTextDark,
                ]}
              >
                {t("Upload Avatar")}
              </Text>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleAddUser}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>{t("Add Staff")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Role Modal */}
      <Modal
        visible={newRoleModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNewRoleModalOpen(false)}
      >
        <View
          style={[styles.modalContainer, isDark && styles.modalContainerDark]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {t("Create New Role")}
            </Text>
            <TouchableOpacity onPress={() => setNewRoleModalOpen(false)}>
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
              placeholder={t("Role name (e.g. Kitchen, Inventory)")}
              value={newRoleName}
              onChangeText={setNewRoleName}
            />

            <Text style={[styles.label, isDark && styles.labelDark]}>
              {t("Copy permissions from")}
            </Text>
            <View style={styles.roleOptions}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    selectedRoleForCopy === role && styles.roleOptionSelected,
                  ]}
                  onPress={() => setSelectedRoleForCopy(role)}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRoleForCopy === role &&
                        styles.roleOptionTextSelected,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleCreateRole}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>{t("Create Role")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <BottomNav />
    </View>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  cardTitleDark: {
    color: "#F3F4F6",
  },
  cardDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 18,
  },
  cardDescDark: {
    color: "#9CA3AF",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  settingLabelDark: {
    color: "#D1D5DB",
  },
  ipInputSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 8,
  },
  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },
  addButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    minWidth: 100,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  ipList: {
    gap: 8,
  },
  ipTag: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  ipTagDark: {
    backgroundColor: "#312E81",
    borderColor: "#4C1D95",
  },
  ipTagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F46E5",
  },
  ipTagTextDark: {
    color: "#A5B4FC",
  },
  removeIpButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addNewButton: {
    padding: 4,
  },
  staffItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  staffInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  staffDetails: {
    flex: 1,
  },
  staffName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  staffNameDark: {
    color: "#F3F4F6",
  },
  staffEmail: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  staffEmailDark: {
    color: "#9CA3AF",
  },
  roleBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4F46E5",
  },
  staffActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  editButton: {
    padding: 6,
    backgroundColor: "#EEF2FF",
    borderRadius: 6,
  },
  deleteButton: {
    padding: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
  },
  editForm: {
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  editFormButtons: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  saveButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  pageButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pageButtonActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  pageButtonTextActive: {
    color: "#FFFFFF",
  },
  roleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  roleNameDark: {
    color: "#F3F4F6",
  },
  rolePerms: {
    fontSize: 12,
    color: "#6B7280",
  },
  rolePermsDark: {
    color: "#9CA3AF",
  },
  deleteRoleButton: {
    padding: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
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
    paddingBottom: 16,
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
    marginBottom: 8,
    marginTop: 12,
  },
  labelDark: {
    color: "#D1D5DB",
  },
  pickerSection: {
    marginBottom: 8,
  },
  roleOptions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  roleOptionSelected: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  roleOptionTextSelected: {
    color: "#FFFFFF",
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 12,
    marginVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  uploadButtonDark: {
    borderColor: "#374151",
  },
  uploadButtonText: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "600",
  },
  uploadButtonTextDark: {
    color: "#A5B4FC",
  },
});
