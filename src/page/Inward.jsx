import { useState, useEffect } from "react"
import toast from "react-hot-toast"
import { supabase } from '../supabaseClient'
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
//import "./Inward.css"

function Inward({ inwardInvoices, setInwardInvoices, products, setProducts, loadAllData }) {
    const [showInvoiceModal, setShowInvoiceModal] = useState(false)
    const [newInvoice, setNewInvoice] = useState({
        invoice_number: "",
        invoice_date: new Date(),
        received_by: "",
        received_date: new Date(),
        supplier_name: "",
        supplier_address: "",
        phone_number: "",
        gst_number: "",
        notes: "",
        status: "draft"
    })
    const [invoiceItems, setInvoiceItems] = useState([])
    const [viewingInvoice, setViewingInvoice] = useState(null)
    const [editingInvoice, setEditingInvoice] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    
    // NEW: Testing completion modal state
    const [showTestingModal, setShowTestingModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [testingForm, setTestingForm] = useState({
        completed_qty: "",
        inspected_by: "",
        inspected_date: new Date().toISOString().split('T')[0]
    })
    
    const [loadingStates, setLoadingStates] = useState({
        saveInvoice: false,
        deleteInvoice: false,
        updateTesting: false,
        finalizeInvoice: false
    })

    // Filter invoices based on search
    const filteredInvoices = inwardInvoices.filter(invoice =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.status?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Generate new invoice number
    const generateInvoiceNumber = () => {
        const prefix = "INV-"
        const date = new Date()
        const year = date.getFullYear().toString().slice(-2)
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        return `${prefix}${year}${month}${random}`
    }

    // Open new invoice modal
    const openNewInvoiceModal = () => {
        setNewInvoice({
            invoice_number: generateInvoiceNumber(),
            invoice_date: new Date(),
            received_by: "",
            received_date: new Date(),
            supplier_name: "",
            supplier_address: "",
            phone_number: "",
            gst_number: "",
            notes: "",
            status: "draft"
        })
        setInvoiceItems([])
        setShowInvoiceModal(true)
        setEditingInvoice(null)
    }

    // Add new item to invoice
    const addNewItem = () => {
        setInvoiceItems([
            ...invoiceItems,
            {
                id: Date.now(),
                bare_code: "",
                part_no: "",
                product_name: "",
                lot_no: "",
                serial_no: "",
                quantity: 1,
                price: 0,
                total_price: 0,
                pending_testing: 0,
                completed_testing: 0,
                testing_status: "pending",
                inspected_date: "",
                inspected_by: "",
                notes: "",
                isNew: true
            }
        ])
    }

    // Duplicate an existing item
    const duplicateInvoiceItem = (index) => {
        const itemToDuplicate = invoiceItems[index]
        const newItem = {
            id: Date.now(),
            bare_code: itemToDuplicate.bare_code,
            part_no: itemToDuplicate.part_no,
            product_name: itemToDuplicate.product_name,
            lot_no: itemToDuplicate.lot_no,
            serial_no: itemToDuplicate.serial_no,
            quantity: itemToDuplicate.quantity,
            price: itemToDuplicate.price,
            total_price: itemToDuplicate.total_price,
            pending_testing: itemToDuplicate.pending_testing,
            completed_testing: itemToDuplicate.completed_testing,
            testing_status: itemToDuplicate.testing_status,
            inspected_date: itemToDuplicate.inspected_date,
            inspected_by: itemToDuplicate.inspected_by,
            notes: itemToDuplicate.notes,
            isNew: true
        }
        
        // Insert duplicate after the original item
        const updatedItems = [...invoiceItems]
        updatedItems.splice(index + 1, 0, newItem)
        setInvoiceItems(updatedItems)
        toast.success('Item duplicated successfully')
    }

    // Update invoice item
    const updateInvoiceItem = (index, field, value) => {
        const updatedItems = [...invoiceItems]
        updatedItems[index] = {
            ...updatedItems[index],
            [field]: value
        }

        // Auto-calculate total price
        if (field === 'quantity' || field === 'price') {
            const quantity = parseInt(updatedItems[index].quantity) || 0
            const price = parseFloat(updatedItems[index].price) || 0
            updatedItems[index].total_price = quantity * price
            
            // Set pending testing to quantity
            if (field === 'quantity') {
                updatedItems[index].pending_testing = quantity
                updatedItems[index].completed_testing = 0
                updatedItems[index].testing_status = 'pending'
            }
        }

        // Auto-fill product name if barcode matches
        if (field === 'bare_code' && value.trim()) {
            const product = products.find(p => p.BareCode === value.trim())
            if (product) {
                updatedItems[index].product_name = product.name
                updatedItems[index].part_no = product.PartNo
                updatedItems[index].price = product.price
                updatedItems[index].pending_testing = updatedItems[index].quantity || 1
            }
        }

        // Auto-fill part no and product name if part no is entered
        if (field === 'part_no' && value.trim()) {
            const product = products.find(p => p.PartNo === value.trim())
            if (product) {
                updatedItems[index].product_name = product.name
                updatedItems[index].price = product.price
            }
        }

        setInvoiceItems(updatedItems)
    }

    // Remove item from invoice
    const removeInvoiceItem = (index) => {
        setInvoiceItems(invoiceItems.filter((_, i) => i !== index))
    }

    // Calculate invoice total
    const calculateInvoiceTotal = () => {
        return invoiceItems.reduce((total, item) => total + (parseFloat(item.total_price) || 0), 0)
    }

    // Save invoice to database
    const saveInvoice = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, saveInvoice: true }))

            // Validation
            if (!newInvoice.invoice_number.trim()) {
                toast.error("Invoice number is required!")
                return
            }

            if (invoiceItems.length === 0) {
                toast.error("Please add at least one item!")
                return
            }

            // Validate all items
            for (const item of invoiceItems) {
                if (!item.bare_code.trim()) {
                    toast.error(`Item ${invoiceItems.indexOf(item) + 1}: Barcode is required!`)
                    return
                }
                if (!item.part_no.trim()) {
                    toast.error(`Item ${invoiceItems.indexOf(item) + 1}: Part Number is required!`)
                    return
                }
                if (!item.product_name.trim()) {
                    toast.error(`Item ${invoiceItems.indexOf(item) + 1}: Product Name is required!`)
                    return
                }
                if (!item.quantity || parseInt(item.quantity) <= 0) {
                    toast.error(`Item ${invoiceItems.indexOf(item) + 1}: Valid Quantity is required!`)
                    return
                }
            }

            // Check for duplicate barcodes within the same invoice
            const barcodeSet = new Set()
            for (const item of invoiceItems) {
                if (barcodeSet.has(item.bare_code.trim())) {
                    toast.error(`Duplicate barcode found: ${item.bare_code.trim()}`)
                    return
                }
                barcodeSet.add(item.bare_code.trim())
            }

            // Check if invoice number already exists (for new invoices)
            if (!editingInvoice) {
                const { data: existingInvoice, error } = await supabase
                    .from('inward_invoices')
                    .select('id')
                    .eq('invoice_number', newInvoice.invoice_number)
                    .single()

                if (existingInvoice && !error) {
                    toast.error("Invoice number already exists!")
                    return
                }
            }

            // Start transaction - save invoice first
            let invoiceId
            if (editingInvoice) {
                // Update existing invoice
                const { error } = await supabase
                    .from('inward_invoices')
                    .update({
                        invoice_number: newInvoice.invoice_number,
                        invoice_date: newInvoice.invoice_date.toISOString().split('T')[0],
                        received_by: newInvoice.received_by,
                        received_date: newInvoice.received_date.toISOString().split('T')[0],
                        supplier_name: newInvoice.supplier_name,
                        supplier_address: newInvoice.supplier_address,
                        phone_number: newInvoice.phone_number,
                        gst_number: newInvoice.gst_number,
                        total_amount: calculateInvoiceTotal(),
                        status: "draft",
                        notes: newInvoice.notes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingInvoice.id)

                if (error) throw error
                invoiceId = editingInvoice.id

                // Get existing items to check for stock variants
                const { data: existingItems } = await supabase
                    .from('inward_items')
                    .select('id, bare_code')
                    .eq('invoice_id', invoiceId)

                // Delete only the items that are no longer in the new list
                const existingBarcodes = existingItems?.map(item => item.bare_code) || []
                const newBarcodes = invoiceItems.map(item => item.bare_code.trim())
                const barcodesToDelete = existingBarcodes.filter(barcode => !newBarcodes.includes(barcode))

                if (barcodesToDelete.length > 0) {
                    await supabase
                        .from('inward_items')
                        .delete()
                        .eq('invoice_id', invoiceId)
                        .in('bare_code', barcodesToDelete)
                }
            } else {
                // Create new invoice
                const { data, error } = await supabase
                    .from('inward_invoices')
                    .insert([{
                        invoice_number: newInvoice.invoice_number,
                        invoice_date: newInvoice.invoice_date.toISOString().split('T')[0],
                        received_by: newInvoice.received_by,
                        received_date: newInvoice.received_date.toISOString().split('T')[0],
                        supplier_name: newInvoice.supplier_name,
                        supplier_address: newInvoice.supplier_address,
                        phone_number: newInvoice.phone_number,
                        gst_number: newInvoice.gst_number,
                        total_amount: calculateInvoiceTotal(),
                        status: "draft",
                        notes: newInvoice.notes
                    }])
                    .select()

                if (error) throw error
                invoiceId = data[0].id
            }

            // Process each item - UPSERT instead of delete/create
            for (const item of invoiceItems) {
                // Check if item already exists (for updates)
                const { data: existingItem } = await supabase
                    .from('inward_items')
                    .select('id')
                    .eq('invoice_id', invoiceId)
                    .eq('bare_code', item.bare_code.trim())
                    .maybeSingle()

                const itemData = {
                    invoice_id: invoiceId,
                    bare_code: item.bare_code.trim(),
                    part_no: item.part_no.trim(),
                    product_name: item.product_name.trim(),
                    lot_no: item.lot_no.trim(),
                    serial_no: item.serial_no.trim(),
                    quantity: parseInt(item.quantity) || 1,
                    price: parseFloat(item.price) || 0,
                    total_price: parseFloat(item.total_price) || 0,
                    pending_testing: parseInt(item.pending_testing) || parseInt(item.quantity) || 0,
                    completed_testing: parseInt(item.completed_testing) || 0,
                    testing_status: item.testing_status || 'pending',
                    inspected_date: item.inspected_date,
                    inspected_by: item.inspected_by,
                    notes: item.notes
                }

                if (existingItem && !item.isNew) {
                    // Update existing item
                    await supabase
                        .from('inward_items')
                        .update(itemData)
                        .eq('id', existingItem.id)
                } else {
                    // Insert new item
                    await supabase
                        .from('inward_items')
                        .insert([itemData])
                }

                // Check if stock variant already exists for this barcode
                const { data: existingVariant } = await supabase
                    .from('stock_variants')
                    .select('id')
                    .eq('bare_code', item.bare_code.trim())
                    .maybeSingle()

                if (!existingVariant) {
                    // Process stock variant creation
                    if (item.part_no.trim() && item.bare_code.trim()) {
                        // Check if stock exists with this part_no
                        const { data: existingStock, error: stockError } = await supabase
                            .from('stocks')
                            .select('*')
                            .eq('part_no', item.part_no.trim())
                            .single()

                        if (!stockError && existingStock) {
                            // Update existing stock
                            const newTotalReceived = (existingStock.total_received || 0) + (parseInt(item.quantity) || 0)
                            const newTestingBalance = (existingStock.testing_balance || 0) + (parseInt(item.quantity) || 0)
                            
                            // Calculate weighted average price
                            const totalExistingValue = (existingStock.quantity || 0) * (existingStock.average_price || 0)
                            const newItemValue = (parseInt(item.quantity) || 0) * (parseFloat(item.price) || 0)
                            const totalNewQuantity = (existingStock.quantity || 0) + (parseInt(item.quantity) || 0)
                            const newAveragePrice = totalNewQuantity > 0 ? 
                                (totalExistingValue + newItemValue) / totalNewQuantity : 0

                            await supabase
                                .from('stocks')
                                .update({
                                    total_received: newTotalReceived,
                                    testing_balance: newTestingBalance,
                                    average_price: newAveragePrice,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', existingStock.id)

                            // Add stock variant only if it doesn't exist
                            const { data: newVariant, error: variantError } = await supabase
                                .from('stock_variants')
                                .insert([{
                                    stock_id: existingStock.id,
                                    inward_invoice_id: invoiceId,
                                    bare_code: item.bare_code.trim(),
                                    serial_no: item.serial_no.trim(),
                                    lot_no: item.lot_no.trim(),
                                    batch_no: item.lot_no || `BATCH-${Date.now()}`,
                                    price: parseFloat(item.price) || 0,
                                    quantity: 0,
                                    pending_testing: parseInt(item.quantity) || 0,
                                    received_date: newInvoice.received_date.toISOString().split('T')[0],
                                    testing_status: 'pending'
                                }])
                                .select()
                                .single()

                            if (variantError && !variantError.message.includes('duplicate key')) {
                                throw variantError
                            }

                            // Record stock movement
                            if (!variantError || variantError.message.includes('duplicate key')) {
                                await supabase
                                    .from('stock_movements')
                                    .insert([{
                                        variant_id: newVariant?.id || existingVariant?.id,
                                        movement_type: 'in',
                                        quantity: parseInt(item.quantity) || 0,
                                        remaining_quantity: parseInt(item.quantity) || 0,
                                        reference_type: 'inward',
                                        reference_id: invoiceId,
                                        movement_date: new Date().toISOString()
                                    }])
                            }

                        } else {
                            // Create new stock
                            const { data: newStock, error: newStockError } = await supabase
                                .from('stocks')
                                .insert([{
                                    bare_code: item.bare_code.trim(),
                                    part_no: item.part_no.trim(),
                                    name: item.product_name.trim(),
                                    price: parseFloat(item.price) || 0,
                                    quantity: 0,
                                    using_quantity: 0,
                                    total_received: parseInt(item.quantity) || 0,
                                    testing_balance: parseInt(item.quantity) || 0,
                                    average_price: parseFloat(item.price) || 0,
                                    lot_no: item.lot_no,
                                    s_no: item.serial_no,
                                    testing_status: 'pending'
                                }])
                                .select()

                            if (newStockError) throw newStockError

                            // Add stock variant
                            const { data: newVariant, error: variantError } = await supabase
                                .from('stock_variants')
                                .insert([{
                                    stock_id: newStock[0].id,
                                    inward_invoice_id: invoiceId,
                                    bare_code: item.bare_code.trim(),
                                    serial_no: item.serial_no.trim(),
                                    lot_no: item.lot_no.trim(),
                                    batch_no: item.lot_no || `BATCH-${Date.now()}`,
                                    price: parseFloat(item.price) || 0,
                                    quantity: 0,
                                    pending_testing: parseInt(item.quantity) || 0,
                                    received_date: newInvoice.received_date.toISOString().split('T')[0],
                                    testing_status: 'pending'
                                }])
                                .select()
                                .single()

                            if (variantError && !variantError.message.includes('duplicate key')) {
                                throw variantError
                            }

                            // Record stock movement
                            await supabase
                                .from('stock_movements')
                                .insert([{
                                    variant_id: newVariant?.id || existingVariant?.id,
                                    movement_type: 'in',
                                    quantity: parseInt(item.quantity) || 0,
                                    remaining_quantity: parseInt(item.quantity) || 0,
                                    reference_type: 'inward',
                                    reference_id: invoiceId,
                                    movement_date: new Date().toISOString()
                                }])
                        }
                    }
                }
            }

            toast.success(editingInvoice ? "Invoice updated successfully!" : "Invoice saved successfully!")
            setShowInvoiceModal(false)
            setNewInvoice({
                invoice_number: "",
                invoice_date: new Date(),
                received_by: "",
                received_date: new Date(),
                supplier_name: "",
                supplier_address: "",
                phone_number: "",
                gst_number: "",
                notes: "",
                status: "draft"
            })
            setInvoiceItems([])
            setEditingInvoice(null)
            
            await loadAllData()
        } catch (error) {
            console.error('Error saving invoice:', error)
            toast.error('Error saving invoice: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, saveInvoice: false }))
        }
    }

    // NEW: Open testing completion modal
    const openTestingModal = (item) => {
        setSelectedItem(item)
        setTestingForm({
            completed_qty: item.pending_testing || item.quantity || 0,
            inspected_by: item.inspected_by || "",
            inspected_date: item.inspected_date || new Date().toISOString().split('T')[0]
        })
        setShowTestingModal(true)
    }

    // NEW: Close testing modal
    const closeTestingModal = () => {
        setShowTestingModal(false)
        setSelectedItem(null)
        setTestingForm({
            completed_qty: "",
            inspected_by: "",
            inspected_date: new Date().toISOString().split('T')[0]
        })
    }

    // FIXED: Update testing status for quantity - Optimized to not reload entire application
    const updateTestingQuantity = async () => {
        if (!selectedItem) return

        try {
            setLoadingStates(prev => ({ ...prev, updateTesting: true }))

            const completedTesting = parseInt(testingForm.completed_qty) || 0
            const pendingQty = selectedItem.pending_testing || selectedItem.quantity || 0
            
            if (completedTesting <= 0) {
                toast.error("Please enter a valid completed quantity!")
                return
            }
            
            if (completedTesting > pendingQty) {
                toast.error(`Cannot complete more than ${pendingQty} items!`)
                return
            }

            const newPending = pendingQty - completedTesting
            const newCompleted = (selectedItem.completed_testing || 0) + completedTesting
            const newStatus = newPending === 0 ? 'completed' : 'pending'

            // Update inward item
            const { error: updateError } = await supabase
                .from('inward_items')
                .update({
                    pending_testing: newPending,
                    completed_testing: newCompleted,
                    testing_status: newStatus,
                    inspected_by: testingForm.inspected_by,
                    inspected_date: testingForm.inspected_date,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedItem.id)

            if (updateError) throw updateError

            // Find the stock variant for this item
            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('bare_code', selectedItem.bare_code)
                .single()

            if (!variantError && variant) {
                // Update variant: move from pending_testing to quantity
                const newVariantPending = Math.max(0, (variant.pending_testing || 0) - completedTesting)
                const newVariantQty = (variant.quantity || 0) + completedTesting
                const newVariantStatus = newVariantPending === 0 ? 'completed' : 'pending'

                await supabase
                    .from('stock_variants')
                    .update({
                        quantity: newVariantQty,
                        pending_testing: newVariantPending,
                        testing_status: newVariantStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', variant.id)

                // Record stock movement for testing completion
                await supabase
                    .from('stock_movements')
                    .insert([{
                        variant_id: variant.id,
                        movement_type: 'out',
                        quantity: completedTesting,
                        remaining_quantity: newVariantQty + newVariantPending,
                        reference_type: 'testing',
                        reference_id: selectedItem.invoice_id,
                        movement_date: new Date().toISOString()
                    }])

                // Update stock - Only update specific fields
                const { data: stock, error: stockError } = await supabase
                    .from('stocks')
                    .select('*')
                    .eq('id', variant.stock_id)
                    .single()

                if (!stockError && stock) {
                    // Update stock testing balance and quantity
                    const newTestingBalance = Math.max(0, (stock.testing_balance || 0) - completedTesting)
                    const newQuantity = (stock.quantity || 0) + completedTesting

                    await supabase
                        .from('stocks')
                        .update({
                            testing_balance: newTestingBalance,
                            quantity: newQuantity,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', stock.id)
                }
            }

            toast.success(`Updated testing: ${completedTesting} completed, ${newPending} pending`)
            
            // Update local state without reloading entire application
            if (viewingInvoice) {
                const updatedItems = viewingInvoice.items.map(i => 
                    i.id === selectedItem.id ? { 
                        ...i, 
                        pending_testing: newPending,
                        completed_testing: newCompleted,
                        testing_status: newStatus,
                        inspected_by: testingForm.inspected_by,
                        inspected_date: testingForm.inspected_date
                    } : i
                )
                setViewingInvoice({ ...viewingInvoice, items: updatedItems })
            }

            // Close modal
            closeTestingModal()

            // Refresh only the necessary data
            const refreshInvoiceData = async () => {
                try {
                    // Only refresh the specific invoice data
                    const { data: updatedInvoice } = await supabase
                        .from('inward_invoices')
                        .select('*')
                        .eq('id', selectedItem.invoice_id)
                        .single()

                    if (updatedInvoice) {
                        const { data: items } = await supabase
                            .from('inward_items')
                            .select('*')
                            .eq('invoice_id', selectedItem.invoice_id)

                        setViewingInvoice({
                            ...updatedInvoice,
                            items: items || []
                        })
                    }
                } catch (error) {
                    console.error('Error refreshing invoice data:', error)
                }
            }

            await refreshInvoiceData()

        } catch (error) {
            console.error('Error updating testing quantity:', error)
            toast.error('Error updating testing quantity: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, updateTesting: false }))
        }
    }

    // View invoice details
    const viewInvoice = async (invoice) => {
        try {
            const { data: items, error } = await supabase
                .from('inward_items')
                .select('*')
                .eq('invoice_id', invoice.id)

            if (error) throw error
            
            setViewingInvoice({
                ...invoice,
                items: items || []
            })
        } catch (error) {
            toast.error('Error loading invoice details: ' + error.message)
        }
    }

    // Edit invoice
    const editInvoice = async (invoice) => {
        try {
            const { data: items, error } = await supabase
                .from('inward_items')
                .select('*')
                .eq('invoice_id', invoice.id)

            if (error) throw error
            
            setNewInvoice({
                invoice_number: invoice.invoice_number,
                invoice_date: new Date(invoice.invoice_date),
                received_by: invoice.received_by,
                received_date: new Date(invoice.received_date),
                supplier_name: invoice.supplier_name || "",
                supplier_address: invoice.supplier_address || "",
                phone_number: invoice.phone_number || "",
                gst_number: invoice.gst_number || "",
                notes: invoice.notes || "",
                status: invoice.status
            })
            setInvoiceItems(items.map(item => ({
                id: item.id,
                bare_code: item.bare_code,
                part_no: item.part_no,
                product_name: item.product_name,
                lot_no: item.lot_no,
                serial_no: item.serial_no,
                quantity: item.quantity,
                price: item.price,
                total_price: item.total_price,
                pending_testing: item.pending_testing || item.quantity,
                completed_testing: item.completed_testing || 0,
                testing_status: item.testing_status,
                inspected_date: item.inspected_date,
                inspected_by: item.inspected_by,
                notes: item.notes,
                isNew: false
            })))
            setEditingInvoice(invoice)
            setShowInvoiceModal(true)
        } catch (error) {
            toast.error('Error loading invoice for editing: ' + error.message)
        }
    }

    // Delete invoice
    const deleteInvoice = async (invoiceId) => {
        const invoiceToDelete = inwardInvoices.find(inv => inv.id === invoiceId);
        
        if (!invoiceToDelete) {
            toast.error("Invoice not found!");
            return;
        }
        
        if (invoiceToDelete.status !== 'draft') {
            toast.error("Only draft invoices can be deleted!");
            return;
        }

        if (!window.confirm('Are you sure you want to delete this invoice? This will also remove all items and testing quantities.')) return

        try {
            setLoadingStates(prev => ({ ...prev, deleteInvoice: true }))

            // Get invoice items first to update stock
            const { data: items, error: itemsError } = await supabase
                .from('inward_items')
                .select('*')
                .eq('invoice_id', invoiceId)

            if (itemsError) throw itemsError

            // Reduce testing quantities in stock and delete variants
            for (const item of items || []) {
                // Find and delete stock variant
                const { data: variants, error: variantsError } = await supabase
                    .from('stock_variants')
                    .select('*')
                    .eq('bare_code', item.bare_code)

                if (!variantsError && variants && variants.length > 0) {
                    for (const variant of variants) {
                        // Update stock before deleting variant
                        const { data: stock, error: stockError } = await supabase
                            .from('stocks')
                            .select('*')
                            .eq('id', variant.stock_id)
                            .single()

                        if (!stockError && stock) {
                            const variantTotalQty = (variant.quantity || 0) + (variant.pending_testing || 0)
                            const newTestingBalance = Math.max(0, (stock.testing_balance || 0) - variantTotalQty)
                            const newTotalReceived = Math.max(0, (stock.total_received || 0) - variantTotalQty)
                            const newQuantity = Math.max(0, (stock.quantity || 0) - (variant.quantity || 0))
                            
                            await supabase
                                .from('stocks')
                                .update({
                                    testing_balance: newTestingBalance,
                                    total_received: newTotalReceived,
                                    quantity: newQuantity,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', stock.id)
                        }

                        // Delete variant
                        await supabase
                            .from('stock_variants')
                            .delete()
                            .eq('id', variant.id)
                    }
                }
            }

            // Delete the invoice (cascade will delete items)
            const { error } = await supabase
                .from('inward_invoices')
                .delete()
                .eq('id', invoiceId)

            if (error) throw error

            toast.success('Invoice deleted successfully!')
            await loadAllData()
            
            // Close viewing modal if open
            if (viewingInvoice && viewingInvoice.id === invoiceId) {
                setViewingInvoice(null);
            }
        } catch (error) {
            console.error('Error deleting invoice:', error)
            toast.error('Error deleting invoice: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, deleteInvoice: false }))
        }
    }

    // Finalize invoice
    const finalizeInvoice = async (invoiceId) => {
        try {
            setLoadingStates(prev => ({ ...prev, finalizeInvoice: true }))
            
            // Check if all items are completed
            const { data: items, error: itemsError } = await supabase
                .from('inward_items')
                .select('testing_status, pending_testing')
                .eq('invoice_id', invoiceId)

            if (itemsError) throw itemsError

            const allCompleted = items.every(item => 
                item.testing_status === 'completed' || item.pending_testing === 0
            )
            
            if (!allCompleted) {
                toast.error('Cannot finalize invoice. All items must have completed testing first.')
                return
            }

            const { error } = await supabase
                .from('inward_invoices')
                .update({
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', invoiceId)

            if (error) throw error

            toast.success('Invoice finalized successfully!')
            
            // Update local state
            if (viewingInvoice && viewingInvoice.id === invoiceId) {
                setViewingInvoice({ ...viewingInvoice, status: 'completed' })
            }

            // Refresh invoice list
            const { data: updatedInvoices } = await supabase
                .from('inward_invoices')
                .select('*')
                .order('created_at', { ascending: false })

            if (updatedInvoices) {
                setInwardInvoices(updatedInvoices)
            }
            
        } catch (error) {
            console.error('Error finalizing invoice:', error)
            toast.error('Error finalizing invoice: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, finalizeInvoice: false }))
        }
    }

    return (
        <div className="container">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="text-primary">Inward / Invoice Management</h1>
                <button className="btn btn-success" onClick={openNewInvoiceModal}>
                    <i className="fa-solid fa-plus me-2"></i>
                    New Invoice
                </button>
            </div>

            {/* Search Bar */}
            <div className="input-group mb-4">
                <span className="input-group-text">
                    <i className="fa-solid fa-magnifying-glass"></i>
                </span>
                <input
                    type="text"
                    className="form-control"
                    placeholder="Search by Invoice Number, Supplier, Status..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Invoices List */}
            <div className="card">
                <div className="card-header">
                    <h5 className="card-title mb-0">
                        <i className="fa-solid fa-list me-2"></i>
                        Invoices
                        <span className="badge bg-primary ms-2">{filteredInvoices.length}</span>
                    </h5>
                </div>
                <div className="card-body">
                    {filteredInvoices.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="fa-solid fa-file-invoice fa-3x text-muted mb-3"></i>
                            <h5 className="text-muted">No invoices found</h5>
                            <p className="text-muted">Create your first invoice to get started</p>
                            <button className="btn btn-success" onClick={openNewInvoiceModal}>
                                <i className="fa-solid fa-plus me-2"></i>
                                Create First Invoice
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Invoice No</th>
                                        <th>Date</th>
                                        <th>Supplier</th>
                                        <th>Phone</th>
                                        <th>GST</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map((invoice, index) => (
                                        <tr key={invoice.id}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <strong>{invoice.invoice_number}</strong>
                                            </td>
                                            <td>{invoice.invoice_date}</td>
                                            <td>{invoice.supplier_name || 'N/A'}</td>
                                            <td>{invoice.phone_number || 'N/A'}</td>
                                            <td>{invoice.gst_number || 'N/A'}</td>
                                            <td>₹{parseFloat(invoice.total_amount || 0).toFixed(2)}</td>
                                            <td>
                                                <span className={`badge ${
                                                    invoice.status === 'completed' ? 'bg-success' :
                                                    invoice.status === 'draft' ? 'bg-warning' :
                                                    'bg-secondary'
                                                }`}>
                                                    {invoice.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={() => viewInvoice(invoice)}
                                                        title="View Invoice"
                                                    >
                                                        <i className="fa-solid fa-eye"></i>
                                                    </button>
                                                    {invoice.status === 'draft' && (
                                                        <>
                                                            <button
                                                                className="btn btn-outline-secondary"
                                                                onClick={() => editInvoice(invoice)}
                                                                title="Edit Invoice"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-outline-danger"
                                                                onClick={() => deleteInvoice(invoice.id)}
                                                                title="Delete Invoice"
                                                                disabled={loadingStates.deleteInvoice}
                                                            >
                                                                {loadingStates.deleteInvoice ? (
                                                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                                                ) : (
                                                                    <i className="fa-solid fa-trash"></i>
                                                                )}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* New/Edit Invoice Modal */}
            {showInvoiceModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => {
                                        setShowInvoiceModal(false)
                                        setEditingInvoice(null)
                                    }}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* Invoice Header */}
                                <div className="row mb-4">
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={newInvoice.invoice_number}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_number: e.target.value }))}
                                                disabled={editingInvoice}
                                            />
                                            <label>Invoice Number *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="me-2">Invoice Date *</label>
                                            <DatePicker
                                                selected={newInvoice.invoice_date}
                                                onChange={(date) => setNewInvoice(prev => ({ ...prev, invoice_date: date }))}
                                                dateFormat="yyyy-MM-dd"
                                                className="form-control"
                                                placeholderText="Select invoice date"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={newInvoice.received_by}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, received_by: e.target.value }))}
                                            />
                                            <label>Received By *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className=" mb-3">
                                             <label className="me-2">Received Date *</label>
                                            <DatePicker
                                                selected={newInvoice.received_date}
                                                onChange={(date) => setNewInvoice(prev => ({ ...prev, received_date: date }))}
                                                dateFormat="yyyy-MM-dd"
                                                className="form-control"
                                                placeholderText="Select received date"
                                                required
                                            />
                                           
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={newInvoice.supplier_name}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, supplier_name: e.target.value }))}
                                            />
                                            <label>Supplier Name</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="tel"
                                                className="form-control"
                                                value={newInvoice.phone_number}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, phone_number: e.target.value }))}
                                                pattern="[0-9]{10}"
                                                placeholder="10-digit phone number"
                                            />
                                            <label>Phone Number</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={newInvoice.gst_number}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, gst_number: e.target.value }))}
                                                pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
                                                placeholder="GSTIN format: 22AAAAA0000A1Z5"
                                            />
                                            <label>GST Number</label>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <textarea
                                                className="form-control"
                                                value={newInvoice.supplier_address}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, supplier_address: e.target.value }))}
                                                style={{ height: '100px' }}
                                            />
                                            <label>Supplier Address</label>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <textarea
                                                className="form-control"
                                                value={newInvoice.notes}
                                                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                                                style={{ height: '100px' }}
                                            />
                                            <label>Notes</label>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Items */}
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5>Invoice Items</h5>
                                    <button className="btn btn-sm btn-primary" onClick={addNewItem}>
                                        <i className="fa-solid fa-plus me-2"></i>
                                        Add Item
                                    </button>
                                </div>

                                {invoiceItems.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No items added. Click "Add Item" to start.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-bordered">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Barcode *</th>
                                                    <th>Part No *</th>
                                                    <th>Product Name</th>
                                                    <th>Lot No</th>
                                                    <th>Serial No</th>
                                                    <th>Quantity</th>
                                                    <th>Price (₹)</th>
                                                    <th>Total (₹)</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {invoiceItems.map((item, index) => (
                                                    <tr key={item.id || index}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={item.bare_code}
                                                                onChange={(e) => updateInvoiceItem(index, 'bare_code', e.target.value)}
                                                                placeholder="Scan or enter barcode"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={item.part_no}
                                                                onChange={(e) => updateInvoiceItem(index, 'part_no', e.target.value)}
                                                                placeholder="Part No"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={item.product_name}
                                                                onChange={(e) => updateInvoiceItem(index, 'product_name', e.target.value)}
                                                                placeholder="Product Name"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={item.lot_no}
                                                                onChange={(e) => updateInvoiceItem(index, 'lot_no', e.target.value)}
                                                                placeholder="Lot No"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={item.serial_no}
                                                                onChange={(e) => updateInvoiceItem(index, 'serial_no', e.target.value)}
                                                                placeholder="Serial No"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-control form-control-sm"
                                                                value={item.quantity}
                                                                onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value)}
                                                                min="1"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-control form-control-sm"
                                                                value={item.price}
                                                                onChange={(e) => updateInvoiceItem(index, 'price', e.target.value)}
                                                                step="0.01"
                                                                min="0"
                                                            />
                                                        </td>
                                                        <td>
                                                            <strong>₹{parseFloat(item.total_price || 0).toFixed(2)}</strong>
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-sm btn-outline-success"
                                                                    onClick={() => duplicateInvoiceItem(index)}
                                                                    title="Duplicate this row"
                                                                >
                                                                    <i className="fa-solid fa-copy"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger"
                                                                    onClick={() => removeInvoiceItem(index)}
                                                                    title="Remove this row"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colSpan="8" className="text-end">
                                                        <strong>Grand Total:</strong>
                                                    </td>
                                                    <td colSpan="2">
                                                        <h5 className="mb-0">₹{calculateInvoiceTotal().toFixed(2)}</h5>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => {
                                        setShowInvoiceModal(false)
                                        setEditingInvoice(null)
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={saveInvoice}
                                    disabled={loadingStates.saveInvoice || invoiceItems.length === 0}
                                >
                                    {loadingStates.saveInvoice ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-save me-2"></i>
                                            {editingInvoice ? 'Update Invoice' : 'Save Invoice'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Invoice Modal */}
            {viewingInvoice && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header bg-info text-white">
                                <h5 className="modal-title">
                                    Invoice Details - {viewingInvoice.invoice_number}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setViewingInvoice(null)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* Invoice Header Info */}
                                <div className="card mb-4">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Invoice Number:</strong> {viewingInvoice.invoice_number}</p>
                                                <p><strong>Invoice Date:</strong> {viewingInvoice.invoice_date}</p>
                                                <p><strong>Received By:</strong> {viewingInvoice.received_by}</p>
                                                <p><strong>Received Date:</strong> {viewingInvoice.received_date}</p>
                                                <p><strong>Phone:</strong> {viewingInvoice.phone_number || 'N/A'}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Supplier:</strong> {viewingInvoice.supplier_name || 'N/A'}</p>
                                                <p><strong>GST Number:</strong> {viewingInvoice.gst_number || 'N/A'}</p>
                                                <p><strong>Address:</strong> {viewingInvoice.supplier_address || 'N/A'}</p>
                                                <p><strong>Status:</strong> 
                                                    <span className={`badge ms-2 ${
                                                        viewingInvoice.status === 'completed' ? 'bg-success' :
                                                        viewingInvoice.status === 'draft' ? 'bg-warning' :
                                                        'bg-secondary'
                                                    }`}>
                                                        {viewingInvoice.status}
                                                    </span>
                                                </p>
                                                <p><strong>Total Amount:</strong> ₹{parseFloat(viewingInvoice.total_amount || 0).toFixed(2)}</p>
                                            </div>
                                            {viewingInvoice.notes && (
                                                <div className="col-md-12 mt-2">
                                                    <p><strong>Notes:</strong> {viewingInvoice.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Items */}
                                <h5>Invoice Items</h5>
                                <div className="table-responsive">
                                    <table className="table table-bordered">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Barcode</th>
                                                <th>Part No</th>
                                                <th>Product Name</th>
                                                <th>Quantity</th>
                                                <th>Pending Testing</th>
                                                <th>Completed Testing</th>
                                                <th>Testing Status</th>
                                                <th>Inspected By</th>
                                                <th>Inspected Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewingInvoice.items?.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td>{index + 1}</td>
                                                    <td><code>{item.bare_code}</code></td>
                                                    <td>{item.part_no}</td>
                                                    <td>{item.product_name}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>
                                                        <span className={`badge ${item.pending_testing > 0 ? 'bg-warning' : 'bg-secondary'}`}>
                                                            {item.pending_testing || 0}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${item.completed_testing > 0 ? 'bg-success' : 'bg-secondary'}`}>
                                                            {item.completed_testing || 0}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${
                                                            item.testing_status === 'completed' ? 'bg-success' :
                                                            item.pending_testing === 0 ? 'bg-success' :
                                                            'bg-warning'
                                                        }`}>
                                                            {item.testing_status === 'completed' || item.pending_testing === 0 ? 'Completed' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td>{item.inspected_by || 'N/A'}</td>
                                                    <td>{item.inspected_date || 'N/A'}</td>
                                                    <td>
                                                        {viewingInvoice.status === 'draft' && (item.pending_testing || 0) > 0 && (
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-sm btn-outline-success"
                                                                    onClick={() => openTestingModal(item)}
                                                                    title="Mark as Completed"
                                                                    disabled={loadingStates.updateTesting}
                                                                >
                                                                    {loadingStates.updateTesting ? (
                                                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                                                    ) : (
                                                                        <i className="fa-solid fa-check"></i>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {viewingInvoice.status === 'draft' && (
                                    <div className="alert alert-warning mt-3">
                                        <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                        This invoice is in draft status. Finalize it when all items have completed testing.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setViewingInvoice(null)}
                                >
                                    Close
                                </button>
                                {viewingInvoice.status === 'draft' && (
                                    <button
                                        type="button"
                                        className="btn btn-success"
                                        onClick={() => finalizeInvoice(viewingInvoice.id)}
                                        disabled={loadingStates.finalizeInvoice}
                                    >
                                        {loadingStates.finalizeInvoice ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Finalizing...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-check-circle me-2"></i>
                                                Finalize Invoice
                                            </>
                                        )}
                                    </button>
                                )}
                                {viewingInvoice.status === 'draft' && (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => {
                                            editInvoice(viewingInvoice)
                                            setViewingInvoice(null)
                                        }}
                                    >
                                        <i className="fa-solid fa-pen me-2"></i>
                                        Edit Invoice
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Testing Completion Modal */}
            {showTestingModal && selectedItem && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-md">
                        <div className="modal-content">
                            <div className="modal-header bg-success text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-check-circle me-2"></i>
                                    Mark Testing as Completed
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={closeTestingModal}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="alert alert-info mb-3">
                                    <p className="mb-1"><strong>Product:</strong> {selectedItem.product_name}</p>
                                    <p className="mb-1"><strong>Barcode:</strong> <code>{selectedItem.bare_code}</code></p>
                                    <p className="mb-1"><strong>Part No:</strong> {selectedItem.part_no}</p>
                                    <p className="mb-0"><strong>Pending Testing:</strong> 
                                        <span className="badge bg-warning ms-2">
                                            {selectedItem.pending_testing || 0}
                                        </span>
                                    </p>
                                </div>
                                
                                <div className="mb-3">
                                    <label className="form-label">
                                        <strong>Completed Quantity *</strong>
                                        <small className="text-muted ms-1">(Max: {selectedItem.pending_testing || selectedItem.quantity || 0})</small>
                                    </label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={testingForm.completed_qty}
                                        onChange={(e) => setTestingForm(prev => ({ ...prev, completed_qty: e.target.value }))}
                                        min="1"
                                        max={selectedItem.pending_testing || selectedItem.quantity || 0}
                                        placeholder="Enter completed quantity"
                                    />
                                </div>
                                
                                <div className="mb-3">
                                    <label className="form-label"><strong>Inspected By *</strong></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={testingForm.inspected_by}
                                        onChange={(e) => setTestingForm(prev => ({ ...prev, inspected_by: e.target.value }))}
                                        placeholder="Enter inspector name"
                                    />
                                </div>
                                
                                <div className="mb-3">
                                    <label className="form-label"><strong>Inspection Date *</strong></label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={testingForm.inspected_date}
                                        onChange={(e) => setTestingForm(prev => ({ ...prev, inspected_date: e.target.value }))}
                                    />
                                </div>
                                
                                <div className="alert alert-warning">
                                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                    This action will move items from pending testing to available stock.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={closeTestingModal}
                                    disabled={loadingStates.updateTesting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-success"
                                    onClick={updateTestingQuantity}
                                    disabled={loadingStates.updateTesting || !testingForm.completed_qty || !testingForm.inspected_by || !testingForm.inspected_date}
                                >
                                    {loadingStates.updateTesting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check-circle me-2"></i>
                                            Mark as Completed
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Inward