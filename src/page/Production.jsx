import "./Production.css"
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import BarcodeScannerComponent from 'react-qr-barcode-scanner'
import { supabase } from '../supabaseClient'
import { playSimpleBeep } from '../utils/beepSound'

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
  loadAllData
}) {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("");
  const [newProduction, setNewProduction] = useState("");
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [moveBackQuantity, setMoveBackQuantity] = useState({});
  const [selectedItemForMove, setSelectedItemForMove] = useState(null);
  const [hasAssembly, setHasAssembly] = useState(true);
  
  // BMR Move States with multiple barcode support
  const [scanningBMR, setScanningBMR] = useState(false)
  const [scannedBMRProducts, setScannedBMRProducts] = useState([])
  const [cameraErrorBMR, setCameraErrorBMR] = useState(false)
  const [selectedBMR, setSelectedBMR] = useState("")
  const [initialCode, setInitialCode] = useState("")
  const [manualBarcodeInput, setManualBarcodeInput] = useState("")
  const [savedTemplates, setSavedTemplates] = useState({})
  const [usingBackCameraBMR, setUsingBackCameraBMR] = useState(false)
  
  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    addDepartment: false,
    editDepartment: false,
    deleteDepartment: false,
    deleteItem: false,
    moveBack: false,
    moveToBMR: false
  })

  // Refs for modals
  const editDepartmentModalRef = useRef(null);
  const moveBackModalRef = useRef(null);
  const moveToBMRModalRef = useRef(null);

  // Update active production department when section changes
  useEffect(() => {
    if (activeSection) {
      setActiveProductionDepartment(activeSection);
    }
  }, [activeSection, setActiveProductionDepartment]);

  // Load saved templates
  useEffect(() => {
    const saved = localStorage.getItem('bmrSavedTemplates');
    if (saved) {
      setSavedTemplates(JSON.parse(saved));
    }
  }, []);

  // Filter production items by selected department
  const filteredProductionItems = productionItems.filter(item =>
    activeSection ? item.department === activeSection : false
  )

  // Get active BMRs for dropdown
  const activeBMRs = bmrTemplates.filter(bmr => 
    bmr.status === 'active' && savedTemplates[bmr.id] && bmr.department === activeSection
  )

  // Get current department assembly type
  const getCurrentDepartmentAssemblyType = () => {
    if (!activeSection) return true;
    const currentDept = productionDepartments.find(dept => dept.name === activeSection);
    return currentDept ? currentDept.has_assembly : true;
  };

  // Set loading state
  const setLoading = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }))
  }

  // Start edit department
  const startEditDepartment = (department) => {
    setEditingDepartment(department);
    setNewDepartmentName(department.name);
    setHasAssembly(department.has_assembly);
  }

  // Add new production department to Supabase
  const addNewProduction = async () => {
    try {
      setLoading('addDepartment', true)
      
      if (!newProduction.trim()) {
        toast.error('Please enter department name!');
        setLoading('addDepartment', false)
        return;
      }

      if (productionDepartments.find(dept => dept.name === newProduction.trim())) {
        toast.error('This department already exists!');
        setLoading('addDepartment', false)
        return;
      }

      const { data, error } = await supabase
        .from('production_departments')
        .insert([{ 
          name: newProduction.trim(),
          has_assembly: hasAssembly
        }])
        .select()

      if (error) throw error

      setProductionDepartments(prev => [...prev, { 
        id: data[0].id,
        name: newProduction.trim(), 
        has_assembly: hasAssembly 
      }]);
      setNewProduction("");
      setHasAssembly(true);
      toast.success('New production department added!');
      
      await loadAllData();
      setLoading('addDepartment', false)
    } catch (error) {
      console.error('Error adding department:', error);
      toast.error('Error adding department: ' + error.message);
      setLoading('addDepartment', false)
    }
  }

  // Edit department in Supabase
  const saveEditDepartment = async () => {
    if (!editingDepartment) return;
    
    try {
      setLoading('editDepartment', true)
      
      if (newDepartmentName.trim()) {
        const { error } = await supabase
          .from('production_departments')
          .update({ 
            name: newDepartmentName.trim(),
            has_assembly: hasAssembly
          })
          .eq('id', editingDepartment.id)

        if (error) throw error

        // Update production items department name
        const { error: itemsError } = await supabase
          .from('production_items')
          .update({ department: newDepartmentName.trim() })
          .eq('department', editingDepartment.name)

        if (itemsError) throw itemsError

        // Update state
        setProductionDepartments(prev =>
          prev.map(dept => 
            dept.id === editingDepartment.id ? { 
              ...dept, 
              name: newDepartmentName.trim(), 
              has_assembly: hasAssembly 
            } : dept
          )
        );

        // Update active section if needed
        if (activeSection === editingDepartment.name) {
          setActiveSection(newDepartmentName.trim());
        }

        toast.success('Department updated successfully!');
        setEditingDepartment(null);
        setNewDepartmentName("");
        
        // Close modal
        if (editDepartmentModalRef.current) {
          const modal = bootstrap.Modal.getInstance(editDepartmentModalRef.current);
          modal?.hide();
        }
        
        await loadAllData();
      }
      setLoading('editDepartment', false)
    } catch (error) {
      toast.error('Error updating department: ' + error.message);
      setLoading('editDepartment', false)
    }
  }

  // Delete department from Supabase
  const deleteDepartment = async (department) => {
    if (!window.confirm(`Are you sure you want to delete ${department.name}? This will also remove all items in this department.`)) return

    try {
      setLoading('deleteDepartment', true)
      
      // Delete production items first
      const { error: itemsError } = await supabase
        .from('production_items')
        .delete()
        .eq('department', department.name)

      if (itemsError) throw itemsError

      // Delete department
      const { error: deptError } = await supabase
        .from('production_departments')
        .delete()
        .eq('id', department.id)

      if (deptError) throw deptError

      // Update state
      setProductionDepartments(prev => prev.filter(dept => dept.id !== department.id));
      setProductionItems(prev => prev.filter(item => item.department !== department.name));
      
      // Clear active section if deleted
      if (activeSection === department.name) {
        setActiveSection("");
        setActiveProductionDepartment("");
      }
      
      toast.success('Department deleted successfully!');
      await loadAllData();
      setLoading('deleteDepartment', false)
    } catch (error) {
      toast.error('Error deleting department: ' + error.message);
      setLoading('deleteDepartment', false)
    }
  }

  // Delete production item from Supabase
  const deleteProductionItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this production item?')) return

    try {
      setLoading('deleteItem', true)
      
      const { error } = await supabase
        .from('production_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      toast.success('Production item deleted successfully!');
      await loadAllData();
      setLoading('deleteItem', false)
    } catch (error) {
      toast.error('Error deleting production item: ' + error.message);
      setLoading('deleteItem', false)
    }
  }

  // Handle move back quantity change
  const handleMoveBackQuantityChange = (itemId, quantity) => {
    const item = productionItems.find(item => item.id === itemId);
    const maxQuantity = parseFloat(item.moveQuantity);
    setMoveBackQuantity(prev => ({
      ...prev,
      [itemId]: Math.min(Math.max(0.01, parseFloat(quantity)), maxQuantity)
    }));
  }

  // Optimized function to load only production data
  const loadProductionDataOnly = async () => {
    try {
      const { data: productionItemsData, error: productionItemsError } = await supabase
        .from('production_items')
        .select(`
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
        `)
        .order('created_at', { ascending: false })

      if (!productionItemsError && productionItemsData) {
        const validItems = productionItemsData.map(item => ({
          id: item.id,
          BareCode: item.stock_variants?.bare_code || item.stocks?.bare_code || 'N/A',
          PartNo: item.stocks?.part_no || 'N/A',
          name: item.stocks?.name || 'Unknown Product',
          price: parseFloat(item.stock_variants?.price) || parseFloat(item.stocks?.price) || 0,
          moveQuantity: parseFloat(item.move_quantity) || 0,
          moveDate: item.move_date,
          moveTime: item.move_time,
          department: item.department,
          stockId: item.stock_id,
          variantId: item.variant_id,
          departmentId: item.department_id,
          variantPrice: parseFloat(item.stock_variants?.price) || 0,
          createdAt: item.created_at
        }));

        setProductionItems(validItems);
      }
    } catch (error) {
      console.error('Error loading production items:', error);
    }
  }

  // Move item back to stock with decimal support
  const moveItemBackToStock = async (item) => {
    const quantityToMove = parseFloat(moveBackQuantity[item.id]) || parseFloat(item.moveQuantity)

    try {
      setLoading('moveBack', true)
      
      // Find variant by barcode
      const { data: variant, error: variantError } = await supabase
        .from('stock_variants')
        .select('*')
        .eq('bare_code', item.BareCode)
        .single()

      if (variantError) throw variantError

      // Move from using_quantity back to available quantity with decimal support
      const currentUsingQty = parseFloat(variant.using_quantity) || 0
      if (currentUsingQty < quantityToMove) {
        toast.error(`Cannot move back ${quantityToMove.toFixed(2)}. Only ${currentUsingQty.toFixed(2)} in use.`)
        return
      }
      
      const newVariantUsing = Math.max(0, currentUsingQty - quantityToMove)
      const newVariantQty = (parseFloat(variant.quantity) || 0) + quantityToMove

      // Update variant quantities with decimal support
      const { error: updateVariantError } = await supabase
        .from('stock_variants')
        .update({
          using_quantity: parseFloat(newVariantUsing.toFixed(2)),
          quantity: parseFloat(newVariantQty.toFixed(2)),
          updated_at: new Date().toISOString()
        })
        .eq('id', variant.id)

      if (updateVariantError) throw updateVariantError

      // Record stock movement
      await supabase
        .from('stock_movements')
        .insert([{
          variant_id: variant.id,
          movement_type: 'in',
          quantity: quantityToMove,
          remaining_quantity: parseFloat(newVariantQty.toFixed(2)),
          reference_type: 'production_return',
          movement_date: new Date().toISOString()
        }])

      // Update stock totals with decimal support
      const { data: stock, error: stockError } = await supabase
        .from('stocks')
        .select('quantity, using_quantity')
        .eq('id', variant.stock_id)
        .single()

      if (!stockError) {
        const currentStockUsing = parseFloat(stock.using_quantity) || 0
        const newStockUsing = Math.max(0, currentStockUsing - quantityToMove)
        const newStockQty = (parseFloat(stock.quantity) || 0) + quantityToMove

        await supabase
          .from('stocks')
          .update({
            using_quantity: parseFloat(newStockUsing.toFixed(2)),
            quantity: parseFloat(newStockQty.toFixed(2)),
            updated_at: new Date().toISOString()
          })
          .eq('id', variant.stock_id)
      }

      if (quantityToMove === parseFloat(item.moveQuantity)) {
        // Delete if all items moved back
        const { error: deleteError } = await supabase
          .from('production_items')
          .delete()
          .eq('id', item.id)

        if (deleteError) throw deleteError
      } else {
        // Update quantity if partial move with decimal support
        const { error: updateItemError } = await supabase
          .from('production_items')
          .update({
            move_quantity: parseFloat((parseFloat(item.moveQuantity) - quantityToMove).toFixed(2)),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        if (updateItemError) throw updateItemError
      }

      toast.success(`Moved ${quantityToMove.toFixed(2)} ${item.name} back to stock`)
      setMoveBackQuantity(prev => {
        const newState = { ...prev }
        delete newState[item.id]
        return newState
      })
      setSelectedItemForMove(null)
      
      // Optimized reload - only reload production data
      await loadProductionDataOnly()
      
      // Close modal
      if (moveBackModalRef.current) {
        const modal = bootstrap.Modal.getInstance(moveBackModalRef.current)
        modal?.hide()
      }
      
      setLoading('moveBack', false)
    } catch (error) {
      toast.error('Error moving back to stock: ' + error.message)
      setLoading('moveBack', false)
    }
  }

  // BMR Scanner Functions - WITH BEEP SOUND AND MULTIPLE BARCODE SUPPORT
  const handleBMRScan = (err, result) => {
    if (result) {
      playSimpleBeep()
      
      const scannedBarcode = result.text
      
      // Find product by barcode in current production department
      const foundProduct = productionItems.find(p => 
        p.BareCode === scannedBarcode && 
        p.department === activeSection
      )
      
      if (foundProduct) {
        // Get variant details for this barcode
        const getVariantDetails = async () => {
          try {
            const { data: variant, error: variantError } = await supabase
              .from('stock_variants')
              .select('*')
              .eq('bare_code', scannedBarcode)
              .single()

            if (variantError) {
              console.error('Error finding variant:', variantError)
              return
            }

            const availableQty = foundProduct.moveQuantity;
            
            if (availableQty <= 0) {
              toast.error(`${foundProduct.name} has no available quantity!`)
              return
            }

            // Check if product already exists in scanned list
            const existingProductIndex = scannedBMRProducts.findIndex(
              p => p.BareCode === scannedBarcode
            )
            
            if (existingProductIndex !== -1) {
              // Update existing product quantity (increase by 0.1 if empty, otherwise use existing)
              const updatedProducts = [...scannedBMRProducts]
              const currentMoveQty = updatedProducts[existingProductIndex].bmrMoveQuantity || ''
              
              if (currentMoveQty === '') {
                updatedProducts[existingProductIndex] = {
                  ...updatedProducts[existingProductIndex],
                  bmrMoveQuantity: '0.1', // Start with 0.1 if empty
                  variantData: variant
                }
                setScannedBMRProducts(updatedProducts)
                toast.success(`Set quantity for ${foundProduct.name} to 0.1`)
              } else {
                // If already has value, just update variant data
                updatedProducts[existingProductIndex].variantData = variant
                setScannedBMRProducts(updatedProducts)
              }
            } else {
              // Add new product with variant details - EMPTY quantity by default
              setScannedBMRProducts(prev => [
                ...prev,
                {
                  ...foundProduct,
                  id: foundProduct.id,
                  variantId: variant.id,
                  variantData: variant,
                  bmrMoveQuantity: '', // EMPTY BY DEFAULT
                  originalQuantity: foundProduct.moveQuantity,
                  availableQuantity: availableQty
                }
              ])
              toast.success(`Added to BMR: ${foundProduct.name} - Please enter quantity`)
            }
          } catch (error) {
            console.error('Error fetching variant details:', error)
            toast.error('Error fetching product details')
          }
        }

        getVariantDetails()
      } else {
        toast.error('Product not found in current production department!')
      }
    }
    
    if (err) {
      console.error('BMR Scan error:', err)
    }
  }

  const handleBMRCameraError = (err) => {
    console.error('BMR Camera error:', err)
    setCameraErrorBMR(true)
    toast.error('Camera access denied or not available. Please check permissions.')
    setScanningBMR(false)
  }

  const startBMRScanner = (useBackCamera = false) => {
    setCameraErrorBMR(false)
    setUsingBackCameraBMR(useBackCamera)
    setScanningBMR(true)
  }

  const stopBMRScanner = () => {
    setScanningBMR(false)
  }

  const switchBMRCamera = () => {
    setUsingBackCameraBMR(prev => !prev)
  }

  // FIXED: Updated BMR quantity change handler - allows empty, decimal, and proper editing
  const handleBMRQuantityChange = (productId, value) => {
    // Allow empty string or 0
    if (value === '' || value === '0' || value === '0.') {
      setScannedBMRProducts(prev => 
        prev.map(product => 
          product.id === productId 
            ? { ...product, bmrMoveQuantity: value }
            : product
        )
      )
      return
    }
    
    // Parse as float
    const parsedValue = parseFloat(value)
    if (isNaN(parsedValue) || parsedValue < 0) return
    
    // Get the product to check max available quantity
    const product = scannedBMRProducts.find(p => p.id === productId)
    const maxQuantity = product ? product.moveQuantity : 0
    
    // Limit to available quantity
    const validQuantity = Math.min(parsedValue, maxQuantity)
    
    setScannedBMRProducts(prev => 
      prev.map(product => 
        product.id === productId 
          ? { ...product, bmrMoveQuantity: validQuantity.toString() }
          : product
      )
    )
  }

  const removeBMRScannedProduct = (productId) => {
    setScannedBMRProducts(prev => prev.filter(p => p.id !== productId))
    toast.success('Product removed from BMR list')
  }

  const clearAllBMRScanned = () => {
    setScannedBMRProducts([])
    toast.success('All BMR products cleared')
  }

  // Manual barcode input for BMR WITH BEEP
  const handleManualBarcodeInput = (e) => {
    if (e.key === 'Enter' && manualBarcodeInput.trim()) {
      playSimpleBeep()
      
      const foundProduct = productionItems.find(p => 
        p.BareCode === manualBarcodeInput.trim() && 
        p.department === activeSection
      )
      
      if (foundProduct) {
        // Get variant details
        const getVariantDetails = async () => {
          try {
            const { data: variant, error: variantError } = await supabase
              .from('stock_variants')
              .select('*')
              .eq('bare_code', manualBarcodeInput.trim())
              .single()

            if (variantError) {
              console.error('Error finding variant:', variantError)
              toast.error('Product variant not found!')
              setManualBarcodeInput('')
              return
            }

            const availableQty = foundProduct.moveQuantity;
            
            if (availableQty <= 0) {
              toast.error(`${foundProduct.name} has no available quantity!`)
              setManualBarcodeInput('')
              return
            }

            const existingProductIndex = scannedBMRProducts.findIndex(
              p => p.BareCode === manualBarcodeInput.trim()
            )
            
            if (existingProductIndex !== -1) {
              const updatedProducts = [...scannedBMRProducts]
              const currentMoveQty = updatedProducts[existingProductIndex].bmrMoveQuantity || ''
              
              if (currentMoveQty === '') {
                updatedProducts[existingProductIndex] = {
                  ...updatedProducts[existingProductIndex],
                  bmrMoveQuantity: '0.1', // Start with 0.1 if empty
                  variantData: variant
                }
                setScannedBMRProducts(updatedProducts)
                toast.success(`Set quantity for ${foundProduct.name} to 0.1`)
              } else {
                updatedProducts[existingProductIndex].variantData = variant
                setScannedBMRProducts(updatedProducts)
              }
            } else {
              setScannedBMRProducts(prev => [
                ...prev,
                {
                  ...foundProduct,
                  id: foundProduct.id,
                  variantId: variant.id,
                  variantData: variant,
                  bmrMoveQuantity: '', // EMPTY BY DEFAULT
                  originalQuantity: foundProduct.moveQuantity,
                  availableQuantity: availableQty
                }
              ])
              toast.success(`Added to BMR: ${foundProduct.name} - Please enter quantity`)
            }
            setManualBarcodeInput('')
          } catch (error) {
            console.error('Error fetching variant details:', error)
            toast.error('Error fetching product details')
            setManualBarcodeInput('')
          }
        }

        getVariantDetails()
      } else {
        toast.error('Product not found in current production department!')
        setManualBarcodeInput('')
      }
    }
  }

  // Get saved template data and auto-fill based on scanned products with multiple barcode support
  const getTemplateDataForBMR = (bmrId) => {
    const template = savedTemplates[bmrId];
    if (!template || !template.templateData) return [];

    // Group scanned products by PartNo to handle multiple barcodes for same product
    const productsByPartNo = {};
    scannedBMRProducts.forEach(product => {
      if (!productsByPartNo[product.PartNo]) {
        productsByPartNo[product.PartNo] = [];
      }
      productsByPartNo[product.PartNo].push(product);
    });

    // Map template data to include multiple barcodes
    return template.templateData.map(templateItem => {
      const matchingProducts = productsByPartNo[templateItem.partNo] || [];
      
      if (matchingProducts.length > 0) {
        // Calculate totals for multiple barcodes
        const totalQuantity = matchingProducts.reduce((sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 0), 0);
        const barcodes = matchingProducts.map(p => p.BareCode).join(', ');
        const variantDetails = matchingProducts.map(p => ({ 
          barcode: p.BareCode, 
          price: p.price || 0, 
          qty: parseFloat(p.bmrMoveQuantity) || 0,
          variantId: p.variantId
        }));
        const totalPrice = matchingProducts.reduce((sum, p) => {
          const price = p.price || 0;
          const qty = parseFloat(p.bmrMoveQuantity) || 0;
          return sum + (price * qty);
        }, 0);
        const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;

        return {
          ...templateItem,
          internalSerialNo: barcodes,
          quantity: totalQuantity,
          price: averagePrice.toFixed(2),
          issuedBy: initialCode,
          variantDetails: JSON.stringify(variantDetails),
          totalPrice: totalPrice.toFixed(2)
        };
      }

      return templateItem;
    });
  };

  // Update BMR template data in database with multiple barcode support
  const updateBMRTemplateDataInDatabase = async (bmrId, templateData, scannedProducts) => {
    try {
      const { error: deleteError } = await supabase
        .from('bmr_template_data')
        .delete()
        .eq('template_id', bmrId);

      if (deleteError) throw deleteError;

      if (templateData && templateData.length > 0) {
        const dataToInsert = templateData.map(item => ({
          template_id: bmrId,
          raw_material: item.rawMaterial || '',
          part_no: item.partNo || '',
          internal_serial_no: item.internalSerialNo || '',
          description: item.description || '',
          assembly_name: item.assemblyName || '',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total_price: item.totalPrice || 0,
          issued_by: item.issuedBy || '',
          received_by: item.receivedBy || '',
          variant_details: item.variantDetails || null
        }));

        const { error: insertError } = await supabase
          .from('bmr_template_data')
          .insert(dataToInsert);

        if (insertError) throw insertError;
      }

      const updatedTemplates = {
        ...savedTemplates,
        [bmrId]: {
          ...savedTemplates[bmrId],
          templateData: templateData,
          scannedProducts: scannedProducts,
          savedAt: new Date().toISOString()
        }
      };
      setSavedTemplates(updatedTemplates);
      localStorage.setItem('bmrSavedTemplates', JSON.stringify(updatedTemplates));

    } catch (error) {
      console.error('Error updating BMR template data in database:', error);
      throw error;
    }
  };

  // FIXED: Updated moveToBMR function - DO NOT REDUCE using_quantity
  const moveToBMR = async (bmrId) => {
    if (scannedBMRProducts.length === 0) {
      toast.error('No products scanned for BMR!')
      return
    }

    // Check if all products have quantity entered
    const productsWithoutQuantity = scannedBMRProducts.filter(p => !p.bmrMoveQuantity || parseFloat(p.bmrMoveQuantity) <= 0)
    if (productsWithoutQuantity.length > 0) {
      toast.error(`Please enter quantity for ${productsWithoutQuantity.length} product(s)!`)
      return
    }

    if (!bmrId) {
      toast.error('Please select a BMR!')
      return
    }

    if (!initialCode.trim()) {
      toast.error('Please enter initial code!')
      return
    }

    try {
      setLoading('moveToBMR', true)
      
      const selectedBmrTemplate = bmrTemplates.find(bmr => bmr.id === bmrId)
      if (!selectedBmrTemplate) {
        toast.error('Selected BMR template not found!')
        setLoading('moveToBMR', false)
        return
      }

      // Group scanned products by PartNo to handle multiple barcodes
      const productsByPartNo = {};
      scannedBMRProducts.forEach(product => {
        if (!productsByPartNo[product.PartNo]) {
          productsByPartNo[product.PartNo] = [];
        }
        productsByPartNo[product.PartNo].push(product);
      });

      // Create template data with multiple barcode support
      const templateData = Object.entries(productsByPartNo).map(([partNo, products]) => {
        // Get first product for basic info
        const firstProduct = products[0];
        
        // Calculate totals for multiple barcodes
        const totalQuantity = products.reduce((sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 0), 0);
        const barcodes = products.map(p => p.BareCode).join(', ');
        const variantDetails = products.map(p => ({ 
          barcode: p.BareCode, 
          price: p.price || 0, 
          qty: parseFloat(p.bmrMoveQuantity) || 0,
          variantId: p.variantId
        }));
        const totalPrice = products.reduce((sum, p) => {
          const price = p.price || 0;
          const qty = parseFloat(p.bmrMoveQuantity) || 0;
          return sum + (price * qty);
        }, 0);
        const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;

        return {
          rawMaterial: firstProduct.name,
          partNo: partNo,
          internalSerialNo: barcodes,
          description: '', // Removed auto-description as requested
          assemblyName: selectedBmrTemplate.assemblyName || '',
          quantity: totalQuantity,
          price: averagePrice.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
          issuedBy: initialCode,
          receivedBy: '',
          variantDetails: JSON.stringify(variantDetails)
        };
      });

      // FIXED: DO NOT update variant quantities when moving to BMR
      // Materials are still in use, just transferred to BMR processing
      // Keep using_quantity unchanged
      
      // Update production items (remove or reduce quantity from move_quantity)
      for (const scannedProduct of scannedBMRProducts) {
        const moveQty = parseFloat(scannedProduct.bmrMoveQuantity) || 0
        const newMoveQuantity = scannedProduct.moveQuantity - moveQty;
        
        if (newMoveQuantity <= 0) {
          // Delete production item completely
          const { error: deleteError } = await supabase
            .from('production_items')
            .delete()
            .eq('id', scannedProduct.id);

          if (deleteError) throw deleteError;
        } else {
          // Update production item quantity
          const { error: updateError } = await supabase
            .from('production_items')
            .update({
              move_quantity: newMoveQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', scannedProduct.id);

          if (updateError) throw updateError;
        }
      }

      // Update BMR template data in database
      await updateBMRTemplateDataInDatabase(bmrId, templateData, scannedBMRProducts);

      // Create or update BMR list entry
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
        status: 'active',
        serialNo: serialNo,
        movedFrom: 'production'
      };

      // Add to BMR list
      const updatedBmrList = [...bmrList, bmrEntry];
      setBmrList(updatedBmrList);
      localStorage.setItem('bmrList', JSON.stringify(updatedBmrList));

      toast.success(`Moved ${scannedBMRProducts.length} product(s) from Production to ${selectedBmrTemplate.name}`);
      
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
      
      setLoading('moveToBMR', false);
    } catch (error) {
      console.error('Error moving to BMR:', error);
      toast.error('Error moving to BMR: ' + error.message);
      setLoading('moveToBMR', false);
    }
  };

  const switching = () => {
    const currentDepartment = productionDepartments.find(dept => dept.name === activeSection);
    const departmentHasAssembly = currentDepartment ? currentDepartment.has_assembly : true;

    return (
      <div className="card mt-3 p-3 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="text-primary">{activeSection} Production</h5>
          <div>
            <button 
              type="button" 
              className="btn btn-primary me-2" 
              data-bs-toggle="modal" 
              data-bs-target="#Move"
              disabled={filteredProductionItems.length === 0 || loadingStates.moveToBMR}
            >
              {loadingStates.moveToBMR ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing...
                </>
              ) : (
                'Move to BMR'
              )}
            </button>
            <button className="btn btn-success" onClick={() => navigate("/BMR")} disabled={loadingStates.deleteItem || loadingStates.moveBack}>
              BMR (BATCH MANUFACTURING RECORD)
            </button>
            <button
              className="btn btn-sm btn-outline-secondary ms-2"
              onClick={() => startEditDepartment(currentDepartment)}
              data-bs-toggle="modal"
              data-bs-target="#editDepartmentModal"
              disabled={loadingStates.editDepartment}
            >
              <i className="fa-solid fa-pen"></i> Edit
            </button>
            <button
              className="btn btn-sm btn-outline-danger ms-1"
              onClick={() => deleteDepartment(currentDepartment)}
              disabled={loadingStates.deleteDepartment}
            >
              {loadingStates.deleteDepartment ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <><i className="fa-solid fa-trash"></i> Delete</>
              )}
            </button>
          </div>
        </div>
        <p>Products moved to {activeSection}: {filteredProductionItems.length} items</p>
        <p>
          <small className="text-muted">
            Assembly Type: {departmentHasAssembly ? 
              'With Main & Sub Assembly' : 
              'With Simple Assemblies Only'
            }
          </small>
        </p>

        {filteredProductionItems.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-striped table-hover table-bordered caption-top align-middle text-center border-secondary shadow-sm">
              <caption className="fw-bold text-secondary">Production Items</caption>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barecode</th>
                  <th>PartNo</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Move Date</th>
                  <th>Move Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductionItems.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.BareCode}</td>
                    <td>{item.PartNo}</td>
                    <td>{item.name}</td>
                    <td>₹{item.price}</td>
                    <td>
                      <span className="badge bg-info">{item.moveQuantity.toFixed(2)}</span>
                    </td>
                    <td>{item.moveDate}</td>
                    <td>{item.moveTime}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-success me-1"
                        onClick={() => setSelectedItemForMove(item)}
                        data-bs-toggle="modal"
                        data-bs-target="#moveBackModal"
                        title="Move back to stock"
                        disabled={loadingStates.moveBack || loadingStates.deleteItem}
                      >
                        <i className="fa-solid fa-arrow-left"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteProductionItem(item.id)}
                        title="Delete item"
                        disabled={loadingStates.deleteItem}
                      >
                        {loadingStates.deleteItem ? (
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        ) : (
                          <i className="fa-solid fa-trash"></i>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="alert alert-info text-center">
            No products moved to {activeSection} yet.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      {/* Edit Department Modal */}
      <div className="modal fade" id="editDepartmentModal" tabIndex="-1" aria-labelledby="editDepartmentModalLabel" aria-hidden="true" ref={editDepartmentModalRef}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="editDepartmentModalLabel">Edit Department</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {loadingStates.editDepartment ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Saving changes...</p>
                </div>
              ) : editingDepartment ? (
                <>
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Department Name"
                      value={newDepartmentName}
                      onChange={(e) => setNewDepartmentName(e.target.value)}
                    />
                    <label>Department Name</label>
                  </div>
                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={hasAssembly}
                      onChange={(e) => setHasAssembly(e.target.checked)}
                      id="hasAssemblySwitch"
                    />
                    <label className="form-check-label" htmlFor="hasAssemblySwitch">
                      With Main & Sub Assembly
                    </label>
                  </div>
                  <small className="text-muted">
                    {hasAssembly ? 
                      'Department will use Main & Sub Assembly structure (like VIT-P, R&D-P)' : 
                      'Department will use simple Assemblies structure (like CONSUMABLES-P)'
                    }
                  </small>
                </>
              ) : (
                <div className="text-center py-3">
                  <p>No department selected for editing.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={loadingStates.editDepartment}>
                Close
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={saveEditDepartment} 
                disabled={!editingDepartment || !newDepartmentName.trim() || loadingStates.editDepartment}
              >
                {loadingStates.editDepartment ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move Back to Stock Modal */}
      <div className="modal fade" id="moveBackModal" tabIndex="-1" aria-labelledby="moveBackModalLabel" aria-hidden="true" ref={moveBackModalRef}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="moveBackModalLabel">Move Back to Stock</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {loadingStates.moveBack ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Processing...</p>
                </div>
              ) : selectedItemForMove ? (
                <>
                  <div className="mb-3">
                    <p><strong>Product:</strong> {selectedItemForMove.name}</p>
                    <p><strong>Available Quantity:</strong> {selectedItemForMove.moveQuantity.toFixed(2)}</p>
                    <p><strong>Barcode:</strong> {selectedItemForMove.BareCode}</p>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Quantity to move back"
                      min="0.01"
                      step="0.01"
                      max={selectedItemForMove.moveQuantity}
                      value={moveBackQuantity[selectedItemForMove.id] || selectedItemForMove.moveQuantity}
                      onChange={(e) => handleMoveBackQuantityChange(selectedItemForMove.id, parseFloat(e.target.value) || 0.01)}
                    />
                    <label>Quantity to move back to stock</label>
                  </div>
                </>
              ) : (
                <div className="text-center py-3">
                  <p>No item selected for move back.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={loadingStates.moveBack}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => moveItemBackToStock(selectedItemForMove)}
                data-bs-dismiss="modal"
                disabled={!selectedItemForMove || loadingStates.moveBack}
              >
                {loadingStates.moveBack ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Processing...
                  </>
                ) : (
                  'Move to Stock'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    
      {/* Move to BMR Modal with FIXED Quantity Inputs */}
      <div className="modal fade" id="Move" tabIndex="-1" aria-labelledby="bmr" aria-hidden="true" ref={moveToBMRModalRef}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="bmr">Move Products to BMR - {activeSection}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={stopBMRScanner}></button>
            </div>
            <div className="modal-body">
              {loadingStates.moveToBMR ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Processing BMR move...</p>
                </div>
              ) : (
                <>
                  <div className="scanner mb-3">
                    <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
                      <button 
                        className={`btn ${scanningBMR && !usingBackCameraBMR ? 'btn-warning' : 'btn-primary'}`}
                        onClick={() => startBMRScanner(false)}
                      >
                        <i className="fa-solid fa-camera me-2"></i>
                        Front Camera
                      </button>
                      
                      <button 
                        className={`btn ${scanningBMR && usingBackCameraBMR ? 'btn-warning' : 'btn-secondary'}`}
                        onClick={() => startBMRScanner(true)}
                      >
                        <i className="fa-solid fa-camera-rotate me-2"></i>
                        Back Camera
                      </button>

                      {scanningBMR && (
                        <button 
                          className="btn btn-outline-info"
                          onClick={switchBMRCamera}
                        >
                          <i className="fa-solid fa-rotate me-2"></i>
                          Switch Camera
                        </button>
                      )}
                      
                      {scanningBMR && (
                        <button 
                          className="btn btn-danger"
                          onClick={stopBMRScanner}
                        >
                          <i className="fa-solid fa-stop me-2"></i>
                          Stop Scanner
                        </button>
                      )}
                      
                      {scannedBMRProducts.length > 0 && (
                        <button 
                          className="btn btn-outline-danger btn-sm"
                          onClick={clearAllBMRScanned}
                        >
                          Clear All ({scannedBMRProducts.length})
                        </button>
                      )}
                    </div>

                    {/* Manual Barcode Input */}
                    <div className="manual-input mb-3">
                      <label htmlFor="manualBarcodeBMR" className="form-label">
                        Or enter barcode manually:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="manualBarcodeBMR"
                        placeholder="Type barcode and press Enter"
                        value={manualBarcodeInput}
                        onChange={(e) => setManualBarcodeInput(e.target.value)}
                        onKeyPress={handleManualBarcodeInput}
                      />
                    </div>

                    {cameraErrorBMR && (
                      <div className="alert alert-warning">
                        <small>
                          <i className="fa-solid fa-triangle-exclamation me-2"></i>
                          Camera not available. Please check permissions or use manual input above.
                        </small>
                      </div>
                    )}

                    {scanningBMR && !cameraErrorBMR && (
                      <div className="scanner-container border rounded p-2 text-center">
                        <BarcodeScannerComponent
                          width={400}
                          height={250}
                          onUpdate={handleBMRScan}
                          onError={handleBMRCameraError}
                          delay={500}
                          facingMode={usingBackCameraBMR ? "environment" : "user"}
                          constraints={{
                            audio: false,
                            video: {
                              facingMode: usingBackCameraBMR ? "environment" : "user",
                              width: { ideal: 1280 },
                              height: { ideal: 720 }
                            }
                          }}
                        />
                        <p className="text-center text-muted mt-2">
                          <i className="fa-solid fa-camera me-2"></i>
                          Using {usingBackCameraBMR ? 'Back' : 'Front'} Camera - Scan products from {activeSection} production
                        </p>
                      </div>
                    )}
                  </div>

                  {/* BMR Products Preview with FIXED Quantity Input */}
                  <div className="preview">
                    <h5>Products for BMR {scannedBMRProducts.length > 0 && `(${scannedBMRProducts.length} products)`}</h5>
                    
                    {scannedBMRProducts.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>#</th>
                              <th>Barecode</th>
                              <th>Product</th>
                              <th>PartNo</th>
                              <th>Available</th>
                              <th>BMR Qty</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scannedBMRProducts.map((product, index) => (
                              <tr key={product.id}>
                                <td>{index + 1}</td>
                                <td>
                                  <code>{product.BareCode}</code>
                                  <br/>
                                  <small className="text-muted">Variant</small>
                                </td>
                                <td>
                                  <div>
                                    <strong>{product.name}</strong>
                                  </div>
                                </td>
                                <td>
                                  <span className="badge bg-secondary">{product.PartNo}</span>
                                </td>
                                <td>
                                  <span className="badge bg-info">{product.moveQuantity.toFixed(2)}</span>
                                </td>
                                <td>
                                  {/* FIXED: Single input field - No +- buttons, empty by default, allows decimals */}
                                  <div className="d-flex align-items-center">
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      style={{ width: '120px' }}
                                      min="0"
                                      step="0.01"
                                      placeholder="Enter Qty"
                                      value={product.bmrMoveQuantity || ''}
                                      onChange={(e) => handleBMRQuantityChange(product.id, e.target.value)}
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
                                    onClick={() => removeBMRScannedProduct(product.id)}
                                  >
                                    <i className="fa-solid fa-times"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted p-4 border rounded">
                        <i className="fa-solid fa-barcode fa-3x mb-3 d-block text-light"></i>
                        <p>No products scanned for BMR yet.</p>
                        <small>Scan products from {activeSection} production department</small>
                      </div>
                    )}
                  </div>

                  {/* BMR Selection Dropdown */}
                  <div className="mb-3">
                    <label htmlFor="bmrSelect" className="form-label">Select BMR Template:</label>
                    <select 
                      className="form-select" 
                      id="bmrSelect"
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

                  {/* Initial Code Input */}
                  <div className="mb-3">
                    <label htmlFor="initialCode" className="form-label">Initial Code (Mandatory):</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      id="initialCode"
                      value={initialCode}
                      onChange={(e) => setInitialCode(e.target.value)}
                      placeholder="Enter initial code (e.g., MM)"
                      required
                      disabled={scannedBMRProducts.length === 0}
                    />
                  </div>

                  {/* Template Preview with Multiple Barcodes */}
                  {selectedBMR && scannedBMRProducts.length > 0 && (
                    <div className="template-preview mt-4">
                      <h5>Template Auto-Fill Preview</h5>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>PartNo</th>
                              <th>Raw Material</th>
                              <th>Multiple Barcodes</th>
                              <th>Total Qty</th>
                              <th>Avg Price</th>
                              <th>Total Price</th>
                              <th>Issued By</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(scannedBMRProducts.reduce((acc, product) => {
                              if (!acc[product.PartNo]) {
                                acc[product.PartNo] = [];
                              }
                              acc[product.PartNo].push(product);
                              return acc;
                            }, {})).map(([partNo, products], index) => {
                              const totalQuantity = products.reduce((sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 0), 0);
                              const totalPrice = products.reduce((sum, p) => {
                                const price = p.price || 0;
                                const qty = parseFloat(p.bmrMoveQuantity) || 0;
                                return sum + (price * qty);
                              }, 0);
                              const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;
                              const barcodes = products.map(p => p.BareCode).join(', ');

                              return (
                                <tr key={index}>
                                  <td>{partNo}</td>
                                  <td>{products[0].name}</td>
                                  <td>
                                    <div className="multiple-barcodes">
                                      {products.map((product, idx) => (
                                        <div key={idx} className="small">
                                          <span className="badge bg-info me-1">{product.BareCode}</span>
                                          (Qty: {product.bmrMoveQuantity || 0}, ₹{product.price || 0})
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge bg-primary">{totalQuantity.toFixed(2)}</span>
                                  </td>
                                  <td>₹{averagePrice.toFixed(2)}</td>
                                  <td>₹{totalPrice.toFixed(2)}</td>
                                  <td>
                                    <span className="badge bg-secondary">{initialCode}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={stopBMRScanner} disabled={loadingStates.moveToBMR}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => moveToBMR(selectedBMR)}
                disabled={scannedBMRProducts.length === 0 || !initialCode.trim() || !selectedBMR || loadingStates.moveToBMR}
              >
                {loadingStates.moveToBMR ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-arrow-right me-2"></i>
                    MOVE TO BMR ({scannedBMRProducts.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="Header-add">
        <div className="card p-3 mb-3">
          <h5>Add New Production Department</h5>
          <div className="input-group mb-3">
            <input
              type="text"
              className="form-control pinput"
              placeholder="Department Name"
              value={newProduction}
              onChange={(e) => setNewProduction(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewProduction()}
              disabled={loadingStates.addDepartment}
            />
            <button className="btn btn-success" onClick={addNewProduction} disabled={loadingStates.addDepartment}>
              {loadingStates.addDepartment ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Adding...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus me-2"></i>
                  Add Department
                </>
              )}
            </button>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              checked={hasAssembly}
              onChange={(e) => setHasAssembly(e.target.checked)}
              id="assemblySwitch"
              disabled={loadingStates.addDepartment}
            />
            <label className="form-check-label" htmlFor="assemblySwitch">
              With Main & Sub Assembly
            </label>
          </div>
          <small className="text-muted">
            {hasAssembly ? 
              'Department will use Main & Sub Assembly structure (like VIT-P, R&D-P)' : 
              'Department will use simple Assemblies structure (like CONSUMABLES-P)'}
          </small>
        </div>

        <div className="Pro-buttons">
          {productionDepartments.map((department, index) => (
            <button
              key={department.id}
              className={`btn me-2 mb-2 ${activeSection === department.name ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveSection(department.name)}
              disabled={loadingStates.deleteDepartment || loadingStates.editDepartment}
            >
              {department.name}
              <small className="d-block">
                {department.has_assembly ? '(Main & Sub)' : '(Simple Assembly)'}
              </small>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Section Display */}
      {activeSection ? switching() : (
        <div className="alert alert-secondary mt-3 text-center">
          Please select a production section above 👆
        </div>
      )}
    </div>
  )
}

export default Production