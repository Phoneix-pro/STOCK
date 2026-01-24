import "./Stocks.css"
import { useState, useRef, useEffect, useCallback } from 'react'
import BarcodeScannerComponent from 'react-qr-barcode-scanner'
import toast from 'react-hot-toast'
import { supabase } from '../supabaseClient'
import { playSimpleBeep } from '../utils/beepSound'

function Stocks({
  products,
  setProducts,
  productionDepartments,
  productionItems,
  setProductionItems,
  sales,
  setSales,
  loadAllData,
  reloadModuleData,
  bmrTemplates,
  bmrList,
  setBmrList,
  stockVariants,
  getProductVariants,
  calculateAvailableQuantity
}) {
  const [scannedProducts, setScannedProducts] = useState([])
  const [scannedBMRProducts, setScannedBMRProducts] = useState([])
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [usingBackCamera, setUsingBackCamera] = useState(false)
  const [selectedProductVariants, setSelectedProductVariants] = useState(null)
  const [quickAddQuantity, setQuickAddQuantity] = useState({})
  const [showAddVariantModal, setShowAddVariantModal] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null)

  // BMR Move States
  const [scanningBMR, setScanningBMR] = useState(false)
  const [cameraErrorBMR, setCameraErrorBMR] = useState(false)
  const [usingBackCameraBMR, setUsingBackCameraBMR] = useState(false)
  const [selectedBMR, setSelectedBMR] = useState("")
  const [initialCode, setInitialCode] = useState("")
  const [manualBarcodeInputBMR, setManualBarcodeInputBMR] = useState("")
  const [savedTemplates, setSavedTemplates] = useState({})

  // Variant editing state
  const [editingVariant, setEditingVariant] = useState(null)
  const [editVariantForm, setEditVariantForm] = useState({
    bare_code: '',
    lot_no: '',
    serial_no: '',
    price: '',
    quantity: '',
    pending_testing: '',
    testing_status: 'pending',
    using_quantity: 0
  })

  // New variant form state with decimal support
  const [newVariant, setNewVariant] = useState({
    bare_code: '',
    lot_no: '',
    serial_no: '',
    price: '',
    quantity: '1.00'
  })

  // New product form state with decimal support
  const [newProduct, setNewProduct] = useState({
    BareCode: '',
    PartNo: '',
    LotNo: '',
    SNo: '',
    name: '',
    price: '',
    Quantity: '1.00',
    testingStatus: 'pending'
  })

  // Modal refs
  const modalRef = useRef(null)
  const addModalRef = useRef(null)
  const editModalRef = useRef(null)
  const moveToBMRModalRef = useRef(null)
  const variantsModalRef = useRef(null)
  const addVariantModalRef = useRef(null)
  const editVariantModalRef = useRef(null)

  // Confirmation modal refs
  const confirmDeleteProductRef = useRef(null)
  const confirmDeleteVariantRef = useRef(null)
  const confirmMoveToSalesRef = useRef(null)
  const confirmMoveToProductionRef = useRef(null)
  const confirmMoveToBMRRef = useRef(null)
  const confirmClearScannedRef = useRef(null)
  const confirmClearBMRScannedRef = useRef(null)

  // State for confirmations
  const [confirmAction, setConfirmAction] = useState({
    type: '',
    data: null,
    department: null
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loadingStates, setLoadingStates] = useState({
    general: false,
    addProduct: false,
    editProduct: false,
    deleteProduct: false,
    moveToSales: false,
    moveToProduction: false,
    moveToBMR: false,
    addVariant: false,
    editVariant: false
  })

  // Scan debouncing
  const [lastScanned, setLastScanned] = useState('')
  const [lastScanTime, setLastScanTime] = useState(0)

  // Filter products based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products)
    } else {
      const filtered = products.filter(product =>
        product.BareCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.PartNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.LotNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.SNo?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredProducts(filtered)
    }
  }, [products, searchTerm])

  // Load saved templates
  useEffect(() => {
    const saved = localStorage.getItem('bmrSavedTemplates');
    if (saved) {
      setSavedTemplates(JSON.parse(saved));
    }
  }, [])

  // Show product variants modal
  const showProductVariants = async (product) => {
    const { stock, variants } = await getProductVariants(product.PartNo)

    if (stock) {
      setSelectedProductVariants({
        partNo: product.PartNo,
        name: product.name,
        stock: stock,
        variants: variants
      })
    }
  }

  // Calculate weighted average price with decimal support
  const calculateWeightedAveragePrice = (variants) => {
    if (!variants || variants.length === 0) return 0

    let totalValue = 0
    let totalQuantity = 0

    variants.forEach(variant => {
      const availableQty = parseFloat(variant.quantity) || 0
      const pendingQty = parseFloat(variant.pending_testing) || 0
      const usingQty = parseFloat(variant.using_quantity) || 0
      const totalQty = availableQty + pendingQty + usingQty
      const price = parseFloat(variant.price) || 0
      totalValue += totalQty * price
      totalQuantity += totalQty
    })

    return totalQuantity > 0 ? totalValue / totalQuantity : 0
  }

  // Calculate total quantity from variants (for total_received) with decimal support
  const calculateTotalVariantQuantity = (variants) => {
    if (!variants || variants.length === 0) return 0

    return variants.reduce((sum, variant) => {
      const availableQty = parseFloat(variant.quantity) || 0
      const pendingQty = parseFloat(variant.pending_testing) || 0
      const usingQty = parseFloat(variant.using_quantity) || 0
      return sum + availableQty + pendingQty + usingQty
    }, 0)
  }

  // Calculate FIFO value
  const calculateFIFOValue = (variants) => {
    if (!variants || variants.length === 0) return 0

    // Sort by received_date (oldest first for FIFO)
    const sortedVariants = [...variants].sort((a, b) =>
      new Date(a.received_date) - new Date(b.received_date)
    )

    let totalValue = 0
    let foundAvailable = false

    for (const variant of sortedVariants) {
      const availableQty = parseFloat(variant.quantity) || 0
      const pendingQty = parseFloat(variant.pending_testing) || 0
      const usingQty = parseFloat(variant.using_quantity) || 0
      const totalQty = availableQty + pendingQty + usingQty

      if (totalQty > 0 && !foundAvailable) {
        const value = totalQty * (parseFloat(variant.price) || 0)
        totalValue = value
        foundAvailable = true
      } else if (totalQty <= 0 && !foundAvailable) {
        totalValue = 0
      } else if (foundAvailable) {
        const value = totalQty * (parseFloat(variant.price) || 0)
        totalValue += value
      }
    }

    return totalValue
  }

  // Handle add variant click
  const handleAddVariantClick = (product) => {
    setSelectedProductForVariant(product)
    setSelectedProductVariants({
      partNo: product.PartNo,
      name: product.name,
      stock: { id: product.id },
      variants: []
    })
    setNewVariant({
      bare_code: '',
      lot_no: '',
      serial_no: '',
      price: product.price || '',
      quantity: '1.00'
    })
  }

  // Handle variant form change with decimal support
  const handleVariantChange = (field, value) => {
    // Allow decimal values for quantity fields
    if (field === 'quantity' || field === 'price') {
      // Remove non-numeric characters except decimal point
      const sanitizedValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = sanitizedValue.split('.');
      if (parts.length > 2) {
        return;
      }
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
      } else {
        value = sanitizedValue;
      }
    }
    
    setNewVariant(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Show confirmation modal
  const showConfirmation = (type, data = null, department = null) => {
    setConfirmAction({ type, data, department })
    
    let modalRef;
    switch(type) {
      case 'deleteProduct':
        modalRef = confirmDeleteProductRef;
        break;
      case 'deleteVariant':
        modalRef = confirmDeleteVariantRef;
        break;
      case 'moveToSales':
        modalRef = confirmMoveToSalesRef;
        break;
      case 'moveToProduction':
        modalRef = confirmMoveToProductionRef;
        break;
      case 'moveToBMR':
        modalRef = confirmMoveToBMRRef;
        break;
      case 'clearScanned':
        modalRef = confirmClearScannedRef;
        break;
      case 'clearBMRScanned':
        modalRef = confirmClearBMRScannedRef;
        break;
      default:
        return;
    }
    
    const modal = new bootstrap.Modal(modalRef.current);
    modal.show();
  }

  // Handle confirmation actions
  const handleConfirmAction = async () => {
    const { type, data, department } = confirmAction;
    
    switch(type) {
      case 'deleteProduct':
        await deleteProduct(data);
        break;
      case 'deleteVariant':
        await deleteVariant(data);
        break;
      case 'moveToSales':
        await moveToSales();
        break;
      case 'moveToProduction':
        await moveToProduction(department);
        break;
      case 'moveToBMR':
        await moveToBMRFromStocks(data);
        break;
      case 'clearScanned':
        clearAllScanned();
        break;
      case 'clearBMRScanned':
        clearAllBMRScannedStocks();
        break;
      default:
        break;
    }
    
    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById(`confirm${type.charAt(0).toUpperCase() + type.slice(1)}Modal`));
    modal?.hide();
  }

  // Add new variant to existing product with decimal support
  const addNewVariant = async () => {
    if (!selectedProductForVariant) return

    try {
      setLoadingStates(prev => ({ ...prev, addVariant: true }))

      // Validation with decimal support
      if (!newVariant.bare_code.trim()) {
        toast.error('Barcode is required!')
        return
      }
      
      const quantity = parseFloat(newVariant.quantity)
      if (isNaN(quantity) || quantity <= 0) {
        toast.error('Valid Quantity is required!')
        return
      }

      // Get or create stock
      const { data: stock, error: stockError } = await supabase
        .from('stocks')
        .select('*')
        .eq('part_no', selectedProductForVariant.PartNo)
        .single()

      let stockId
      let existingStock

      if (stockError) {
        // If stock doesn't exist, create it
        const price = parseFloat(newVariant.price) || 0
        const { data: newStock, error: createStockError } = await supabase
          .from('stocks')
          .insert([{
            part_no: selectedProductForVariant.PartNo,
            name: selectedProductForVariant.name,
            price: price,
            average_price: price,
            quantity: quantity,
            total_received: quantity,
            using_quantity: 0,
            testing_balance: 0,
            bare_code: newVariant.bare_code.trim()
          }])
          .select()
          .single()

        if (createStockError) throw createStockError
        stockId = newStock.id
        existingStock = newStock
      } else {
        stockId = stock.id
        existingStock = stock
      }

      // Check if barcode already exists
      const { data: existingVariant, error: checkError } = await supabase
        .from('stock_variants')
        .select('id')
        .eq('bare_code', newVariant.bare_code.trim())
        .maybeSingle()

      if (!checkError && existingVariant) {
        toast.error('This barcode already exists for another variant!')
        return
      }

      // Add stock variant with decimal quantities
      const price = parseFloat(newVariant.price) || 0
      const { data: newVariantData, error: variantError } = await supabase
        .from('stock_variants')
        .insert([{
          stock_id: stockId,
          bare_code: newVariant.bare_code.trim(),
          serial_no: newVariant.serial_no.trim(),
          lot_no: newVariant.lot_no.trim(),
          batch_no: newVariant.lot_no || `BATCH-${Date.now()}`,
          price: price,
          quantity: quantity,
          pending_testing: 0,
          using_quantity: 0,
          received_date: new Date().toISOString().split('T')[0],
          testing_status: 'completed'
        }])
        .select()

      if (variantError) throw variantError

      // Record stock movement
      await supabase
        .from('stock_movements')
        .insert([{
          variant_id: newVariantData[0].id,
          movement_type: 'in',
          quantity: quantity,
          remaining_quantity: quantity,
          reference_type: 'manual',
          movement_date: new Date().toISOString()
        }])

      // Get all variants to calculate totals
      const { data: allVariants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity, price')
        .eq('stock_id', stockId)

      if (variantsError) throw variantsError

      // Calculate totals from all variants with decimal support
      let totalQuantity = 0
      let totalTestingBalance = 0
      let totalUsingQuantity = 0
      let totalValue = 0
      let totalReceived = 0

      allVariants.forEach(variant => {
        const qty = parseFloat(variant.quantity) || 0
        const pending = parseFloat(variant.pending_testing) || 0
        const using = parseFloat(variant.using_quantity) || 0
        const price = parseFloat(variant.price) || 0

        totalQuantity += qty
        totalTestingBalance += pending
        totalUsingQuantity += using
        totalValue += (qty + pending + using) * price
        totalReceived += qty + pending + using
      })

      const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0

      // Update stock totals including total_received
      await supabase
        .from('stocks')
        .update({
          quantity: totalQuantity,
          using_quantity: totalUsingQuantity,
          testing_balance: totalTestingBalance,
          total_received: totalReceived,
          average_price: averagePrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId)

      toast.success(`Added ${newVariant.quantity} units as new variant`)

      // Close modal and reset
      setShowAddVariantModal(false)
      setSelectedProductForVariant(null)
      setNewVariant({
        bare_code: '',
        lot_no: '',
        serial_no: '',
        price: '',
        quantity: '1.00'
      })

      // Refresh variants modal if open
      if (selectedProductVariants) {
        const { stock, variants } = await getProductVariants(selectedProductVariants.partNo)
        setSelectedProductVariants(prev => ({
          ...prev,
          stock: stock,
          variants: variants
        }))
      }

      // Optimized reload - only reload stock data
      await reloadModuleData('stocks')

      // Close modal
      if (addVariantModalRef.current) {
        const modal = bootstrap.Modal.getInstance(addVariantModalRef.current)
        modal?.hide()
      }
    } catch (error) {
      console.error('Error adding variant:', error)
      toast.error('Error adding variant: ' + error.message)
    } finally {
      setLoadingStates(prev => ({ ...prev, addVariant: false }))
    }
  }

  // Start editing variant
  const startEditVariant = (variant) => {
    setEditingVariant(variant)
    setEditVariantForm({
      bare_code: variant.bare_code || '',
      lot_no: variant.lot_no || '',
      serial_no: variant.serial_no || '',
      price: variant.price || '',
      quantity: variant.quantity || '',
      pending_testing: variant.pending_testing || '',
      using_quantity: variant.using_quantity || 0,
      testing_status: variant.testing_status || 'pending'
    })
  }

  // Update variant with decimal support
  const updateVariant = async () => {
    if (!editingVariant) return

    try {
      setLoadingStates(prev => ({ ...prev, editVariant: true }))

      // Calculate total quantity with decimal support
      const availableQty = parseFloat(editVariantForm.quantity) || 0
      const pendingQty = parseFloat(editVariantForm.pending_testing) || 0
      const usingQty = parseFloat(editVariantForm.using_quantity) || 0
      const totalQty = availableQty + pendingQty + usingQty

      const { data: updatedVariant, error } = await supabase
        .from('stock_variants')
        .update({
          bare_code: editVariantForm.bare_code.trim(),
          lot_no: editVariantForm.lot_no.trim(),
          serial_no: editVariantForm.serial_no.trim(),
          price: parseFloat(editVariantForm.price) || 0,
          quantity: availableQty,
          pending_testing: pendingQty,
          using_quantity: usingQty,
          testing_status: editVariantForm.testing_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingVariant.id)
        .select()
        .single()

      if (error) throw error

      // Record stock movement for quantity changes
      const oldTotalQty = (parseFloat(editingVariant.quantity) || 0) + (parseFloat(editingVariant.pending_testing) || 0) + (parseFloat(editingVariant.using_quantity) || 0)
      const qtyDifference = totalQty - oldTotalQty

      if (qtyDifference !== 0) {
        await supabase
          .from('stock_movements')
          .insert([{
            variant_id: editingVariant.id,
            movement_type: qtyDifference > 0 ? 'in' : 'out',
            quantity: Math.abs(qtyDifference),
            remaining_quantity: totalQty,
            reference_type: 'manual_update',
            movement_date: new Date().toISOString()
          }])
      }

      // Get all variants to recalculate stock totals
      const { data: allVariants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity, price')
        .eq('stock_id', editingVariant.stock_id)

      if (!variantsError && allVariants) {
        let totalQuantity = 0
        let totalTestingBalance = 0
        let totalUsingQuantity = 0
        let totalValue = 0
        let totalReceived = 0

        allVariants.forEach(variant => {
          const qty = parseFloat(variant.quantity) || 0
          const pending = parseFloat(variant.pending_testing) || 0
          const using = parseFloat(variant.using_quantity) || 0
          const price = parseFloat(variant.price) || 0

          totalQuantity += qty
          totalTestingBalance += pending
          totalUsingQuantity += using
          totalValue += (qty + pending + using) * price
          totalReceived += qty + pending + using
        })

        const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0

        // Update stock totals including total_received
        await supabase
          .from('stocks')
          .update({
            quantity: totalQuantity,
            using_quantity: totalUsingQuantity,
            testing_balance: totalTestingBalance,
            total_received: totalReceived,
            average_price: averagePrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingVariant.stock_id)
      }

      toast.success('Variant updated successfully!')
      setEditingVariant(null)

      // Close modal
      if (editVariantModalRef.current) {
        const modal = bootstrap.Modal.getInstance(editVariantModalRef.current)
        modal?.hide()
      }

      // Refresh variants modal if open
      if (selectedProductVariants) {
        const { stock, variants } = await getProductVariants(selectedProductVariants.partNo)
        setSelectedProductVariants(prev => ({
          ...prev,
          stock: stock,
          variants: variants
        }))
      }

      await reloadModuleData('stocks')
    } catch (error) {
      console.error('Error updating variant:', error)
      toast.error('Error updating variant: ' + error.message)
    } finally {
      setLoadingStates(prev => ({ ...prev, editVariant: false }))
    }
  }

  // Delete variant (only if total quantity is 0)
  const deleteVariant = async (variantId) => {
    try {
      setLoadingStates(prev => ({ ...prev, deleteProduct: true }))

      const { data: variant, error: variantError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity, stock_id')
        .eq('id', variantId)
        .single()

      if (variantError) throw variantError

      const totalQty = (parseFloat(variant.quantity) || 0) + (parseFloat(variant.pending_testing) || 0) + (parseFloat(variant.using_quantity) || 0)
      if (totalQty > 0) {
        toast.error('Cannot delete variant. It still has quantity.')
        return
      }

      const { error } = await supabase
        .from('stock_variants')
        .delete()
        .eq('id', variantId)

      if (error) throw error

      // Get all remaining variants to recalculate stock totals
      const { data: allVariants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity, price')
        .eq('stock_id', variant.stock_id)

      if (!variantsError && allVariants) {
        let totalQuantity = 0
        let totalTestingBalance = 0
        let totalUsingQuantity = 0
        let totalValue = 0
        let totalReceived = 0

        allVariants.forEach(variant => {
          const qty = parseFloat(variant.quantity) || 0
          const pending = parseFloat(variant.pending_testing) || 0
          const using = parseFloat(variant.using_quantity) || 0
          const price = parseFloat(variant.price) || 0

          totalQuantity += qty
          totalTestingBalance += pending
          totalUsingQuantity += using
          totalValue += (qty + pending + using) * price
          totalReceived += qty + pending + using
        })

        const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0

        // Update stock totals including total_received
        await supabase
          .from('stocks')
          .update({
            quantity: totalQuantity,
            using_quantity: totalUsingQuantity,
            testing_balance: totalTestingBalance,
            total_received: totalReceived,
            average_price: averagePrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', variant.stock_id)
      }

      toast.success('Variant deleted successfully!')

      // Refresh variants modal if open
      if (selectedProductVariants) {
        const { stock, variants } = await getProductVariants(selectedProductVariants.partNo)
        setSelectedProductVariants(prev => ({
          ...prev,
          stock: stock,
          variants: variants
        }))
      }

      await reloadModuleData('stocks')
    } catch (error) {
      console.error('Error deleting variant:', error)
      toast.error('Error deleting variant: ' + error.message)
    } finally {
      setLoadingStates(prev => ({ ...prev, deleteProduct: false }))
    }
  }

  // FIXED: Move products with correct stock total calculation
  const moveProductsWithEnhancedFIFO = async (productsToMove, destination, department = null) => {
    try {
      const loadingKey = destination === 'sales' ? 'moveToSales' : 'moveToProduction'
      setLoadingStates(prev => ({ ...prev, [loadingKey]: true }))

      for (const product of productsToMove) {
        // Get specific variant by barcode
        const { data: variant, error: variantError } = await supabase
          .from('stock_variants')
          .select('*')
          .eq('bare_code', product.BareCode)
          .single()

        if (variantError) {
          toast.error(`Variant with barcode ${product.BareCode} not found!`)
          continue
        }

        const quantityToMove = parseFloat(product.moveQuantity)
        const availableInVariant = parseFloat(variant.quantity) || 0

        if (availableInVariant < quantityToMove) {
          toast.error(`Insufficient quantity in variant ${product.BareCode}. Available: ${availableInVariant.toFixed(2)}, Requested: ${quantityToMove.toFixed(2)}`)
          continue
        }

        // Calculate new variant quantities correctly with decimal support
        const newVariantQty = parseFloat((availableInVariant - quantityToMove).toFixed(2))
        const newVariantUsing = (parseFloat(variant.using_quantity) || 0) + quantityToMove

        // Update variant quantities
        const { error: updateVariantError } = await supabase
          .from('stock_variants')
          .update({
            quantity: newVariantQty,
            using_quantity: newVariantUsing,
            updated_at: new Date().toISOString()
          })
          .eq('id', variant.id)

        if (updateVariantError) throw updateVariantError

        // Record stock movement
        await supabase
          .from('stock_movements')
          .insert([{
            variant_id: variant.id,
            movement_type: 'out',
            quantity: quantityToMove,
            remaining_quantity: newVariantQty,
            reference_type: destination === 'sales' ? 'sales' : 'production',
            reference_id: product.id,
            movement_date: new Date().toISOString()
          }])

        // Get ALL variants for this stock to calculate CORRECT totals
        const { data: allVariants, error: variantsError } = await supabase
          .from('stock_variants')
          .select('quantity, using_quantity, pending_testing, price')
          .eq('stock_id', variant.stock_id)

        if (!variantsError && allVariants) {
          // Calculate totals from ALL variants with decimal support
          let totalQuantity = 0
          let totalUsingQuantity = 0
          let totalTestingBalance = 0
          let totalValue = 0
          let totalReceived = 0

          allVariants.forEach(v => {
            const qty = parseFloat(v.quantity) || 0
            const using = parseFloat(v.using_quantity) || 0
            const pending = parseFloat(v.pending_testing) || 0
            const price = parseFloat(v.price) || 0

            totalQuantity += qty
            totalUsingQuantity += using
            totalTestingBalance += pending
            totalValue += (qty + using + pending) * price
            totalReceived += qty + using + pending
          })

          const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0

          // FIXED: Update stock totals correctly using the calculated totals
          await supabase
            .from('stocks')
            .update({
              quantity: totalQuantity, // This is the sum of all variant.quantity
              using_quantity: totalUsingQuantity, // This is the sum of all variant.using_quantity
              testing_balance: totalTestingBalance, // This is the sum of all variant.pending_testing
              total_received: totalReceived, // This is the sum of all (quantity + using_quantity + pending_testing)
              average_price: averagePrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', variant.stock_id)
        }

        // Create or update destination record
        const currentDate = new Date().toLocaleDateString()
        const currentTime = new Date().toLocaleTimeString()

        if (destination === 'sales') {
          // Check for existing sales record for this variant
          const { data: existingSales, error: salesCheckError } = await supabase
            .from('sales')
            .select('id, move_quantity')
            .eq('variant_id', variant.id)
            .maybeSingle()

          if (!salesCheckError && existingSales) {
            // Update existing sales record with decimal support
            const newMoveQty = parseFloat(existingSales.move_quantity) + quantityToMove
            await supabase
              .from('sales')
              .update({
                move_quantity: newMoveQty,
                sale_date: currentDate,
                sale_time: currentTime,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingSales.id)
          } else {
            // Create new sale record
            await supabase
              .from('sales')
              .insert([{
                stock_id: variant.stock_id,
                variant_id: variant.id,
                move_quantity: quantityToMove,
                sale_date: currentDate,
                sale_time: currentTime
              }])
          }
        } else if (destination === 'production' && department) {
          // Check for existing production record for this variant in this department
          const { data: existingProduction, error: prodCheckError } = await supabase
            .from('production_items')
            .select('id, move_quantity')
            .eq('variant_id', variant.id)
            .eq('department', department)
            .maybeSingle()

          if (!prodCheckError && existingProduction) {
            // Update existing production record with decimal support
            const newMoveQty = parseFloat(existingProduction.move_quantity) + quantityToMove
            await supabase
              .from('production_items')
              .update({
                move_quantity: newMoveQty,
                move_date: currentDate,
                move_time: currentTime,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingProduction.id)
          } else {
            // Get department ID
            const { data: deptData, error: deptError } = await supabase
              .from('production_departments')
              .select('id')
              .eq('name', department)
              .single()

            if (!deptError && deptData) {
              // Create new production record
              await supabase
                .from('production_items')
                .insert([{
                  stock_id: variant.stock_id,
                  variant_id: variant.id,
                  department_id: deptData.id,
                  move_quantity: quantityToMove,
                  move_date: currentDate,
                  move_time: currentTime,
                  department: department
                }])
            }
          }
        }
      }

      toast.success(`Moved ${productsToMove.length} product(s) successfully`)
      setScannedProducts([])
      stopScanner()
      
      // Optimized reload - only reload affected data
      await reloadModuleData('stocks')
      if (destination === 'sales') {
        await reloadModuleData('sales')
      } else if (destination === 'production') {
        await reloadModuleData('production')
      }

      if (modalRef.current) {
        const modal = bootstrap.Modal.getInstance(modalRef.current)
        modal?.hide()
      }
    } catch (error) {
      console.error(`Error moving to ${destination}:`, error)
      toast.error(`Error moving to ${destination}: ` + error.message)
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        moveToSales: false,
        moveToProduction: false
      }))
    }
  }

  // Simplified move functions
  const moveToSales = async () => {
    await moveProductsWithEnhancedFIFO(scannedProducts, 'sales')
  }

  const moveToProduction = async (department) => {
    await moveProductsWithEnhancedFIFO(scannedProducts, 'production', department)
  }

  // Handle camera errors
  const handleCameraError = (err) => {
    console.error('Camera error:', err)
    setCameraError(true)
    toast.error('Camera access denied or not available. Please check permissions.')
    setScanning(false)
  }

  // Handle barcode scan - VARIANT BASED with debouncing and empty quantity field
  const handleScan = useCallback((err, result) => {
    if (result) {
      const now = Date.now()
      const scannedBarcode = result.text
      
      // Debounce - prevent scanning same barcode within 2 seconds
      if (scannedBarcode === lastScanned && (now - lastScanTime) < 2000) {
        return
      }
      
      setLastScanned(scannedBarcode)
      setLastScanTime(now)
      
      playSimpleBeep()

      // Find variant by barcode
      const findVariantAndProduct = async () => {
        try {
          // First, find the variant by barcode
          const { data: variant, error: variantError } = await supabase
            .from('stock_variants')
            .select(`
              *,
              stocks (
                id,
                part_no,
                name,
                price,
                average_price,
                quantity,
                using_quantity,
                total_received
              )
            `)
            .eq('bare_code', scannedBarcode)
            .single()

          if (variantError) {
            toast.error('Variant not found in database!')
            return
          }

          const { data: product, error: productError } = await supabase
            .from('stocks')
            .select('*')
            .eq('id', variant.stock_id)
            .single()

          if (productError) {
            toast.error('Product not found!')
            return
          }

          const availableQty = parseFloat(variant.quantity) || 0

          if (availableQty <= 0) {
            toast.error(`${product.name} (Variant: ${scannedBarcode}) is out of stock!`)
            return
          }

          // Check if variant already exists in scannedProducts
          const existingIndex = scannedProducts.findIndex(
            p => p.BareCode === scannedBarcode
          )

          if (existingIndex !== -1) {
            // Update existing variant quantity
            const updatedProducts = [...scannedProducts]
            const currentMoveQty = parseFloat(updatedProducts[existingIndex].moveQuantity) || 0

            if (currentMoveQty < availableQty) {
              const newQuantity = (currentMoveQty + 0.1).toFixed(2)
              updatedProducts[existingIndex] = {
                ...updatedProducts[existingIndex],
                moveQuantity: newQuantity,
                variantQuantity: availableQty
              }
              setScannedProducts(updatedProducts)
              toast.success(`Increased quantity for ${product.name} (Variant: ${scannedBarcode}) to ${newQuantity}`)
            } else {
              toast.error(`Cannot add more. Only ${availableQty.toFixed(2)} available for ${product.name}`)
            }
          } else {
            // Add new variant with empty quantity field
            setScannedProducts(prev => [
              ...prev,
              {
                id: variant.id,
                stockId: product.id,
                BareCode: scannedBarcode,
                PartNo: product.part_no,
                name: product.name,
                price: parseFloat(variant.price) || parseFloat(product.price) || 0,
                moveQuantity: '', // EMPTY by default
                variantQuantity: availableQty,
                variantId: variant.id,
                variantData: variant
              }
            ])
            toast.success(`Added: ${product.name} (Variant: ${scannedBarcode})`)
          }
        } catch (error) {
          console.error('Error finding variant:', error)
          toast.error('Error finding product variant!')
        }
      }

      findVariantAndProduct()
    }

    if (err) {
      console.error('Scan error:', err)
    }
  }, [lastScanned, lastScanTime, scannedProducts])

  // Start scanning with selected camera
  const startScanner = (useBackCamera = false) => {
    setCameraError(false)
    setUsingBackCamera(useBackCamera)
    setScanning(true)
    setLastScanned('')
    setLastScanTime(0)
  }

  // Stop scanning
  const stopScanner = () => {
    setScanning(false)
  }

  // Switch camera
  const switchCamera = () => {
    setUsingBackCamera(prev => !prev)
  }

  // Handle quantity change for individual product with decimal support
  const handleQuantityChange = (variantId, newQuantity) => {
    // Allow empty string, 0, or positive decimal numbers
    if (newQuantity === '' || newQuantity === '0' || newQuantity === '0.') {
      setScannedProducts(prev =>
        prev.map(product =>
          product.variantId === variantId
            ? { ...product, moveQuantity: newQuantity }
            : product
        )
      )
      return
    }
    
    const parsedQuantity = parseFloat(newQuantity)
    if (isNaN(parsedQuantity) || parsedQuantity < 0) return
    
    setScannedProducts(prev =>
      prev.map(product => {
        const maxQuantity = parseFloat(product.variantQuantity) || 0
        const validQuantity = Math.min(parsedQuantity, maxQuantity)
        return product.variantId === variantId
          ? {
            ...product,
            moveQuantity: validQuantity.toString()
          }
          : product
      })
    )
  }

  // Remove product from scanned list
  const removeScannedProduct = (variantId) => {
    setScannedProducts(prev => prev.filter(p => p.variantId !== variantId))
    toast.success('Product removed from list')
  }

  // Clear all scanned products
  const clearAllScanned = () => {
    setScannedProducts([])
    toast.success('All products cleared')
  }

  // Alternative manual barcode input
  const handleManualBarcode = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      playSimpleBeep()

      const scannedBarcode = e.target.value.trim()

      // Find variant by barcode manually
      const findVariantManual = async () => {
        try {
          const { data: variant, error: variantError } = await supabase
            .from('stock_variants')
            .select(`
              *,
              stocks (
                id,
                part_no,
                name,
                price,
                average_price,
                quantity,
                using_quantity,
                total_received
              )
            `)
            .eq('bare_code', scannedBarcode)
            .single()

          if (variantError) {
            toast.error('Variant not found in database!')
            e.target.value = ''
            return
          }

          const { data: product, error: productError } = await supabase
            .from('stocks')
            .select('*')
            .eq('id', variant.stock_id)
            .single()

          if (productError) {
            toast.error('Product not found!')
            e.target.value = ''
            return
          }

          const availableQty = parseFloat(variant.quantity) || 0

          if (availableQty <= 0) {
            toast.error(`${product.name} (Variant: ${scannedBarcode}) is out of stock!`)
            e.target.value = ''
            return
          }

          const existingProductIndex = scannedProducts.findIndex(
            p => p.BareCode === scannedBarcode
          )

          if (existingProductIndex !== -1) {
            const updatedProducts = [...scannedProducts]
            const currentMoveQty = parseFloat(updatedProducts[existingProductIndex].moveQuantity) || 0

            if (currentMoveQty < availableQty) {
              updatedProducts[existingProductIndex] = {
                ...updatedProducts[existingProductIndex],
                moveQuantity: (currentMoveQty + 0.1).toFixed(2),
                variantQuantity: availableQty
              }
              setScannedProducts(updatedProducts)
              toast.success(`Increased quantity for ${product.name} to ${(currentMoveQty + 0.1).toFixed(2)}`)
            } else {
              toast.error(`Cannot add more. Only ${availableQty} available for ${product.name}`)
            }
          } else {
            setScannedProducts(prev => [
              ...prev,
              {
                id: variant.id,
                stockId: product.id,
                BareCode: scannedBarcode,
                PartNo: product.part_no,
                name: product.name,
                price: parseFloat(variant.price) || parseFloat(product.price) || 0,
                moveQuantity: '', // EMPTY by default
                variantQuantity: availableQty,
                variantId: variant.id,
                variantData: variant
              }
            ])
            toast.success(`Added: ${product.name}`)
          }
          e.target.value = ''
        } catch (error) {
          console.error('Error finding variant manual:', error)
          toast.error('Error finding product variant!')
          e.target.value = ''
        }
      }

      findVariantManual()
    }
  }

  // BMR Scanner Functions for Stocks
  const handleBMRScanStocks = (err, result) => {
    if (result) {
      playSimpleBeep()

      const scannedBarcode = result.text

      // Find variant by barcode for BMR
      const findVariantForBMR = async () => {
        try {
          const { data: variant, error: variantError } = await supabase
            .from('stock_variants')
            .select(`
              *,
              stocks (
                id,
                part_no,
                name,
                price,
                average_price,
                quantity,
                using_quantity,
                total_received
              )
            `)
            .eq('bare_code', scannedBarcode)
            .single()

          if (variantError) {
            toast.error('Variant not found in database!')
            return
          }

          const { data: product, error: productError } = await supabase
            .from('stocks')
            .select('*')
            .eq('id', variant.stock_id)
            .single()

          if (productError) {
            toast.error('Product not found!')
            return
          }

          const availableQty = parseFloat(variant.quantity) || 0

          if (availableQty <= 0) {
            toast.error(`${product.name} (Variant: ${scannedBarcode}) has no available quantity!`)
            return
          }

          const existingProductIndex = scannedBMRProducts.findIndex(
            p => p.BareCode === scannedBarcode
          )

          if (existingProductIndex !== -1) {
            const updatedProducts = [...scannedBMRProducts]
            const currentMoveQty = parseFloat(updatedProducts[existingProductIndex].bmrMoveQuantity) || 0

            if (currentMoveQty < availableQty) {
              updatedProducts[existingProductIndex] = {
                ...updatedProducts[existingProductIndex],
                bmrMoveQuantity: (currentMoveQty + 0.1).toFixed(2)
              }
              setScannedBMRProducts(updatedProducts)
              toast.success(`Increased quantity for ${product.name}`)
            } else {
              toast.error(`Cannot add more. Only ${availableQty} available for ${product.name}`)
            }
          } else {
            setScannedBMRProducts(prev => [
              ...prev,
              {
                id: variant.id,
                stockId: product.id,
                BareCode: scannedBarcode,
                PartNo: product.part_no,
                name: product.name,
                price: parseFloat(variant.price) || parseFloat(product.price) || 0,
                bmrMoveQuantity: '', // EMPTY by default
                variantQuantity: availableQty,
                variantId: variant.id,
                variantData: variant
              }
            ])
            toast.success(`Added to BMR: ${product.name}`)
          }
        } catch (error) {
          console.error('Error finding variant for BMR:', error)
          toast.error('Error finding product variant!')
        }
      }

      findVariantForBMR()
    }

    if (err) {
      console.error('BMR Scan error:', err)
    }
  }

  const handleBMRCameraErrorStocks = (err) => {
    console.error('BMR Camera error:', err)
    setCameraErrorBMR(true)
    toast.error('Camera access denied or not available. Please check permissions.')
    setScanningBMR(false)
  }

  const startBMRScannerStocks = (useBackCamera = false) => {
    setCameraErrorBMR(false)
    setUsingBackCameraBMR(useBackCamera)
    setScanningBMR(true)
  }

  const stopBMRScannerStocks = () => {
    setScanningBMR(false)
  }

  const switchBMRCameraStocks = () => {
    setUsingBackCameraBMR(prev => !prev)
  }

  const handleBMRQuantityChangeStocks = (variantId, newQuantity) => {
    // Allow empty string, 0, or positive decimal numbers
    if (newQuantity === '' || newQuantity === '0' || newQuantity === '0.') {
      setScannedBMRProducts(prev =>
        prev.map(product =>
          product.variantId === variantId
            ? { ...product, bmrMoveQuantity: newQuantity }
            : product
        )
      )
      return
    }
    
    const parsedQuantity = parseFloat(newQuantity)
    if (isNaN(parsedQuantity) || parsedQuantity < 0) return
    
    setScannedBMRProducts(prev =>
      prev.map(product => {
        const maxQuantity = parseFloat(product.variantQuantity) || 0
        const validQuantity = Math.min(parsedQuantity, maxQuantity)
        return product.variantId === variantId
          ? {
            ...product,
            bmrMoveQuantity: validQuantity.toString()
          }
          : product
      })
    )
  }

  const removeBMRScannedProductStocks = (variantId) => {
    setScannedBMRProducts(prev => prev.filter(p => p.variantId !== variantId))
    toast.success('Product removed from BMR list')
  }

  const clearAllBMRScannedStocks = () => {
    setScannedBMRProducts([])
    toast.success('All BMR products cleared')
  }

  // Manual barcode input for BMR in Stocks
  const handleManualBarcodeInputBMR = (e) => {
    if (e.key === 'Enter' && manualBarcodeInputBMR.trim()) {
      playSimpleBeep()

      const findVariantForBMRManual = async () => {
        try {
          const { data: variant, error: variantError } = await supabase
            .from('stock_variants')
            .select(`
              *,
              stocks (
                id,
                part_no,
                name,
                price,
                average_price,
                quantity,
                using_quantity,
                total_received
              )
            `)
            .eq('bare_code', manualBarcodeInputBMR.trim())
            .single()

          if (variantError) {
            toast.error('Variant not found in database!')
            setManualBarcodeInputBMR('');
            return
          }

          const { data: product, error: productError } = await supabase
            .from('stocks')
            .select('*')
            .eq('id', variant.stock_id)
            .single()

          if (productError) {
            toast.error('Product not found!')
            setManualBarcodeInputBMR('');
            return
          }

          const availableQty = parseFloat(variant.quantity) || 0

          if (availableQty <= 0) {
            toast.error(`${product.name} (Variant: ${manualBarcodeInputBMR.trim()}) has no available quantity!`)
            setManualBarcodeInputBMR('');
            return
          }

          const existingProductIndex = scannedBMRProducts.findIndex(
            p => p.BareCode === manualBarcodeInputBMR.trim()
          )

          if (existingProductIndex !== -1) {
            const updatedProducts = [...scannedBMRProducts]
            const currentMoveQty = parseFloat(updatedProducts[existingProductIndex].bmrMoveQuantity) || 0

            if (currentMoveQty < availableQty) {
              updatedProducts[existingProductIndex] = {
                ...updatedProducts[existingProductIndex],
                bmrMoveQuantity: (currentMoveQty + 0.1).toFixed(2)
              }
              setScannedBMRProducts(updatedProducts)
              toast.success(`Increased quantity for ${product.name}`)
            } else {
              toast.error(`Cannot add more. Only ${availableQty} available for ${product.name}`)
            }
          } else {
            setScannedBMRProducts(prev => [
              ...prev,
              {
                id: variant.id,
                stockId: product.id,
                BareCode: manualBarcodeInputBMR.trim(),
                PartNo: product.part_no,
                name: product.name,
                price: parseFloat(variant.price) || parseFloat(product.price) || 0,
                bmrMoveQuantity: '', // EMPTY by default
                variantQuantity: availableQty,
                variantId: variant.id,
                variantData: variant
              }
            ])
            toast.success(`Added to BMR: ${product.name}`)
          }
          setManualBarcodeInputBMR('')
        } catch (error) {
          console.error('Error finding variant for BMR manual:', error)
          toast.error('Error finding product variant!')
          setManualBarcodeInputBMR('')
        }
      }

      findVariantForBMRManual()
    }
  }

  // Get active BMRs - ONLY ACTIVE BMR TEMPLATES
  const getActiveBMRs = () => {
    return bmrTemplates.filter(bmr => bmr.status === 'active')
  }

  // Update BMR template data in database
  const updateBMRTemplateDataInDatabase = async (bmrId, templateData) => {
    try {
      // Delete existing template data
      const { error: deleteError } = await supabase
        .from('bmr_template_data')
        .delete()
        .eq('template_id', bmrId)

      if (deleteError) throw deleteError

      if (templateData && templateData.length > 0) {
        const dataToInsert = templateData.map(item => ({
          template_id: bmrId,
          raw_material: item.rawMaterial || item.raw_material || '',
          part_no: item.partNo || item.part_no || '',
          internal_serial_no: item.internalSerialNo || item.internal_serial_no || '',
          description: item.description || '',
          assembly_name: item.assemblyName || item.assembly_name || '',
          quantity: parseFloat(item.quantity) || 1.00,
          price: parseFloat(item.price) || 0,
          issued_by: item.issuedBy || item.issued_by || '',
          received_by: item.receivedBy || item.received_by || '',
          variant_details: item.variantDetails ? JSON.stringify(item.variantDetails) : '[]',
          total_quantity: parseFloat(item.totalQuantity) || parseFloat(item.quantity) || 1.00,
          average_price: parseFloat(item.averagePrice) || parseFloat(item.price) || 0
        }))

        const { error: insertError } = await supabase
          .from('bmr_template_data')
          .insert(dataToInsert)

        if (insertError) throw insertError
      }

      return true
    } catch (error) {
      console.error('Error updating BMR template data in database:', error)
      throw error
    }
  }

  // Move products from Stocks to BMR with proper decimal support
  const moveToBMRFromStocks = async (bmrId) => {
    if (scannedBMRProducts.length === 0) {
      toast.error('No products scanned for BMR!')
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
      setLoadingStates(prev => ({ ...prev, moveToBMR: true }))

      const selectedBmrTemplate = bmrTemplates.find(bmr => bmr.id === bmrId)
      if (!selectedBmrTemplate) {
        toast.error('Selected BMR template not found!')
        setLoadingStates(prev => ({ ...prev, moveToBMR: false }))
        return
      }

      // Get or create template data
      const { data: existingTemplateData, error: existingDataError } = await supabase
        .from('bmr_template_data')
        .select('*')
        .eq('template_id', bmrId)
        .order('created_at', { ascending: true })

      let existingData = []
      if (!existingDataError && existingTemplateData) {
        existingData = existingTemplateData.map(item => ({
          id: item.id,
          rawMaterial: item.raw_material,
          partNo: item.part_no,
          internalSerialNo: item.internal_serial_no,
          description: item.description,
          assemblyName: item.assembly_name,
          quantity: parseFloat(item.quantity) || 1.00,
          price: parseFloat(item.price) || 0,
          issuedBy: item.issued_by,
          receivedBy: item.received_by,
          variantDetails: item.variant_details,
          totalQuantity: parseFloat(item.total_quantity) || parseFloat(item.quantity) || 1.00,
          averagePrice: parseFloat(item.average_price) || 0
        }))
      }

      // Group scanned products by PartNo
      const productsByPartNo = {}
      scannedBMRProducts.forEach(product => {
        if (!productsByPartNo[product.PartNo]) {
          productsByPartNo[product.PartNo] = []
        }
        productsByPartNo[product.PartNo].push(product)
      })

      // Create template data with multiple barcodes
      const newTemplateData = Object.entries(productsByPartNo).map(([partNo, products]) => {
        const firstProduct = products[0]
        const totalQuantity = products.reduce((sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 1.00), 0)
        const barcodes = products.map(p => p.BareCode).join(', ')
        
        // Create variant details array
        const variantDetails = products.map(p => ({
          barcode: p.BareCode,
          price: parseFloat(p.price) || 0,
          qty: parseFloat(p.bmrMoveQuantity) || 1.00
        }))
        
        const totalPrice = products.reduce((sum, p) => {
          const price = parseFloat(p.price) || 0
          const qty = parseFloat(p.bmrMoveQuantity) || 1.00
          return sum + (price * qty)
        }, 0)
        
        const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0

        return {
          rawMaterial: firstProduct.name,
          partNo: partNo,
          internalSerialNo: barcodes,
          description: '',
          assemblyName: selectedBmrTemplate.assemblyName || '',
          quantity: totalQuantity,
          price: averagePrice.toFixed(2),
          issuedBy: initialCode,
          receivedBy: '',
          variantDetails: variantDetails,
          totalQuantity: totalQuantity,
          averagePrice: averagePrice.toFixed(2)
        }
      })

      // Merge with existing data
      const mergedTemplateData = [...existingData]
      
      newTemplateData.forEach(newItem => {
        const existingIndex = mergedTemplateData.findIndex(item => item.partNo === newItem.partNo)
        
        if (existingIndex !== -1) {
          // Append barcodes to existing item
          const existingItem = mergedTemplateData[existingIndex]
          const existingBarcodes = existingItem.internalSerialNo ? existingItem.internalSerialNo.split(',').map(b => b.trim()) : []
          const newBarcodes = newItem.internalSerialNo.split(',').map(b => b.trim())
          const allBarcodes = [...new Set([...existingBarcodes, ...newBarcodes])].join(', ')
          
          // Merge variant details
          let existingVariants = []
          if (existingItem.variantDetails) {
            try {
              existingVariants = typeof existingItem.variantDetails === 'string' 
                ? JSON.parse(existingItem.variantDetails) 
                : existingItem.variantDetails
            } catch (e) {
              console.error('Error parsing existing variant details:', e)
            }
          }
          
          const mergedVariants = [...existingVariants]
          newItem.variantDetails.forEach(newVariant => {
            const existingVariantIndex = mergedVariants.findIndex(v => v.barcode === newVariant.barcode)
            if (existingVariantIndex !== -1) {
              // Update existing variant quantity
              mergedVariants[existingVariantIndex].qty = parseFloat(mergedVariants[existingVariantIndex].qty) + parseFloat(newVariant.qty)
            } else {
              // Add new variant
              mergedVariants.push(newVariant)
            }
          })
          
          // Recalculate totals
          const totalQuantity = mergedVariants.reduce((sum, v) => sum + parseFloat(v.qty), 0)
          const totalPrice = mergedVariants.reduce((sum, v) => sum + (parseFloat(v.price) * parseFloat(v.qty)), 0)
          const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0
          
          mergedTemplateData[existingIndex] = {
            ...existingItem,
            internalSerialNo: allBarcodes,
            variantDetails: mergedVariants,
            quantity: totalQuantity,
            totalQuantity: totalQuantity,
            averagePrice: averagePrice,
            price: averagePrice
          }
        } else {
          // Add new item
          mergedTemplateData.push(newItem)
        }
      })

      // Update BMR template data in database
      await updateBMRTemplateDataInDatabase(bmrId, mergedTemplateData)

      // Update variant quantities when moving from Stocks to BMR
      for (const scannedProduct of scannedBMRProducts) {
        const quantityToMove = parseFloat(scannedProduct.bmrMoveQuantity) || 1.00

        // Get variant by barcode
        const { data: variant, error: variantError } = await supabase
          .from('stock_variants')
          .select('*')
          .eq('bare_code', scannedProduct.BareCode)
          .single()

        if (!variantError) {
          // Check available quantity with decimal support
          const availableQty = parseFloat(variant.quantity) || 0
          if (availableQty < quantityToMove) {
            toast.error(`Insufficient available quantity for ${scannedProduct.name}. Available: ${availableQty.toFixed(2)}, Requested: ${quantityToMove.toFixed(2)}`)
            continue
          }

          // Move from available quantity to using_quantity (for BMR processing)
          const newVariantQty = Math.max(0, availableQty - quantityToMove)
          const newVariantUsing = (parseFloat(variant.using_quantity) || 0) + quantityToMove

          await supabase
            .from('stock_variants')
            .update({
              quantity: newVariantQty,
              using_quantity: newVariantUsing,
              updated_at: new Date().toISOString()
            })
            .eq('id', variant.id)

          // Record movement
          await supabase
            .from('stock_movements')
            .insert([{
              variant_id: variant.id,
              movement_type: 'out',
              quantity: quantityToMove,
              remaining_quantity: newVariantQty,
              reference_type: 'bmr_processing',
              reference_id: bmrId,
              movement_date: new Date().toISOString()
            }])

          // Update stock totals - Get ALL variants for correct calculation
          const { data: allVariants, error: allVariantsError } = await supabase
            .from('stock_variants')
            .select('quantity, using_quantity, pending_testing, price')
            .eq('stock_id', variant.stock_id)

          if (!allVariantsError && allVariants) {
            let totalQuantity = 0
            let totalUsingQuantity = 0
            let totalTestingBalance = 0
            let totalValue = 0
            let totalReceived = 0

            allVariants.forEach(v => {
              const qty = parseFloat(v.quantity) || 0
              const using = parseFloat(v.using_quantity) || 0
              const pending = parseFloat(v.pending_testing) || 0
              const price = parseFloat(v.price) || 0

              totalQuantity += qty
              totalUsingQuantity += using
              totalTestingBalance += pending
              totalValue += (qty + using + pending) * price
              totalReceived += qty + using + pending
            })

            const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0

            await supabase
              .from('stocks')
              .update({
                quantity: totalQuantity,
                using_quantity: totalUsingQuantity,
                testing_balance: totalTestingBalance,
                total_received: totalReceived,
                average_price: averagePrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', variant.stock_id)
          }
        }
      }

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
        templateData: mergedTemplateData,
        department: selectedBmrTemplate.department,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
        status: 'active',
        serialNo: serialNo,
        movedFrom: 'stocks'
      }

      // Add to BMR list
      const updatedBmrList = [...bmrList, bmrEntry]
      setBmrList(updatedBmrList)
      localStorage.setItem('bmrList', JSON.stringify(updatedBmrList))

      toast.success(`Moved ${scannedBMRProducts.length} product(s) from Stocks to ${selectedBmrTemplate.name}`)

      setScannedBMRProducts([])
      setSelectedBMR("")
      setInitialCode("")
      stopBMRScannerStocks()
      
      // Only reload necessary data
      await reloadModuleData('stocks')

      // Close modal
      if (moveToBMRModalRef.current) {
        const modal = bootstrap.Modal.getInstance(moveToBMRModalRef.current)
        modal?.hide()
      }

      setLoadingStates(prev => ({ ...prev, moveToBMR: false }))
    } catch (error) {
      console.error('Error moving to BMR from stocks:', error)
      toast.error('Error moving to BMR: ' + error.message)
      setLoadingStates(prev => ({ ...prev, moveToBMR: false }))
    }
  }

  // Add new product (only if PartNo doesn't exist) with decimal support
  const addNewProduct = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, addProduct: true }))

      // Validation with decimal support
      if (!newProduct.BareCode.trim()) {
        toast.error('Barcode is required!')
        return
      }
      if (!newProduct.PartNo.trim()) {
        toast.error('Part Number is required!')
        return
      }
      if (!newProduct.name.trim()) {
        toast.error('Product Name is required!')
        return
      }
      
      const quantity = parseFloat(newProduct.Quantity)
      if (isNaN(quantity) || quantity <= 0) {
        toast.error('Valid Quantity is required!')
        return
      }

      // Check if PartNo already exists
      const { data: existingProduct, error: checkError } = await supabase
        .from('stocks')
        .select('id')
        .eq('part_no', newProduct.PartNo.trim())
        .single()

      if (!checkError && existingProduct) {
        const addAsVariant = window.confirm(
          `Product with PartNo ${newProduct.PartNo} already exists.\n` +
          `Do you want to add this as a new variant instead?\n\n` +
          `Click OK to add as variant, Cancel to use different PartNo.`
        )

        if (addAsVariant) {
          setSelectedProductForVariant({
            PartNo: newProduct.PartNo,
            name: newProduct.name,
            price: newProduct.price
          })
          setNewVariant({
            bare_code: newProduct.BareCode,
            lot_no: newProduct.LotNo,
            serial_no: newProduct.SNo,
            price: newProduct.price,
            quantity: newProduct.Quantity
          })
          setShowAddVariantModal(true)

          // Reset form
          setNewProduct({
            BareCode: '',
            PartNo: '',
            LotNo: '',
            SNo: '',
            name: '',
            price: '',
            Quantity: '1.00',
            testingStatus: 'pending'
          })

          if (addModalRef.current) {
            const modal = bootstrap.Modal.getInstance(addModalRef.current)
            modal?.hide()
          }

          setLoadingStates(prev => ({ ...prev, addProduct: false }))
          return
        } else {
          setLoadingStates(prev => ({ ...prev, addProduct: false }))
          return
        }
      }

      // Check if barcode already exists
      const { data: existingBarcode, error: barcodeError } = await supabase
        .from('stock_variants')
        .select('id')
        .eq('bare_code', newProduct.BareCode.trim())
        .single()

      if (!barcodeError && existingBarcode) {
        toast.error('This barcode already exists for another product!')
        setLoadingStates(prev => ({ ...prev, addProduct: false }))
        return
      }

      // Create new product with decimal quantities
      const price = parseFloat(newProduct.price) || 0
      const { data: newStock, error: stockError } = await supabase
        .from('stocks')
        .insert([{
          bare_code: newProduct.BareCode.trim(),
          part_no: newProduct.PartNo.trim(),
          name: newProduct.name.trim(),
          price: price,
          quantity: quantity,
          using_quantity: 0,
          total_received: quantity,
          average_price: price,
          lot_no: newProduct.LotNo,
          s_no: newProduct.SNo,
          testing_status: newProduct.testingStatus || 'pending',
          testing_balance: 0
        }])
        .select()

      if (stockError) throw stockError

      // Add first variant with decimal quantities
      await supabase
        .from('stock_variants')
        .insert([{
          stock_id: newStock[0].id,
          bare_code: newProduct.BareCode.trim(),
          serial_no: newProduct.SNo.trim(),
          lot_no: newProduct.LotNo.trim(),
          batch_no: newProduct.LotNo || `BATCH-${Date.now()}`,
          price: price,
          quantity: quantity,
          pending_testing: 0,
          using_quantity: 0,
          received_date: new Date().toISOString().split('T')[0],
          testing_status: 'completed'
        }])

      toast.success('Product added successfully!')

      // Reset form
      setNewProduct({
        BareCode: '',
        PartNo: '',
        LotNo: '',
        SNo: '',
        name: '',
        price: '',
        Quantity: '1.00',
        testingStatus: 'pending'
      })

      // Optimized reload - only reload stock data
      await reloadModuleData('stocks')

      // Close modal
      if (addModalRef.current) {
        const modal = bootstrap.Modal.getInstance(addModalRef.current)
        modal?.hide()
      }

      setLoadingStates(prev => ({ ...prev, addProduct: false }))
    } catch (error) {
      console.error('Error adding product:', error)
      toast.error('Error adding product: ' + error.message)
      setLoadingStates(prev => ({ ...prev, addProduct: false }))
    }
  }

  // Delete product (only if no variants have quantity)
  const deleteProduct = async (productId) => {
    try {
      setLoadingStates(prev => ({ ...prev, deleteProduct: true }))

      // Check if product has any quantity in use
      const { data: stock, error: stockError } = await supabase
        .from('stocks')
        .select('quantity, using_quantity, testing_balance')
        .eq('id', productId)
        .single()

      if (stockError) throw stockError

      if ((parseFloat(stock.using_quantity) || 0) > 0 || (parseFloat(stock.testing_balance) || 0) > 0) {
        toast.error('Cannot delete product. It is being used in production or sales.')
        return
      }

      // Check if any variants have quantity
      const { data: variants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity')
        .eq('stock_id', productId)

      if (!variantsError && variants.some(v =>
        (parseFloat(v.quantity) || 0) > 0 || (parseFloat(v.pending_testing) || 0) > 0 || (parseFloat(v.using_quantity) || 0) > 0
      )) {
        toast.error('Cannot delete product. Some variants still have quantity.')
        return
      }

      // Delete product (cascade will delete variants)
      const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('id', productId)

      if (error) throw error

      toast.success('Product deleted successfully!')
      await reloadModuleData('stocks')
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Error deleting product: ' + error.message)
    } finally {
      setLoadingStates(prev => ({ ...prev, deleteProduct: false }))
    }
  }

  // Edit product in Supabase with decimal support
  const saveEditProduct = async () => {
    if (!editingProduct) return

    try {
      setLoadingStates(prev => ({ ...prev, editProduct: true }))

      // Validation
      if (!editingProduct.BareCode.trim()) {
        toast.error('Barcode is required!')
        setLoadingStates(prev => ({ ...prev, editProduct: false }))
        return
      }
      if (!editingProduct.PartNo.trim()) {
        toast.error('Part Number is required!')
        setLoadingStates(prev => ({ ...prev, editProduct: false }))
        return
      }
      if (!editingProduct.name.trim()) {
        toast.error('Product Name is required!')
        setLoadingStates(prev => ({ ...prev, editProduct: false }))
        return
      }

      // Check if barcode already exists (excluding current product)
      const { data: existingProduct, error: checkError } = await supabase
        .from('stocks')
        .select('id')
        .eq('bare_code', editingProduct.BareCode.trim())
        .neq('id', editingProduct.id)
        .maybeSingle()

      if (!checkError && existingProduct) {
        toast.error('Another product with this barcode already exists!')
        setLoadingStates(prev => ({ ...prev, editProduct: false }))
        return
      }

      // Get all variants to calculate total_received
      const { data: allVariants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity')
        .eq('stock_id', editingProduct.id)

      let totalReceived = 0
      if (!variantsError && allVariants) {
        allVariants.forEach(variant => {
          totalReceived += (parseFloat(variant.quantity) || 0) + 
                          (parseFloat(variant.pending_testing) || 0) + 
                          (parseFloat(variant.using_quantity) || 0)
        })
      }

      const { error } = await supabase
        .from('stocks')
        .update({
          bare_code: editingProduct.BareCode.trim(),
          part_no: editingProduct.PartNo.trim(),
          lot_no: editingProduct.LotNo.trim(),
          s_no: editingProduct.SNo.trim(),
          name: editingProduct.name.trim(),
          price: parseFloat(editingProduct.price) || 0,
          quantity: parseFloat(editingProduct.Quantity) || 0,
          using_quantity: parseFloat(editingProduct.usingQuantity) || 0,
          testing_balance: parseFloat(editingProduct.testingBalance) || 0,
          total_received: totalReceived,
          testing_status: editingProduct.testingStatus || 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProduct.id)

      if (error) throw error

      toast.success('Product updated successfully!')
      setEditingProduct(null)
      
      // Optimized reload - only reload stock data
      await reloadModuleData('stocks')

      // Close modal
      if (editModalRef.current) {
        const modal = bootstrap.Modal.getInstance(editModalRef.current)
        modal?.hide()
      }

      setLoadingStates(prev => ({ ...prev, editProduct: false }))
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Error updating product: ' + error.message)
      setLoadingStates(prev => ({ ...prev, editProduct: false }))
    }
  }

  // Edit product
  const startEditProduct = (product) => {
    setEditingProduct({ ...product })
  }

  const handleEditChange = (field, value) => {
    // Handle decimal inputs
    if (field === 'price' || field === 'Quantity' || field === 'usingQuantity' || field === 'testingBalance') {
      // Remove non-numeric characters except decimal point
      const sanitizedValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = sanitizedValue.split('.');
      if (parts.length > 2) {
        return;
      }
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
      } else {
        value = sanitizedValue;
      }
    }
    
    setEditingProduct(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Add new product functions with decimal support
  const handleAddChange = (field, value) => {
    // Handle decimal inputs
    if (field === 'price' || field === 'Quantity') {
      // Remove non-numeric characters except decimal point
      const sanitizedValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = sanitizedValue.split('.');
      if (parts.length > 2) {
        return;
      }
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
      } else {
        value = sanitizedValue;
      }
    }
    
    setNewProduct(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Calculate total items to move with decimal support
  const totalItemsToMove = scannedProducts.reduce(
    (total, product) => total + (parseFloat(product.moveQuantity) || 0),
    0
  )

  // Calculate total value of scanned products with decimal support
  const totalValue = scannedProducts.reduce(
    (total, product) => total + ((parseFloat(product.price) || 0) * (parseFloat(product.moveQuantity) || 0)),
    0
  )

  // Get available production departments
  const availableProductionDepartments = Array.isArray(productionDepartments)
    ? productionDepartments.map(dept => dept.name || dept)
    : []

  // Calculate total received quantity from variants with decimal support
  const calculateTotalReceivedFromVariants = (product) => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, variant) => {
        const availableQty = parseFloat(variant.quantity) || 0
        const pendingQty = parseFloat(variant.pending_testing) || 0
        const usingQty = parseFloat(variant.using_quantity) || 0
        return sum + availableQty + pendingQty + usingQty
      }, 0)
    }
    return parseFloat(product.totalReceived) || 0
  }

  // Calculate total items for BMR with decimal support
  const totalBMRItemsToMove = scannedBMRProducts.reduce(
    (total, product) => total + (parseFloat(product.bmrMoveQuantity) || 0),
    0
  )

  // Calculate total value for BMR with decimal support
  const totalBMRValue = scannedBMRProducts.reduce(
    (total, product) => total + ((parseFloat(product.price) || 0) * (parseFloat(product.bmrMoveQuantity) || 0)),
    0
  )

  // FIXED: Calculate available quantity from variants for main table
  const calculateAvailableFromVariants = (product) => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, variant) => {
        return sum + (parseFloat(variant.quantity) || 0)
      }, 0)
    }
    return parseFloat(product.Quantity) || 0
  }

  // FIXED: Calculate using quantity from variants for main table
  const calculateUsingFromVariants = (product) => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, variant) => {
        return sum + (parseFloat(variant.using_quantity) || 0)
      }, 0)
    }
    return parseFloat(product.usingQuantity) || 0
  }

  // FIXED: Calculate testing balance from variants for main table
  const calculateTestingFromVariants = (product) => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, variant) => {
        return sum + (parseFloat(variant.pending_testing) || 0)
      }, 0)
    }
    return parseFloat(product.testingBalance) || 0
  }

  return (
    <div className="container-fluid px-lg-4 px-md-3 px-2 py-3 stocks-container">
      {/* Header with Buttons and Search */}
      <div className="row mb-4 align-items-center">
        <div className="col-lg-4 col-md-6 col-12 mb-3 mb-md-0">
          <div className="d-flex flex-wrap gap-2">
            <button 
              className="btn btn-success btn-lg shadow-sm" 
              data-bs-toggle="modal" 
              data-bs-target="#addProductModal"
            >
              <i className="fa-solid fa-plus me-2"></i>
              ADD STOCKS
            </button>
            <button 
              className="btn btn-primary btn-lg shadow-sm" 
              data-bs-toggle="modal" 
              data-bs-target="#move"
            >
              <i className="fa-solid fa-arrow-right-arrow-left me-2"></i>
              MOVE PRODUCTS
            </button>
            <button 
              className="btn btn-warning btn-lg shadow-sm" 
              data-bs-toggle="modal" 
              data-bs-target="#moveToBMRModal"
            >
              <i className="fa-solid fa-industry me-2"></i>
              BMR
            </button>
          </div>
        </div>
        <div className="col-lg-8 col-md-6 col-12">
          <div className="input-group input-group-lg shadow-sm">
            <span className="input-group-text bg-white border-end-0">
              <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0 ps-0"
              placeholder="Search by Barcode, Part No, Name, Lot No, S.No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="btn btn-outline-secondary" 
                type="button"
                onClick={() => setSearchTerm('')}
              >
                <i className="fa-solid fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stock Summary Cards with decimal formatting */}
      <div className="row mb-4 g-3">
        <div className="col-xl-3 col-lg-6 col-md-6 col-12">
          <div className="card dashboard-card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="card-subtitle mb-2 text-muted">Total Products</h6>
                  <h2 className="card-title mb-0">{products.length}</h2>
                </div>
                <div className="dashboard-icon bg-primary">
                  <i className="fa-solid fa-boxes-stacked"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-lg-6 col-md-6 col-12">
          <div className="card dashboard-card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="card-subtitle mb-2 text-muted">Available Quantity</h6>
                  <h2 className="card-title mb-0">
                    {products.reduce((sum, product) => {
                      const available = calculateAvailableFromVariants(product);
                      return sum + available;
                    }, 0).toFixed(2)}
                  </h2>
                </div>
                <div className="dashboard-icon bg-success">
                  <i className="fa-solid fa-cubes"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-lg-6 col-md-6 col-12">
          <div className="card dashboard-card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="card-subtitle mb-2 text-muted">In Use</h6>
                  <h2 className="card-title mb-0">
                    {products.reduce((sum, product) => sum + calculateUsingFromVariants(product), 0).toFixed(2)}
                  </h2>
                </div>
                <div className="dashboard-icon bg-warning">
                  <i className="fa-solid fa-industry"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-lg-6 col-md-6 col-12">
          <div className="card dashboard-card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="card-subtitle mb-2 text-muted">Testing Balance</h6>
                  <h2 className="card-title mb-0">
                    {products.reduce((sum, product) => sum + calculateTestingFromVariants(product), 0).toFixed(2)}
                  </h2>
                </div>
                <div className="dashboard-icon bg-info">
                  <i className="fa-solid fa-flask"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Products Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">
              <i className="fa-solid fa-warehouse me-2 text-primary"></i>
              Products Inventory
              <span className="badge bg-primary ms-2">{filteredProducts.length} items</span>
            </h5>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-outline-primary btn-sm"
                onClick={() => reloadModuleData('stocks')}
                disabled={loadingStates.general}
              >
                <i className="fa-solid fa-rotate"></i>
              </button>
              <button 
                className="btn btn-outline-success btn-sm"
                data-bs-toggle="modal" 
                data-bs-target="#addProductModal"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {loadingStates.general ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-5">
              <i className="fa-solid fa-box-open fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">No products found</h5>
              <p className="text-muted">
                {searchTerm ? 'Try adjusting your search terms' : 'Add your first product to get started'}
              </p>
              {!searchTerm && (
                <button className="btn btn-success" data-bs-toggle="modal" data-bs-target="#addProductModal">
                  <i className="fa-solid fa-plus me-2"></i>
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">#</th>
                    <th>Part No</th>
                    <th>Product</th>
                    <th className="text-end">Avg Price</th>
                    <th className="text-center">Available</th>
                    <th className="text-center">In Use</th>
                    <th className="text-center">Testing</th>
                    <th className="text-center">Total</th>
                    <th className="text-end">Value</th>
                    <th className="text-center pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, index) => {
                    const availableQty = calculateAvailableFromVariants(p)
                    const usingQty = calculateUsingFromVariants(p)
                    const testingQty = calculateTestingFromVariants(p)
                    const totalReceived = calculateTotalReceivedFromVariants(p)
                    const totalValue = availableQty * (parseFloat(p.averagePrice) || parseFloat(p.price) || 0)

                    return (
                      <tr key={p.id} className="hover-row">
                        <td className="ps-3">
                          <span className="badge bg-light text-dark">{index + 1}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <strong className="text-primary">{p.PartNo}</strong>
                            <button
                              className="btn btn-sm btn-outline-info"
                              onClick={() => showProductVariants(p)}
                              data-bs-toggle="modal"
                              data-bs-target="#variantsModal"
                              title="View Variants"
                            >
                              <i className="fa-solid fa-layer-group"></i>
                            </button>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong className="d-block">{p.name}</strong>
                            <small className="text-muted">
                              <code>{p.BareCode}</code>
                            </small>
                          </div>
                        </td>
                        <td className="text-end">
                          <span className="fw-bold">₹{(parseFloat(p.averagePrice) || parseFloat(p.price) || 0).toFixed(2)}</span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${availableQty > 0 ? 'bg-success' : 'bg-danger'}`}>
                            {availableQty.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${usingQty > 0 ? 'bg-warning' : 'bg-secondary'}`}>
                            {usingQty.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${testingQty > 0 ? 'bg-info' : 'bg-secondary'}`}>
                            {testingQty.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-dark">{totalReceived.toFixed(2)}</span>
                        </td>
                        <td className="text-end">
                          <strong className="text-success">₹{totalValue.toFixed(2)}</strong>
                        </td>
                        <td className="text-center pe-3">
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              className="btn btn-outline-success"
                              onClick={() => handleAddVariantClick(p)}
                              data-bs-toggle="modal"
                              data-bs-target="#addVariantModal"
                              title="Add Variant"
                              disabled={loadingStates.addVariant}
                            >
                              <i className="fa-solid fa-plus"></i>
                            </button>
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => startEditProduct(p)}
                              data-bs-toggle="modal"
                              data-bs-target="#editProductModal"
                              title="Edit Product"
                              disabled={loadingStates.editProduct}
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => showConfirmation('deleteProduct', p.id)}
                              title="Delete Product"
                              disabled={loadingStates.deleteProduct}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filteredProducts.length > 0 && (
          <div className="card-footer bg-white border-0 py-3">
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Showing {filteredProducts.length} of {products.length} products
              </small>
              <small className="text-muted">
                Last updated: {new Date().toLocaleTimeString()}
              </small>
            </div>
          </div>
        )}
      </div>

      {/* Variants Modal */}
      <div className="modal fade" id="variantsModal" tabIndex="-1" aria-labelledby="variantsModalLabel" aria-hidden="true" ref={variantsModalRef}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-primary text-white">
              <h5 className="modal-title" id="variantsModalLabel">
                <i className="fa-solid fa-layer-group me-2"></i>
                {selectedProductVariants?.name} - Variants
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4">
              {selectedProductVariants ? (
                <>
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-lg-4 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-barcode text-primary"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">Part No</small>
                              <strong>{selectedProductVariants.partNo}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-box text-success"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">Product</small>
                              <strong>{selectedProductVariants.name}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-layer-group text-warning"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">Total Variants</small>
                              <strong className="badge bg-primary">{selectedProductVariants.variants.length}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-check-circle text-success"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">Available</small>
                              <strong className="badge bg-success">
                                {selectedProductVariants.variants.reduce((sum, v) => sum + (parseFloat(v.quantity) || 0), 0).toFixed(2)}
                              </strong>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-flask text-warning"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">Testing</small>
                              <strong className="badge bg-warning">
                                {selectedProductVariants.variants.reduce((sum, v) => sum + (parseFloat(v.pending_testing) || 0), 0).toFixed(2)}
                              </strong>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-industry text-danger"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">In Use</small>
                              <strong className="badge bg-danger">
                                {selectedProductVariants.variants.reduce((sum, v) => sum + (parseFloat(v.using_quantity) || 0), 0).toFixed(2)}
                              </strong>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-light p-2 rounded">
                              <i className="fa-solid fa-chart-line text-primary"></i>
                            </div>
                            <div>
                              <small className="text-muted d-block">Avg Price</small>
                              <strong>₹{calculateWeightedAveragePrice(selectedProductVariants.variants).toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>FIFO</th>
                          <th>Barcode</th>
                          <th>Lot No</th>
                          <th>Serial No</th>
                          <th className="text-end">Price</th>
                          <th className="text-center">Testing</th>
                          <th className="text-center">Available</th>
                          <th className="text-center">In Use</th>
                          <th className="text-center">Total</th>
                          <th className="text-center">Status</th>
                          <th className="text-end">Value</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProductVariants.variants.map((variant, index) => {
                          const availableQty = parseFloat(variant.quantity) || 0
                          const pendingQty = parseFloat(variant.pending_testing) || 0
                          const usingQty = parseFloat(variant.using_quantity) || 0
                          const totalQty = availableQty + pendingQty + usingQty
                          const value = totalQty * (parseFloat(variant.price) || 0)
                          const isFirstInFIFO = index === 0 && totalQty > 0
                          const isFirstZeroFIFO = index === 0 && totalQty === 0

                          return (
                            <tr key={variant.id} className={isFirstInFIFO ? 'table-success' : isFirstZeroFIFO ? 'table-warning' : ''}>
                              <td>
                                <span className="badge bg-light text-dark">{index + 1}</span>
                              </td>
                              <td>
                                {isFirstInFIFO && (
                                  <span className="badge bg-success" title="First in FIFO (Will be consumed first)">
                                    <i className="fa-solid fa-arrow-right me-1"></i>
                                    FIFO
                                  </span>
                                )}
                                {isFirstZeroFIFO && (
                                  <span className="badge bg-danger" title="First FIFO is Zero - No stock available">
                                    <i className="fa-solid fa-exclamation-triangle me-1"></i>
                                    ZERO
                                  </span>
                                )}
                                {index > 0 && totalQty > 0 && (
                                  <span className="badge bg-secondary" title={`Position ${index + 1} in FIFO queue`}>
                                    #{index + 1}
                                  </span>
                                )}
                              </td>
                              <td>
                                <code className="fw-bold">{variant.bare_code}</code>
                              </td>
                              <td>{variant.lot_no || '-'}</td>
                              <td>{variant.serial_no || '-'}</td>
                              <td className="text-end">₹{(parseFloat(variant.price) || 0).toFixed(2)}</td>
                              <td className="text-center">
                                <span className={`badge ${pendingQty > 0 ? 'bg-warning' : 'bg-secondary'}`}>
                                  {pendingQty.toFixed(2)}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${availableQty > 0 ? 'bg-success' : 'bg-danger'}`}>
                                  {availableQty.toFixed(2)}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${usingQty > 0 ? 'bg-danger' : 'bg-secondary'}`}>
                                  {usingQty.toFixed(2)}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${totalQty > 0 ? 'bg-primary' : 'bg-light text-dark border'}`}>
                                  {totalQty.toFixed(2)}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${variant.testing_status === 'completed' ? 'bg-success' : 'bg-warning'
                                  }`}>
                                  {variant.testing_status}
                                </span>
                              </td>
                              <td className="text-end">
                                <span className="fw-bold">₹{value.toFixed(2)}</span>
                              </td>
                              <td className="text-center">
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-primary"
                                    onClick={() => startEditVariant(variant)}
                                    data-bs-toggle="modal"
                                    data-bs-target="#editVariantModal"
                                    title="Edit Variant"
                                  >
                                    <i className="fa-solid fa-pen"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => showConfirmation('deleteVariant', variant.id)}
                                    disabled={totalQty > 0 || selectedProductVariants.variants.length === 1}
                                    title={totalQty > 0 ? "Cannot delete variant with quantity" :
                                      selectedProductVariants.variants.length === 1 ? "Cannot delete only variant" : "Delete variant"}
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="table-light">
                        <tr>
                          <td colSpan="5" className="text-end fw-bold">Totals:</td>
                          <td></td>
                          <td className="text-center fw-bold">
                            {selectedProductVariants.variants.reduce((sum, v) => sum + (parseFloat(v.pending_testing) || 0), 0).toFixed(2)}
                          </td>
                          <td className="text-center fw-bold">
                            {selectedProductVariants.variants.reduce((sum, v) => sum + (parseFloat(v.quantity) || 0), 0).toFixed(2)}
                          </td>
                          <td className="text-center fw-bold">
                            {selectedProductVariants.variants.reduce((sum, v) => sum + (parseFloat(v.using_quantity) || 0), 0).toFixed(2)}
                          </td>
                          <td className="text-center fw-bold">
                            {calculateTotalVariantQuantity(selectedProductVariants.variants).toFixed(2)}
                          </td>
                          <td></td>
                          <td className="text-end fw-bold text-success">
                            ₹{selectedProductVariants.variants.reduce((sum, v) => {
                              const totalQty = (parseFloat(v.quantity) || 0) + (parseFloat(v.pending_testing) || 0) + (parseFloat(v.using_quantity) || 0)
                              return sum + (totalQty * (parseFloat(v.price) || 0))
                            }, 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="alert alert-info mt-4 border-0 shadow-sm">
                    <div className="d-flex align-items-start gap-2">
                      <i className="fa-solid fa-circle-info text-primary mt-1"></i>
                      <div>
                        <strong>FIFO Explanation:</strong> The green "FIFO" badge indicates which variant will be consumed first.
                        Red "ZERO" badge means the first variant has no stock. Items move from production/testing to using quantity when consumed.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <i className="fa-solid fa-box-open fa-3x text-muted mb-3"></i>
                  <p className="text-muted">No product selected</p>
                </div>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => selectedProductVariants && handleAddVariantClick({
                  PartNo: selectedProductVariants.partNo,
                  name: selectedProductVariants.name,
                  price: selectedProductVariants.variants[0]?.price || 0
                })}
                data-bs-toggle="modal"
                data-bs-target="#addVariantModal"
              >
                <i className="fa-solid fa-plus me-2"></i>
                Add New Variant
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      <div className="modal fade" id="addProductModal" tabIndex="-1" aria-labelledby="addProductModalLabel" aria-hidden="true" ref={addModalRef}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-success text-white">
              <h5 className="modal-title" id="addProductModalLabel">
                <i className="fa-solid fa-plus-circle me-2"></i>
                Add New Product
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4">
              {loadingStates.addProduct ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Adding product...</p>
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Barcode *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter barcode"
                      value={newProduct.BareCode}
                      onChange={(e) => handleAddChange('BareCode', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Part Number *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter part number"
                      value={newProduct.PartNo}
                      onChange={(e) => handleAddChange('PartNo', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Lot Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional"
                      value={newProduct.LotNo}
                      onChange={(e) => handleAddChange('LotNo', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional"
                      value={newProduct.SNo}
                      onChange={(e) => handleAddChange('SNo', e.target.value)}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label fw-bold">Product Name *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter product name"
                      value={newProduct.name}
                      onChange={(e) => handleAddChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Price (₹)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="0.00"
                      value={newProduct.price}
                      onChange={(e) => handleAddChange('price', e.target.value)}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label fw-bold">Quantity *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="1.00"
                      value={newProduct.Quantity}
                      onChange={(e) => handleAddChange('Quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Testing Status</label>
                    <select
                      className="form-select"
                      value={newProduct.testingStatus}
                      onChange={(e) => handleAddChange('testingStatus', e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="inprogress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <div className="alert alert-info border-0 bg-light">
                      <div className="d-flex align-items-start gap-2">
                        <i className="fa-solid fa-circle-info text-primary mt-1"></i>
                        <div>
                          <strong>Note:</strong>
                          <ul className="mb-0 mt-1">
                            <li>Fields marked with * are required</li>
                            <li>Quantity and price support decimal values</li>
                            <li>If barcode exists, you'll be prompted to add to existing product</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal" disabled={loadingStates.addProduct}>
                Cancel
              </button>
              <button type="button" className="btn btn-success btn-lg" onClick={addNewProduct} disabled={loadingStates.addProduct}>
                {loadingStates.addProduct ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus-circle me-2"></i>
                    Add Product
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      <div className="modal fade" id="editProductModal" tabIndex="-1" aria-labelledby="editProductModalLabel" aria-hidden="true" ref={editModalRef}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-primary text-white">
              <h5 className="modal-title" id="editProductModalLabel">
                <i className="fa-solid fa-pen-circle me-2"></i>
                Edit Product
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4">
              {loadingStates.editProduct ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Saving changes...</p>
                </div>
              ) : editingProduct ? (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Barcode *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      value={editingProduct.BareCode}
                      onChange={(e) => handleEditChange('BareCode', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Part Number *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      value={editingProduct.PartNo}
                      onChange={(e) => handleEditChange('PartNo', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Lot Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingProduct.LotNo}
                      onChange={(e) => handleEditChange('LotNo', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingProduct.SNo}
                      onChange={(e) => handleEditChange('SNo', e.target.value)}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label fw-bold">Product Name *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      value={editingProduct.name}
                      onChange={(e) => handleEditChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Price (₹)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingProduct.price}
                      onChange={(e) => handleEditChange('price', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Total Quantity *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingProduct.Quantity}
                      onChange={(e) => handleEditChange('Quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Using Quantity *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingProduct.usingQuantity || 0}
                      onChange={(e) => handleEditChange('usingQuantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Testing Balance *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingProduct.testingBalance || 0}
                      onChange={(e) => handleEditChange('testingBalance', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <div className="alert alert-info border-0 bg-light">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>Total Value:</strong>
                          <span className="ms-2 fw-bold text-success">
                            ₹{((parseFloat(editingProduct.Quantity) || 0) * (parseFloat(editingProduct.price) || 0)).toFixed(2)}
                          </span>
                        </div>
                        <small className="text-muted">Calculated based on quantity × price</small>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <i className="fa-solid fa-box-open fa-3x text-muted mb-3"></i>
                  <p className="text-muted">No product selected for editing.</p>
                </div>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal" disabled={loadingStates.editProduct}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={saveEditProduct} disabled={loadingStates.editProduct || !editingProduct}>
                {loadingStates.editProduct ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save me-2"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move Products Modal */}
      <div className="modal fade" id="move" tabIndex="-1" aria-labelledby="moveModalLabel" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-primary text-white">
              <h5 className="modal-title" id="moveModalLabel">
                <i className="fa-solid fa-arrow-right-arrow-left me-2"></i>
                Move Products
                {scannedProducts.length > 0 && (
                  <span className="badge bg-white text-primary ms-2">{scannedProducts.length} products</span>
                )}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onClick={stopScanner}></button>
            </div>
            <div className="modal-body p-4">
              {loadingStates.moveToSales || loadingStates.moveToProduction ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Processing...</p>
                </div>
              ) : (
                <>
                  {/* Scanner Section */}
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                      <h6 className="card-title mb-3">
                        <i className="fa-solid fa-barcode me-2 text-primary"></i>
                        Scanner
                      </h6>
                      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                        <button
                          className={`btn ${scanning ? 'btn-warning' : 'btn-primary'}`}
                          onClick={() => startScanner(false)}
                        >
                          <i className="fa-solid fa-camera me-2"></i>
                          Front Camera
                        </button>

                        <button
                          className={`btn ${scanning && usingBackCamera ? 'btn-warning' : 'btn-secondary'}`}
                          onClick={() => startScanner(true)}
                        >
                          <i className="fa-solid fa-camera-rotate me-2"></i>
                          Back Camera
                        </button>

                        {scanning && (
                          <button
                            className="btn btn-outline-info"
                            onClick={switchCamera}
                          >
                            <i className="fa-solid fa-rotate me-2"></i>
                            Switch Camera
                          </button>
                        )}

                        {scanning && (
                          <button
                            className="btn btn-danger"
                            onClick={stopScanner}
                          >
                            <i className="fa-solid fa-stop me-2"></i>
                            Stop Scanner
                          </button>
                        )}

                        {scannedProducts.length > 0 && (
                          <>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => showConfirmation('clearScanned')}
                            >
                              <i className="fa-solid fa-trash me-2"></i>
                              Clear All
                            </button>
                            <span className="badge bg-info fs-6">
                              <i className="fa-solid fa-cube me-1"></i>
                              Total Items: {totalItemsToMove.toFixed(2)}
                            </span>
                            <span className="badge bg-success fs-6">
                              <i className="fa-solid fa-indian-rupee-sign me-1"></i>
                              Total Value: ₹{totalValue.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Manual Input */}
                      <div className="mb-3">
                        <label htmlFor="manualBarcode" className="form-label">
                          <i className="fa-solid fa-keyboard me-2"></i>
                          Or enter barcode manually:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          id="manualBarcode"
                          placeholder="Type barcode and press Enter"
                          onKeyPress={handleManualBarcode}
                        />
                      </div>

                      {cameraError && (
                        <div className="alert alert-warning alert-dismissible fade show" role="alert">
                          <i className="fa-solid fa-triangle-exclamation me-2"></i>
                          <strong>Camera not available.</strong> Please check permissions or use manual input above.
                          <button type="button" className="btn-close" onClick={() => setCameraError(false)}></button>
                        </div>
                      )}

                      {scanning && !cameraError && (
                        <div className="scanner-container border rounded p-2 text-center bg-light">
                          <BarcodeScannerComponent
                            width={400}
                            height={250}
                            onUpdate={handleScan}
                            onError={handleCameraError}
                            delay={1000}
                            facingMode={usingBackCamera ? "environment" : "user"}
                            constraints={{
                              audio: false,
                              video: {
                                facingMode: usingBackCamera ? "environment" : "user",
                                width: { ideal: 1280 },
                                height: { ideal: 720 }
                              }
                            }}
                          />
                          <p className="text-center text-muted mt-2">
                            <i className="fa-solid fa-camera me-2"></i>
                            Using {usingBackCamera ? 'Back' : 'Front'} Camera - Point camera at barcode
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <h6 className="card-title mb-3">
                        <i className="fa-solid fa-list me-2 text-primary"></i>
                        Products to Move
                        {scannedProducts.length > 0 && (
                          <span className="badge bg-primary ms-2">{scannedProducts.length} items</span>
                        )}
                      </h6>

                      {scannedProducts.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-hover align-middle">
                            <thead className="table-light">
                              <tr>
                                <th>#</th>
                                <th>Barcode</th>
                                <th>Product</th>
                                <th>Part No</th>
                                <th>Available</th>
                                <th>Move Qty</th>
                                <th className="text-end">Price</th>
                                <th className="text-end">Total</th>
                                <th className="text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scannedProducts.map((product, index) => {
                                const availableQty = parseFloat(product.variantQuantity) || 0
                                const moveQty = parseFloat(product.moveQuantity) || 0
                                const itemTotal = (parseFloat(product.price) || 0) * moveQty
                                return (
                                  <tr key={product.variantId}>
                                    <td>
                                      <span className="badge bg-light text-dark">{index + 1}</span>
                                    </td>
                                    <td>
                                      <code className="fw-bold">{product.BareCode}</code>
                                      <br />
                                      <small className="text-muted">Variant</small>
                                    </td>
                                    <td>
                                      <div>
                                        <strong>{product.name}</strong>
                                        {availableQty <= 0 && (
                                          <span className="badge bg-danger ms-2">Out of Stock</span>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <span className="badge bg-secondary">{product.PartNo}</span>
                                    </td>
                                    <td>
                                      <span className={`badge ${availableQty > 0 ? 'bg-success' : 'bg-danger'}`}>
                                        {availableQty.toFixed(2)}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="d-flex align-items-center">
                                        <input
                                          type="number"
                                          className="form-control form-control-sm text-center"
                                          style={{ width: '100px' }}
                                          value={product.moveQuantity}
                                          onChange={(e) => handleQuantityChange(product.variantId, e.target.value)}
                                          min="0"
                                          step="0.01"
                                          placeholder="Enter Qty"
                                          onFocus={(e) => e.target.select()}
                                        />
                                        <small className="ms-2 text-muted">
                                          Max: {availableQty.toFixed(2)}
                                        </small>
                                      </div>
                                    </td>
                                    <td className="text-end">₹{(parseFloat(product.price) || 0).toFixed(2)}</td>
                                    <td className="text-end">
                                      <strong className="text-success">₹{itemTotal.toFixed(2)}</strong>
                                    </td>
                                    <td className="text-center">
                                      <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeScannedProduct(product.variantId)}
                                        title="Remove product"
                                      >
                                        <i className="fa-solid fa-times"></i>
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <td colSpan="5" className="text-end fw-bold">Grand Total:</td>
                                <td className="fw-bold">{totalItemsToMove.toFixed(2)}</td>
                                <td></td>
                                <td className="text-end fw-bold text-success">₹{totalValue.toFixed(2)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center text-muted p-5">
                          <i className="fa-solid fa-barcode fa-3x mb-3 d-block text-muted"></i>
                          <p className="mb-2">No products scanned yet.</p>
                          <small className="text-muted">Use camera scanner or manual input to add products.</small>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal" onClick={stopScanner}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-info"
                onClick={() => showConfirmation('moveToSales')}
                disabled={scannedProducts.length === 0 || loadingStates.moveToSales || loadingStates.moveToProduction}
              >
                {loadingStates.moveToSales ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cart-shopping me-2"></i>
                    MOVE TO SALES
                  </>
                )}
              </button>
              <div className="dropdown">
                <button
                  className="btn btn-primary dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  disabled={scannedProducts.length === 0 || availableProductionDepartments.length === 0 || loadingStates.moveToSales || loadingStates.moveToProduction}
                >
                  {loadingStates.moveToProduction ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-industry me-2"></i>
                      MOVE TO PRODUCTION
                    </>
                  )}
                </button>
                <ul className="dropdown-menu shadow">
                  {availableProductionDepartments.length > 0 ? (
                    availableProductionDepartments.map((department, index) => (
                      <li key={index}>
                        <button
                          className="dropdown-item"
                          onClick={() => showConfirmation('moveToProduction', null, department)}
                        >
                          <i className="fa-solid fa-arrow-right me-2 text-success"></i>
                          {department}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>
                      <button className="dropdown-item text-muted" disabled>
                        No production departments available
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Variant Modal */}
      <div className="modal fade" id="addVariantModal" tabIndex="-1" aria-labelledby="addVariantModalLabel" aria-hidden="true" ref={addVariantModalRef}>
        <div className="modal-dialog">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-success text-white">
              <h5 className="modal-title" id="addVariantModalLabel">
                <i className="fa-solid fa-plus-circle me-2"></i>
                Add New Variant
                {selectedProductForVariant && ` - ${selectedProductForVariant.name}`}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4">
              {loadingStates.addVariant ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Adding variant...</p>
                </div>
              ) : selectedProductForVariant ? (
                <div className="row g-3">
                  <div className="col-12">
                    <div className="alert alert-info border-0 bg-light">
                      <div className="d-flex align-items-start gap-2">
                        <i className="fa-solid fa-circle-info text-primary mt-1"></i>
                        <div>
                          <strong>Product:</strong> {selectedProductForVariant.name}<br />
                          <strong>Part No:</strong> {selectedProductForVariant.PartNo}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Barcode *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter barcode"
                      value={newVariant.bare_code}
                      onChange={(e) => handleVariantChange('bare_code', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Lot Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional"
                      value={newVariant.lot_no}
                      onChange={(e) => handleVariantChange('lot_no', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional"
                      value={newVariant.serial_no}
                      onChange={(e) => handleVariantChange('serial_no', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Price (₹)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="0.00"
                      value={newVariant.price}
                      onChange={(e) => handleVariantChange('price', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Quantity *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="1.00"
                      value={newVariant.quantity}
                      onChange={(e) => handleVariantChange('quantity', e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <i className="fa-solid fa-box-open fa-2x text-muted mb-3"></i>
                  <p className="text-muted">No product selected for adding variant.</p>
                </div>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn btn-success"
                onClick={addNewVariant}
                disabled={!selectedProductForVariant || loadingStates.addVariant}
              >
                {loadingStates.addVariant ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus-circle me-2"></i>
                    Add Variant
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Variant Modal */}
      <div className="modal fade" id="editVariantModal" tabIndex="-1" aria-labelledby="editVariantModalLabel" aria-hidden="true" ref={editVariantModalRef}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-primary text-white">
              <h5 className="modal-title" id="editVariantModalLabel">
                <i className="fa-solid fa-pen-circle me-2"></i>
                Edit Variant
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4">
              {loadingStates.editVariant ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Updating variant...</p>
                </div>
              ) : editingVariant ? (
                <div className="row g-3">
                  <div className="col-12">
                    <div className="alert alert-info border-0 bg-light">
                      <div className="d-flex align-items-start gap-2">
                        <i className="fa-solid fa-circle-info text-primary mt-1"></i>
                        <div>
                          <strong>Barcode:</strong> {editingVariant.bare_code}<br />
                          <strong>Current Available:</strong> {parseFloat(editingVariant.quantity || 0).toFixed(2)}<br />
                          <strong>Current Using:</strong> {parseFloat(editingVariant.using_quantity || 0).toFixed(2)}<br />
                          <strong>Current Total:</strong> {(parseFloat(editingVariant.quantity) || 0) + (parseFloat(editingVariant.pending_testing) || 0) + (parseFloat(editingVariant.using_quantity) || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Barcode *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Barcode"
                      value={editVariantForm.bare_code}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, bare_code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Lot Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Lot Number"
                      value={editVariantForm.lot_no}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, lot_no: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Serial Number"
                      value={editVariantForm.serial_no}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, serial_no: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Price (₹) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Price"
                      value={editVariantForm.price}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, price: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Available Quantity *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Available Quantity"
                      value={editVariantForm.quantity}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Testing Pending *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Testing Pending"
                      value={editVariantForm.pending_testing}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, pending_testing: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Using Quantity *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Using Quantity"
                      value={editVariantForm.using_quantity}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, using_quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Testing Status</label>
                    <select
                      className="form-select"
                      value={editVariantForm.testing_status}
                      onChange={(e) => setEditVariantForm(prev => ({ ...prev, testing_status: e.target.value }))}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <div className="alert alert-warning border-0 bg-light">
                      <div className="d-flex align-items-start gap-2">
                        <i className="fa-solid fa-calculator text-warning mt-1"></i>
                        <div>
                          <strong>Total Quantity:</strong>
                          <span className="ms-2 fw-bold">
                            {
                              (parseFloat(editVariantForm.quantity) || 0) +
                              (parseFloat(editVariantForm.pending_testing) || 0) +
                              (parseFloat(editVariantForm.using_quantity) || 0)
                            } units
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <i className="fa-solid fa-box-open fa-2x text-muted mb-3"></i>
                  <p className="text-muted">No variant selected for editing.</p>
                </div>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={updateVariant}
                disabled={!editingVariant || loadingStates.editVariant}
              >
                {loadingStates.editVariant ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Updating...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save me-2"></i>
                    Update Variant
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to BMR Modal */}
      <div className="modal fade" id="moveToBMRModal" tabIndex="-1" aria-labelledby="moveToBMRModalLabel" aria-hidden="true" ref={moveToBMRModalRef}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-gradient-warning text-white">
              <h5 className="modal-title" id="moveToBMRModalLabel">
                <i className="fa-solid fa-industry me-2"></i>
                Move Products to BMR
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onClick={stopBMRScannerStocks}></button>
            </div>
            <div className="modal-body p-4">
              {loadingStates.moveToBMR ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-warning" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Processing BMR move...</p>
                </div>
              ) : (
                <>
                  {/* BMR Scanner Section */}
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                      <h6 className="card-title mb-3">
                        <i className="fa-solid fa-barcode me-2 text-warning"></i>
                        BMR Scanner
                      </h6>
                      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                        <button
                          className={`btn ${scanningBMR && !usingBackCameraBMR ? 'btn-warning' : 'btn-primary'}`}
                          onClick={() => startBMRScannerStocks(false)}
                        >
                          <i className="fa-solid fa-camera me-2"></i>
                          Front Camera
                        </button>

                        <button
                          className={`btn ${scanningBMR && usingBackCameraBMR ? 'btn-warning' : 'btn-secondary'}`}
                          onClick={() => startBMRScannerStocks(true)}
                        >
                          <i className="fa-solid fa-camera-rotate me-2"></i>
                          Back Camera
                        </button>

                        {scanningBMR && (
                          <button
                            className="btn btn-outline-info"
                            onClick={switchBMRCameraStocks}
                          >
                            <i className="fa-solid fa-rotate me-2"></i>
                            Switch Camera
                          </button>
                        )}

                        {scanningBMR && (
                          <button
                            className="btn btn-danger"
                            onClick={stopBMRScannerStocks}
                          >
                            <i className="fa-solid fa-stop me-2"></i>
                            Stop Scanner
                          </button>
                        )}

                        {scannedBMRProducts.length > 0 && (
                          <>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => showConfirmation('clearBMRScanned')}
                            >
                              Clear All
                            </button>
                            <span className="badge bg-info fs-6">
                              <i className="fa-solid fa-cube me-1"></i>
                              Total Items: {totalBMRItemsToMove.toFixed(2)}
                            </span>
                            <span className="badge bg-success fs-6">
                              <i className="fa-solid fa-indian-rupee-sign me-1"></i>
                              Total Value: ₹{totalBMRValue.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Manual Input */}
                      <div className="mb-3">
                        <label htmlFor="manualBarcodeBMRStocks" className="form-label">
                          Or enter barcode manually:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          id="manualBarcodeBMRStocks"
                          placeholder="Type barcode and press Enter"
                          value={manualBarcodeInputBMR}
                          onChange={(e) => setManualBarcodeInputBMR(e.target.value)}
                          onKeyPress={handleManualBarcodeInputBMR}
                        />
                      </div>

                      {cameraErrorBMR && (
                        <div className="alert alert-warning alert-dismissible fade show" role="alert">
                          <small>
                            <i className="fa-solid fa-triangle-exclamation me-2"></i>
                            Camera not available. Please check permissions or use manual input above.
                          </small>
                          <button type="button" className="btn-close" onClick={() => setCameraErrorBMR(false)}></button>
                        </div>
                      )}

                      {scanningBMR && !cameraErrorBMR && (
                        <div className="scanner-container border rounded p-2 text-center bg-light">
                          <BarcodeScannerComponent
                            width={400}
                            height={250}
                            onUpdate={handleBMRScanStocks}
                            onError={handleBMRCameraErrorStocks}
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
                            Using {usingBackCameraBMR ? 'Back' : 'Front'} Camera - Scan products from stocks
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BMR Products Preview */}
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                      <h6 className="card-title mb-3">
                        <i className="fa-solid fa-list me-2 text-warning"></i>
                        Products for BMR
                        {scannedBMRProducts.length > 0 && (
                          <span className="badge bg-warning ms-2">{scannedBMRProducts.length} items</span>
                        )}
                      </h6>

                      {scannedBMRProducts.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-hover align-middle">
                            <thead className="table-light">
                              <tr>
                                <th>#</th>
                                <th>Barcode</th>
                                <th>Product</th>
                                <th>Part No</th>
                                <th>Available</th>
                                <th>BMR Qty</th>
                                <th className="text-end">Price</th>
                                <th className="text-end">Total</th>
                                <th className="text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scannedBMRProducts.map((product, index) => {
                                const availableQty = parseFloat(product.variantQuantity) || 0;
                                const moveQty = parseFloat(product.bmrMoveQuantity) || 0;
                                const itemTotal = (parseFloat(product.price) || 0) * moveQty;
                                return (
                                  <tr key={product.variantId}>
                                    <td>
                                      <span className="badge bg-light text-dark">{index + 1}</span>
                                    </td>
                                    <td>
                                      <code className="fw-bold">{product.BareCode}</code>
                                      <br />
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
                                      <span className={`badge ${availableQty > 0 ? 'bg-info' : 'bg-danger'}`}>
                                        {availableQty.toFixed(2)}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="d-flex align-items-center">
                                        <input
                                          type="number"
                                          className="form-control form-control-sm text-center"
                                          style={{ width: '100px' }}
                                          value={product.bmrMoveQuantity}
                                          onChange={(e) => handleBMRQuantityChangeStocks(product.variantId, e.target.value)}
                                          min="0"
                                          step="0.01"
                                          placeholder="Enter Qty"
                                          onFocus={(e) => e.target.select()}
                                        />
                                        <small className="ms-2 text-muted">
                                          Max: {availableQty.toFixed(2)}
                                        </small>
                                      </div>
                                    </td>
                                    <td className="text-end">₹{(parseFloat(product.price) || 0).toFixed(2)}</td>
                                    <td className="text-end">
                                      <strong className="text-success">₹{itemTotal.toFixed(2)}</strong>
                                    </td>
                                    <td className="text-center">
                                      <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeBMRScannedProductStocks(product.variantId)}
                                      >
                                        <i className="fa-solid fa-times"></i>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <td colSpan="5" className="text-end fw-bold">Grand Total:</td>
                                <td className="fw-bold">{totalBMRItemsToMove.toFixed(2)}</td>
                                <td></td>
                                <td className="text-end fw-bold text-success">₹{totalBMRValue.toFixed(2)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center text-muted p-5">
                          <i className="fa-solid fa-barcode fa-3x mb-3 d-block text-muted"></i>
                          <p className="mb-2">No products scanned for BMR yet.</p>
                          <small className="text-muted">Scan products from your stock inventory</small>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BMR Selection */}
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label htmlFor="bmrSelectStocks" className="form-label fw-bold">Select Active BMR Template:</label>
                          <select
                            className="form-select form-select-lg"
                            id="bmrSelectStocks"
                            value={selectedBMR}
                            onChange={(e) => setSelectedBMR(e.target.value)}
                            disabled={scannedBMRProducts.length === 0}
                          >
                            <option value="">-- Select Active BMR Template --</option>
                            {getActiveBMRs().map((bmr) => (
                              <option key={bmr.id} value={bmr.id}>
                                {bmr.name} ({bmr.initialCode}) - {bmr.productName}
                              </option>
                            ))}
                          </select>
                          <small className="text-muted">
                            Only active BMR templates are shown. {getActiveBMRs().length} active templates available.
                          </small>
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="initialCodeStocks" className="form-label fw-bold">Initial Code (Mandatory):</label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            id="initialCodeStocks"
                            value={initialCode}
                            onChange={(e) => setInitialCode(e.target.value)}
                            placeholder="Enter initial code (e.g., MM)"
                            required
                            disabled={scannedBMRProducts.length === 0}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Template Preview */}
                  {selectedBMR && scannedBMRProducts.length > 0 && (
                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <h6 className="card-title mb-3">
                          <i className="fa-solid fa-eye me-2 text-info"></i>
                          Template Auto-Fill Preview
                        </h6>
                        <div className="table-responsive">
                          <table className="table table-hover align-middle">
                            <thead className="table-light">
                              <tr>
                                <th>Part No</th>
                                <th>Raw Material</th>
                                <th>Barcodes</th>
                                <th className="text-center">Total Qty</th>
                                <th className="text-end">Avg Price</th>
                                <th className="text-end">Total Price</th>
                                <th className="text-center">Issued By</th>
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
                                const totalQuantity = products.reduce((sum, p) => sum + (parseFloat(p.bmrMoveQuantity) || 1), 0)
                                const totalPrice = products.reduce((sum, p) => {
                                  const price = parseFloat(p.price) || 0
                                  const qty = parseFloat(p.bmrMoveQuantity) || 1
                                  return sum + (price * qty)
                                }, 0)
                                const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0
                                const barcodes = products.map(p => p.BareCode).join(', ')

                                return (
                                  <tr key={index}>
                                    <td>
                                      <strong className="text-primary">{partNo}</strong>
                                    </td>
                                    <td>{products[0].name}</td>
                                    <td>
                                      <div className="multiple-barcodes">
                                        {products.map((product, idx) => (
                                          <div key={idx} className="small mb-1">
                                            <span className="badge bg-info me-1">{product.BareCode}</span>
                                            (Qty: {product.bmrMoveQuantity || 1}, ₹{product.price || 0})
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="text-center">
                                      <span className="badge bg-primary">{totalQuantity.toFixed(2)}</span>
                                    </td>
                                    <td className="text-end">₹{averagePrice.toFixed(2)}</td>
                                    <td className="text-end">
                                      <strong className="text-success">₹{totalPrice.toFixed(2)}</strong>
                                    </td>
                                    <td className="text-center">
                                      <span className="badge bg-secondary">{initialCode}</span>
                                    </td>
                                  </tr>
                                )
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
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal" onClick={stopBMRScannerStocks} disabled={loadingStates.moveToBMR}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-warning btn-lg"
                onClick={() => showConfirmation('moveToBMR', selectedBMR)}
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
                    MOVE TO BMR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      
      {/* Delete Product Confirmation */}
      <div className="modal fade" id="confirmDeleteProductModal" tabIndex="-1" aria-labelledby="confirmDeleteProductModalLabel" aria-hidden="true" ref={confirmDeleteProductRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-danger text-white border-0">
              <h5 className="modal-title" id="confirmDeleteProductModalLabel">
                <i className="fa-solid fa-triangle-exclamation me-2"></i>
                Confirm Delete
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-trash fa-3x text-danger mb-3"></i>
              <h5 className="mb-3">Delete Product</h5>
              <p className="text-muted">
                Are you sure you want to delete this product? This will delete ALL variants and cannot be undone.
              </p>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmAction}>
                <i className="fa-solid fa-trash me-2"></i>
                Delete Product
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Variant Confirmation */}
      <div className="modal fade" id="confirmDeleteVariantModal" tabIndex="-1" aria-labelledby="confirmDeleteVariantModalLabel" aria-hidden="true" ref={confirmDeleteVariantRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-danger text-white border-0">
              <h5 className="modal-title" id="confirmDeleteVariantModalLabel">
                <i className="fa-solid fa-triangle-exclamation me-2"></i>
                Confirm Delete
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-trash-alt fa-3x text-danger mb-3"></i>
              <h5 className="mb-3">Delete Variant</h5>
              <p className="text-muted">
                Are you sure you want to delete this variant? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmAction}>
                <i className="fa-solid fa-trash-alt me-2"></i>
                Delete Variant
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to Sales Confirmation */}
      <div className="modal fade" id="confirmMoveToSalesModal" tabIndex="-1" aria-labelledby="confirmMoveToSalesModalLabel" aria-hidden="true" ref={confirmMoveToSalesRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-info text-white border-0">
              <h5 className="modal-title" id="confirmMoveToSalesModalLabel">
                <i className="fa-solid fa-cart-shopping me-2"></i>
                Move to Sales
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-arrow-right fa-3x text-info mb-3"></i>
              <h5 className="mb-3">Move {scannedProducts.length} Products to Sales?</h5>
              <div className="alert alert-info border-0 bg-light mb-0">
                <div className="d-flex justify-content-between">
                  <span>Total Items:</span>
                  <strong>{totalItemsToMove.toFixed(2)}</strong>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Total Value:</span>
                  <strong className="text-success">₹{totalValue.toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-info" onClick={handleConfirmAction}>
                <i className="fa-solid fa-check me-2"></i>
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to Production Confirmation */}
      <div className="modal fade" id="confirmMoveToProductionModal" tabIndex="-1" aria-labelledby="confirmMoveToProductionModalLabel" aria-hidden="true" ref={confirmMoveToProductionRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-primary text-white border-0">
              <h5 className="modal-title" id="confirmMoveToProductionModalLabel">
                <i className="fa-solid fa-industry me-2"></i>
                Move to Production
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-arrow-right fa-3x text-primary mb-3"></i>
              <h5 className="mb-3">Move {scannedProducts.length} Products to {confirmAction.department}?</h5>
              <div className="alert alert-primary border-0 bg-light mb-0">
                <div className="d-flex justify-content-between">
                  <span>Department:</span>
                  <strong>{confirmAction.department}</strong>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Total Items:</span>
                  <strong>{totalItemsToMove.toFixed(2)}</strong>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Total Value:</span>
                  <strong className="text-success">₹{totalValue.toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmAction}>
                <i className="fa-solid fa-check me-2"></i>
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to BMR Confirmation */}
      <div className="modal fade" id="confirmMoveToBMRModal" tabIndex="-1" aria-labelledby="confirmMoveToBMRModalLabel" aria-hidden="true" ref={confirmMoveToBMRRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-warning text-white border-0">
              <h5 className="modal-title" id="confirmMoveToBMRModalLabel">
                <i className="fa-solid fa-industry me-2"></i>
                Move to BMR
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-arrow-right fa-3x text-warning mb-3"></i>
              <h5 className="mb-3">Move {scannedBMRProducts.length} Products to BMR?</h5>
              <div className="alert alert-warning border-0 bg-light mb-0">
                <div className="d-flex justify-content-between">
                  <span>Total Items:</span>
                  <strong>{totalBMRItemsToMove.toFixed(2)}</strong>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Total Value:</span>
                  <strong className="text-success">₹{totalBMRValue.toFixed(2)}</strong>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Initial Code:</span>
                  <strong>{initialCode}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-warning" onClick={handleConfirmAction}>
                <i className="fa-solid fa-check me-2"></i>
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Scanned Products Confirmation */}
      <div className="modal fade" id="confirmClearScannedModal" tabIndex="-1" aria-labelledby="confirmClearScannedModalLabel" aria-hidden="true" ref={confirmClearScannedRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-secondary text-white border-0">
              <h5 className="modal-title" id="confirmClearScannedModalLabel">
                <i className="fa-solid fa-trash me-2"></i>
                Clear All Products
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-broom fa-3x text-secondary mb-3"></i>
              <h5 className="mb-3">Clear {scannedProducts.length} Products?</h5>
              <p className="text-muted">
                This will remove all scanned products from the list. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-secondary" onClick={handleConfirmAction}>
                <i className="fa-solid fa-trash me-2"></i>
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clear BMR Scanned Products Confirmation */}
      <div className="modal fade" id="confirmClearBMRScannedModal" tabIndex="-1" aria-labelledby="confirmClearBMRScannedModalLabel" aria-hidden="true" ref={confirmClearBMRScannedRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-secondary text-white border-0">
              <h5 className="modal-title" id="confirmClearBMRScannedModalLabel">
                <i className="fa-solid fa-trash me-2"></i>
                Clear BMR Products
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 text-center">
              <i className="fa-solid fa-broom fa-3x text-secondary mb-3"></i>
              <h5 className="mb-3">Clear {scannedBMRProducts.length} BMR Products?</h5>
              <p className="text-muted">
                This will remove all scanned products from the BMR list. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer border-0 justify-content-center">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-secondary" onClick={handleConfirmAction}>
                <i className="fa-solid fa-trash me-2"></i>
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Stocks