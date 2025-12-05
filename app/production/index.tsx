import { useEffect, useState, useCallback, useMemo } from "react";
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
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import secureFetch from "../../src/api/secureFetch";
import { useAuth } from "../../src/context/AuthContext";

type Recipe = {
  id?: string;
  _id?: string;
  name: string;
  emoji?: string;
  base_quantity: number;
  output_unit: string;
  ingredients?: Ingredient[];
  restaurant_id?: string | number;
  tenant_id?: string | number;
};

type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
};

export default function ProductionScreen() {
  const { isDark } = useAppearance();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [producing, setProducing] = useState<{ [key: string]: boolean }>({});
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [newRecipe, setNewRecipe] = useState({
    name: "",
    emoji: "📦",
    base_quantity: "1",
    output_unit: "pcs",
  });

  const tenantId = useMemo(() => {
    return user?.restaurant_id ? String(user.restaurant_id) : null;
  }, [user]);

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = tenantId
        ? `/production/recipes?restaurant_id=${tenantId}`
        : "/production/recipes";
      const data = await secureFetch(endpoint);
      const recipeList = Array.isArray(data) ? data : [];

      setRecipes(recipeList);

      const initialQuantities: { [key: string]: number } = {};
      recipeList.forEach((recipe: Recipe) => {
        initialQuantities[recipe.name] = 1;
      });
      setQuantities(initialQuantities);
    } catch (err) {
      console.error("❌ Failed to load recipes:", err);
      Alert.alert(t("Error"), t("Failed to load recipes"));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    if (tenantId || !user) {
      loadRecipes();
    }
  }, [loadRecipes, tenantId, user]);

  const handleAdjust = (recipeName: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [recipeName]: Math.max(1, (prev[recipeName] ?? 1) + delta),
    }));
  };

  const handleProduce = async (recipe: Recipe) => {
    try {
      setProducing((prev) => ({ ...prev, [recipe.name]: true }));

      const batchCount = quantities[recipe.name] ?? 1;
      const payload = {
        product_name: recipe.name,
        base_quantity: recipe.base_quantity,
        batch_count: batchCount,
        total_produced: recipe.base_quantity * batchCount,
        output_unit: recipe.output_unit,
        ingredients: recipe.ingredients || [],
      };

      if (tenantId) {
        Object.assign(payload, { restaurant_id: tenantId });
      }

      await secureFetch("/production/production-log", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      Alert.alert(
        t("Success"),
        t("Produced %s batches of %s", { batchCount, name: recipe.name })
      );
      setQuantities((prev) => ({ ...prev, [recipe.name]: 1 }));
    } catch (err) {
      console.error("❌ Failed to produce:", err);
      Alert.alert(t("Error"), t("Failed to produce item"));
    } finally {
      setProducing((prev) => ({ ...prev, [recipe.name]: false }));
    }
  };

  const handleSaveRecipe = async () => {
    try {
      if (!newRecipe.name.trim()) {
        Alert.alert(t("Error"), t("Recipe name is required"));
        return;
      }

      const payload = {
        name: newRecipe.name.trim(),
        emoji: newRecipe.emoji,
        base_quantity: Number(newRecipe.base_quantity) || 1,
        output_unit: newRecipe.output_unit,
        ingredients: [],
      };

      if (tenantId) {
        Object.assign(payload, { restaurant_id: tenantId });
      }

      if (editingRecipe) {
        const recipeId = editingRecipe.id || editingRecipe._id;
        const endpoint = tenantId
          ? `/production/recipes/${recipeId}?restaurant_id=${tenantId}`
          : `/production/recipes/${recipeId}`;

        await secureFetch(endpoint, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        const endpoint = tenantId
          ? `/production/recipes?restaurant_id=${tenantId}`
          : "/production/recipes";

        await secureFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      Alert.alert(t("Success"), t("Recipe saved successfully"));
      setNewRecipe({
        name: "",
        emoji: "📦",
        base_quantity: "1",
        output_unit: "pcs",
      });
      setEditingRecipe(null);
      setRecipeModalOpen(false);
      await loadRecipes();
    } catch (err) {
      console.error("❌ Failed to save recipe:", err);
      Alert.alert(t("Error"), t("Failed to save recipe"));
    }
  };

  const handleDeleteRecipe = async (recipe: Recipe) => {
    Alert.alert(
      t("Delete Recipe"),
      t("Are you sure you want to delete {{name}}?", { name: recipe.name }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const recipeId = recipe.id || recipe._id;
              const endpoint = tenantId
                ? `/production/recipes/${recipeId}?restaurant_id=${tenantId}`
                : `/production/recipes/${recipeId}`;

              await secureFetch(endpoint, {
                method: "DELETE",
              });

              Alert.alert(t("Success"), t("Recipe deleted"));
              await loadRecipes();
            } catch (err) {
              console.error("❌ Failed to delete recipe:", err);
              Alert.alert(t("Error"), t("Failed to delete recipe"));
            }
          },
        },
      ]
    );
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setNewRecipe({
      name: recipe.name,
      emoji: recipe.emoji || "📦",
      base_quantity: recipe.base_quantity.toString(),
      output_unit: recipe.output_unit,
    });
    setRecipeModalOpen(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading recipes...")}
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
            🏭 {t("Production")}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingRecipe(null);
              setNewRecipe({
                name: "",
                emoji: "📦",
                base_quantity: "1",
                output_unit: "pcs",
              });
              setRecipeModalOpen(true);
            }}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Recipes Grid */}
        {recipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              {t("No recipes found")}
            </Text>
            <Text
              style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}
            >
              {t("Create your first recipe to get started")}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {recipes.map((recipe) => {
              const batches = quantities[recipe.name] ?? 1;
              const totalOutput = recipe.base_quantity * batches;
              const isProduting = producing[recipe.name] || false;

              return (
                <View
                  key={recipe.name}
                  style={[styles.recipeCard, isDark && styles.recipeCardDark]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.recipeEmoji}>
                      {recipe.emoji || "📦"}
                    </Text>
                    <View style={styles.recipeInfo}>
                      <Text
                        style={[
                          styles.recipeName,
                          isDark && styles.recipeNameDark,
                        ]}
                      >
                        {recipe.name}
                      </Text>
                      <Text
                        style={[
                          styles.recipeOutput,
                          isDark && styles.recipeOutputDark,
                        ]}
                      >
                        {totalOutput} {recipe.output_unit}
                      </Text>
                    </View>
                  </View>

                  {/* Batch Adjuster */}
                  <View style={styles.batchAdjuster}>
                    <TouchableOpacity
                      style={[
                        styles.adjustButton,
                        isDark && styles.adjustButtonDark,
                      ]}
                      onPress={() => handleAdjust(recipe.name, -1)}
                      disabled={isProduting}
                    >
                      <Ionicons name="remove" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.batchCount,
                        isDark && styles.batchCountDark,
                      ]}
                    >
                      {batches}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.adjustButton,
                        isDark && styles.adjustButtonDark,
                      ]}
                      onPress={() => handleAdjust(recipe.name, 1)}
                      disabled={isProduting}
                    >
                      <Ionicons name="add" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.produceButton,
                        isProduting && styles.produceButtonDisabled,
                      ]}
                      onPress={() => handleProduce(recipe)}
                      disabled={isProduting}
                    >
                      {isProduting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={styles.produceButtonText}>
                            {t("Produce")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditRecipe(recipe)}
                      disabled={isProduting}
                    >
                      <Ionicons name="pencil" size={18} color="#8B5CF6" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteRecipe(recipe)}
                      disabled={isProduting}
                    >
                      <Ionicons name="trash" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Recipe Modal */}
      <Modal
        visible={recipeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRecipeModalOpen(false)}
      >
        <View
          style={[styles.modalContainer, isDark && styles.modalContainerDark]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {editingRecipe ? t("Edit Recipe") : t("New Recipe")}
            </Text>
            <TouchableOpacity onPress={() => setRecipeModalOpen(false)}>
              <Ionicons
                name="close"
                size={24}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Emoji Selector */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Emoji")}
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                maxLength={2}
                value={newRecipe.emoji}
                onChangeText={(text) =>
                  setNewRecipe({ ...newRecipe, emoji: text })
                }
                placeholder="📦"
              />
            </View>

            {/* Recipe Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Recipe Name")} *
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("e.g., Tomato Sauce")}
                value={newRecipe.name}
                onChangeText={(text) =>
                  setNewRecipe({ ...newRecipe, name: text })
                }
              />
            </View>

            {/* Base Quantity */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Base Quantity")} *
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="1"
                keyboardType="decimal-pad"
                value={newRecipe.base_quantity}
                onChangeText={(text) =>
                  setNewRecipe({ ...newRecipe, base_quantity: text })
                }
              />
            </View>

            {/* Output Unit */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Output Unit")} *
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="pcs"
                value={newRecipe.output_unit}
                onChangeText={(text) =>
                  setNewRecipe({ ...newRecipe, output_unit: text })
                }
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveRecipe}
            >
              <Text style={styles.saveButtonText}>{t("Save Recipe")}</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  addButton: {
    backgroundColor: "#8B5CF6",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  emptySubtextDark: {
    color: "#6B7280",
  },
  grid: {
    gap: 12,
  },
  recipeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  recipeCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  recipeEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  recipeNameDark: {
    color: "#F3F4F6",
  },
  recipeOutput: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  recipeOutputDark: {
    color: "#9CA3AF",
  },
  batchAdjuster: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingVertical: 8,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  adjustButtonDark: {
    backgroundColor: "#374151",
  },
  batchCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    minWidth: 40,
    textAlign: "center",
  },
  batchCountDark: {
    color: "#F3F4F6",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  produceButton: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  produceButtonDisabled: {
    opacity: 0.6,
  },
  produceButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8B4FE",
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  labelDark: {
    color: "#D1D5DB",
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
  },
  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },
  saveButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
