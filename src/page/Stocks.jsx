import "./Stocks.css"
import { useState, useRef, useEffect } from 'react'
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
  bmrTemplates,
  bmrList,
  setBmrList,
  stockVariants,
  setStockVariants
}) {
  const [scannedProducts, setScannedProducts] = useState([])
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
  const [scannedBMRProducts, setScannedBMRProducts] = useState([])
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
  
  // New variant form state
  const [newVariant, setNewVariant] = useState({
    bare_code: '',
    lot_no: '',
    serial_no: '',
    price: '',
    quantity: '1'
  })
  
  // New product form state
  const [newProduct, setNewProduct] = useState({
    BareCode: '',
    PartNo: '',
    LotNo: '',
    SNo: '',
    name: '',
    price: '',
    Quantity: '',
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

  // Get product variants with using quantity
  const getProductVariants = async (partNo) => {
    try {
      const { data: stock, error: stockError } = await supabase
        .from('stocks')
        .select('id, name, part_no, bare_code, price, average_price, using_quantity, total_received')
        .eq('part_no', partNo)
        .single()

      if (stockError) {
        console.error('Error finding stock:', stockError)
        return { stock: null, variants: [] }
      }

      const { data: variants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('*')
        .eq('stock_id', stock.id)
        .order('received_date', { ascending: true })

      if (variantsError) {
        console.error('Error loading variants:', variantsError)
        return { stock, variants: [] }
      }

      return { stock, variants: variants || [] }
    } catch (error) {
      console.error('Error getting product variants:', error)
      return { stock: null, variants: [] }
    }
  }

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

  // Calculate weighted average price
  const calculateWeightedAveragePrice = (variants) => {
    if (!variants || variants.length === 0) return 0
    
    let totalValue = 0
    let totalQuantity = 0
    
    variants.forEach(variant => {
      const availableQty = variant.quantity || 0
      const pendingQty = variant.pending_testing || 0
      const usingQty = variant.using_quantity || 0
      const totalQty = availableQty + pendingQty + usingQty
      const price = variant.price || 0
      totalValue += totalQty * price
      totalQuantity += totalQty
    })
    
    return totalQuantity > 0 ? totalValue / totalQuantity : 0
  }

  // Calculate total quantity from variants (for total_received)
  const calculateTotalVariantQuantity = (variants) => {
    if (!variants || variants.length === 0) return 0
    
    return variants.reduce((sum, variant) => {
      const availableQty = variant.quantity || 0
      const pendingQty = variant.pending_testing || 0
      const usingQty = variant.using_quantity || 0
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
      const availableQty = variant.quantity || 0
      const pendingQty = variant.pending_testing || 0
      const usingQty = variant.using_quantity || 0
      const totalQty = availableQty + pendingQty + usingQty
      
      if (totalQty > 0 && !foundAvailable) {
        const value = totalQty * (variant.price || 0)
        totalValue = value
        foundAvailable = true
      } else if (totalQty <= 0 && !foundAvailable) {
        totalValue = 0
      } else if (foundAvailable) {
        const value = totalQty * (variant.price || 0)
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
      quantity: '1'
    })
  }

  // Handle variant form change
  const handleVariantChange = (field, value) => {
    setNewVariant(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Add new variant to existing product
  const addNewVariant = async () => {
    if (!selectedProductForVariant) return

    try {
      setLoadingStates(prev => ({ ...prev, addVariant: true }))

      // Validation
      if (!newVariant.bare_code.trim()) {
        toast.error('Barcode is required!')
        return
      }
      if (!newVariant.quantity || parseInt(newVariant.quantity) <= 0) {
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
        const { data: newStock, error: createStockError } = await supabase
          .from('stocks')
          .insert([{
            part_no: selectedProductForVariant.PartNo,
            name: selectedProductForVariant.name,
            price: parseFloat(newVariant.price) || 0,
            average_price: parseFloat(newVariant.price) || 0,
            quantity: parseInt(newVariant.quantity) || 0,
            total_received: parseInt(newVariant.quantity) || 0,
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

      // Add stock variant
      const { data: newVariantData, error: variantError } = await supabase
        .from('stock_variants')
        .insert([{
          stock_id: stockId,
          bare_code: newVariant.bare_code.trim(),
          serial_no: newVariant.serial_no.trim(),
          lot_no: newVariant.lot_no.trim(),
          batch_no: newVariant.lot_no || `BATCH-${Date.now()}`,
          price: parseFloat(newVariant.price) || 0,
          quantity: parseInt(newVariant.quantity) || 0,
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
          quantity: parseInt(newVariant.quantity) || 0,
          remaining_quantity: parseInt(newVariant.quantity) || 0,
          reference_type: 'manual',
          movement_date: new Date().toISOString()
        }])

      // Get all variants to calculate totals
      const { data: allVariants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity, price')
        .eq('stock_id', stockId)

      if (variantsError) throw variantsError

      // Calculate totals from all variants
      let totalQuantity = 0
      let totalTestingBalance = 0
      let totalUsingQuantity = 0
      let totalValue = 0
      let totalReceived = 0
      
      allVariants.forEach(variant => {
        const qty = variant.quantity || 0
        const pending = variant.pending_testing || 0
        const using = variant.using_quantity || 0
        const price = variant.price || 0
        
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
        quantity: '1'
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
      
      await loadAllData()
      
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

  // Update variant
  const updateVariant = async () => {
    if (!editingVariant) return

    try {
      setLoadingStates(prev => ({ ...prev, editVariant: true }))

      // Calculate total quantity
      const availableQty = parseInt(editVariantForm.quantity) || 0
      const pendingQty = parseInt(editVariantForm.pending_testing) || 0
      const usingQty = parseInt(editVariantForm.using_quantity) || 0
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
      const oldTotalQty = (editingVariant.quantity || 0) + (editingVariant.pending_testing || 0) + (editingVariant.using_quantity || 0)
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
          const qty = variant.quantity || 0
          const pending = variant.pending_testing || 0
          const using = variant.using_quantity || 0
          const price = variant.price || 0
          
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
      
      await loadAllData()
    } catch (error) {
      console.error('Error updating variant:', error)
      toast.error('Error updating variant: ' + error.message)
    } finally {
      setLoadingStates(prev => ({ ...prev, editVariant: false }))
    }
  }

  // Delete variant (only if total quantity is 0)
  const deleteVariant = async (variantId) => {
    if (!window.confirm('Are you sure you want to delete this variant?')) return

    try {
      const { data: variant, error: variantError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity, stock_id')
        .eq('id', variantId)
        .single()

      if (variantError) throw variantError

      const totalQty = (variant.quantity || 0) + (variant.pending_testing || 0) + (variant.using_quantity || 0)
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
          const qty = variant.quantity || 0
          const pending = variant.pending_testing || 0
          const using = variant.using_quantity || 0
          const price = variant.price || 0
          
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
      
      await loadAllData()
    } catch (error) {
      console.error('Error deleting variant:', error)
      toast.error('Error deleting variant: ' + error.message)
    }
  }

  // Move products with enhanced FIFO
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

            const quantityToMove = product.moveQuantity
            const availableInVariant = variant.quantity || 0
            
            if (availableInVariant < quantityToMove) {
                toast.error(`Insufficient quantity in variant ${product.BareCode}. Available: ${availableInVariant}, Requested: ${quantityToMove}`)
                continue
            }

            // Calculate new quantities correctly
            const newVariantQty = availableInVariant - quantityToMove
            const newVariantUsing = (variant.using_quantity || 0) + quantityToMove

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

            // Get all variants to recalculate stock totals
            const { data: allVariants, error: variantsError } = await supabase
                .from('stock_variants')
                .select('quantity, using_quantity, pending_testing, price')
                .eq('stock_id', variant.stock_id)

            if (!variantsError && allVariants) {
                // Calculate totals from all variants
                let totalQuantity = 0
                let totalUsingQuantity = 0
                let totalTestingBalance = 0
                let totalValue = 0
                let totalReceived = 0
                
                allVariants.forEach(v => {
                    const qty = v.quantity || 0
                    const using = v.using_quantity || 0
                    const pending = v.pending_testing || 0
                    const price = v.price || 0
                    
                    totalQuantity += qty
                    totalUsingQuantity += using
                    totalTestingBalance += pending
                    totalValue += (qty + using + pending) * price
                    totalReceived += qty + using + pending
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
                    // Update existing sales record
                    const newMoveQty = existingSales.move_quantity + quantityToMove
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
                    // Update existing production record
                    const newMoveQty = existingProduction.move_quantity + quantityToMove
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
        await loadAllData()
        
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

  // Handle barcode scan - VARIANT BASED
  const handleScan = (err, result) => {
    if (result) {
      playSimpleBeep()
      
      const scannedBarcode = result.text
      
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

          const availableQty = variant.quantity || 0
          
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
            const currentMoveQty = updatedProducts[existingIndex].moveQuantity
            
            if (currentMoveQty < availableQty) {
              updatedProducts[existingIndex] = {
                ...updatedProducts[existingIndex],
                moveQuantity: currentMoveQty + 1,
                variantQuantity: availableQty // Update available quantity
              }
              setScannedProducts(updatedProducts)
              toast.success(`Increased quantity for ${product.name} (Variant: ${scannedBarcode}) to ${currentMoveQty + 1}`)
            } else {
              toast.error(`Cannot add more. Only ${availableQty} available for ${product.name}`)
            }
          } else {
            // Add new variant
            setScannedProducts(prev => [
              ...prev,
              {
                id: variant.id, // Variant ID
                stockId: product.id,
                BareCode: scannedBarcode,
                PartNo: product.part_no,
                name: product.name,
                price: variant.price || product.price || 0,
                moveQuantity: 1,
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
  }

  // Start scanning with selected camera
  const startScanner = (useBackCamera = false) => {
    setCameraError(false)
    setUsingBackCamera(useBackCamera)
    setScanning(true)
  }

  // Stop scanning
  const stopScanner = () => {
    setScanning(false)
  }

  // Switch camera
  const switchCamera = () => {
    setUsingBackCamera(prev => !prev)
  }

  // Handle quantity change for individual product
  const handleQuantityChange = (variantId, newQuantity) => {
    setScannedProducts(prev => 
      prev.map(product => {
        const maxQuantity = product.variantQuantity || 0
        return product.variantId === variantId 
          ? { 
              ...product, 
              moveQuantity: Math.min(Math.max(1, newQuantity), maxQuantity) 
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

          const availableQty = variant.quantity || 0
          
          if (availableQty <= 0) {
            toast.error(`${product.name} (Variant: ${scannedBarcode}) has no available quantity!`)
            return
          }

          const existingProductIndex = scannedBMRProducts.findIndex(
            p => p.BareCode === scannedBarcode
          )
          
          if (existingProductIndex !== -1) {
            const updatedProducts = [...scannedBMRProducts]
            const currentMoveQty = updatedProducts[existingProductIndex].bmrMoveQuantity || 1
            
            if (currentMoveQty < availableQty) {
              updatedProducts[existingProductIndex] = {
                ...updatedProducts[existingProductIndex],
                bmrMoveQuantity: currentMoveQty + 1
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
                price: variant.price || product.price || 0,
                bmrMoveQuantity: 1,
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
    setScannedBMRProducts(prev => 
      prev.map(product => {
        const maxQuantity = product.variantQuantity || 0
        return product.variantId === variantId 
          ? { 
              ...product, 
              bmrMoveQuantity: Math.min(Math.max(1, newQuantity), maxQuantity) 
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

          const availableQty = variant.quantity || 0
          
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
            const currentMoveQty = updatedProducts[existingProductIndex].bmrMoveQuantity || 1
            
            if (currentMoveQty < availableQty) {
              updatedProducts[existingProductIndex] = {
                ...updatedProducts[existingProductIndex],
                bmrMoveQuantity: currentMoveQty + 1
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
                price: variant.price || product.price || 0,
                bmrMoveQuantity: 1,
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

  // Get active BMRs
  const getActiveBMRs = () => {
    return bmrTemplates.filter(bmr => 
      bmr.status === 'active' && savedTemplates[bmr.id]
    )
  }

  // Update BMR template data in database
  const updateBMRTemplateDataInDatabase = async (bmrId, templateData, scannedProducts) => {
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
          quantity: item.quantity || 1,
          price: item.price || 0,
          issued_by: item.issuedBy || item.issued_by || '',
          received_by: item.receivedBy || item.received_by || '',
          variant_details: item.variantDetails ? JSON.stringify(item.variantDetails) : '[]'
        }))

        const { error: insertError } = await supabase
          .from('bmr_template_data')
          .insert(dataToInsert)

        if (insertError) throw insertError
      }

      // Update saved templates in localStorage
      const updatedTemplates = {
        ...savedTemplates,
        [bmrId]: {
          ...savedTemplates[bmrId],
          templateData: templateData,
          scannedProducts: scannedProducts,
          savedAt: new Date().toISOString()
        }
      }
      
      setSavedTemplates(updatedTemplates)
      localStorage.setItem('bmrSavedTemplates', JSON.stringify(updatedTemplates))

      return true
    } catch (error) {
      console.error('Error updating BMR template data in database:', error)
      throw error
    }
  }

  // Move to BMR from Stocks
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

        // Group scanned products by PartNo to handle multiple barcodes
        const productsByPartNo = {}
        scannedBMRProducts.forEach(product => {
            if (!productsByPartNo[product.PartNo]) {
                productsByPartNo[product.PartNo] = []
            }
            productsByPartNo[product.PartNo].push(product)
        })

        // Create template data with multiple barcodes for same PartNo
        const templateData = Object.entries(productsByPartNo).map(([partNo, products]) => {
            // Get first product for basic info
            const firstProduct = products[0]
            
            // Calculate totals for multiple barcodes
            const totalQuantity = products.reduce((sum, p) => sum + (p.bmrMoveQuantity || 1), 0)
            const barcodes = products.map(p => p.BareCode).join(', ')
            const prices = products.map(p => ({ 
                barcode: p.BareCode, 
                price: p.price || 0, 
                qty: p.bmrMoveQuantity || 1 
            }))
            const totalPrice = products.reduce((sum, p) => {
                const price = p.price || 0
                const qty = p.bmrMoveQuantity || 1
                return sum + (price * qty)
            }, 0)
            const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0

            return {
                rawMaterial: firstProduct.name,
                partNo: partNo,
                internalSerialNo: barcodes, // Multiple barcodes comma separated
                description: '', // Removed auto-description as requested
                assemblyName: selectedBmrTemplate.assemblyName || '',
                quantity: totalQuantity,
                price: averagePrice.toFixed(2),
                issuedBy: initialCode,
                receivedBy: '',
                variantDetails: prices, // Store detailed price info
                totalQuantity: totalQuantity,
                totalPrice: totalPrice.toFixed(2)
            }
        })

        // Update BMR template data in database
        await updateBMRTemplateDataInDatabase(bmrId, templateData, scannedBMRProducts)

        // Update variant quantities when moving directly from Stocks to BMR
        for (const scannedProduct of scannedBMRProducts) {
            const quantityToMove = scannedProduct.bmrMoveQuantity || 1
            
            // Get variant by barcode
            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('bare_code', scannedProduct.BareCode)
                .single()

            if (!variantError) {
                // Check available quantity
                const availableQty = variant.quantity || 0
                if (availableQty < quantityToMove) {
                    toast.error(`Insufficient available quantity for ${scannedProduct.name}. Available: ${availableQty}, Requested: ${quantityToMove}`)
                    continue
                }
                
                // Move from available quantity to using_quantity (for BMR processing)
                const newVariantQty = Math.max(0, availableQty - quantityToMove)
                const newVariantUsing = (variant.using_quantity || 0) + quantityToMove
                
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
                        reference_type: 'stock_to_bmr',
                        reference_id: bmrId,
                        movement_date: new Date().toISOString()
                    }])

                // Get all variants to recalculate stock totals
                const { data: allVariants, error: variantsError } = await supabase
                    .from('stock_variants')
                    .select('quantity, using_quantity, pending_testing, price')
                    .eq('stock_id', variant.stock_id)

                if (!variantsError && allVariants) {
                    // Calculate totals from all variants
                    let totalQuantity = 0
                    let totalUsingQuantity = 0
                    let totalTestingBalance = 0
                    let totalValue = 0
                    let totalReceived = 0
                    
                    allVariants.forEach(v => {
                        const qty = v.quantity || 0
                        const using = v.using_quantity || 0
                        const pending = v.pending_testing || 0
                        const price = v.price || 0
                        
                        totalQuantity += qty
                        totalUsingQuantity += using
                        totalTestingBalance += pending
                        totalValue += (qty + using + pending) * price
                        totalReceived += qty + using + pending
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
            }
        }

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
        await loadAllData()
        
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

  // Add new product (only if PartNo doesn't exist)
  const addNewProduct = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, addProduct: true }))
      
      // Validation
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
      if (!newProduct.Quantity || parseInt(newProduct.Quantity) <= 0) {
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
            Quantity: '',
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

      // Create new product
      const { data: newStock, error: stockError } = await supabase
        .from('stocks')
        .insert([{
          bare_code: newProduct.BareCode.trim(),
          part_no: newProduct.PartNo.trim(),
          name: newProduct.name.trim(),
          price: parseFloat(newProduct.price) || 0,
          quantity: parseInt(newProduct.Quantity) || 0,
          using_quantity: 0,
          total_received: parseInt(newProduct.Quantity) || 0,
          average_price: parseFloat(newProduct.price) || 0,
          lot_no: newProduct.LotNo,
          s_no: newProduct.SNo,
          testing_status: newProduct.testingStatus || 'pending',
          testing_balance: 0
        }])
        .select()

      if (stockError) throw stockError

      // Add first variant
      await supabase
        .from('stock_variants')
        .insert([{
          stock_id: newStock[0].id,
          bare_code: newProduct.BareCode.trim(),
          serial_no: newProduct.SNo.trim(),
          lot_no: newProduct.LotNo.trim(),
          batch_no: newProduct.LotNo || `BATCH-${Date.now()}`,
          price: parseFloat(newProduct.price) || 0,
          quantity: parseInt(newProduct.Quantity) || 0,
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
        Quantity: '',
        testingStatus: 'pending'
      })
      
      // Refresh data
      await loadAllData()
      
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
    if (!window.confirm('Are you sure you want to delete this product? This will delete ALL variants.')) return

    try {
      setLoadingStates(prev => ({ ...prev, deleteProduct: true }))
      
      // Check if product has any quantity in use
      const { data: stock, error: stockError } = await supabase
        .from('stocks')
        .select('quantity, using_quantity, testing_balance')
        .eq('id', productId)
        .single()

      if (stockError) throw stockError

      if ((stock.using_quantity || 0) > 0 || (stock.testing_balance || 0) > 0) {
        toast.error('Cannot delete product. It is being used in production or sales.')
        return
      }

      // Check if any variants have quantity
      const { data: variants, error: variantsError } = await supabase
        .from('stock_variants')
        .select('quantity, pending_testing, using_quantity')
        .eq('stock_id', productId)

      if (!variantsError && variants.some(v => 
        (v.quantity || 0) > 0 || (v.pending_testing || 0) > 0 || (v.using_quantity || 0) > 0
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
      await loadAllData()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Error deleting product: ' + error.message)
    } finally {
      setLoadingStates(prev => ({ ...prev, deleteProduct: false }))
    }
  }

  // Edit product in Supabase
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
          totalReceived += (variant.quantity || 0) + (variant.pending_testing || 0) + (variant.using_quantity || 0)
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
          quantity: parseInt(editingProduct.Quantity) || 0,
          using_quantity: parseInt(editingProduct.usingQuantity) || 0,
          testing_balance: parseInt(editingProduct.testingBalance) || 0,
          total_received: totalReceived,
          testing_status: editingProduct.testingStatus || 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProduct.id)

      if (error) throw error

      toast.success('Product updated successfully!')
      setEditingProduct(null)
      await loadAllData()
      
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

          const availableQty = variant.quantity || 0
          
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
            const currentMoveQty = updatedProducts[existingProductIndex].moveQuantity
            
            if (currentMoveQty < availableQty) {
              updatedProducts[existingProductIndex] = {
                ...updatedProducts[existingProductIndex],
                moveQuantity: currentMoveQty + 1,
                variantQuantity: availableQty
              }
              setScannedProducts(updatedProducts)
              toast.success(`Increased quantity for ${product.name} to ${currentMoveQty + 1}`)
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
                price: variant.price || product.price || 0,
                moveQuantity: 1,
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

  // Edit product
  const startEditProduct = (product) => {
    setEditingProduct({...product})
  }

  const handleEditChange = (field, value) => {
    setEditingProduct(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Add new product functions
  const handleAddChange = (field, value) => {
    setNewProduct(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Calculate total items to move
  const totalItemsToMove = scannedProducts.reduce(
    (total, product) => total + product.moveQuantity, 
    0
  )

  // Calculate total value of scanned products
  const totalValue = scannedProducts.reduce(
    (total, product) => total + (product.price * product.moveQuantity), 
    0
  )

  // Get available production departments
  const availableProductionDepartments = Array.isArray(productionDepartments) 
    ? productionDepartments.map(dept => dept.name || dept)
    : []

  // Update the calculateAvailableQuantity function to be more accurate
  const calculateAvailableQuantity = (product) => {
    // Calculate from variants if available
    if (product.variants && product.variants.length > 0) {
        return product.variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);
    }
    // Otherwise use stock quantity minus using quantity
    return Math.max(0, 
        (product.Quantity || 0) - 
        (product.usingQuantity || 0)
    );
  };

  // Calculate total received quantity from variants
  const calculateTotalReceivedFromVariants = (product) => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, variant) => {
        const availableQty = variant.quantity || 0
        const pendingQty = variant.pending_testing || 0
        const usingQty = variant.using_quantity || 0
        return sum + availableQty + pendingQty + usingQty
      }, 0)
    }
    return product.totalReceived || 0
  }

  // JSX Return
  return (
    <div className="container">
      {/* Header with Buttons and Search */}
      <div className="head-Button">
        <button className="btn btn-success" data-bs-toggle="modal" data-bs-target="#addProductModal">
          <i className="fa-solid fa-plus me-2"></i>
          ADD STOCKS
        </button>
        <button className="btn btn-danger" data-bs-toggle="modal" data-bs-target="#move">
          <i className="fa-solid fa-arrow-right-arrow-left me-2"></i>
          MOVE OR REMOVE
        </button>
        <button className="btn btn-warning" data-bs-toggle="modal" data-bs-target="#moveToBMRModal">
          <i className="fa-solid fa-industry me-2"></i>
          MOVE TO BMR
        </button>
        <div className="input-group flex-nowrap">
          <span className="input-group-text" id="addon-wrapping">
            <i className="fa-solid fa-magnifying-glass"></i>
          </span>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by Barcode, Part No, Name, Lot No, S.No..." 
            aria-label="Search" 
            aria-describedby="addon-wrapping"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Stock Summary Cards */}
      <div className="row mb-4 mt-4">
        <div className="col-md-3">
          <div className="card text-white bg-primary">
            <div className="card-body ">
              <div className="d-flex justify-content-between">
                <div>
                  <h4 className="card-title">{products.length}</h4>
                  <p className="card-text">Total Products</p>
                </div>
                <div className="align-self-center">
                  <i className="fa-solid fa-boxes-stacked fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-white bg-success">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4 className="card-title">
                    {products.reduce((sum, product) => sum + calculateAvailableQuantity(product), 0)}
                  </h4>
                  <p className="card-text">Available Quantity</p>
                </div>
                <div className="align-self-center">
                  <i className="fa-solid fa-cubes fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-white bg-warning">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4 className="card-title">
                    {products.reduce((sum, product) => sum + (product.usingQuantity || 0), 0)}
                  </h4>
                  <p className="card-text">In Use</p>
                </div>
                <div className="align-self-center">
                  <i className="fa-solid fa-industry fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-white bg-info">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4 className="card-title">
                    {products.reduce((sum, product) => sum + (product.testingBalance || 0), 0)}
                  </h4>
                  <p className="card-text">Testing Balance</p>
                </div>
                <div className="align-self-center">
                  <i className="fa-solid fa-flask fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Products Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">
            <i className="fa-solid fa-warehouse me-2"></i>
            Products Inventory
            <span className="badge bg-primary ms-2">{filteredProducts.length} items</span>
          </h5>
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
              <table className="table table-striped table-hover table-bordered caption-top align-middle text-center border-secondary shadow-sm">
                <thead className="table-dark">
                  <tr>
                    <th>#</th>
                    <th>PartNo</th>
                    <th>Product</th>
                    <th>Avg Price (₹)</th>
                    <th>Available Qty</th>
                    <th>Using Qty</th>
                    <th>Testing Balance</th>
                    <th>Total Received</th>
                    <th>Total Value (₹)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, index) => {
                    const availableQty = calculateAvailableQuantity(p)
                    const totalReceived = calculateTotalReceivedFromVariants(p)
                    const totalValue = availableQty * (p.averagePrice || p.price || 0)
                    
                    return (
                      <tr key={p.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{p.PartNo}</strong>
                          <button 
                            className="btn btn-sm btn-outline-info ms-2"
                            onClick={() => showProductVariants(p)}
                            data-bs-toggle="modal"
                            data-bs-target="#variantsModal"
                            title="View Variants"
                          >
                            <i className="fa-solid fa-layer-group"></i>
                          </button>
                        </td>
                        <td className="text-start">
                          <strong>{p.name}</strong>
                          <small className="d-block text-muted">
                            Barcode: {p.BareCode}
                          </small>
                        </td>
                        <td className="text-end">
                          <strong>₹{(p.averagePrice || p.price || 0).toFixed(2)}</strong>
                        </td>
                        <td>
                          <span className={`badge ${availableQty > 0 ? 'bg-success' : 'bg-danger'}`}>
                            {availableQty}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${(p.usingQuantity || 0) > 0 ? 'bg-warning' : 'bg-secondary'}`}>
                            {p.usingQuantity || 0}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${(p.testingBalance || 0) > 0 ? 'bg-info' : 'bg-secondary'}`}>
                            {p.testingBalance || 0}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-dark">{totalReceived}</span>
                        </td>
                        <td className="text-end">
                          <strong>₹{totalValue.toFixed(2)}</strong>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
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
                              className="btn btn-outline-secondary"
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
                              onClick={() => deleteProduct(p.id)}
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
      </div>

      {/* Variants Modal */}
      <div className="modal fade" id="variantsModal" tabIndex="-1" aria-labelledby="variantsModalLabel" aria-hidden="true" ref={variantsModalRef}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-info text-white">
              <h5 className="modal-title" id="variantsModalLabel">
                <i className="fa-solid fa-layer-group me-2"></i>
                Product Variants - {selectedProductVariants?.name}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {selectedProductVariants ? (
                <>
                  <div className="card mb-3">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4">
                          <p><strong>Part No:</strong> {selectedProductVariants.partNo}</p>
                          <p><strong>Product Name:</strong> {selectedProductVariants.name}</p>
                          <p><strong>Total Variants:</strong> 
                            <span className="badge bg-primary ms-2">
                              {selectedProductVariants.variants.length}
                            </span>
                          </p>
                        </div>
                        <div className="col-md-4">
                          <p><strong>Available Quantity:</strong> 
                            <span className="badge bg-success ms-2">
                              {selectedProductVariants.variants.reduce((sum, v) => sum + (v.quantity || 0), 0)}
                            </span>
                          </p>
                          <p><strong>Testing Pending:</strong> 
                            <span className="badge bg-warning ms-2">
                              {selectedProductVariants.variants.reduce((sum, v) => sum + (v.pending_testing || 0), 0)}
                            </span>
                          </p>
                          <p><strong>In Use:</strong> 
                            <span className="badge bg-danger ms-2">
                              {selectedProductVariants.variants.reduce((sum, v) => sum + (v.using_quantity || 0), 0)}
                            </span>
                          </p>
                        </div>
                        <div className="col-md-4">
                          <p><strong>Total Received:</strong> 
                            <span className="badge bg-dark ms-2">
                              {calculateTotalVariantQuantity(selectedProductVariants.variants)}
                            </span>
                          </p>
                          <p><strong>Average Price:</strong> 
                            <span className="fw-bold">₹{calculateWeightedAveragePrice(selectedProductVariants.variants).toFixed(2)}</span>
                          </p>
                          <p><strong>FIFO Value:</strong> 
                            <span className="text-primary fw-bold">
                              ₹{calculateFIFOValue(selectedProductVariants.variants).toFixed(2)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-bordered table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>FIFO</th>
                          <th>Barcode</th>
                          <th>Lot No</th>
                          <th>Serial No</th>
                          <th>Price (₹)</th>
                          <th>Testing Qty</th>
                          <th>Available Qty</th>
                          <th>Using Qty</th>
                          <th>Total Qty</th>
                          <th>Received Date</th>
                          <th>Testing Status</th>
                          <th>Value (₹)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProductVariants.variants.map((variant, index) => {
                          const availableQty = variant.quantity || 0
                          const pendingQty = variant.pending_testing || 0
                          const usingQty = variant.using_quantity || 0
                          const totalQty = availableQty + pendingQty + usingQty
                          const value = totalQty * (variant.price || 0)
                          const isFirstInFIFO = index === 0 && totalQty > 0
                          const isFirstZeroFIFO = index === 0 && totalQty === 0
                          
                          return (
                            <tr key={variant.id} className={isFirstInFIFO ? 'table-success' : isFirstZeroFIFO ? 'table-warning' : ''}>
                              <td>{index + 1}</td>
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
                              <td className="text-end">₹{variant.price.toFixed(2)}</td>
                              <td>
                                <span className={`badge ${pendingQty > 0 ? 'bg-warning' : 'bg-secondary'}`}>
                                  {pendingQty}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${availableQty > 0 ? 'bg-success' : 'bg-danger'}`}>
                                  {availableQty}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${usingQty > 0 ? 'bg-danger' : 'bg-secondary'}`}>
                                  {usingQty}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${totalQty > 0 ? 'bg-primary' : 'bg-light text-dark border'}`}>
                                  {totalQty}
                                </span>
                              </td>
                              <td>
                                <span className="text-muted">
                                  {new Date(variant.received_date).toLocaleDateString()}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${
                                  variant.testing_status === 'completed' ? 'bg-success' : 'bg-warning'
                                }`}>
                                  {variant.testing_status}
                                </span>
                              </td>
                              <td className="text-end">₹{value.toFixed(2)}</td>
                              <td>
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
                                    onClick={() => deleteVariant(variant.id)}
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
                      <tfoot className="table-secondary fw-bold">
                        <tr>
                          <td colSpan="5" className="text-end">Totals:</td>
                          <td></td>
                          <td>
                            {selectedProductVariants.variants.reduce((sum, v) => sum + (v.pending_testing || 0), 0)}
                          </td>
                          <td>
                            {selectedProductVariants.variants.reduce((sum, v) => sum + (v.quantity || 0), 0)}
                          </td>
                          <td>
                            {selectedProductVariants.variants.reduce((sum, v) => sum + (v.using_quantity || 0), 0)}
                          </td>
                          <td>
                            {calculateTotalVariantQuantity(selectedProductVariants.variants)}
                          </td>
                          <td></td>
                          <td></td>
                          <td className="text-end">
                            ₹{selectedProductVariants.variants.reduce((sum, v) => {
                              const totalQty = (v.quantity || 0) + (v.pending_testing || 0) + (v.using_quantity || 0)
                              return sum + (totalQty * (v.price || 0))
                            }, 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  <div className="alert alert-info mt-3">
                    <i className="fa-solid fa-circle-info me-2"></i>
                    <strong>FIFO Explanation:</strong> The green "FIFO" badge indicates which variant will be consumed first. 
                    Red "ZERO" badge means the first variant has no stock. Items move from production/testing to using quantity when consumed.
                  </div>
                </>
              ) : (
                <div className="text-center py-3">
                  <p>No product selected</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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

      {/* Edit Variant Modal */}
      <div className="modal fade" id="editVariantModal" tabIndex="-1" aria-labelledby="editVariantModalLabel" aria-hidden="true" ref={editVariantModalRef}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title" id="editVariantModalLabel">
                <i className="fa-solid fa-pen me-2"></i>
                Edit Variant
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {loadingStates.editVariant ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Updating variant...</p>
                </div>
              ) : editingVariant ? (
                <div className="row">
                  <div className="col-md-12">
                    <div className="alert alert-info">
                      <strong>Barcode:</strong> {editingVariant.bare_code}<br/>
                      <strong>Current Available:</strong> {editingVariant.quantity || 0}<br/>
                      <strong>Current Using:</strong> {editingVariant.using_quantity || 0}<br/>
                      <strong>Current Total:</strong> {(editingVariant.quantity || 0) + (editingVariant.pending_testing || 0) + (editingVariant.using_quantity || 0)}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Barcode"
                        value={editVariantForm.bare_code}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, bare_code: e.target.value }))}
                        required
                      />
                      <label>Barcode *</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Lot Number"
                        value={editVariantForm.lot_no}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, lot_no: e.target.value }))}
                      />
                      <label>Lot Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Serial Number"
                        value={editVariantForm.serial_no}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, serial_no: e.target.value }))}
                      />
                      <label>Serial Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Price"
                        value={editVariantForm.price}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, price: e.target.value }))}
                        min="0"
                        step="0.01"
                        required
                      />
                      <label>Price (₹) *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Available Quantity"
                        value={editVariantForm.quantity}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, quantity: e.target.value }))}
                        min="0"
                        required
                      />
                      <label>Available Quantity *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Testing Pending"
                        value={editVariantForm.pending_testing}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, pending_testing: e.target.value }))}
                        min="0"
                        required
                      />
                      <label>Testing Pending *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Using Quantity"
                        value={editVariantForm.using_quantity}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, using_quantity: e.target.value }))}
                        min="0"
                        required
                      />
                      <label>Using Quantity *</label>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="form-floating mb-3">
                      <select
                        className="form-select"
                        value={editVariantForm.testing_status}
                        onChange={(e) => setEditVariantForm(prev => ({ ...prev, testing_status: e.target.value }))}
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                      </select>
                      <label>Testing Status</label>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="alert alert-warning">
                      <strong>Total Quantity:</strong> {
                        (parseInt(editVariantForm.quantity) || 0) + 
                        (parseInt(editVariantForm.pending_testing) || 0) +
                        (parseInt(editVariantForm.using_quantity) || 0)
                      } units
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p>No variant selected for editing.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
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

      {/* Add Variant Modal */}
      <div className="modal fade" id="addVariantModal" tabIndex="-1" aria-labelledby="addVariantModalLabel" aria-hidden="true" ref={addVariantModalRef}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title" id="addVariantModalLabel">
                <i className="fa-solid fa-plus me-2"></i>
                Add New Variant - {selectedProductForVariant?.name}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {loadingStates.addVariant ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Adding variant...</p>
                </div>
              ) : selectedProductForVariant ? (
                <div className="row">
                  <div className="col-md-12">
                    <div className="alert alert-info">
                      <strong>Product:</strong> {selectedProductForVariant.name}<br/>
                      <strong>Part No:</strong> {selectedProductForVariant.PartNo}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Barcode"
                        value={newVariant.bare_code}
                        onChange={(e) => handleVariantChange('bare_code', e.target.value)}
                        required
                      />
                      <label>Barcode *</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Lot Number"
                        value={newVariant.lot_no}
                        onChange={(e) => handleVariantChange('lot_no', e.target.value)}
                      />
                      <label>Lot Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Serial Number"
                        value={newVariant.serial_no}
                        onChange={(e) => handleVariantChange('serial_no', e.target.value)}
                      />
                      <label>Serial Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Price"
                        value={newVariant.price}
                        onChange={(e) => handleVariantChange('price', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <label>Price (₹)</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Quantity"
                        value={newVariant.quantity}
                        onChange={(e) => handleVariantChange('quantity', e.target.value)}
                        min="1"
                        required
                      />
                      <label>Quantity *</label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p>No product selected for adding variant.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
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
                    <i className="fa-solid fa-plus me-2"></i>
                    Add Variant
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
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title" id="moveModalLabel">
                <i className="fa-solid fa-arrow-right-arrow-left me-2"></i>
                Move Products 
                {scannedProducts.length > 0 && ` (${scannedProducts.length} products)`}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onClick={stopScanner}></button>
            </div>
            <div className="modal-body">
              {loadingStates.moveToSales || loadingStates.moveToProduction ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Processing...</p>
                </div>
              ) : (
                <>
                  <div className="scanner mb-3">
                    <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
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
                            className="btn btn-outline-danger btn-sm"
                            onClick={clearAllScanned}
                          >
                            <i className="fa-solid fa-trash me-2"></i>
                            Clear All ({scannedProducts.length})
                          </button>
                          <span className="badge bg-info fs-6">
                            <i className="fa-solid fa-cube me-1"></i>
                            Total Items: {totalItemsToMove}
                          </span>
                          <span className="badge bg-success fs-6">
                            <i className="fa-solid fa-indian-rupee-sign me-1"></i>
                            Total Value: ₹{totalValue.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Manual Barcode Input as Backup */}
                    <div className="manual-input mb-3">
                      <label htmlFor="manualBarcode" className="form-label">
                        <i className="fa-solid fa-keyboard me-2"></i>
                        Or enter barcode manually:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="manualBarcode"
                        placeholder="Type barcode and press Enter"
                        onKeyPress={handleManualBarcode}
                      />
                    </div>

                    {cameraError && (
                      <div className="alert alert-warning">
                        <i className="fa-solid fa-triangle-exclamation me-2"></i>
                        <strong>Camera not available.</strong> Please check permissions or use manual input above.
                      </div>
                    )}

                    {scanning && !cameraError && (
                      <div className="scanner-container border rounded p-2 text-center bg-light">
                        <BarcodeScannerComponent
                          width={400}
                          height={250}
                          onUpdate={handleScan}
                          onError={handleCameraError}
                          delay={500}
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

                  {/* Preview Section - Multiple Products */}
                  <div className="preview">
                    <h5 className="d-flex align-items-center">
                      <i className="fa-solid fa-list me-2"></i>
                      Products to Move 
                      {scannedProducts.length > 0 && ` (${scannedProducts.length} products)`}
                    </h5>
                    
                    {scannedProducts.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>#</th>
                              <th>Barecode</th>
                              <th>Product</th>
                              <th>PartNo</th>
                              <th>Available</th>
                              <th>Move Qty</th>
                              <th>Price (₹)</th>
                              <th>Total (₹)</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scannedProducts.map((product, index) => {
                              const availableQty = product.variantQuantity || 0
                              const itemTotal = (product.price || 0) * product.moveQuantity
                              return (
                                <tr key={product.variantId}>
                                  <td>{index + 1}</td>
                                  <td>
                                    <code>{product.BareCode}</code>
                                    <br/>
                                    <small className="text-muted">Variant</small>
                                  </td>
                                  <td className="text-start">
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
                                      {availableQty}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center gap-2">
                                      <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => handleQuantityChange(product.variantId, product.moveQuantity - 1)}
                                        disabled={product.moveQuantity <= 1}
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        className="form-control form-control-sm text-center"
                                        style={{ width: '70px' }}
                                        min="1"
                                        max={availableQty}
                                        value={product.moveQuantity}
                                        onChange={(e) => handleQuantityChange(product.variantId, parseInt(e.target.value) || 1)}
                                      />
                                      <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => handleQuantityChange(product.variantId, product.moveQuantity + 1)}
                                        disabled={product.moveQuantity >= availableQty}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className="text-end">₹{(product.price || 0).toFixed(2)}</td>
                                  <td className="text-end">
                                    <strong>₹{itemTotal.toFixed(2)}</strong>
                                  </td>
                                  <td>
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
                          <tfoot className="table-secondary">
                            <tr>
                              <td colSpan="5" className="text-end"><strong>Grand Total:</strong></td>
                              <td><strong>{totalItemsToMove}</strong></td>
                              <td></td>
                              <td className="text-end"><strong>₹{totalValue.toFixed(2)}</strong></td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted p-4 border rounded bg-light">
                        <i className="fa-solid fa-barcode fa-3x mb-3 d-block text-muted"></i>
                        <p>No products scanned yet. Use camera scanner or manual input to add products.</p>
                        <small>Scan multiple products - they will appear here</small>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={stopScanner}>
                <i className="fa-solid fa-times me-2"></i>
                Close
              </button>
              <button 
                type="button" 
                className="btn btn-info"
                onClick={moveToSales}
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
                    MOVE TO SALES ({scannedProducts.length})
                  </>
                )}
              </button>
              <div className="dropdown">
                <button 
                  className="btn btn-secondary dropdown-toggle" 
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
                <ul className="dropdown-menu">
                  {availableProductionDepartments.length > 0 ? (
                    availableProductionDepartments.map((department, index) => (
                      <li key={index}>
                        <button 
                          className="dropdown-item" 
                          onClick={() => moveToProduction(department)}
                        >
                          <i className="fa-solid fa-arrow-right me-2"></i>
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

      {/* Add Product Modal */}
      <div className="modal fade" id="addProductModal" tabIndex="-1" aria-labelledby="addProductModalLabel" aria-hidden="true" ref={addModalRef}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title" id="addProductModalLabel">
                <i className="fa-solid fa-plus me-2"></i>
                Add New Product
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {loadingStates.addProduct ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Adding product...</p>
                </div>
              ) : (
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Barcode"
                        value={newProduct.BareCode}
                        onChange={(e) => handleAddChange('BareCode', e.target.value)}
                        required
                      />
                      <label>Barcode *</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Part Number"
                        value={newProduct.PartNo}
                        onChange={(e) => handleAddChange('PartNo', e.target.value)}
                        required
                      />
                      <label>Part Number *</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Lot Number"
                        value={newProduct.LotNo}
                        onChange={(e) => handleAddChange('LotNo', e.target.value)}
                      />
                      <label>Lot Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Serial Number"
                        value={newProduct.SNo}
                        onChange={(e) => handleAddChange('SNo', e.target.value)}
                      />
                      <label>Serial Number</label>
                    </div>
                  </div>
                  <div className="col-md-8">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Product Name"
                        value={newProduct.name}
                        onChange={(e) => handleAddChange('name', e.target.value)}
                        required
                      />
                      <label>Product Name *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Price"
                        value={newProduct.price}
                        onChange={(e) => handleAddChange('price', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <label>Price (₹)</label>
                    </div>
                  </div>
                  <div className="col-md-8">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Quantity"
                        value={newProduct.Quantity}
                        onChange={(e) => handleAddChange('Quantity', e.target.value)}
                        min="1"
                        required
                      />
                      <label>Quantity *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
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
                      <label>Testing Status</label>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="alert alert-info">
                      <i className="fa-solid fa-circle-info me-2"></i>
                      <strong>Note:</strong> 
                      <ul className="mb-0 mt-1">
                        <li>Fields marked with * are required</li>
                        <li>If barcode exists, you'll be prompted to add to existing product</li>
                        <li>Same PartNo with different barcode creates product variants</li>
                        <li>Testing status determines if product is ready for use</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={loadingStates.addProduct}>
                <i className="fa-solid fa-times me-2"></i>
                Close
              </button>
              <button type="button" className="btn btn-success" onClick={addNewProduct} disabled={loadingStates.addProduct}>
                {loadingStates.addProduct ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus me-2"></i>
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
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title" id="editProductModalLabel">
                <i className="fa-solid fa-pen me-2"></i>
                Edit Product
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {loadingStates.editProduct ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Saving changes...</p>
                </div>
              ) : editingProduct ? (
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editingProduct.BareCode}
                        onChange={(e) => handleEditChange('BareCode', e.target.value)}
                        required
                      />
                      <label>Barcode *</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editingProduct.PartNo}
                        onChange={(e) => handleEditChange('PartNo', e.target.value)}
                        required
                      />
                      <label>Part Number *</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editingProduct.LotNo}
                        onChange={(e) => handleEditChange('LotNo', e.target.value)}
                      />
                      <label>Lot Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editingProduct.SNo}
                        onChange={(e) => handleEditChange('SNo', e.target.value)}
                      />
                      <label>Serial Number</label>
                    </div>
                  </div>
                  <div className="col-md-8">
                    <div className="form-floating mb-3">
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editingProduct.name}
                        onChange={(e) => handleEditChange('name', e.target.value)}
                        required
                      />
                      <label>Product Name *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editingProduct.price}
                        onChange={(e) => handleEditChange('price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                      <label>Price (₹)</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editingProduct.Quantity}
                        onChange={(e) => handleEditChange('Quantity', parseInt(e.target.value) || 0)}
                        min="0"
                        required
                      />
                      <label>Total Quantity *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editingProduct.usingQuantity || 0}
                        onChange={(e) => handleEditChange('usingQuantity', parseInt(e.target.value) || 0)}
                        min="0"
                        max={editingProduct.Quantity}
                        required
                      />
                      <label>Using Quantity *</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="form-floating mb-3">
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editingProduct.testingBalance || 0}
                        onChange={(e) => handleEditChange('testingBalance', parseInt(e.target.value) || 0)}
                        min="0"
                        max={editingProduct.Quantity}
                        required
                      />
                      <label>Testing Balance *</label>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="alert alert-info">
                      <i className="fa-solid fa-circle-info me-2"></i>
                      <strong>Total Value:</strong> ₹{((editingProduct.Quantity || 0) * (editingProduct.price || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <p>No product selected for editing.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={loadingStates.editProduct}>
                <i className="fa-solid fa-times me-2"></i>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEditProduct} disabled={loadingStates.editProduct || !editingProduct}>
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

      {/* Move to BMR Modal for Stocks */}
      <div className="modal fade" id="moveToBMRModal" tabIndex="-1" aria-labelledby="moveToBMRModalLabel" aria-hidden="true" ref={moveToBMRModalRef}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-warning text-white">
              <h5 className="modal-title" id="moveToBMRModalLabel">
                <i className="fa-solid fa-industry me-2"></i>
                Move Products to BMR from Stocks
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onClick={stopBMRScannerStocks}></button>
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
                        <button 
                          className="btn btn-outline-danger btn-sm"
                          onClick={clearAllBMRScannedStocks}
                        >
                          Clear All ({scannedBMRProducts.length})
                        </button>
                      )}
                    </div>

                    {/* Manual Barcode Input */}
                    <div className="manual-input mb-3">
                      <label htmlFor="manualBarcodeBMRStocks" className="form-label">
                        Or enter barcode manually:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="manualBarcodeBMRStocks"
                        placeholder="Type barcode and press Enter"
                        value={manualBarcodeInputBMR}
                        onChange={(e) => setManualBarcodeInputBMR(e.target.value)}
                        onKeyPress={handleManualBarcodeInputBMR}
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

                  {/* BMR Products Preview */}
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
                            {scannedBMRProducts.map((product, index) => {
                              const availableQty = product.variantQuantity || 0;
                              return (
                                <tr key={product.variantId}>
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
                                    <span className={`badge ${availableQty > 0 ? 'bg-info' : 'bg-danger'}`}>
                                      {availableQty}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center gap-2">
                                      <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => handleBMRQuantityChangeStocks(product.variantId, (product.bmrMoveQuantity || 1) - 1)}
                                        disabled={(product.bmrMoveQuantity || 1) <= 1}
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        className="form-control form-control-sm text-center"
                                        style={{ width: '70px' }}
                                        min="1"
                                        max={availableQty}
                                        value={product.bmrMoveQuantity || 1}
                                        onChange={(e) => handleBMRQuantityChangeStocks(product.variantId, parseInt(e.target.value) || 1)}
                                      />
                                      <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => handleBMRQuantityChangeStocks(product.variantId, (product.bmrMoveQuantity || 1) + 1)}
                                        disabled={(product.bmrMoveQuantity || 1) >= availableQty}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td>
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
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted p-4 border rounded">
                        <i className="fa-solid fa-barcode fa-3x mb-3 d-block text-light"></i>
                        <p>No products scanned for BMR yet.</p>
                        <small>Scan products from your stock inventory</small>
                      </div>
                    )}
                  </div>

                  {/* BMR Selection Dropdown */}
                  <div className="mb-3">
                    <label htmlFor="bmrSelectStocks" className="form-label">Select BMR Template:</label>
                    <select 
                      className="form-select" 
                      id="bmrSelectStocks"
                      value={selectedBMR}
                      onChange={(e) => setSelectedBMR(e.target.value)}
                      disabled={scannedBMRProducts.length === 0}
                    >
                      <option value="">-- Select BMR Template --</option>
                      {getActiveBMRs().map((bmr) => (
                        <option key={bmr.id} value={bmr.id}>
                          {bmr.name} ({bmr.initialCode}) - {bmr.productName} - {bmr.department}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Initial Code Input */}
                  <div className="mb-3">
                    <label htmlFor="initialCodeStocks" className="form-label">Initial Code (Mandatory):</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      id="initialCodeStocks"
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
                              const totalQuantity = products.reduce((sum, p) => sum + (p.bmrMoveQuantity || 1), 0)
                              const totalPrice = products.reduce((sum, p) => {
                                const price = p.price || 0
                                const qty = p.bmrMoveQuantity || 1
                                return sum + (price * qty)
                              }, 0)
                              const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0
                              const barcodes = products.map(p => p.BareCode).join(', ')

                              return (
                                <tr key={index}>
                                  <td>{partNo}</td>
                                  <td>{products[0].name}</td>
                                  <td>
                                    <div className="multiple-barcodes">
                                      {products.map((product, idx) => (
                                        <div key={idx} className="small">
                                          <span className="badge bg-info me-1">{product.BareCode}</span>
                                          (Qty: {product.bmrMoveQuantity || 1}, ₹{product.price || 0})
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge bg-primary">{totalQuantity}</span>
                                  </td>
                                  <td>₹{averagePrice.toFixed(2)}</td>
                                  <td>₹{totalPrice.toFixed(2)}</td>
                                  <td>
                                    <span className="badge bg-secondary">{initialCode}</span>
                                  </td>
                                </tr>
                              )
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
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={stopBMRScannerStocks} disabled={loadingStates.moveToBMR}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => moveToBMRFromStocks(selectedBMR)}
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
    </div>
  )
}

export default Stocks