import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import secureFetch from "../../src/api/secureFetch";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";

type Product = {
  id: string;
  name: string;
  category?: string;
  price: number;
  visible?: boolean;
  tags?: string;
  cost?: number;
  description?: string;
  allergens?: string;
  preparation_time?: string | number;
  discount_type?: string;
  discount_value?: string | number;
  image?: string;
  image_url?: string;
  ingredients?: IngredientItem[];
  extras?: ExtraItem[];
  selected_extras_group?: (string | number)[];
  promo_start?: string;
  promo_end?: string;
  show_add_to_cart_modal?: boolean;
};

type ExtrasGroup = {
  id?: string;
  name: string;
  required?: boolean;
  maxSelection?: number;
  items: { id?: string; name: string; price: number; amount: number; unit: string }[];
};

type Ingredient = {
  id?: string;
  name?: string;
  price_per_unit?: number;
  unit?: string;
};

type IngredientItem = {
  ingredient: string;
  quantity: string;
  unit: string;
};

type ExtraItem = {
  name: string;
  extraPrice: number;
  amount?: number;
  unit?: string;
};

type DiscountType = "none" | "percentage" | "fixed";

type ProductFormState = {
  name: string;
  price: string;
  category: string;
  description: string;
  tags: string;
  allergens: string;
  preparation_time: string;
  discount_type: DiscountType;
  discount_value: string;
  visible: boolean;
  image?: string;
  ingredients?: IngredientItem[];
  extras?: ExtraItem[];
  selected_extras_group?: (string | number)[];
  promo_start?: string;
  promo_end?: string;
  show_add_to_cart_modal?: boolean;
};

const defaultFormState: ProductFormState = {
  name: "",
  price: "",
  category: "",
  description: "",
  tags: "",
  allergens: "",
  preparation_time: "",
  discount_type: "none",
  discount_value: "",
  visible: true,
  image: "",
  ingredients: [],
  extras: [],
  selected_extras_group: [],
  promo_start: "",
  promo_end: "",
  show_add_to_cart_modal: true,
};

const mapProductToForm = (product: Product): ProductFormState => ({
  name: product.name ?? "",
  price: product.price?.toString() ?? "",
  category: product.category ?? "",
  description: product.description ?? "",
  tags: product.tags ?? "",
  allergens: product.allergens ?? "",
  preparation_time: product.preparation_time?.toString() ?? "",
  discount_type:
    product.discount_type === "percentage"
      ? "percentage"
      : product.discount_type === "fixed"
      ? "fixed"
      : "none",
  discount_value: product.discount_value?.toString() ?? "",
  visible: product.visible !== false,
  image: product.image ?? product.image_url ?? "",
  ingredients: Array.isArray(product.ingredients)
    ? product.ingredients.map((ing: any) => ({
        ingredient: ing.ingredient ?? "",
        quantity: ing.quantity?.toString() ?? "",
        unit: ing.unit ?? "",
      }))
    : [],
  extras: Array.isArray(product.extras)
    ? product.extras.map((ex: any) => ({
        name: ex.name ?? "",
        extraPrice: Number(ex.extraPrice ?? ex.price ?? 0) || 0,
        amount: Number(ex.amount ?? 1) || 1,
        unit: ex.unit ?? "",
      }))
    : [],
  selected_extras_group: Array.isArray(product.selected_extras_group)
    ? product.selected_extras_group
    : [],
  promo_start: product.promo_start ?? "",
  promo_end: product.promo_end ?? "",
  show_add_to_cart_modal: product.show_add_to_cart_modal !== false,
});

const productCardBackgrounds = [
  "#e0e7ff",
  "#dcfce7",
  "#fef9c3",
  "#ffe4e6",
  "#e0f2fe",
];

const normalizeProducts = (payload: any): Product[] => {
  let list: any[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload?.products && Array.isArray(payload.products)) {
    list = payload.products;
  } else if (payload?.product) {
    list = [payload.product];
  }

  return list.map((item) => ({
    id:
      item?.id?.toString() ||
      item?._id?.toString() ||
      item?.product_id?.toString() ||
      Math.random().toString(),
    name: item?.name || item?.title || "Untitled product",
    category: item?.category || item?.category_name || item?.categoryName,
    price: Number(item?.price ?? item?.unit_price ?? 0) || 0,
    visible:
      item?.visible === undefined ? true : Boolean(item?.visible ?? true),
    tags: item?.tags || item?.tag_list || item?.label,
  }));
};

const normalizeCategories = (payload: any, fallback: string[] = []): string[] => {
  const list = Array.isArray(payload) ? payload : [];
  const normalized = list
    .map((cat) => (typeof cat === "string" ? cat : cat?.category || cat?.name))
    .filter(Boolean)
    .map((cat) => cat.trim());
  return Array.from(new Set([...fallback, ...normalized])).filter(Boolean);
};

const normalizeExtras = (payload: any): ExtrasGroup[] => {
  const list = Array.isArray(payload) ? payload : [];
  return list.map((group) => ({
    id: group?.id?.toString() || group?._id?.toString(),
    name: group?.name || group?.group_name || group?.groupName || "",
    required: Boolean(group?.required),
    maxSelection: Number(group?.max_selection ?? group?.maxSelection ?? 1) || 1,
    items: Array.isArray(group?.items)
      ? group.items.map((item: any) => ({
          id: item?.id?.toString() || item?._id?.toString(),
          name: item?.name || item?.label || "",
          price: Number(item?.price ?? 0) || 0,
          amount: Number(item?.amount ?? item?.quantity ?? 1) || 1,
          unit: item?.unit || item?.measurement || "",
        }))
      : [],
  }));
};

const normalizeCosts = (payload: any): Record<string, number> => {
  const list = Array.isArray(payload) ? payload : [];
  return list.reduce((acc, entry) => {
    const key = entry?.product_id ?? entry?.id ?? entry?._id;
    if (!key) return acc;
    const value = Number(entry?.ingredient_cost ?? entry?.cost ?? 0) || 0;
    acc[key.toString()] = value;
    return acc;
  }, {} as Record<string, number>);
};

const normalizeIngredients = (payload: any): Ingredient[] =>
  Array.isArray(payload) ? payload : [];

export default function ProductsScreen() {
  const { isDark, fontScale } = useAppearance();
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [extrasGroups, setExtrasGroups] = useState<ExtrasGroup[]>([]);
  const [productCosts, setProductCosts] = useState<Record<string, number>>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(defaultFormState);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [groupsModalVisible, setGroupsModalVisible] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<ExtrasGroup[]>([]);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [imageFile, setImageFile] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const [productsData, categoriesData, extrasData, costsData, ingredientData] =
        await Promise.all([
          secureFetch("/products"),
          secureFetch("/products/categories"),
          secureFetch("/products/extras-group"),
          secureFetch("/products/costs"),
          secureFetch("/suppliers/ingredients"),
        ]);

      const normalizedProducts = normalizeProducts(productsData);
      const derivedCategories = normalizedProducts
        .map((p) => p.category)
        .filter(Boolean) as string[];
      const mergedCategories = normalizeCategories(categoriesData, derivedCategories);

      setProducts(normalizedProducts);
      setCategories(mergedCategories.sort((a, b) => a.localeCompare(b)));
      setExtrasGroups(normalizeExtras(extrasData));
      setProductCosts(normalizeCosts(costsData));
      setIngredients(normalizeIngredients(ingredientData));
    } catch (err) {
      console.error("❌ Failed to load products data", err);
      setErrorMessage(t("Could not load products right now. Try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedCategories((prev) => prev.filter((cat) => categories.includes(cat)));
  }, [categories]);

  useEffect(() => {
    if (groupsModalVisible) {
      setGroupDrafts(
        extrasGroups.map((group) => ({
          ...group,
        }))
      );
    }
  }, [groupsModalVisible, extrasGroups]);

  const openForm = (product?: Product) => {
    setEditingProduct(product ?? null);
    setFormState(product ? mapProductToForm(product) : { ...defaultFormState });
    if (product?.image) {
      setImagePreview(product.image);
    } else {
      setImagePreview(null);
    }
    setImageFile(null);
    setModalVisible(true);
  };

  const closeForm = () => {
    setModalVisible(false);
    setEditingProduct(null);
    setFormState({ ...defaultFormState });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFormChange = (field: keyof ProductFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const addIngredient = () => {
    setFormState((prev) => ({
      ...prev,
      ingredients: [
        ...(prev.ingredients || []),
        { ingredient: "", quantity: "", unit: "" },
      ],
    }));
  };

  const removeIngredient = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).filter((_, i) => i !== index),
    }));
  };

  const handleIngredientChange = (index: number, field: keyof IngredientItem, value: string) => {
    setFormState((prev) => {
      const updated = [...(prev.ingredients || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, ingredients: updated };
    });
  };

  const addExtra = () => {
    setFormState((prev) => ({
      ...prev,
      extras: [...(prev.extras || []), { name: "", extraPrice: 0 }],
    }));
  };

  const removeExtra = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      extras: (prev.extras || []).filter((_, i) => i !== index),
    }));
  };

  const handleExtraChange = (index: number, field: keyof ExtraItem, value: string | number) => {
    setFormState((prev) => {
      const updated = [...(prev.extras || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, extras: updated };
    });
  };

  // Calculate estimated cost from ingredients
  const recalculateEstimatedCost = (ings: IngredientItem[]) => {
    let total = 0;
    (ings || []).forEach((ing) => {
      if (!ing.ingredient || !ing.quantity || !ing.unit) return;
      const match = ingredients.find(
        (i) => i.name?.toLowerCase() === ing.ingredient.toLowerCase()
      );
      if (!match) return;
      const basePrice = match.price_per_unit || 0;
      const quantity = parseFloat(ing.quantity) || 0;
      if (basePrice > 0 && quantity > 0) {
        total += basePrice * quantity;
      }
    });
    setEstimatedCost(total);
  };

  // Recalculate cost when ingredients change
  useEffect(() => {
    recalculateEstimatedCost(formState.ingredients || []);
  }, [formState.ingredients, ingredients]);

  const pickImage = async () => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("Permission needed"), t("Please allow access to your photo library"));
        return;
      }

      // Launch without editing - user can crop after if needed
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImageFile(asset);
        setImagePreview(asset.uri);
        // Update form state with image URI
        setFormState((prev) => ({ ...prev, image: asset.uri }));
        Alert.alert("✅ " + t("Image Selected"), t("Image has been added to your product"));
      }
    } catch (err) {
      console.error("Image picker error:", err);
      Alert.alert(t("Error"), t("Failed to pick image"));
    }
  };

  const uploadImage = async (file: any): Promise<string> => {
    if (!file) return formState.image || "";

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: file.mimeType || "image/jpeg",
        name: file.fileName || `product-${Date.now()}.jpg`,
      } as any);

      const data = await secureFetch("/upload", {
        method: "POST",
        body: formData,
      });

      // Check if upload was successful
      if (data && typeof data === 'object') {
        // Handle different response formats
        const imageUrl = data.url || data.image_url || data.path;
        if (imageUrl) {
          console.log("✅ Image uploaded successfully:", imageUrl);
          return imageUrl;
        }
      }
      
      // If we get here, log but don't fail - use local URI as fallback
      console.warn("Upload response format unexpected:", data);
      return file.uri; // Return local URI as fallback
    } catch (err) {
      console.error("❌ Upload error:", err);
      // Don't alert on error - just use local URI
      // This allows the product to save with the local image
      return file.uri;
    }
  };

  const handleSaveProduct = async () => {
    if (!formState.name.trim() || !formState.price.trim()) {
      Alert.alert(t("Missing data"), t("Please provide at least a name and price."));
      return;
    }

    setSavingProduct(true);
    try {
      // Upload image if a new file was selected
      let imageUrl = formState.image || "";
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (imageUrl) {
          console.log("✅ Using image URL:", imageUrl);
        }
      }

      const payload: Record<string, any> = {
        name: formState.name.trim(),
        price: Number(formState.price) || 0,
        category: formState.category.trim() || undefined,
        description: formState.description.trim() || undefined,
        tags: formState.tags.trim() || undefined,
        allergens: formState.allergens.trim() || undefined,
        preparation_time: formState.preparation_time
          ? Number(formState.preparation_time)
          : undefined,
        discount_type: formState.discount_type === "none" ? undefined : formState.discount_type,
        discount_value: formState.discount_value
          ? Number(formState.discount_value)
          : undefined,
        visible: formState.visible,
        image: imageUrl || undefined,
        ingredients: Array.isArray(formState.ingredients) && formState.ingredients.length > 0
          ? formState.ingredients
          : undefined,
        extras: Array.isArray(formState.extras) && formState.extras.length > 0
          ? formState.extras.map((ex) => ({
              name: ex.name || "",
              extraPrice: Number(ex.extraPrice) || 0,
              amount: Number(ex.amount ?? 1) || 1,
              unit: ex.unit || "",
            }))
          : undefined,
        selected_extras_group: Array.isArray(formState.selected_extras_group) && formState.selected_extras_group.length > 0
          ? formState.selected_extras_group.map(g => Number(g)).filter(g => Number.isFinite(g))
          : undefined,
        promo_start: formState.promo_start || undefined,
        promo_end: formState.promo_end || undefined,
        show_add_to_cart_modal: formState.show_add_to_cart_modal !== false,
      };

      const endpoint = editingProduct?.id
        ? `/products/${editingProduct.id}`
        : "/products";
      const method = editingProduct?.id ? "PUT" : "POST";

      const result = await secureFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (result?.error) {
        Alert.alert(t("Error"), result.error || t("Failed to save product"));
        return;
      }

      Alert.alert("✅ " + t("Saved"), editingProduct ? t("Product updated successfully") : t("Product created successfully"));
      closeForm();
      loadData();
    } catch (err) {
      console.error("❌ Failed to save product", err);
      Alert.alert(t("Error"), t("Unable to save product now."));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    setDeletingProductId(product.id);
    try {
      await secureFetch(`/products/${product.id}`, {
        method: "DELETE",
      });
      Alert.alert(t("Deleted"), `${product.name} ${t("removed")}`);
      loadData();
    } catch (err) {
      console.error("Failed to delete product", err);
      Alert.alert(t("Error"), t("Unable to delete product."));
    } finally {
      setDeletingProductId(null);
    }
  };

  const confirmDelete = (product: Product) => {
    Alert.alert(
      t("Delete product"),
      `${t("Are you sure you want to delete")} "${product.name}"?`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () => handleDeleteProduct(product),
        },
      ]
    );
  };

  const confirmDeleteAll = () => {
    Alert.alert(
      t("Delete all products"),
      t("This will remove every product. Continue?"),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete all"),
          style: "destructive",
          onPress: handleDeleteAll,
        },
      ]
    );
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      await secureFetch("/products", { method: "DELETE" });
      Alert.alert(t("Deleted"), t("All products removed"));
      loadData();
    } catch (err) {
      console.error("Failed to delete all", err);
      Alert.alert(t("Error"), t("Unable to delete all products."));
    } finally {
      setDeletingAll(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCategorySubmitting(true);
    try {
      await secureFetch("/products/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: trimmed }),
      });
      setNewCategoryName("");
      setCategoryModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert(t("Category error"), t("Could not add category."));
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleSaveGroups = async () => {
    try {
      await Promise.all(
        groupDrafts.map(async (group) => {
          const payload = {
            name: group.name?.trim() || "",
            items: group.items,
          };
          if (!group.id && !payload.name) return;
          if (group.id) {
            await secureFetch(`/products/extras-group/${group.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          } else {
            await secureFetch("/products/extras-group", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
        })
      );
      setGroupsModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert(t("Groups error"), t("Unable to save groups."));
    }
  };

  const addGroupDraft = () => {
    setGroupDrafts((prev) => [
      ...prev,
      {
        name: "",
        items: [],
      },
    ]);
  };

  const updateGroupDraftName = (index: number, name: string) => {
    setGroupDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  };

  const removeGroupDraft = (index: number) => {
    setGroupDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        selectedCategories.length === 0 ||
        (product.category && selectedCategories.includes(product.category));
      const matchesSearch = !term ||
        product.name.toLowerCase().includes(term) ||
        (product.tags ?? "").toString().toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategories, searchTerm]);

  const extrasItemCount = extrasGroups.reduce(
    (sum, group) => sum + (group.items?.length || 0),
    0
  );

  const discountOptions: { key: DiscountType; label: string }[] = [
    { key: "none", label: t("No discount") },
    { key: "percentage", label: t("Discount (%)") },
    { key: "fixed", label: t("Discount (fixed)") },
  ];

  const StatCard = ({ label, value }: { label: string; value: number | string }) => (
    <View
      style={[
        styles.statCard,
        isDark ? styles.statDark : styles.statLight,
      ]}
    >
      <Text
        style={[
          styles.statValue,
          isDark && styles.statValueDark,
          { fontSize: 20 * fontScale },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          isDark && styles.statLabelDark,
          { fontSize: 12 * fontScale },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  return (
    <View
      style={[
        styles.screen,
        isDark && styles.screenDark,
      ]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={isDark ? "#fff" : "#111"}
            colors={isDark ? ["#fff"] : ["#111"]}
          />
        }
        keyboardShouldPersistTaps="always"
      >
        <View style={[styles.hero, isDark && styles.heroDark, styles.heroSpacing]}>
          <View style={styles.heroTitleBlock}>
            <View style={styles.heroTitleRow}>
              <Text
                style={[
                  styles.heroTitle,
                  isDark && styles.heroTitleDark,
                  { fontSize: 32 * fontScale },
                ]}
              >
                {t("Products")}
              </Text>
            
            </View>
            <Text
              style={[
                styles.heroSubtitle,
                isDark && styles.heroSubtitleDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              {t("Menu, pricing and extras all in one place.")}
            </Text>
          </View>
          <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
            <Text
              style={[
                styles.flatButtonText,
                isDark && styles.flatButtonTextDark,
              ]}
            >
              {t("Refresh")}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroActionsRow}>
          <TouchableOpacity
            onPress={() => openForm()}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>{t("Add product")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCategoryModalVisible(true)}
            style={[styles.actionButton, styles.secondaryButton, styles.heroButtonGap]}
          >
            <Text style={[styles.actionButtonText, styles.secondaryText]}>
              {t("Add category")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setGroupsModalVisible(true)}
            style={[styles.actionButton, styles.secondaryButton, styles.heroButtonGap]}
          >
            <Text style={[styles.actionButtonText, styles.secondaryText]}>
              {t("Manage groups")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDeleteAll}
            style={[styles.actionButton, styles.secondaryButton, styles.heroButtonGap]}
          >
            {deletingAll ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.actionButtonText, styles.secondaryText]}>
                {t("Delete all")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label={t("Products")} value={products.length} />
          <StatCard label={t("Category")} value={categories.length} />
        </View>

        {errorMessage && (
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            {errorMessage}
          </Text>
        )}

        <View style={styles.searchRow}>
          <TextInput
            placeholder={t("Search by name or tag")}
            placeholderTextColor={isDark ? "#a1a1aa" : "#6b7280"}
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={[styles.searchInput, isDark && styles.searchInputDark]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!selectedCategories.length && (
            <TouchableOpacity
              onPress={() => setSelectedCategories([])}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>{t("Clear")}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.chipRow}>
          {categories.map((category) => {
            const selected = selectedCategories.includes(category);
            return (
              <TouchableOpacity
                key={category}
                onPress={() => toggleCategory(category)}
                style={[
                  styles.chip,
                  isDark ? styles.chipDark : styles.chipLight,
                  selected && styles.chipSelected,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                    isDark && !selected && styles.chipTextDark,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text
          style={[
            styles.sectionTitle,
            isDark && styles.sectionTitleDark,
            { fontSize: 16 * fontScale },
          ]}
        >
          {t("Product list")} • {filteredProducts.length} {t("items")}
        </Text>

        {filteredProducts.length === 0 && !loading ? (
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
            {t("No products match the filters yet.")}
          </Text>
        ) : (
          filteredProducts.map((product, index) => {
            const cardColor =
              productCardBackgrounds[index % productCardBackgrounds.length];
            const cost = productCosts[product.id] ?? 0;
            const margin = Number(product.price) - cost;
            const marginLabel =
              Number(product.price) > 0
                ? `${Math.round((margin / Number(product.price)) * 100)}%`
                : "—";
            return (
              <TouchableOpacity
                key={product.id}
                onPress={() => openForm(product)}
                activeOpacity={0.8}
                style={[
                  styles.card,
                  { backgroundColor: cardColor },
                  isDark && styles.cardDark,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.productName, { fontSize: 18 * fontScale }]}
                  >
                    {product.name}
                  </Text>
                  <Text style={styles.productPrice}>
                    {formatCurrency(product.price)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.productCategory,
                    isDark && styles.productCategoryDark,
                  ]}
                  numberOfLines={1}
                >
                  {product.category || t("Uncategorized")}
                </Text>
                <View style={styles.badgeRow}>
                  <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                    {t("Cost")}: {formatCurrency(cost)}
                  </Text>
                  <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                    {t("Margin")}: {formatCurrency(margin)} ({marginLabel})
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                    {t("Tags")}: {product.tags || "—"}
                  </Text>
                  {!product.visible && (
                    <Text style={styles.visibilityBadge}>{t("Hidden")}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.extrasText,
                    isDark && styles.extrasTextDark,
                  ]}
                >
                  {t("Extras groups")}: {extrasGroups.length} • {extrasItemCount} {t("options")}
                </Text>
                <TouchableOpacity
                  onPress={() => confirmDelete(product)}
                  style={styles.productDeleteButton}
                  disabled={deletingProductId === product.id}
                >
                  {deletingProductId === product.id ? (
                    <ActivityIndicator color="#070000ff" size={12} />
                  ) : (
                    <Text style={styles.deleteButtonText}>{t("Delete product")}</Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      isDark && styles.modalTitleDark,
                    ]}
                  >
                    {editingProduct ? t("Edit product") : t("New product")}
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      isDark && styles.modalSubtitleDark,
                    ]}
                  >
                    {t("Update price, category and visibility.")}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeForm}>
                  <Text
                    style={[
                      styles.flatButtonText,
                      isDark && styles.flatButtonTextDark,
                    ]}
                  >
                    {t("Close")}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
              >
                {/* Image Section */}
                <View style={[styles.imageSection, isDark && styles.imageSectionDark]}>
                  <Text style={[styles.imageSectionTitle, isDark && styles.imageSectionTitleDark]}>
                    {t("Product Image")}
                  </Text>
                  {imagePreview ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: imagePreview }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                      <View style={styles.imageOverlay}>
                        <TouchableOpacity
                          style={styles.imageChangeButton}
                          onPress={pickImage}
                        >
                          <Text style={styles.imageChangeButtonText}>📸 {t("Change Image")}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.imageUploadButton, isDark && styles.imageUploadButtonDark]}
                      onPress={pickImage}
                    >
                      <Text style={styles.imageUploadButtonEmoji}>📷</Text>
                      <Text style={styles.imageUploadButtonText}>{t("Add Image")}</Text>
                      <Text style={styles.imageUploadButtonSubtext}>{t("Select from gallery")}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  placeholder={t("Name")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.name}
                  onChangeText={(value) => handleFormChange("name", value)}
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Price")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.price}
                  onChangeText={(value) => handleFormChange("price", value)}
                  keyboardType="numeric"
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Category")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.category}
                  onChangeText={(value) => handleFormChange("category", value)}
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Preparation time (minutes)")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.preparation_time}
                  onChangeText={(value) =>
                    handleFormChange("preparation_time", value)
                  }
                  keyboardType="number-pad"
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Description")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.description}
                  onChangeText={(value) => handleFormChange("description", value)}
                  multiline
                  style={[
                    styles.modalInput,
                    styles.modalTextarea,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Tags (comma separated)")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.tags}
                  onChangeText={(value) => handleFormChange("tags", value)}
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Allergens")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.allergens}
                  onChangeText={(value) => handleFormChange("allergens", value)}
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />

                <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  {t("Discount")}
                </Text>
                <View style={styles.discountRow}>
                  {discountOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => handleFormChange("discount_type", option.key)}
                      style={[
                        styles.discountButton,
                        formState.discount_type === option.key &&
                          styles.discountButtonActive,
                        isDark && styles.discountButtonDark,
                        formState.discount_type === option.key &&
                          isDark &&
                          styles.discountButtonActiveDark,
                      ]}
                    >
                      <Text
                        style={[
                          styles.discountLabel,
                          formState.discount_type === option.key &&
                            styles.discountLabelActive,
                          isDark && styles.discountLabelDark,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {formState.discount_type !== "none" && (
                  <TextInput
                    placeholder={t("Discount value")}
                    placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                    value={formState.discount_value}
                    onChangeText={(value) =>
                      handleFormChange("discount_value", value)
                    }
                    keyboardType="numeric"
                    style={[
                      styles.modalInput,
                      isDark && styles.modalInputDark,
                    ]}
                  />
                )}

                <View style={styles.switchRow}>
                  <Text
                    style={[
                      styles.switchLabel,
                      isDark && styles.switchLabelDark,
                    ]}
                  >
                    {t("Visible on website")}
                  </Text>
                  <Switch
                    value={formState.visible}
                    onValueChange={(value) => handleFormChange("visible", value)}
                    thumbColor={formState.visible ? "#2563eb" : "#9ca3af"}
                    trackColor={{ false: "#374151", true: "#60a5fa" }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text
                    style={[
                      styles.switchLabel,
                      isDark && styles.switchLabelDark,
                    ]}
                  >
                    {t("Show add-to-cart modal")}
                  </Text>
                  <Switch
                    value={formState.show_add_to_cart_modal !== false}
                    onValueChange={(value) => handleFormChange("show_add_to_cart_modal", value)}
                    thumbColor={formState.show_add_to_cart_modal ? "#2563eb" : "#9ca3af"}
                    trackColor={{ false: "#374151", true: "#60a5fa" }}
                  />
                </View>

                <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  {t("Promotion Dates")}
                </Text>
                <TextInput
                  placeholder={t("Promo start (YYYY-MM-DD)")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.promo_start}
                  onChangeText={(value) => handleFormChange("promo_start", value)}
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />
                <TextInput
                  placeholder={t("Promo end (YYYY-MM-DD)")}
                  placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                  value={formState.promo_end}
                  onChangeText={(value) => handleFormChange("promo_end", value)}
                  style={[
                    styles.modalInput,
                    isDark && styles.modalInputDark,
                  ]}
                />

                <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  {t("Ingredients")} ({t("Cost")}: {formatCurrency(estimatedCost)})
                </Text>
                {(formState.ingredients || []).map((ing, index) => (
                  <View key={index} style={[styles.ingredientRow, isDark && styles.ingredientRowDark]}>
                    <TextInput
                      placeholder={t("Ingredient")}
                      placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                      value={ing.ingredient}
                      onChangeText={(value) => handleIngredientChange(index, "ingredient", value)}
                      style={[styles.ingredientInput, isDark && styles.ingredientInputDark]}
                    />
                    <TextInput
                      placeholder={t("Qty")}
                      placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                      value={ing.quantity}
                      onChangeText={(value) => handleIngredientChange(index, "quantity", value)}
                      keyboardType="decimal-pad"
                      style={[styles.ingredientInput, isDark && styles.ingredientInputDark, styles.ingredientSmall]}
                    />
                    <TextInput
                      placeholder={t("Unit")}
                      placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                      value={ing.unit}
                      onChangeText={(value) => handleIngredientChange(index, "unit", value)}
                      style={[styles.ingredientInput, isDark && styles.ingredientInputDark, styles.ingredientSmall]}
                    />
                    <TouchableOpacity
                      onPress={() => removeIngredient(index)}
                      style={styles.ingredientDelete}
                    >
                      <Text style={styles.ingredientDeleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={addIngredient}
                  style={[styles.addButton, isDark && styles.addButtonDark]}
                >
                  <Text style={styles.addButtonText}>+ {t("Add ingredient")}</Text>
                </TouchableOpacity>

                <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  {t("Extras")}
                </Text>
                {(formState.extras || []).map((extra, index) => (
                  <View key={index} style={[styles.ingredientRow, isDark && styles.ingredientRowDark]}>
                    <TextInput
                      placeholder={t("Extra name")}
                      placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                      value={extra.name}
                      onChangeText={(value) => handleExtraChange(index, "name", value)}
                      style={[styles.ingredientInput, isDark && styles.ingredientInputDark]}
                    />
                    <TextInput
                      placeholder={t("Price")}
                      placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                      value={extra.extraPrice.toString()}
                      onChangeText={(value) => handleExtraChange(index, "extraPrice", parseFloat(value) || 0)}
                      keyboardType="decimal-pad"
                      style={[styles.ingredientInput, isDark && styles.ingredientInputDark, styles.ingredientSmall]}
                    />
                    <TouchableOpacity
                      onPress={() => removeExtra(index)}
                      style={styles.ingredientDelete}
                    >
                      <Text style={styles.ingredientDeleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={addExtra}
                  style={[styles.addButton, isDark && styles.addButtonDark]}
                >
                  <Text style={styles.addButtonText}>+ {t("Add extra")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveProduct}
                  style={styles.saveButton}
                  disabled={savingProduct}
                >
                  {savingProduct ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingProduct ? t("Update product") : t("Create product")}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  isDark && styles.modalTitleDark,
                ]}
              >
                {categorySubmitting ? t("Adding category") : t("Add category")}
              </Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Text
                  style={[
                    styles.flatButtonText,
                    isDark && styles.flatButtonTextDark,
                  ]}
                >
                  {t("Close")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                placeholder={t("Category name")}
                placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                style={[styles.modalInput, isDark && styles.modalInputDark]}
              />
              <TouchableOpacity
                onPress={handleAddCategory}
                style={styles.saveButton}
                disabled={categorySubmitting}
              >
                <Text style={styles.saveButtonText}>
                  {categorySubmitting ? t("Saving…") : t("Create category")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={groupsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGroupsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  isDark && styles.modalTitleDark,
                ]}
              >
                {t("Extras groups")}
              </Text>
              <TouchableOpacity onPress={() => setGroupsModalVisible(false)}>
                <Text
                  style={[
                    styles.flatButtonText,
                    isDark && styles.flatButtonTextDark,
                  ]}
                >
                  {t("Close")}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {(groupDrafts || []).map((group, idx) => (
                <View key={`${group.id ?? "new"}-${idx}`} style={styles.groupItem}>
                  <TextInput
                    placeholder={t("Group name")}
                    placeholderTextColor={isDark ? "#cbd5f5" : "#9ca3af"}
                    value={group.name}
                    onChangeText={(value) => updateGroupDraftName(idx, value)}
                    style={[styles.modalInput, isDark && styles.modalInputDark]}
                  />
                  <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                    {group.items?.length || 0} {t("items")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeGroupDraft(idx)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>{t("Remove")}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={addGroupDraft}
                style={[styles.actionButton, styles.groupAddButton]}
              >
                <Text style={styles.actionButtonText}>+ {t("Add group")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveGroups}
                style={[styles.saveButton, { marginTop: 12 }]}
              >
                <Text style={styles.saveButtonText}>{t("Save groups")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  screenDark: {
    backgroundColor: "#05070f",
  },
  scroll: {
    paddingBottom: 140,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroDark: {
    backgroundColor: "#111827",
  },
  heroTitle: {
    fontWeight: "800",
    color: "#0f172a",
  },
  heroTitleDark: {
    color: "#f8fafc",
  },
  heroSubtitle: {
    color: "#475569",
    marginTop: 6,
  },
  heroSubtitleDark: {
    color: "#cbd5f5",
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  heroSpacing: {
    marginBottom: 20,
  },
  heroActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 12,
    justifyContent: "space-between",
  },
  heroButtonGap: {
    marginLeft: 0,
  },
  actionButton: {
    flexBasis: "48%",
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    flexShrink: 1,
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryText: {
    color: "#2563eb",
  },
  ctaButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    shadowColor: "#2563eb",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  flatButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5f5",
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    alignSelf: "flex-start",
  },
  flatButtonText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  flatButtonTextDark: {
    color: "#f8fafc",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    flexBasis: "48%",
    maxWidth: "48%",
    padding: 12,
    borderRadius: 16,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  statLight: {
    backgroundColor: "#fff",
  },
  statDark: {
    backgroundColor: "#1f2937",
  },
  statValue: {
    fontWeight: "700",
    color: "#111827",
  },
  statValueDark: {
    color: "#f8fafc",
  },
  statLabel: {
    marginTop: 2,
    color: "#6b7280",
  },
  statLabelDark: {
    color: "#cbd5f5",
  },
  errorText: {
    color: "#b91c1c",
    marginBottom: 12,
  },
  errorTextDark: {
    color: "#fca5a5",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    maxWidth: 420,
    minWidth: 200,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
    marginRight: 8,
  },
  searchInputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#f9fafb",
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#e0e7ff",
    borderRadius: 12,
    flexShrink: 0,
    marginTop: 4,
  },
  clearButtonText: {
    color: "#4338ca",
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 28,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 8,
  },
  chipLight: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  chipDark: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  chipSelected: {
    backgroundColor: "#6366f1",
  },
  chipText: {
    color: "#1f2937",
    fontWeight: "600",
  },
  chipTextDark: {
    color: "#e5e7eb",
  },
  chipTextSelected: {
    color: "#fff",
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
    marginTop: 12,
  },
  sectionTitleDark: {
    color: "#f8fafc",
  },
  emptyText: {
    color: "#6b7280",
    marginBottom: 24,
  },
  emptyTextDark: {
    color: "#d1d5db",
  },
  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: "#111827",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  productName: {
    fontWeight: "700",
    color: "#111827",
  },
  productPrice: {
    fontWeight: "800",
    color: "#0f172a",
  },
  productCategory: {
    color: "#4b5563",
    marginBottom: 8,
  },
  productCategoryDark: {
    color: "#cbd5f5",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginVertical: 4,
  },
  badgeText: {
    backgroundColor: "rgba(15,23,42,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    color: "#111827",
    fontSize: 12,
    marginBottom: 6,
  },
  badgeTextDark: {
    backgroundColor: "rgba(248, 250, 252, 0.12)",
    color: "#f8fafc",
  },
  visibilityBadge: {
    backgroundColor: "#ef4444",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
  },
  extrasText: {
    marginTop: 8,
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "600",
  },
  extrasTextDark: {
    color: "#e5e7eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#fff",
    maxHeight: "90%",
    paddingBottom: 40,
  },
  modalCardDark: {
    backgroundColor: "#0f172a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalTitleDark: {
    color: "#f8fafc",
  },
  modalSubtitle: {
    color: "#475569",
  },
  modalSubtitleDark: {
    color: "#cbd5f5",
  },
  modalBody: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 70,
  },
  modalInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
    marginBottom: 12,
  },
  modalInputDark: {
    backgroundColor: "#1f2937",
    borderColor: "#374151",
    color: "#f8fafc",
  },
  modalTextarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  sectionLabel: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#0f172a",
  },
  sectionLabelDark: {
    color: "#f8fafc",
  },
  discountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  discountButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    marginRight: 8,
    marginBottom: 8,
  },
  discountButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  discountButtonDark: {
    borderColor: "#374151",
  },
  discountButtonActiveDark: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  discountLabel: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 12,
  },
  discountLabelActive: {
    color: "#fff",
  },
  discountLabelDark: {
    color: "#f8fafc",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  switchLabel: {
    color: "#0f172a",
    fontWeight: "600",
  },
  switchLabelDark: {
    color: "#f8fafc",
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  groupItem: {
    marginBottom: 12,
  },
  deleteButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f87171",
    marginTop: 6,
  },
  deleteButtonText: {
    color: "#d55a5aff",
    fontWeight: "600",
  },
  groupAddButton: {
    backgroundColor: "#10b981",
  },
  productDeleteButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    marginTop: 8,
  },
  ingredientRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 8,
  },
  ingredientRowDark: {
    backgroundColor: "#374151",
  },
  ingredientInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    fontSize: 12,
    color: "#111",
  },
  ingredientInputDark: {
    backgroundColor: "#1f2937",
    borderColor: "#4b5563",
    color: "#fff",
  },
  ingredientSmall: {
    flex: 0.4,
  },
  ingredientDelete: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientDeleteText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    marginBottom: 12,
  },
  addButtonDark: {
    backgroundColor: "#2563eb",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  imageSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  imageSectionDark: {
    borderBottomColor: "#374151",
  },
  imageSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  imageSectionTitleDark: {
    color: "#9ca3af",
  },
  imageUploadButton: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
  },
  imageUploadButtonDark: {
    borderColor: "#4b5563",
    backgroundColor: "#1f2937",
  },
  imageUploadButtonEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  imageUploadButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  imageUploadButtonSubtext: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  imagePreviewContainer: {
    position: "relative",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    elevation: 5,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    zIndex: 1,
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    zIndex: 10,
  },
  imageChangeButton: {
    backgroundColor: "rgba(59, 130, 246, 0.95)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  imageChangeButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
