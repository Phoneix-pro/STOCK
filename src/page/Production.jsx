import "./Production.css";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { supabase } from "../supabaseClient";
import { playSimpleBeep } from "../utils/beepSound";

function Production({
  productionDepartments,
  setProductionDepartments,
  productionItems,
  setProductionItems,
  products,
  setProducts,
  bmrList,
  setBmrList,
  bmrTemplates,
  setBmrTemplates,
  activeProductionDepartment,
  setActiveProductionDepartment,
  loadAllData,
}) {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("");
  const [newProduction, setNewProduction] = useState("");
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [moveBackQuantity, setMoveBackQuantity] = useState({});
  const [selectedItemForMove, setSelectedItemForMove] = useState(null);
  const [hasAssembly, setHasAssembly] = useState(true);
  const [confirmationData, setConfirmationData] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
    type: "danger",
  });

  // BMR Move States
  const [scanningBMR, setScanningBMR] = useState(false);
  const [scannedBMRProducts, setScannedBMRProducts] = useState([]);
  const [cameraErrorBMR, setCameraErrorBMR] = useState(false);
  const [selectedBMR, setSelectedBMR] = useState("");
  const [initialCode, setInitialCode] = useState("");
  const [manualBarcodeInput, setManualBarcodeInput] = useState("");
  const [savedTemplates, setSavedTemplates] = useState({});
  const [usingBackCameraBMR, setUsingBackCameraBMR] = useState(false);

  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    addDepartment: false,
    editDepartment: false,
    deleteDepartment: false,
    deleteItem: false,
    moveBack: false,
    moveToBMR: false,
  });

  // Refs for modals
  const editDepartmentModalRef = useRef(null);
  const moveBackModalRef = useRef(null);
  const moveToBMRModalRef = useRef(null);
  const confirmationModalRef = useRef(null);

  // Update active production department when section changes
  useEffect(() => {
    if (activeSection) {
      setActiveProductionDepartment(activeSection);
    }
  }, [activeSection, setActiveProductionDepartment]);

  // Load saved templates
  useEffect(() => {
    const saved = localStorage.getItem("bmrSavedTemplates");
    if (saved) {
      setSavedTemplates(JSON.parse(saved));
    }
  }, []);

  // Filter production items by selected department
  const filteredProductionItems = productionItems.filter((item) =>
    activeSection ? item.department === activeSection : false
  );

  // Get active BMRs for dropdown
  const activeBMRs = bmrTemplates.filter(
    (bmr) =>
      bmr.status === "active" &&
      savedTemplates[bmr.id] &&
      bmr.department === activeSection
  );

  // Get current department assembly type
  const getCurrentDepartmentAssemblyType = () => {
    if (!activeSection) return true;
    const currentDept = productionDepartments.find(
      (dept) => dept.name === activeSection
    );
    return currentDept ? currentDept.has_assembly : true;
  };

  // Set loading state
  const setLoading = (key, value) => {
    setLoadingStates((prev) => ({ ...prev, [key]: value }));
  };

  // Confirmation modal functions
  const showConfirmation = (title, message, onConfirm, type = "danger") => {
    setConfirmationData({
      show: true,
      title,
      message,
      onConfirm,
      type,
    });
    const modal = new bootstrap.Modal(confirmationModalRef.current);
    modal.show();
  };

  const handleConfirmation = () => {
    if (confirmationData.onConfirm) {
      confirmationData.onConfirm();
    }
    const modal = bootstrap.Modal.getInstance(confirmationModalRef.current);
    modal?.hide();
  };

  // Start edit department
  const startEditDepartment = (department) => {
    setEditingDepartment(department);
    setNewDepartmentName(department.name);
    setHasAssembly(department.has_assembly);
  };

  // Add new production department to Supabase
  const addNewProduction = async () => {
    try {
      setLoading("addDepartment", true);

      if (!newProduction.trim()) {
        toast.error("Please enter department name!");
        setLoading("addDepartment", false);
        return;
      }

      if (
        productionDepartments.find((dept) => dept.name === newProduction.trim())
      ) {
        toast.error("This department already exists!");
        setLoading("addDepartment", false);
        return;
      }

      const { data, error } = await supabase
        .from("production_departments")
        .insert([{ name: newProduction.trim(), has_assembly: hasAssembly }])
        .select();

      if (error) throw error;

      setProductionDepartments((prev) => [
        ...prev,
        {
          id: data[0].id,
          name: newProduction.trim(),
          has_assembly: hasAssembly,
        },
      ]);
      setNewProduction("");
      setHasAssembly(true);
      toast.success("New production department added!");

      await loadAllData();
      setLoading("addDepartment", false);
    } catch (error) {
      console.error("Error adding department:", error);
      toast.error("Error adding department: " + error.message);
      setLoading("addDepartment", false);
    }
  };

  // Edit department in Supabase
  const saveEditDepartment = async () => {
    if (!editingDepartment) return;

    try {
      setLoading("editDepartment", true);

      if (newDepartmentName.trim()) {
        const { error } = await supabase
          .from("production_departments")
          .update({
            name: newDepartmentName.trim(),
            has_assembly: hasAssembly,
          })
          .eq("id", editingDepartment.id);

        if (error) throw error;

        // Update production items department name
        const { error: itemsError } = await supabase
          .from("production_items")
          .update({ department: newDepartmentName.trim() })
          .eq("department", editingDepartment.name);

        if (itemsError) throw itemsError;

        // Update state
        setProductionDepartments((prev) =>
          prev.map((dept) =>
            dept.id === editingDepartment.id
              ? {
                  ...dept,
                  name: newDepartmentName.trim(),
                  has_assembly: hasAssembly,
                }
              : dept
          )
        );

        // Update active section if needed
        if (activeSection === editingDepartment.name) {
          setActiveSection(newDepartmentName.trim());
        }

        toast.success("Department updated successfully!");
        setEditingDepartment(null);
        setNewDepartmentName("");

        // Close modal
        if (editDepartmentModalRef.current) {
          const modal = bootstrap.Modal.getInstance(
            editDepartmentModalRef.current
          );
          modal?.hide();
        }

        await loadAllData();
      }
      setLoading("editDepartment", false);
    } catch (error) {
      toast.error("Error updating department: " + error.message);
      setLoading("editDepartment", false);
    }
  };

  // Delete department from Supabase
  const deleteDepartment = async (department) => {
    showConfirmation(
      "Delete Department",
      `Are you sure you want to delete <strong>${department.name}</strong>? This will also remove all items in this department.`,
      async () => {
        try {
          setLoading("deleteDepartment", true);

          // Delete production items first
          const { error: itemsError } = await supabase
            .from("production_items")
            .delete()
            .eq("department", department.name);

          if (itemsError) throw itemsError;

          // Delete department
          const { error: deptError } = await supabase
            .from("production_departments")
            .delete()
            .eq("id", department.id);

          if (deptError) throw deptError;

          // Update state
          setProductionDepartments((prev) =>
            prev.filter((dept) => dept.id !== department.id)
          );
          setProductionItems((prev) =>
            prev.filter((item) => item.department !== department.name)
          );

          // Clear active section if deleted
          if (activeSection === department.name) {
            setActiveSection("");
            setActiveProductionDepartment("");
          }

          toast.success("Department deleted successfully!");
          await loadAllData();
          setLoading("deleteDepartment", false);
        } catch (error) {
          toast.error("Error deleting department: " + error.message);
          setLoading("deleteDepartment", false);
        }
      }
    );
  };

  // Delete production item from Supabase
  const deleteProductionItem = async (itemId, itemName) => {
    showConfirmation(
      "Delete Production Item",
      `Are you sure you want to delete <strong>${itemName}</strong> from production?`,
      async () => {
        try {
          setLoading("deleteItem", true);

          const { error } = await supabase
            .from("production_items")
            .delete()
            .eq("id", itemId);

          if (error) throw error;

          toast.success("Production item deleted successfully!");
          await loadAllData();
          setLoading("deleteItem", false);
        } catch (error) {
          toast.error("Error deleting production item: " + error.message);
          setLoading("deleteItem", false);
        }
      }
    );
  };

  // Handle move back quantity change
  const handleMoveBackQuantityChange = (itemId, quantity) => {
    const item = productionItems.find((item) => item.id === itemId);
    const maxQuantity = parseFloat(item.moveQuantity);
    setMoveBackQuantity((prev) => ({
      ...prev,
      [itemId]: Math.min(
        Math.max(0.01, parseFloat(quantity)),
        maxQuantity
      ),
    }));
  };

  // Optimized function to load only production data
  const loadProductionDataOnly = async () => {
    try {
      const { data: productionItemsData, error: productionItemsError } =
        await supabase
          .from("production_items")
          .select(
            `
          *,
          stocks (
            bare_code,
            part_no,
            name,
            price
          ),
          stock_variants!inner (
            bare_code,
            price,
            quantity,
            using_quantity
          )
        `
          )
          .order("created_at", { ascending: false });

      if (!productionItemsError && productionItemsData) {
        const validItems = productionItemsData.map((item) => ({
          id: item.id,
          BareCode: item.stock_variants?.bare_code || item.stocks?.bare_code || "N/A",
          PartNo: item.stocks?.part_no || "N/A",
          name: item.stocks?.name || "Unknown Product",
          price:
            parseFloat(item.stock_variants?.price) ||
            parseFloat(item.stocks?.price) ||
            0,
          moveQuantity: parseFloat(item.move_quantity) || 0,
          moveDate: item.move_date,
          moveTime: item.move_time,
          department: item.department,
          stockId: item.stock_id,
          variantId: item.variant_id,
          departmentId: item.department_id,
          variantPrice: parseFloat(item.stock_variants?.price) || 0,
          createdAt: item.created_at,
        }));

        setProductionItems(validItems);
      }
    } catch (error) {
      console.error("Error loading production items:", error);
    }
  };

  // Move item back to stock with decimal support
  const moveItemBackToStock = async (item) => {
    const quantityToMove = parseFloat(moveBackQuantity[item.id]) || parseFloat(item.moveQuantity);

    try {
      setLoading("moveBack", true);

      // Find variant by barcode
      const { data: variant, error: variantError } = await supabase
        .from("stock_variants")
        .select("*")
        .eq("bare_code", item.BareCode)
        .single();

      if (variantError) throw variantError;

      // Move from using_quantity back to available quantity with decimal support
      const currentUsingQty = parseFloat(variant.using_quantity) || 0;
      if (currentUsingQty < quantityToMove) {
        toast.error(
          `Cannot move back ${quantityToMove.toFixed(2)}. Only ${currentUsingQty.toFixed(2)} in use.`
        );
        return;
      }

      const newVariantUsing = Math.max(0, currentUsingQty - quantityToMove);
      const newVariantQty = (parseFloat(variant.quantity) || 0) + quantityToMove;

      // Update variant quantities with decimal support
      const { error: updateVariantError } = await supabase
        .from("stock_variants")
        .update({
          using_quantity: parseFloat(newVariantUsing.toFixed(2)),
          quantity: parseFloat(newVariantQty.toFixed(2)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id);

      if (updateVariantError) throw updateVariantError;

      // Record stock movement
      await supabase.from("stock_movements").insert([
        {
          variant_id: variant.id,
          movement_type: "in",
          quantity: quantityToMove,
          remaining_quantity: parseFloat(newVariantQty.toFixed(2)),
          reference_type: "production_return",
          movement_date: new Date().toISOString(),
        },
      ]);

      // Update stock totals with decimal support
      const { data: stock, error: stockError } = await supabase
        .from("stocks")
        .select("quantity, using_quantity")
        .eq("id", variant.stock_id)
        .single();

      if (!stockError) {
        const currentStockUsing = parseFloat(stock.using_quantity) || 0;
        const newStockUsing = Math.max(0, currentStockUsing - quantityToMove);
        const newStockQty = (parseFloat(stock.quantity) || 0) + quantityToMove;

        await supabase
          .from("stocks")
          .update({
            using_quantity: parseFloat(newStockUsing.toFixed(2)),
            quantity: parseFloat(newStockQty.toFixed(2)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", variant.stock_id);
      }

      if (quantityToMove === parseFloat(item.moveQuantity)) {
        // Delete if all items moved back
        const { error: deleteError } = await supabase
          .from("production_items")
          .delete()
          .eq("id", item.id);

        if (deleteError) throw deleteError;
      } else {
        // Update quantity if partial move with decimal support
        const { error: updateItemError } = await supabase
          .from("production_items")
          .update({
            move_quantity: parseFloat(
              (parseFloat(item.moveQuantity) - quantityToMove).toFixed(2)
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (updateItemError) throw updateItemError;
      }

      toast.success(`Moved ${quantityToMove.toFixed(2)} ${item.name} back to stock`);
      setMoveBackQuantity((prev) => {
        const newState = { ...prev };
        delete newState[item.id];
        return newState;
      });
      setSelectedItemForMove(null);

      // Optimized reload - only reload production data
      await loadProductionDataOnly();

      // Close modal
      if (moveBackModalRef.current) {
        const modal = bootstrap.Modal.getInstance(moveBackModalRef.current);
        modal?.hide();
      }

      setLoading("moveBack", false);
    } catch (error) {
      toast.error("Error moving back to stock: " + error.message);
      setLoading("moveBack", false);
    }
  };

  // BMR Scanner Functions
  const handleBMRScan = (err, result) => {
    if (result) {
      playSimpleBeep();

      const scannedBarcode = result.text;

      // Find product by barcode in current production department
      const foundProduct = productionItems.find(
        (p) => p.BareCode === scannedBarcode && p.department === activeSection
      );

      if (foundProduct) {
        // Get variant details for this barcode
        const getVariantDetails = async () => {
          try {
            const { data: variant, error: variantError } = await supabase
              .from("stock_variants")
              .select("*")
              .eq("bare_code", scannedBarcode)
              .single();

            if (variantError) {
              console.error("Error finding variant:", variantError);
              return;
            }

            const availableQty = foundProduct.moveQuantity;

            if (availableQty <= 0) {
              toast.error(`${foundProduct.name} has no available quantity!`);
              return;
            }

            // Check if product already exists in scanned list
            const existingProductIndex = scannedBMRProducts.findIndex(
              (p) => p.BareCode === scannedBarcode
            );

            if (existingProductIndex !== -1) {
              // Update existing product quantity
              const updatedProducts = [...scannedBMRProducts];
              const currentMoveQty =
                updatedProducts[existingProductIndex].bmrMoveQuantity || "";

              if (currentMoveQty === "") {
                updatedProducts[existingProductIndex] = {
                  ...updatedProducts[existingProductIndex],
                  bmrMoveQuantity: "0.1",
                  variantData: variant,
                };
                setScannedBMRProducts(updatedProducts);
                toast.success(`Set quantity for ${foundProduct.name} to 0.1`);
              } else {
                updatedProducts[existingProductIndex].variantData = variant;
                setScannedBMRProducts(updatedProducts);
              }
            } else {
              // Add new product with variant details
              setScannedBMRProducts((prev) => [
                ...prev,
                {
                  ...foundProduct,
                  id: foundProduct.id,
                  variantId: variant.id,
                  variantData: variant,
                  bmrMoveQuantity: "",
                  originalQuantity: foundProduct.moveQuantity,
                  availableQuantity: availableQty,
                },
              ]);
              toast.success(
                `Added to BMR: ${foundProduct.name} - Please enter quantity`
              );
            }
          } catch (error) {
            console.error("Error fetching variant details:", error);
            toast.error("Error fetching product details");
          }
        };

        getVariantDetails();
      } else {
        toast.error("Product not found in current production department!");
      }
    }

    if (err) {
      console.error("BMR Scan error:", err);
    }
  };

  const handleBMRCameraError = (err) => {
    console.error("BMR Camera error:", err);
    setCameraErrorBMR(true);
    toast.error(
      "Camera access denied or not available. Please check permissions."
    );
    setScanningBMR(false);
  };

  const startBMRScanner = (useBackCamera = false) => {
    setCameraErrorBMR(false);
    setUsingBackCameraBMR(useBackCamera);
    setScanningBMR(true);
  };

  const stopBMRScanner = () => {
    setScanningBMR(false);
  };

  const switchBMRCamera = () => {
    setUsingBackCameraBMR((prev) => !prev);
  };

  // BMR quantity change handler
  const handleBMRQuantityChange = (productId, value) => {
    if (value === "" || value === "0" || value === "0.") {
      setScannedBMRProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? { ...product, bmrMoveQuantity: value }
            : product
        )
      );
      return;
    }

    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue < 0) return;

    const product = scannedBMRProducts.find((p) => p.id === productId);
    const maxQuantity = product ? product.moveQuantity : 0;

    const validQuantity = Math.min(parsedValue, maxQuantity);

    setScannedBMRProducts((prev) =>
      prev.map((product) =>
        product.id === productId
          ? { ...product, bmrMoveQuantity: validQuantity.toString() }
          : product
      )
    );
  };

  const removeBMRScannedProduct = (productId) => {
    setScannedBMRProducts((prev) => prev.filter((p) => p.id !== productId));
    toast.success("Product removed from BMR list");
  };

  const clearAllBMRScanned = () => {
    showConfirmation(
      "Clear All Scanned",
      "Are you sure you want to clear all scanned products from BMR?",
      () => {
        setScannedBMRProducts([]);
        toast.success("All BMR products cleared");
      },
      "warning"
    );
  };

  // Manual barcode input for BMR
  const handleManualBarcodeInput = (e) => {
    if (e.key === "Enter" && manualBarcodeInput.trim()) {
      playSimpleBeep();

      const foundProduct = productionItems.find(
        (p) =>
          p.BareCode === manualBarcodeInput.trim() &&
          p.department === activeSection
      );

      if (foundProduct) {
        // Get variant details
        const getVariantDetails = async () => {
          try {
            const { data: variant, error: variantError } = await supabase
              .from("stock_variants")
              .select("*")
              .eq("bare_code", manualBarcodeInput.trim())
              .single();

            if (variantError) {
              console.error("Error finding variant:", variantError);
              toast.error("Product variant not found!");
              setManualBarcodeInput("");
              return;
            }

            const availableQty = foundProduct.moveQuantity;

            if (availableQty <= 0) {
              toast.error(`${foundProduct.name} has no available quantity!`);
              setManualBarcodeInput("");
              return;
            }

            const existingProductIndex = scannedBMRProducts.findIndex(
              (p) => p.BareCode === manualBarcodeInput.trim()
            );

            if (existingProductIndex !== -1) {
              const updatedProducts = [...scannedBMRProducts];
              const currentMoveQty =
                updatedProducts[existingProductIndex].bmrMoveQuantity || "";

              if (currentMoveQty === "") {
                updatedProducts[existingProductIndex] = {
                  ...updatedProducts[existingProductIndex],
                  bmrMoveQuantity: "0.1",
                  variantData: variant,
                };
                setScannedBMRProducts(updatedProducts);
                toast.success(`Set quantity for ${foundProduct.name} to 0.1`);
              } else {
                updatedProducts[existingProductIndex].variantData = variant;
                setScannedBMRProducts(updatedProducts);
              }
            } else {
              setScannedBMRProducts((prev) => [
                ...prev,
                {
                  ...foundProduct,
                  id: foundProduct.id,
                  variantId: variant.id,
                  variantData: variant,
                  bmrMoveQuantity: "",
                  originalQuantity: foundProduct.moveQuantity,
                  availableQuantity: availableQty,
                },
              ]);
              toast.success(
                `Added to BMR: ${foundProduct.name} - Please enter quantity`
              );
            }
            setManualBarcodeInput("");
          } catch (error) {
            console.error("Error fetching variant details:", error);
            toast.error("Error fetching product details");
            setManualBarcodeInput("");
          }
        };

        getVariantDetails();
      } else {
        toast.error("Product not found in current production department!");
        setManualBarcodeInput("");
      }
    }
  };

  // Get saved template data
  const getTemplateDataForBMR = (bmrId) => {
    const template = savedTemplates[bmrId];
    if (!template || !template.templateData) return [];

    const productsByPartNo = {};
    scannedBMRProducts.forEach((product) => {
      if (!productsByPartNo[product.PartNo]) {
        productsByPartNo[product.PartNo] = [];
      }
      productsByPartNo[product.PartNo].push(product);
    });

    return template.templateData.map((templateItem) => {
      const matchingProducts = productsByPartNo[templateItem.partNo] || [];

      if (matchingProducts.length > 0) {
        const totalQuantity = matchingProducts.reduce(
          (sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 0),
          0
        );
        const barcodes = matchingProducts.map((p) => p.BareCode).join(", ");
        const variantDetails = matchingProducts.map((p) => ({
          barcode: p.BareCode,
          price: p.price || 0,
          qty: parseFloat(p.bmrMoveQuantity) || 0,
          variantId: p.variantId,
        }));
        const totalPrice = matchingProducts.reduce((sum, p) => {
          const price = p.price || 0;
          const qty = parseFloat(p.bmrMoveQuantity) || 0;
          return sum + price * qty;
        }, 0);
        const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;

        return {
          ...templateItem,
          internalSerialNo: barcodes,
          quantity: totalQuantity,
          price: averagePrice.toFixed(2),
          issuedBy: initialCode,
          variantDetails: JSON.stringify(variantDetails),
          totalPrice: totalPrice.toFixed(2),
        };
      }

      return templateItem;
    });
  };

  // Update BMR template data in database
  const updateBMRTemplateDataInDatabase = async (
    bmrId,
    templateData,
    scannedProducts
  ) => {
    try {
      const { error: deleteError } = await supabase
        .from("bmr_template_data")
        .delete()
        .eq("template_id", bmrId);

      if (deleteError) throw deleteError;

      if (templateData && templateData.length > 0) {
        const dataToInsert = templateData.map((item) => ({
          template_id: bmrId,
          raw_material: item.rawMaterial || "",
          part_no: item.partNo || "",
          internal_serial_no: item.internalSerialNo || "",
          description: item.description || "",
          assembly_name: item.assemblyName || "",
          quantity: item.quantity || 1,
          price: item.price || 0,
          total_price: item.totalPrice || 0,
          issued_by: item.issuedBy || "",
          received_by: item.receivedBy || "",
          variant_details: item.variantDetails || null,
        }));

        const { error: insertError } = await supabase
          .from("bmr_template_data")
          .insert(dataToInsert);

        if (insertError) throw insertError;
      }

      const updatedTemplates = {
        ...savedTemplates,
        [bmrId]: {
          ...savedTemplates[bmrId],
          templateData: templateData,
          scannedProducts: scannedProducts,
          savedAt: new Date().toISOString(),
        },
      };
      setSavedTemplates(updatedTemplates);
      localStorage.setItem(
        "bmrSavedTemplates",
        JSON.stringify(updatedTemplates)
      );
    } catch (error) {
      console.error("Error updating BMR template data in database:", error);
      throw error;
    }
  };

  // Move to BMR function
  const moveToBMR = async (bmrId) => {
    if (scannedBMRProducts.length === 0) {
      toast.error("No products scanned for BMR!");
      return;
    }

    const productsWithoutQuantity = scannedBMRProducts.filter(
      (p) => !p.bmrMoveQuantity || parseFloat(p.bmrMoveQuantity) <= 0
    );
    if (productsWithoutQuantity.length > 0) {
      toast.error(
        `Please enter quantity for ${productsWithoutQuantity.length} product(s)!`
      );
      return;
    }

    if (!bmrId) {
      toast.error("Please select a BMR!");
      return;
    }

    if (!initialCode.trim()) {
      toast.error("Please enter initial code!");
      return;
    }

    showConfirmation(
      "Move to BMR",
      `Are you sure you want to move ${scannedBMRProducts.length} product(s) to BMR? This action cannot be undone.`,
      async () => {
        try {
          setLoading("moveToBMR", true);

          const selectedBmrTemplate = bmrTemplates.find(
            (bmr) => bmr.id === bmrId
          );
          if (!selectedBmrTemplate) {
            toast.error("Selected BMR template not found!");
            setLoading("moveToBMR", false);
            return;
          }

          // Group scanned products by PartNo
          const productsByPartNo = {};
          scannedBMRProducts.forEach((product) => {
            if (!productsByPartNo[product.PartNo]) {
              productsByPartNo[product.PartNo] = [];
            }
            productsByPartNo[product.PartNo].push(product);
          });

          // Create template data
          const templateData = Object.entries(productsByPartNo).map(
            ([partNo, products]) => {
              const firstProduct = products[0];
              const totalQuantity = products.reduce(
                (sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 0),
                0
              );
              const barcodes = products.map((p) => p.BareCode).join(", ");
              const variantDetails = products.map((p) => ({
                barcode: p.BareCode,
                price: p.price || 0,
                qty: parseFloat(p.bmrMoveQuantity) || 0,
                variantId: p.variantId,
              }));
              const totalPrice = products.reduce((sum, p) => {
                const price = p.price || 0;
                const qty = parseFloat(p.bmrMoveQuantity) || 0;
                return sum + price * qty;
              }, 0);
              const averagePrice =
                totalQuantity > 0 ? totalPrice / totalQuantity : 0;

              return {
                rawMaterial: firstProduct.name,
                partNo: partNo,
                internalSerialNo: barcodes,
                description: "",
                assemblyName: selectedBmrTemplate.assemblyName || "",
                quantity: totalQuantity,
                price: averagePrice.toFixed(2),
                totalPrice: totalPrice.toFixed(2),
                issuedBy: initialCode,
                receivedBy: "",
                variantDetails: JSON.stringify(variantDetails),
              };
            }
          );

          // Update production items
          for (const scannedProduct of scannedBMRProducts) {
            const moveQty = parseFloat(scannedProduct.bmrMoveQuantity) || 0;
            const newMoveQuantity = scannedProduct.moveQuantity - moveQty;

            if (newMoveQuantity <= 0) {
              const { error: deleteError } = await supabase
                .from("production_items")
                .delete()
                .eq("id", scannedProduct.id);

              if (deleteError) throw deleteError;
            } else {
              const { error: updateError } = await supabase
                .from("production_items")
                .update({
                  move_quantity: newMoveQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", scannedProduct.id);

              if (updateError) throw updateError;
            }
          }

          // Update BMR template data in database
          await updateBMRTemplateDataInDatabase(
            bmrId,
            templateData,
            scannedBMRProducts
          );

          // Create BMR list entry
          const bmrEntryId = Date.now() + Math.random();
          const serialNo = `BMR-${Date.now()}`;

          const bmrEntry = {
            id: bmrEntryId,
            bmrName: selectedBmrTemplate.name,
            bmrTemplateId: bmrId,
            initialCode: initialCode,
            products: scannedBMRProducts,
            productsByPartNo: productsByPartNo,
            templateData: templateData,
            department: activeSection,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
            status: "active",
            serialNo: serialNo,
            movedFrom: "production",
          };

          // Add to BMR list
          const updatedBmrList = [...bmrList, bmrEntry];
          setBmrList(updatedBmrList);
          localStorage.setItem("bmrList", JSON.stringify(updatedBmrList));

          toast.success(
            `Moved ${scannedBMRProducts.length} product(s) from Production to ${selectedBmrTemplate.name}`
          );

          setScannedBMRProducts([]);
          setSelectedBMR("");
          setInitialCode("");
          stopBMRScanner();
          await loadAllData();

          // Close modal
          if (moveToBMRModalRef.current) {
            const modal = bootstrap.Modal.getInstance(moveToBMRModalRef.current);
            modal?.hide();
          }

          setLoading("moveToBMR", false);
        } catch (error) {
          console.error("Error moving to BMR:", error);
          toast.error("Error moving to BMR: " + error.message);
          setLoading("moveToBMR", false);
        }
      },
      "info"
    );
  };

  const switching = () => {
    const currentDepartment = productionDepartments.find(
      (dept) => dept.name === activeSection
    );
    const departmentHasAssembly = currentDepartment
      ? currentDepartment.has_assembly
      : true;

    return (
      <div className="card mt-3 border-0 shadow-lg">
        <div className="card-header bg-gradient bg-primary text-white py-3">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
            <div className="mb-2 mb-md-0">
              <h5 className="mb-1">
                <i className="fas fa-industry me-2"></i>
                {activeSection} Production
              </h5>
              <p className="mb-0 opacity-75">
                <i className="fas fa-boxes me-1"></i>
                {filteredProductionItems.length} items in production
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-light btn-hover-shadow"
                data-bs-toggle="modal"
                data-bs-target="#Move"
                disabled={
                  filteredProductionItems.length === 0 || loadingStates.moveToBMR
                }
              >
                {loadingStates.moveToBMR ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-arrow-right me-2"></i>
                    Move to BMR
                  </>
                )}
              </button>
              <button
                className="btn btn-success btn-hover-shadow"
                onClick={() => navigate("/BMR")}
                disabled={loadingStates.deleteItem || loadingStates.moveBack}
              >
                <i className="fas fa-clipboard-list me-2"></i>
                BMR Dashboard
              </button>
              <button
                className="btn btn-outline-light btn-hover-shadow"
                onClick={() => startEditDepartment(currentDepartment)}
                data-bs-toggle="modal"
                data-bs-target="#editDepartmentModal"
                disabled={loadingStates.editDepartment}
                title="Edit Department"
              >
                <i className="fas fa-edit"></i>
              </button>
              <button
                className="btn btn-outline-light btn-hover-shadow"
                onClick={() => deleteDepartment(currentDepartment)}
                disabled={loadingStates.deleteDepartment}
                title="Delete Department"
              >
                {loadingStates.deleteDepartment ? (
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : (
                  <i className="fas fa-trash"></i>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-6">
              <div className="d-flex align-items-center">
                <div className="bg-light rounded-circle p-3 me-3">
                  <i className="fas fa-cogs text-primary fa-lg"></i>
                </div>
                <div>
                  <h6 className="mb-1">Assembly Type</h6>
                  <span className={`badge ${departmentHasAssembly ? 'bg-info' : 'bg-secondary'}`}>
                    {departmentHasAssembly
                      ? "With Main & Sub Assembly"
                      : "With Simple Assemblies Only"}
                  </span>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex align-items-center">
                <div className="bg-light rounded-circle p-3 me-3">
                  <i className="fas fa-box text-primary fa-lg"></i>
                </div>
                <div>
                  <h6 className="mb-1">Total Items</h6>
                  <span className="badge bg-primary fs-6">
                    {filteredProductionItems.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {filteredProductionItems.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover table-striped align-middle">
                <thead className="table-dark">
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Barcode</th>
                    <th scope="col">Part No</th>
                    <th scope="col">Product</th>
                    <th scope="col">Price</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Move Date/Time</th>
                    <th scope="col" className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductionItems.map((item, index) => (
                    <tr key={item.id}>
                      <th scope="row">{index + 1}</th>
                      <td>
                        <code className="bg-light p-1 rounded">{item.BareCode}</code>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{item.PartNo}</span>
                      </td>
                      <td>
                        <div className="fw-semibold">{item.name}</div>
                      </td>
                      <td>
                        <span className="text-success fw-bold">
                          ₹{item.price.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-info rounded-pill px-3 py-2">
                          {item.moveQuantity.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <div className="small">
                          <div className="text-primary">
                            <i className="fas fa-calendar me-1"></i>
                            {item.moveDate}
                          </div>
                          <div className="text-secondary">
                            <i className="fas fa-clock me-1"></i>
                            {item.moveTime}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className="btn btn-sm btn-outline-success btn-hover-shadow"
                            onClick={() => setSelectedItemForMove(item)}
                            data-bs-toggle="modal"
                            data-bs-target="#moveBackModal"
                            title="Move back to stock"
                            disabled={loadingStates.moveBack || loadingStates.deleteItem}
                          >
                            <i className="fas fa-arrow-left me-1"></i>
                            Return
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger btn-hover-shadow"
                            onClick={() => deleteProductionItem(item.id, item.name)}
                            title="Delete item"
                            disabled={loadingStates.deleteItem}
                          >
                            {loadingStates.deleteItem ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              ></span>
                            ) : (
                              <i className="fas fa-trash"></i>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <div className="mb-4">
                <i className="fas fa-box-open fa-4x text-muted opacity-50"></i>
              </div>
              <h5 className="text-muted mb-3">No Products in Production</h5>
              <p className="text-muted mb-4">
                There are no products currently moved to {activeSection}.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid px-lg-4 py-3 mt-3">
      {/* Confirmation Modal */}
      <div
        className="modal fade"
        id="confirmationModal"
        tabIndex="-1"
        aria-labelledby="confirmationModalLabel"
        aria-hidden="true"
        ref={confirmationModalRef}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className={`modal-header bg-${confirmationData.type} text-white`}>
              <h5 className="modal-title" id="confirmationModalLabel">
                <i className={`fas fa-${confirmationData.type === 'danger' ? 'exclamation-triangle' : 
                  confirmationData.type === 'warning' ? 'exclamation-circle' : 'info-circle'} me-2`}></i>
                {confirmationData.title}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <div className="text-center mb-4">
                <i className={`fas fa-${confirmationData.type === 'danger' ? 'exclamation-triangle' : 
                  confirmationData.type === 'warning' ? 'exclamation-circle' : 'question-circle'} fa-3x text-${confirmationData.type} mb-3`}></i>
                <p dangerouslySetInnerHTML={{ __html: confirmationData.message }}></p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                data-bs-dismiss="modal"
              >
                <i className="fas fa-times me-2"></i>
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-${confirmationData.type}`}
                onClick={handleConfirmation}
              >
                <i className="fas fa-check me-2"></i>
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Department Modal */}
      <div
        className="modal fade"
        id="editDepartmentModal"
        tabIndex="-1"
        aria-labelledby="editDepartmentModalLabel"
        aria-hidden="true"
        ref={editDepartmentModalRef}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title" id="editDepartmentModalLabel">
                <i className="fas fa-edit me-2"></i>
                Edit Department
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {loadingStates.editDepartment ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Saving changes...</p>
                </div>
              ) : editingDepartment ? (
                <>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      <i className="fas fa-building me-2"></i>
                      Department Name
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter department name"
                      value={newDepartmentName}
                      onChange={(e) => setNewDepartmentName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={hasAssembly}
                        onChange={(e) => setHasAssembly(e.target.checked)}
                        id="hasAssemblySwitch"
                      />
                      <label
                        className="form-check-label fw-semibold"
                        htmlFor="hasAssemblySwitch"
                      >
                        <i className="fas fa-sitemap me-2"></i>
                        Main & Sub Assembly Structure
                      </label>
                    </div>
                    <div className="text-muted small mt-2 ps-4">
                      {hasAssembly
                        ? "Department will use Main & Sub Assembly structure (like VIT-P, R&D-P)"
                        : "Department will use simple Assemblies structure (like CONSUMABLES-P)"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <i className="fas fa-exclamation-circle fa-3x text-warning mb-3"></i>
                  <p>No department selected for editing.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                data-bs-dismiss="modal"
                disabled={loadingStates.editDepartment}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveEditDepartment}
                disabled={
                  !editingDepartment ||
                  !newDepartmentName.trim() ||
                  loadingStates.editDepartment
                }
              >
                {loadingStates.editDepartment ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-2"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move Back to Stock Modal */}
      <div
        className="modal fade"
        id="moveBackModal"
        tabIndex="-1"
        aria-labelledby="moveBackModalLabel"
        aria-hidden="true"
        ref={moveBackModalRef}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-info text-white">
              <h5 className="modal-title" id="moveBackModalLabel">
                <i className="fas fa-arrow-left me-2"></i>
                Return to Stock
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {loadingStates.moveBack ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-info" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Processing return...</p>
                </div>
              ) : selectedItemForMove ? (
                <>
                  <div className="text-center mb-4">
                    <div className="bg-light rounded-circle p-3 d-inline-block mb-3">
                      <i className="fas fa-arrow-left fa-2x text-info"></i>
                    </div>
                    <h6 className="fw-bold">{selectedItemForMove.name}</h6>
                    <div className="row mt-3">
                      <div className="col-6">
                        <div className="bg-light p-2 rounded text-center">
                          <small className="text-muted d-block">Available</small>
                          <span className="fw-bold text-primary">
                            {selectedItemForMove.moveQuantity.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="bg-light p-2 rounded text-center">
                          <small className="text-muted d-block">Barcode</small>
                          <code>{selectedItemForMove.BareCode}</code>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      <i className="fas fa-balance-scale me-2"></i>
                      Quantity to Return
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-lg"
                      placeholder="Enter quantity"
                      min="0.01"
                      step="0.01"
                      max={selectedItemForMove.moveQuantity}
                      value={
                        moveBackQuantity[selectedItemForMove.id] ||
                        selectedItemForMove.moveQuantity
                      }
                      onChange={(e) =>
                        handleMoveBackQuantityChange(
                          selectedItemForMove.id,
                          parseFloat(e.target.value) || 0.01
                        )
                      }
                    />
                    <div className="form-text">
                      Maximum: {selectedItemForMove.moveQuantity.toFixed(2)} units
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <i className="fas fa-exclamation-circle fa-3x text-warning mb-3"></i>
                  <p>No item selected for return.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                data-bs-dismiss="modal"
                disabled={loadingStates.moveBack}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-info text-white"
                onClick={() => moveItemBackToStock(selectedItemForMove)}
                disabled={!selectedItemForMove || loadingStates.moveBack}
              >
                {loadingStates.moveBack ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check me-2"></i>
                    Return to Stock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to BMR Modal */}
      <div
        className="modal fade"
        id="Move"
        tabIndex="-1"
        aria-labelledby="bmr"
        aria-hidden="true"
        ref={moveToBMRModalRef}
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient bg-primary text-white">
              <h5 className="modal-title" id="bmr">
                <i className="fas fa-clipboard-list me-2"></i>
                Move Products to BMR - {activeSection}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={stopBMRScanner}
              ></button>
            </div>
            <div className="modal-body">
              {loadingStates.moveToBMR ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Processing BMR move...</p>
                </div>
              ) : (
                <>
                  {/* Scanner Section */}
                  <div className="card mb-4 border-0 shadow-sm">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="fas fa-barcode me-2"></i>
                        Scanner Interface
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        <button
                          className={`btn ${
                            scanningBMR && !usingBackCameraBMR
                              ? "btn-warning"
                              : "btn-outline-primary"
                          }`}
                          onClick={() => startBMRScanner(false)}
                        >
                          <i className="fas fa-camera me-2"></i>
                          Front Camera
                        </button>

                        <button
                          className={`btn ${
                            scanningBMR && usingBackCameraBMR
                              ? "btn-warning"
                              : "btn-outline-secondary"
                          }`}
                          onClick={() => startBMRScanner(true)}
                        >
                          <i className="fas fa-camera-rotate me-2"></i>
                          Back Camera
                        </button>

                        {scanningBMR && (
                          <button
                            className="btn btn-outline-info"
                            onClick={switchBMRCamera}
                          >
                            <i className="fas fa-sync-alt me-2"></i>
                            Switch Camera
                          </button>
                        )}

                        {scanningBMR && (
                          <button
                            className="btn btn-outline-danger"
                            onClick={stopBMRScanner}
                          >
                            <i className="fas fa-stop me-2"></i>
                            Stop Scanner
                          </button>
                        )}

                        {scannedBMRProducts.length > 0 && (
                          <button
                            className="btn btn-outline-danger"
                            onClick={clearAllBMRScanned}
                          >
                            <i className="fas fa-trash me-2"></i>
                            Clear All ({scannedBMRProducts.length})
                          </button>
                        )}
                      </div>

                      {/* Manual Input */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          <i className="fas fa-keyboard me-2"></i>
                          Manual Barcode Entry
                        </label>
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Type barcode and press Enter"
                            value={manualBarcodeInput}
                            onChange={(e) => setManualBarcodeInput(e.target.value)}
                            onKeyPress={handleManualBarcodeInput}
                          />
                          <span className="input-group-text">
                            <i className="fas fa-arrow-right"></i>
                          </span>
                        </div>
                      </div>

                      {cameraErrorBMR && (
                        <div className="alert alert-warning">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          Camera not available. Please check permissions or use
                          manual input.
                        </div>
                      )}

                      {scanningBMR && !cameraErrorBMR && (
                        <div className="text-center">
                          <div className="scanner-container border rounded p-3 bg-dark">
                            <BarcodeScannerComponent
                              width={500}
                              height={300}
                              onUpdate={handleBMRScan}
                              onError={handleBMRCameraError}
                              delay={500}
                              facingMode={usingBackCameraBMR ? "environment" : "user"}
                              constraints={{
                                audio: false,
                                video: {
                                  facingMode: usingBackCameraBMR
                                    ? "environment"
                                    : "user",
                                  width: { ideal: 1280 },
                                  height: { ideal: 720 },
                                },
                              }}
                            />
                          </div>
                          <p className="text-muted mt-2">
                            <i className="fas fa-info-circle me-1"></i>
                            Scanning from {activeSection} production department
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scanned Products Table */}
                  <div className="card mb-4 border-0 shadow-sm">
                    <div className="card-header bg-light d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">
                        <i className="fas fa-list me-2"></i>
                        Scanned Products
                      </h6>
                      <span className="badge bg-primary">
                        {scannedBMRProducts.length} items
                      </span>
                    </div>
                    <div className="card-body">
                      {scannedBMRProducts.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-hover">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Barcode</th>
                                <th>Product</th>
                                <th>Part No</th>
                                <th>Available</th>
                                <th>BMR Quantity</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scannedBMRProducts.map((product, index) => (
                                <tr key={product.id}>
                                  <td>{index + 1}</td>
                                  <td>
                                    <code className="bg-light p-1 rounded">
                                      {product.BareCode}
                                    </code>
                                  </td>
                                  <td>
                                    <strong>{product.name}</strong>
                                  </td>
                                  <td>
                                    <span className="badge bg-secondary">
                                      {product.PartNo}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge bg-info">
                                      {product.moveQuantity.toFixed(2)}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center">
                                      <input
                                        type="number"
                                        className="form-control form-control-sm"
                                        style={{ width: "120px" }}
                                        min="0"
                                        step="0.01"
                                        placeholder="Enter Qty"
                                        value={product.bmrMoveQuantity || ""}
                                        onChange={(e) =>
                                          handleBMRQuantityChange(
                                            product.id,
                                            e.target.value
                                          )
                                        }
                                        onFocus={(e) => e.target.select()}
                                      />
                                      <small className="ms-2 text-muted">
                                        Max: {product.moveQuantity.toFixed(2)}
                                      </small>
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() =>
                                        removeBMRScannedProduct(product.id)
                                      }
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <i className="fas fa-barcode fa-3x text-muted mb-3 opacity-50"></i>
                          <p className="text-muted">No products scanned yet.</p>
                          <small className="text-muted">
                            Scan products from {activeSection} production
                            department
                          </small>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BMR Selection */}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="form-label fw-semibold">
                          <i className="fas fa-clipboard me-2"></i>
                          Select BMR Template
                        </label>
                        <select
                          className="form-select"
                          value={selectedBMR}
                          onChange={(e) => setSelectedBMR(e.target.value)}
                          disabled={scannedBMRProducts.length === 0}
                        >
                          <option value="">-- Select BMR Template --</option>
                          {activeBMRs.map((bmr) => (
                            <option key={bmr.id} value={bmr.id}>
                              {bmr.name} ({bmr.initialCode}) - {bmr.productName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="form-label fw-semibold">
                          <i className="fas fa-user-tag me-2"></i>
                          Initial Code (Mandatory)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={initialCode}
                          onChange={(e) => setInitialCode(e.target.value)}
                          placeholder="Enter initial code (e.g., MM)"
                          required
                          disabled={scannedBMRProducts.length === 0}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Template Preview */}
                  {selectedBMR && scannedBMRProducts.length > 0 && (
                    <div className="card mt-4 border-0 shadow-sm">
                      <div className="card-header bg-info text-white">
                        <h6 className="mb-0">
                          <i className="fas fa-eye me-2"></i>
                          Template Preview
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm table-bordered">
                            <thead className="table-light">
                              <tr>
                                <th>Part No</th>
                                <th>Raw Material</th>
                                <th>Barcodes</th>
                                <th>Total Qty</th>
                                <th>Avg Price</th>
                                <th>Total Price</th>
                                <th>Issued By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(
                                scannedBMRProducts.reduce((acc, product) => {
                                  if (!acc[product.PartNo]) {
                                    acc[product.PartNo] = [];
                                  }
                                  acc[product.PartNo].push(product);
                                  return acc;
                                }, {})
                              ).map(([partNo, products], index) => {
                                const totalQuantity = products.reduce(
                                  (sum, p) =>
                                    sum + (parseFloat(p.bmrMoveQuantity) || 0),
                                  0
                                );
                                const totalPrice = products.reduce(
                                  (sum, p) => {
                                    const price = p.price || 0;
                                    const qty =
                                      parseFloat(p.bmrMoveQuantity) || 0;
                                    return sum + price * qty;
                                  },
                                  0
                                );
                                const averagePrice =
                                  totalQuantity > 0
                                    ? totalPrice / totalQuantity
                                    : 0;
                                const barcodes = products
                                  .map((p) => p.BareCode)
                                  .join(", ");

                                return (
                                  <tr key={index}>
                                    <td>
                                      <strong>{partNo}</strong>
                                    </td>
                                    <td>{products[0].name}</td>
                                    <td>
                                      <div className="d-flex flex-wrap gap-1">
                                        {products.map((product, idx) => (
                                          <span
                                            key={idx}
                                            className="badge bg-light text-dark border"
                                          >
                                            {product.BareCode}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td>
                                      <span className="badge bg-primary">
                                        {totalQuantity.toFixed(2)}
                                      </span>
                                    </td>
                                    <td>₹{averagePrice.toFixed(2)}</td>
                                    <td>
                                      <span className="fw-bold text-success">
                                        ₹{totalPrice.toFixed(2)}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="badge bg-secondary">
                                        {initialCode}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                data-bs-dismiss="modal"
                onClick={stopBMRScanner}
                disabled={loadingStates.moveToBMR}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => moveToBMR(selectedBMR)}
                disabled={
                  scannedBMRProducts.length === 0 ||
                  !initialCode.trim() ||
                  !selectedBMR ||
                  loadingStates.moveToBMR
                }
              >
                {loadingStates.moveToBMR ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-arrow-right me-2"></i>
                    Move to BMR ({scannedBMRProducts.length} items)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="card border-0 shadow-lg mb-4">
        <div className="card-header bg-gradient bg-primary text-white">
          <h4 className="mb-0">
            <i className="fas fa-industry me-2"></i>
            Production Management
          </h4>
        </div>
        <div className="card-body">
          {/* Add New Department */}
          <div className="mb-4">
            <h5 className="fw-semibold mb-3">
              <i className="fas fa-plus-circle me-2 text-success"></i>
              Add New Production Department
            </h5>
            <div className="row g-3">
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fas fa-building"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter department name"
                    value={newProduction}
                    onChange={(e) => setNewProduction(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && addNewProduction()
                    }
                    disabled={loadingStates.addDepartment}
                  />
                  <button
                    className="btn btn-success"
                    onClick={addNewProduction}
                    disabled={loadingStates.addDepartment}
                  >
                    {loadingStates.addDepartment ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Adding...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-plus me-2"></i>
                        Add Department
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={hasAssembly}
                    onChange={(e) => setHasAssembly(e.target.checked)}
                    id="assemblySwitch"
                    disabled={loadingStates.addDepartment}
                  />
                  <label
                    className="form-check-label fw-semibold"
                    htmlFor="assemblySwitch"
                  >
                    <i className="fas fa-sitemap me-2"></i>
                    Enable Main & Sub Assembly Structure
                  </label>
                  <div className="text-muted small mt-1">
                    {hasAssembly
                      ? "Department will use Main & Sub Assembly structure (like VIT-P, R&D-P)"
                      : "Department will use simple Assemblies structure (like CONSUMABLES-P)"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Department Buttons */}
          <div>
            <h5 className="fw-semibold mb-3">
              <i className="fas fa-th-list me-2 text-primary"></i>
              Production Departments
            </h5>
            <div className="d-flex flex-wrap gap-2">
              {productionDepartments.map((department, index) => (
                <button
                  key={department.id}
                  className={`btn ${
                    activeSection === department.name
                      ? "btn-primary"
                      : "btn-outline-primary"
                  } btn-department position-relative`}
                  onClick={() => setActiveSection(department.name)}
                  disabled={loadingStates.deleteDepartment || loadingStates.editDepartment}
                >
                  <div className="d-flex align-items-center">
                    <i className="fas fa-warehouse me-2"></i>
                    <div className="text-start">
                      <div className="fw-bold">{department.name}</div>
                      <small className="opacity-75">
                        {department.has_assembly
                          ? "Main & Sub Assembly"
                          : "Simple Assembly"}
                      </small>
                    </div>
                  </div>
                  {activeSection === department.name && (
                    <span className="position-absolute top-0 start-100 translate-middle p-2 bg-success border border-light rounded-circle">
                      <i className="fas fa-check text-white"></i>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Section Display */}
      {activeSection ? (
        switching()
      ) : (
        <div className="card border-0 shadow-lg">
          <div className="card-body text-center py-5">
            <i className="fas fa-hand-pointer fa-4x text-muted mb-4 opacity-50"></i>
            <h4 className="text-muted mb-3">Select a Department</h4>
            <p className="text-muted mb-0">
              Please select a production department above to view and manage its
              items.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Production;