import { useState } from "react"
import toast from "react-hot-toast"
import { supabase } from '../supabaseClient'
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import "./Inward.css";

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
    
    // Testing completion modal state
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

    // Confirmation modal states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [invoiceToDelete, setInvoiceToDelete] = useState(null)
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
    const [invoiceToFinalize, setInvoiceToFinalize] = useState(null)
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

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
        
        const updatedItems = [...invoiceItems]
        updatedItems.splice(index + 1, 0, newItem)
        setInvoiceItems(updatedItems)
        toast.success('Item duplicated successfully')
    }

    // Update invoice item with decimal support
    const updateInvoiceItem = (index, field, value) => {
        const updatedItems = [...invoiceItems]
        
        if (field === 'quantity' || field === 'price' || field === 'completed_qty') {
            let sanitizedValue = value.replace(/[^0-9.]/g, '')
            const parts = sanitizedValue.split('.')
            if (parts.length > 2) return
            if (parts[1] && parts[1].length > 2) {
                sanitizedValue = parts[0] + '.' + parts[1].substring(0, 2)
            }
            value = sanitizedValue
        }
        
        updatedItems[index] = {
            ...updatedItems[index],
            [field]: value
        }

        if (field === 'quantity' || field === 'price') {
            const quantity = parseFloat(updatedItems[index].quantity) || 0
            const price = parseFloat(updatedItems[index].price) || 0
            updatedItems[index].total_price = parseFloat((quantity * price).toFixed(2))
            
            if (field === 'quantity') {
                updatedItems[index].pending_testing = quantity
                updatedItems[index].completed_testing = 0
                updatedItems[index].testing_status = 'pending'
            }
        }

        if (field === 'bare_code' && value.trim()) {
            const product = products.find(p => p.BareCode === value.trim())
            if (product) {
                updatedItems[index].product_name = product.name
                updatedItems[index].part_no = product.PartNo
                updatedItems[index].price = product.price
                updatedItems[index].pending_testing = parseFloat(updatedItems[index].quantity) || 1
            }
        }

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

    // Optimized function to load only inward data
    const loadInwardDataOnly = async () => {
        try {
            const { data: invoicesData, error: invoicesError } = await supabase
                .from('inward_invoices')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (!invoicesError && invoicesData) {
                setInwardInvoices(invoicesData)
            }
        } catch (error) {
            console.error('Error loading inward invoices:', error)
        }
    }

    // Save invoice to database
    const saveInvoice = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, saveInvoice: true }))

            if (!newInvoice.invoice_number.trim()) {
                toast.error("Invoice number is required!")
                return
            }

            if (invoiceItems.length === 0) {
                toast.error("Please add at least one item!")
                return
            }

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
                
                const quantity = parseFloat(item.quantity)
                if (isNaN(quantity) || quantity <= 0) {
                    toast.error(`Item ${invoiceItems.indexOf(item) + 1}: Valid Quantity is required!`)
                    return
                }
            }

            const barcodeSet = new Set()
            for (const item of invoiceItems) {
                if (barcodeSet.has(item.bare_code.trim())) {
                    toast.error(`Duplicate barcode found: ${item.bare_code.trim()}`)
                    return
                }
                barcodeSet.add(item.bare_code.trim())
            }

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

            const invoiceTotal = invoiceItems.reduce((total, item) => {
                return total + (parseFloat(item.total_price) || 0)
            }, 0)

            let invoiceId
            if (editingInvoice) {
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
                        total_amount: parseFloat(invoiceTotal.toFixed(2)),
                        status: "draft",
                        notes: newInvoice.notes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingInvoice.id)

                if (error) throw error
                invoiceId = editingInvoice.id

                const { data: existingItems } = await supabase
                    .from('inward_items')
                    .select('id, bare_code')
                    .eq('invoice_id', invoiceId)

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
                        total_amount: parseFloat(invoiceTotal.toFixed(2)),
                        status: "draft",
                        notes: newInvoice.notes
                    }])
                    .select()

                if (error) throw error
                invoiceId = data[0].id
            }

            for (const item of invoiceItems) {
                const { data: existingItem } = await supabase
                    .from('inward_items')
                    .select('id')
                    .eq('invoice_id', invoiceId)
                    .eq('bare_code', item.bare_code.trim())
                    .maybeSingle()

                const quantity = parseFloat(item.quantity) || 0
                const price = parseFloat(item.price) || 0
                const pendingTesting = parseFloat(item.pending_testing) || quantity
                const completedTesting = parseFloat(item.completed_testing) || 0

                const itemData = {
                    invoice_id: invoiceId,
                    bare_code: item.bare_code.trim(),
                    part_no: item.part_no.trim(),
                    product_name: item.product_name.trim(),
                    lot_no: item.lot_no.trim(),
                    serial_no: item.serial_no.trim(),
                    quantity: quantity,
                    price: price,
                    total_price: parseFloat((quantity * price).toFixed(2)),
                    pending_testing: pendingTesting,
                    completed_testing: completedTesting,
                    testing_status: item.testing_status || 'pending',
                    inspected_date: item.inspected_date,
                    inspected_by: item.inspected_by,
                    notes: item.notes
                }

                if (existingItem && !item.isNew) {
                    await supabase
                        .from('inward_items')
                        .update(itemData)
                        .eq('id', existingItem.id)
                } else {
                    await supabase
                        .from('inward_items')
                        .insert([itemData])
                }

                const { data: existingVariant } = await supabase
                    .from('stock_variants')
                    .select('id')
                    .eq('bare_code', item.bare_code.trim())
                    .maybeSingle()

                if (!existingVariant) {
                    if (item.part_no.trim() && item.bare_code.trim()) {
                        const { data: existingStock, error: stockError } = await supabase
                            .from('stocks')
                            .select('*')
                            .eq('part_no', item.part_no.trim())
                            .single()

                        if (!stockError && existingStock) {
                            const newTotalReceived = (parseFloat(existingStock.total_received) || 0) + quantity
                            const newTestingBalance = (parseFloat(existingStock.testing_balance) || 0) + quantity
                            
                            const totalExistingValue = (parseFloat(existingStock.quantity) || 0) * (parseFloat(existingStock.average_price) || 0)
                            const newItemValue = quantity * price
                            const totalNewQuantity = (parseFloat(existingStock.quantity) || 0) + quantity
                            const newAveragePrice = totalNewQuantity > 0 ? 
                                (totalExistingValue + newItemValue) / totalNewQuantity : 0

                            await supabase
                                .from('stocks')
                                .update({
                                    total_received: parseFloat(newTotalReceived.toFixed(2)),
                                    testing_balance: parseFloat(newTestingBalance.toFixed(2)),
                                    average_price: parseFloat(newAveragePrice.toFixed(2)),
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', existingStock.id)

                            const { data: newVariant, error: variantError } = await supabase
                                .from('stock_variants')
                                .insert([{
                                    stock_id: existingStock.id,
                                    inward_invoice_id: invoiceId,
                                    bare_code: item.bare_code.trim(),
                                    serial_no: item.serial_no.trim(),
                                    lot_no: item.lot_no.trim(),
                                    batch_no: item.lot_no || `BATCH-${Date.now()}`,
                                    price: price,
                                    quantity: 0,
                                    pending_testing: quantity,
                                    received_date: newInvoice.received_date.toISOString().split('T')[0],
                                    testing_status: 'pending'
                                }])
                                .select()
                                .single()

                            if (variantError && !variantError.message.includes('duplicate key')) {
                                throw variantError
                            }

                            if (!variantError || variantError.message.includes('duplicate key')) {
                                await supabase
                                    .from('stock_movements')
                                    .insert([{
                                        variant_id: newVariant?.id || existingVariant?.id,
                                        movement_type: 'in',
                                        quantity: quantity,
                                        remaining_quantity: quantity,
                                        reference_type: 'inward',
                                        reference_id: invoiceId,
                                        movement_date: new Date().toISOString()
                                    }])
                            }

                        } else {
                            const { data: newStock, error: newStockError } = await supabase
                                .from('stocks')
                                .insert([{
                                    bare_code: item.bare_code.trim(),
                                    part_no: item.part_no.trim(),
                                    name: item.product_name.trim(),
                                    price: price,
                                    quantity: 0,
                                    using_quantity: 0,
                                    total_received: quantity,
                                    testing_balance: quantity,
                                    average_price: price,
                                    lot_no: item.lot_no,
                                    s_no: item.serial_no,
                                    testing_status: 'pending'
                                }])
                                .select()

                            if (newStockError) throw newStockError

                            const { data: newVariant, error: variantError } = await supabase
                                .from('stock_variants')
                                .insert([{
                                    stock_id: newStock[0].id,
                                    inward_invoice_id: invoiceId,
                                    bare_code: item.bare_code.trim(),
                                    serial_no: item.serial_no.trim(),
                                    lot_no: item.lot_no.trim(),
                                    batch_no: item.lot_no || `BATCH-${Date.now()}`,
                                    price: price,
                                    quantity: 0,
                                    pending_testing: quantity,
                                    received_date: newInvoice.received_date.toISOString().split('T')[0],
                                    testing_status: 'pending'
                                }])
                                .select()
                                .single()

                            if (variantError && !variantError.message.includes('duplicate key')) {
                                throw variantError
                            }

                            await supabase
                                .from('stock_movements')
                                .insert([{
                                    variant_id: newVariant?.id || existingVariant?.id,
                                    movement_type: 'in',
                                    quantity: quantity,
                                    remaining_quantity: quantity,
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
            
            await loadInwardDataOnly()
        } catch (error) {
            console.error('Error saving invoice:', error)
            toast.error('Error saving invoice: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, saveInvoice: false }))
        }
    }

    // Open testing completion modal
    const openTestingModal = (item) => {
        setSelectedItem(item)
        setTestingForm({
            completed_qty: item.pending_testing || item.quantity || 0,
            inspected_by: item.inspected_by || "",
            inspected_date: item.inspected_date || new Date().toISOString().split('T')[0]
        })
        setShowTestingModal(true)
    }

    // Close testing modal
    const closeTestingModal = () => {
        setShowTestingModal(false)
        setSelectedItem(null)
        setTestingForm({
            completed_qty: "",
            inspected_by: "",
            inspected_date: new Date().toISOString().split('T')[0]
        })
    }

    // Update testing status for quantity with decimal support
    const updateTestingQuantity = async () => {
        if (!selectedItem) return

        try {
            setLoadingStates(prev => ({ ...prev, updateTesting: true }))

            const completedTesting = parseFloat(testingForm.completed_qty) || 0
            const pendingQty = parseFloat(selectedItem.pending_testing) || parseFloat(selectedItem.quantity) || 0
            
            if (completedTesting <= 0) {
                toast.error("Please enter a valid completed quantity!")
                return
            }
            
            if (completedTesting > pendingQty) {
                toast.error(`Cannot complete more than ${pendingQty.toFixed(2)} items!`)
                return
            }

            const newPending = parseFloat((pendingQty - completedTesting).toFixed(2))
            const newCompleted = (parseFloat(selectedItem.completed_testing) || 0) + completedTesting
            const newStatus = newPending === 0 ? 'completed' : 'pending'

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

            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('bare_code', selectedItem.bare_code)
                .single()

            if (!variantError && variant) {
                const newVariantPending = Math.max(0, (parseFloat(variant.pending_testing) || 0) - completedTesting)
                const newVariantQty = (parseFloat(variant.quantity) || 0) + completedTesting
                const newVariantStatus = newVariantPending === 0 ? 'completed' : 'pending'

                await supabase
                    .from('stock_variants')
                    .update({
                        quantity: parseFloat(newVariantQty.toFixed(2)),
                        pending_testing: parseFloat(newVariantPending.toFixed(2)),
                        testing_status: newVariantStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', variant.id)

                await supabase
                    .from('stock_movements')
                    .insert([{
                        variant_id: variant.id,
                        movement_type: 'out',
                        quantity: completedTesting,
                        remaining_quantity: parseFloat((newVariantQty + newVariantPending).toFixed(2)),
                        reference_type: 'testing',
                        reference_id: selectedItem.invoice_id,
                        movement_date: new Date().toISOString()
                    }])

                const { data: stock, error: stockError } = await supabase
                    .from('stocks')
                    .select('*')
                    .eq('id', variant.stock_id)
                    .single()

                if (!stockError && stock) {
                    const newTestingBalance = Math.max(0, (parseFloat(stock.testing_balance) || 0) - completedTesting)
                    const newQuantity = (parseFloat(stock.quantity) || 0) + completedTesting

                    await supabase
                        .from('stocks')
                        .update({
                            testing_balance: parseFloat(newTestingBalance.toFixed(2)),
                            quantity: parseFloat(newQuantity.toFixed(2)),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', stock.id)
                }
            }

            toast.success(`Updated testing: ${completedTesting.toFixed(2)} completed, ${newPending.toFixed(2)} pending`)
            
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

            closeTestingModal()

            const refreshInvoiceData = async () => {
                try {
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

    // Show delete confirmation
    const confirmDeleteInvoice = (invoiceId) => {
        const invoice = inwardInvoices.find(inv => inv.id === invoiceId)
        if (!invoice) {
            toast.error("Invoice not found!")
            return
        }
        
        if (invoice.status !== 'draft') {
            toast.error("Only draft invoices can be deleted!")
            return
        }
        
        setInvoiceToDelete(invoice)
        setShowDeleteConfirm(true)
    }

    // Delete invoice after confirmation
    const deleteInvoice = async () => {
        if (!invoiceToDelete) return

        try {
            setLoadingStates(prev => ({ ...prev, deleteInvoice: true }))

            const { data: items, error: itemsError } = await supabase
                .from('inward_items')
                .select('*')
                .eq('invoice_id', invoiceToDelete.id)

            if (itemsError) throw itemsError

            for (const item of items || []) {
                const { data: variants, error: variantsError } = await supabase
                    .from('stock_variants')
                    .select('*')
                    .eq('bare_code', item.bare_code)

                if (!variantsError && variants && variants.length > 0) {
                    for (const variant of variants) {
                        const { data: stock, error: stockError } = await supabase
                            .from('stocks')
                            .select('*')
                            .eq('id', variant.stock_id)
                            .single()

                        if (!stockError && stock) {
                            const variantTotalQty = (parseFloat(variant.quantity) || 0) + (parseFloat(variant.pending_testing) || 0)
                            const newTestingBalance = Math.max(0, (parseFloat(stock.testing_balance) || 0) - variantTotalQty)
                            const newTotalReceived = Math.max(0, (parseFloat(stock.total_received) || 0) - variantTotalQty)
                            const newQuantity = Math.max(0, (parseFloat(stock.quantity) || 0) - (parseFloat(variant.quantity) || 0))
                            
                            await supabase
                                .from('stocks')
                                .update({
                                    testing_balance: parseFloat(newTestingBalance.toFixed(2)),
                                    total_received: parseFloat(newTotalReceived.toFixed(2)),
                                    quantity: parseFloat(newQuantity.toFixed(2)),
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', stock.id)
                        }

                        await supabase
                            .from('stock_variants')
                            .delete()
                            .eq('id', variant.id)
                    }
                }
            }

            const { error } = await supabase
                .from('inward_invoices')
                .delete()
                .eq('id', invoiceToDelete.id)

            if (error) throw error

            toast.success('Invoice deleted successfully!')
            await loadAllData()
            
            if (viewingInvoice && viewingInvoice.id === invoiceToDelete.id) {
                setViewingInvoice(null)
            }
            
            setShowDeleteConfirm(false)
            setInvoiceToDelete(null)
        } catch (error) {
            console.error('Error deleting invoice:', error)
            toast.error('Error deleting invoice: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, deleteInvoice: false }))
        }
    }

    // Show finalize confirmation
    const confirmFinalizeInvoice = (invoiceId) => {
        const invoice = inwardInvoices.find(inv => inv.id === invoiceId)
        if (!invoice) {
            toast.error("Invoice not found!")
            return
        }
        
        setInvoiceToFinalize(invoice)
        setShowFinalizeConfirm(true)
    }

    // Finalize invoice after confirmation
    const finalizeInvoice = async () => {
        if (!invoiceToFinalize) return

        try {
            setLoadingStates(prev => ({ ...prev, finalizeInvoice: true }))
            
            const { data: items, error: itemsError } = await supabase
                .from('inward_items')
                .select('testing_status, pending_testing')
                .eq('invoice_id', invoiceToFinalize.id)

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
                .eq('id', invoiceToFinalize.id)

            if (error) throw error

            toast.success('Invoice finalized successfully!')
            
            if (viewingInvoice && viewingInvoice.id === invoiceToFinalize.id) {
                setViewingInvoice({ ...viewingInvoice, status: 'completed' })
            }

            const { data: updatedInvoices } = await supabase
                .from('inward_invoices')
                .select('*')
                .order('created_at', { ascending: false })

            if (updatedInvoices) {
                setInwardInvoices(updatedInvoices)
            }
            
            setShowFinalizeConfirm(false)
            setInvoiceToFinalize(null)
            
        } catch (error) {
            console.error('Error finalizing invoice:', error)
            toast.error('Error finalizing invoice: ' + error.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, finalizeInvoice: false }))
        }
    }

    // Show discard confirmation
    const confirmDiscardChanges = () => {
        if (invoiceItems.length > 0 || 
            newInvoice.supplier_name.trim() || 
            newInvoice.received_by.trim()) {
            setShowDiscardConfirm(true)
        } else {
            setShowInvoiceModal(false)
            setEditingInvoice(null)
        }
    }

    // Discard changes after confirmation
    const discardChanges = () => {
        setShowInvoiceModal(false)
        setShowDiscardConfirm(false)
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
    }

    return (
        <div className="container-fluid px-lg-5 px-md-3 px-2 py-3">
            {/* Header Section */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                <div className="mb-3 mb-md-0">
                    <h1 className="text-primary fw-bold">
                        <i className="fas fa-inbox me-2"></i>
                        Inward Management
                    </h1>
                    <p className="text-muted mb-0">Manage incoming invoices and inventory</p>
                </div>
                <button 
                    className="btn btn-success btn-lg shadow-sm"
                    onClick={openNewInvoiceModal}
                >
                    <i className="fa-solid fa-plus me-2"></i>
                    New Invoice
                </button>
            </div>

            {/* Search Bar */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3">
                    <div className="input-group input-group-lg">
                        <span className="input-group-text bg-light border-0">
                            <i className="fa-solid fa-magnifying-glass text-muted"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control border-0 bg-light"
                            placeholder="Search invoices by number, supplier, or status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button 
                            className="btn btn-outline-secondary border-0"
                            onClick={() => setSearchTerm("")}
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Invoices List Card */}
            <div className="card shadow border-0">
                <div className="card-header bg-white border-0 py-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
                        <h5 className="card-title fw-bold mb-2 mb-md-0">
                            <i className="fa-solid fa-file-invoice me-2 text-primary"></i>
                            Invoices
                            <span className="badge bg-primary ms-2">{filteredInvoices.length}</span>
                        </h5>
                        <div className="text-muted">
                            Showing {filteredInvoices.length} of {inwardInvoices.length} invoices
                        </div>
                    </div>
                </div>
                <div className="card-body p-0">
                    {filteredInvoices.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="fa-solid fa-file-invoice fa-4x text-light mb-3" style={{color: '#e9ecef'}}></i>
                            <h5 className="text-muted mb-2">No invoices found</h5>
                            <p className="text-muted mb-4">Create your first invoice to get started</p>
                            <button className="btn btn-primary btn-lg" onClick={openNewInvoiceModal}>
                                <i className="fa-solid fa-plus me-2"></i>
                                Create First Invoice
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="ps-4">#</th>
                                        <th>Invoice No</th>
                                        <th>Date</th>
                                        <th>Supplier</th>
                                        <th>Phone</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th className="text-center pe-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map((invoice, index) => (
                                        <tr key={invoice.id} className="align-middle">
                                            <td className="ps-4 fw-medium text-muted">{index + 1}</td>
                                            <td>
                                                <div className="d-flex flex-column">
                                                    <strong className="text-primary">{invoice.invoice_number}</strong>
                                                    <small className="text-muted">{invoice.gst_number || 'No GST'}</small>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex flex-column">
                                                    <span>{invoice.invoice_date}</span>
                                                    <small className="text-muted">Received: {invoice.received_date}</small>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex flex-column">
                                                    <strong>{invoice.supplier_name || 'N/A'}</strong>
                                                    <small className="text-muted">{invoice.received_by}</small>
                                                </div>
                                            </td>
                                            <td>
                                                <a href={`tel:${invoice.phone_number}`} className="text-decoration-none">
                                                    {invoice.phone_number || 'N/A'}
                                                </a>
                                            </td>
                                            <td className="fw-bold">
                                                ₹{parseFloat(invoice.total_amount || 0).toFixed(2)}
                                            </td>
                                            <td>
                                                <span className={`badge rounded-pill px-3 py-2 ${
                                                    invoice.status === 'completed' ? 'bg-success' :
                                                    invoice.status === 'draft' ? 'bg-warning text-dark' :
                                                    'bg-secondary'
                                                }`}>
                                                    <i className={`fas ${
                                                        invoice.status === 'completed' ? 'fa-check-circle' :
                                                        invoice.status === 'draft' ? 'fa-pen' :
                                                        'fa-clock'
                                                    } me-2`}></i>
                                                    {invoice.status}
                                                </span>
                                            </td>
                                            <td className="text-center pe-4">
                                                <div className="btn-group" role="group">
                                                    <button
                                                        className="btn btn-outline-primary btn-sm rounded-start"
                                                        onClick={() => viewInvoice(invoice)}
                                                        title="View Details"
                                                    >
                                                        <i className="fa-solid fa-eye"></i>
                                                    </button>
                                                    {invoice.status === 'draft' && (
                                                        <>
                                                            <button
                                                                className="btn btn-outline-secondary btn-sm"
                                                                onClick={() => editInvoice(invoice)}
                                                                title="Edit Invoice"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-outline-danger btn-sm rounded-end"
                                                                onClick={() => confirmDeleteInvoice(invoice.id)}
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
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-primary text-white py-3">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-file-invoice me-2"></i>
                                    {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={confirmDiscardChanges}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                {/* Invoice Header */}
                                <div className="border-0 bg-light mb-4">
                                    <div className="card-body">
                                        <h6 className="card-title text-primary mb-3">
                                            <i className="fa-solid fa-info-circle me-2"></i>
                                            Invoice Information
                                        </h6>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <div className="form-floating">
                                                    <input
                                                        type="text"
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.invoice_number}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_number: e.target.value }))}
                                                        disabled={editingInvoice}
                                                    />
                                                    <label className="text-muted">Invoice Number *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div >
                                                      <label className="form-label me-3">Invoice Date *</label>
                                                    <DatePicker
                                                        selected={newInvoice.invoice_date}
                                                        onChange={(date) => setNewInvoice(prev => ({ ...prev, invoice_date: date }))}
                                                        dateFormat="yyyy-MM-dd"
                                                        className="form-control border-0 shadow-sm"
                                                        placeholderText="Select invoice date"
                                                        required
                                                    />
                                                  
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-floating">
                                                    <input
                                                        type="text"
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.received_by}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, received_by: e.target.value }))}
                                                    />
                                                    <label className="text-muted">Received By *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div>
                                                     <label className="form-label me-3">Received Date *</label>
                                                    <DatePicker
                                                        selected={newInvoice.received_date}
                                                        onChange={(date) => setNewInvoice(prev => ({ ...prev, received_date: date }))}
                                                        dateFormat="yyyy-MM-dd"
                                                        className="form-control border-0 shadow-sm"
                                                        placeholderText="Select received date"
                                                        required
                                                    />
                                                   
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Supplier Information */}
                                <div className="card border-0 bg-light mb-4">
                                    <div className="card-body">
                                        <h6 className="card-title text-primary mb-3">
                                            <i className="fa-solid fa-building me-2"></i>
                                            Supplier Information
                                        </h6>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <div className="form-floating">
                                                    <input
                                                        type="text"
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.supplier_name}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, supplier_name: e.target.value }))}
                                                    />
                                                    <label className="text-muted">Supplier Name</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-floating">
                                                    <input
                                                        type="tel"
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.phone_number}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, phone_number: e.target.value }))}
                                                        pattern="[0-9]{10}"
                                                    />
                                                    <label className="text-muted">Phone Number</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-floating">
                                                    <input
                                                        type="text"
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.gst_number}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, gst_number: e.target.value }))}
                                                    />
                                                    <label className="text-muted">GST Number</label>
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="form-floating">
                                                    <textarea
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.supplier_address}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, supplier_address: e.target.value }))}
                                                        style={{ height: '100px' }}
                                                    />
                                                    <label className="text-muted">Supplier Address</label>
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="form-floating">
                                                    <textarea
                                                        className="form-control border-0 shadow-sm"
                                                        value={newInvoice.notes}
                                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                                                        style={{ height: '80px' }}
                                                    />
                                                    <label className="text-muted">Notes (Optional)</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Items */}
                                <div className="card border-0 bg-light">
                                    <div className="card-body">
                                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                                            <div>
                                                <h6 className="card-title text-primary mb-1">
                                                    <i className="fa-solid fa-boxes me-2"></i>
                                                    Invoice Items
                                                </h6>
                                                <p className="text-muted mb-0">Add products to this invoice</p>
                                            </div>
                                            <button 
                                                className="btn btn-primary mt-2 mt-md-0"
                                                onClick={addNewItem}
                                            >
                                                <i className="fa-solid fa-plus me-2"></i>
                                                Add Item
                                            </button>
                                        </div>

                                        {invoiceItems.length === 0 ? (
                                            <div className="text-center py-5 border rounded bg-white">
                                                <i className="fa-solid fa-box-open fa-3x text-muted mb-3"></i>
                                                <h6 className="text-muted">No items added yet</h6>
                                                <p className="text-muted mb-0">Click "Add Item" to start adding products</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="table-responsive">
                                                    <table className="table table-hover bg-white rounded shadow-sm">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th width="40">#</th>
                                                                <th>Barcode *</th>
                                                                <th>Part No *</th>
                                                                <th>Product Name</th>
                                                                <th>Lot No</th>
                                                                <th>Serial No</th>
                                                                <th width="120">Quantity</th>
                                                                <th width="120">Price (₹)</th>
                                                                <th width="120">Total (₹)</th>
                                                                <th width="100" className="text-center">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {invoiceItems.map((item, index) => (
                                                                <tr key={item.id || index} className="align-middle">
                                                                    <td className="fw-medium text-muted">{index + 1}</td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border"
                                                                            value={item.bare_code}
                                                                            onChange={(e) => updateInvoiceItem(index, 'bare_code', e.target.value)}
                                                                            placeholder="Scan barcode"
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border"
                                                                            value={item.part_no}
                                                                            onChange={(e) => updateInvoiceItem(index, 'part_no', e.target.value)}
                                                                            placeholder="Part No"
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border"
                                                                            value={item.product_name}
                                                                            onChange={(e) => updateInvoiceItem(index, 'product_name', e.target.value)}
                                                                            placeholder="Product Name"
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border"
                                                                            value={item.lot_no}
                                                                            onChange={(e) => updateInvoiceItem(index, 'lot_no', e.target.value)}
                                                                            placeholder="Lot No"
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border"
                                                                            value={item.serial_no}
                                                                            onChange={(e) => updateInvoiceItem(index, 'serial_no', e.target.value)}
                                                                            placeholder="Serial No"
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border text-end"
                                                                            value={item.quantity}
                                                                            onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value)}
                                                                            placeholder="Qty"
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm border text-end"
                                                                            value={item.price}
                                                                            onChange={(e) => updateInvoiceItem(index, 'price', e.target.value)}
                                                                            placeholder="Price"
                                                                        />
                                                                    </td>
                                                                    <td className="fw-bold text-end">
                                                                        ₹{parseFloat(item.total_price || 0).toFixed(2)}
                                                                    </td>
                                                                    <td className="text-center">
                                                                        <div className="btn-group btn-group-sm" role="group">
                                                                            <button
                                                                                className="btn btn-outline-success"
                                                                                onClick={() => duplicateInvoiceItem(index)}
                                                                                title="Duplicate"
                                                                            >
                                                                                <i className="fa-solid fa-copy"></i>
                                                                            </button>
                                                                            <button
                                                                                className="btn btn-outline-danger"
                                                                                onClick={() => removeInvoiceItem(index)}
                                                                                title="Remove"
                                                                            >
                                                                                <i className="fa-solid fa-trash"></i>
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="table-light">
                                                            <tr>
                                                                <td colSpan="7" className="text-end fw-bold">
                                                                    Grand Total:
                                                                </td>
                                                                <td colSpan="2" className="text-end">
                                                                    <h4 className="text-primary mb-0">
                                                                        ₹{calculateInvoiceTotal().toFixed(2)}
                                                                    </h4>
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                                <div className="alert alert-info mt-3 mb-0">
                                                    <i className="fa-solid fa-info-circle me-2"></i>
                                                    <strong>Tip:</strong> Scan barcode or enter Part No to auto-fill product details
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={confirmDiscardChanges}
                                >
                                    <i className="fa-solid fa-times me-2"></i>
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary px-4"
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
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-info text-white py-3">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-eye me-2"></i>
                                    Invoice Details
                                    <small className="ms-2 fw-normal">#{viewingInvoice.invoice_number}</small>
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setViewingInvoice(null)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                {/* Invoice Header */}
                                <div className="row mb-4">
                                    <div className="col-md-6">
                                        <div className="card border-0 bg-light h-100">
                                            <div className="card-body">
                                                <h6 className="card-title text-primary mb-3">
                                                    <i className="fa-solid fa-receipt me-2"></i>
                                                    Invoice Details
                                                </h6>
                                                <div className="row">
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Invoice No</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.invoice_number}</p>
                                                    </div>
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Invoice Date</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.invoice_date}</p>
                                                    </div>
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Received By</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.received_by}</p>
                                                    </div>
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Received Date</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.received_date}</p>
                                                    </div>
                                                    <div className="col-12 mb-2">
                                                        <small className="text-muted">Notes</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.notes || 'No notes'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="card border-0 bg-light h-100">
                                            <div className="card-body">
                                                <h6 className="card-title text-primary mb-3">
                                                    <i className="fa-solid fa-building me-2"></i>
                                                    Supplier Details
                                                </h6>
                                                <div className="row">
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Supplier</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.supplier_name || 'N/A'}</p>
                                                    </div>
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Phone</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.phone_number || 'N/A'}</p>
                                                    </div>
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">GST Number</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.gst_number || 'N/A'}</p>
                                                    </div>
                                                    <div className="col-6 mb-2">
                                                        <small className="text-muted">Status</small>
                                                        <p className="mb-1">
                                                            <span className={`badge ${
                                                                viewingInvoice.status === 'completed' ? 'bg-success' :
                                                                viewingInvoice.status === 'draft' ? 'bg-warning text-dark' :
                                                                'bg-secondary'
                                                            }`}>
                                                                {viewingInvoice.status}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <div className="col-12 mb-2">
                                                        <small className="text-muted">Address</small>
                                                        <p className="fw-bold mb-1">{viewingInvoice.supplier_address || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Items */}
                                <div className="card border-0 bg-light">
                                    <div className="card-body">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h6 className="card-title text-primary mb-0">
                                                <i className="fa-solid fa-boxes me-2"></i>
                                                Invoice Items
                                                <span className="badge bg-primary ms-2">{viewingInvoice.items?.length || 0}</span>
                                            </h6>
                                            <div className="text-end">
                                                <h5 className="text-primary mb-0">
                                                    Total: ₹{parseFloat(viewingInvoice.total_amount || 0).toFixed(2)}
                                                </h5>
                                            </div>
                                        </div>

                                        <div className="table-responsive">
                                            <table className="table table-hover bg-white rounded">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Barcode</th>
                                                        <th>Part No</th>
                                                        <th>Product Name</th>
                                                        <th>Quantity</th>
                                                        <th>Pending</th>
                                                        <th>Completed</th>
                                                        <th>Status</th>
                                                        <th>Inspected By</th>
                                                        <th>Date</th>
                                                        <th className="text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {viewingInvoice.items?.map((item, index) => (
                                                        <tr key={item.id} className="align-middle">
                                                            <td className="fw-medium text-muted">{index + 1}</td>
                                                            <td>
                                                                <code className="bg-light p-1 rounded">{item.bare_code}</code>
                                                            </td>
                                                            <td>{item.part_no}</td>
                                                            <td>
                                                                <div className="d-flex flex-column">
                                                                    <strong>{item.product_name}</strong>
                                                                    <small className="text-muted">
                                                                        Lot: {item.lot_no || 'N/A'} | Serial: {item.serial_no || 'N/A'}
                                                                    </small>
                                                                </div>
                                                            </td>
                                                            <td className="fw-bold">{parseFloat(item.quantity).toFixed(2)}</td>
                                                            <td>
                                                                <span className={`badge ${item.pending_testing > 0 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                                                    {parseFloat(item.pending_testing || 0).toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${item.completed_testing > 0 ? 'bg-success' : 'bg-secondary'}`}>
                                                                    {parseFloat(item.completed_testing || 0).toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${
                                                                    item.testing_status === 'completed' || item.pending_testing === 0 ? 'bg-success' :
                                                                    'bg-warning text-dark'
                                                                }`}>
                                                                    {item.testing_status === 'completed' || item.pending_testing === 0 ? 'Completed' : 'Pending'}
                                                                </span>
                                                            </td>
                                                            <td>{item.inspected_by || 'N/A'}</td>
                                                            <td>{item.inspected_date || 'N/A'}</td>
                                                            <td className="text-center">
                                                                {viewingInvoice.status === 'draft' && (item.pending_testing || 0) > 0 && (
                                                                    <button
                                                                        className="btn btn-sm btn-success"
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
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {viewingInvoice.status === 'draft' && (
                                            <div className="alert alert-warning mt-3 mb-0">
                                                <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                                <strong>Draft Invoice:</strong> Finalize when all items have completed testing.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={() => setViewingInvoice(null)}
                                >
                                    <i className="fa-solid fa-times me-2"></i>
                                    Close
                                </button>
                                {viewingInvoice.status === 'draft' && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary"
                                            onClick={() => {
                                                editInvoice(viewingInvoice)
                                                setViewingInvoice(null)
                                            }}
                                        >
                                            <i className="fa-solid fa-pen me-2"></i>
                                            Edit Invoice
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-success"
                                            onClick={() => confirmFinalizeInvoice(viewingInvoice.id)}
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
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Testing Completion Modal */}
            {showTestingModal && selectedItem && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-md modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-success text-white py-3">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-check-circle me-2"></i>
                                    Complete Testing
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={closeTestingModal}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                {/* Product Info */}
                                <div className="card border-0 bg-light mb-4">
                                    <div className="card-body">
                                        <h6 className="card-title text-primary mb-3">Product Information</h6>
                                        <div className="row">
                                            <div className="col-md-6 mb-2">
                                                <small className="text-muted">Product Name</small>
                                                <p className="fw-bold mb-1">{selectedItem.product_name}</p>
                                            </div>
                                            <div className="col-md-6 mb-2">
                                                <small className="text-muted">Part No</small>
                                                <p className="fw-bold mb-1">{selectedItem.part_no}</p>
                                            </div>
                                            <div className="col-md-6 mb-2">
                                                <small className="text-muted">Barcode</small>
                                                <p className="fw-bold mb-1">
                                                    <code className="bg-white p-1 rounded">{selectedItem.bare_code}</code>
                                                </p>
                                            </div>
                                            <div className="col-md-6 mb-2">
                                                <small className="text-muted">Pending Testing</small>
                                                <p className="fw-bold mb-1">
                                                    <span className="badge bg-warning text-dark px-3 py-2">
                                                        {parseFloat(selectedItem.pending_testing || selectedItem.quantity || 0).toFixed(2)}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Testing Form */}
                                <div className="row g-3">
                                    <div className="col-md-12">
                                        <label className="form-label fw-bold">
                                            Completed Quantity *
                                            <small className="text-muted ms-1">
                                                (Max: {parseFloat(selectedItem.pending_testing || selectedItem.quantity || 0).toFixed(2)})
                                            </small>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control border-2"
                                            value={testingForm.completed_qty}
                                            onChange={(e) => setTestingForm(prev => ({ 
                                                ...prev, 
                                                completed_qty: e.target.value.replace(/[^0-9.]/g, '')
                                            }))}
                                            placeholder="Enter completed quantity"
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Inspected By *</label>
                                        <input
                                            type="text"
                                            className="form-control border-2"
                                            value={testingForm.inspected_by}
                                            onChange={(e) => setTestingForm(prev => ({ ...prev, inspected_by: e.target.value }))}
                                            placeholder="Enter inspector name"
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Inspection Date *</label>
                                        <input
                                            type="date"
                                            className="form-control border-2"
                                            value={testingForm.inspected_date}
                                            onChange={(e) => setTestingForm(prev => ({ ...prev, inspected_date: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="alert alert-info mt-4 mb-0">
                                    <i className="fa-solid fa-info-circle me-2"></i>
                                    This will move items from pending testing to available stock inventory.
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={closeTestingModal}
                                    disabled={loadingStates.updateTesting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-success px-4"
                                    onClick={updateTestingQuantity}
                                    disabled={loadingStates.updateTesting || !testingForm.completed_qty || !testingForm.inspected_by || !testingForm.inspected_date}
                                >
                                    {loadingStates.updateTesting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check-circle me-2"></i>
                                            Complete Testing
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && invoiceToDelete && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-md modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-danger text-white py-3">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                    Confirm Deletion
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => {
                                        setShowDeleteConfirm(false)
                                        setInvoiceToDelete(null)
                                    }}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="text-center mb-4">
                                    <i className="fa-solid fa-trash fa-3x text-danger mb-3"></i>
                                    <h5 className="fw-bold">Delete Invoice?</h5>
                                    <p className="text-muted">
                                        Are you sure you want to delete invoice <strong>#{invoiceToDelete.invoice_number}</strong>?
                                    </p>
                                    <div className="alert alert-danger mt-3">
                                        <i className="fa-solid fa-exclamation-circle me-2"></i>
                                        <strong>Warning:</strong> This action cannot be undone. All items and testing data will be permanently removed.
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={() => {
                                        setShowDeleteConfirm(false)
                                        setInvoiceToDelete(null)
                                    }}
                                    disabled={loadingStates.deleteInvoice}
                                >
                                    <i className="fa-solid fa-times me-2"></i>
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-danger px-4"
                                    onClick={deleteInvoice}
                                    disabled={loadingStates.deleteInvoice}
                                >
                                    {loadingStates.deleteInvoice ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-trash me-2"></i>
                                            Delete Invoice
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Finalize Confirmation Modal */}
            {showFinalizeConfirm && invoiceToFinalize && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-md modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-success text-white py-3">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-check-circle me-2"></i>
                                    Finalize Invoice
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => {
                                        setShowFinalizeConfirm(false)
                                        setInvoiceToFinalize(null)
                                    }}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="text-center mb-4">
                                    <i className="fa-solid fa-file-check fa-3x text-success mb-3"></i>
                                    <h5 className="fw-bold">Finalize Invoice?</h5>
                                    <p className="text-muted">
                                        Are you sure you want to finalize invoice <strong>#{invoiceToFinalize.invoice_number}</strong>?
                                    </p>
                                    <div className="alert alert-warning mt-3">
                                        <i className="fa-solid fa-exclamation-circle me-2"></i>
                                        <strong>Note:</strong> This will mark the invoice as completed. Make sure all items have completed testing.
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={() => {
                                        setShowFinalizeConfirm(false)
                                        setInvoiceToFinalize(null)
                                    }}
                                    disabled={loadingStates.finalizeInvoice}
                                >
                                    <i className="fa-solid fa-times me-2"></i>
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-success px-4"
                                    onClick={finalizeInvoice}
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
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Discard Changes Confirmation Modal */}
            {showDiscardConfirm && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-md modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-warning text-white py-3">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                    Discard Changes
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setShowDiscardConfirm(false)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="text-center mb-4">
                                    <i className="fa-solid fa-file-excel fa-3x text-warning mb-3"></i>
                                    <h5 className="fw-bold">Discard Changes?</h5>
                                    <p className="text-muted">
                                        You have unsaved changes. Are you sure you want to discard them?
                                    </p>
                                    <div className="alert alert-warning mt-3">
                                        <i className="fa-solid fa-exclamation-circle me-2"></i>
                                        All unsaved changes will be lost.
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowDiscardConfirm(false)}
                                >
                                    <i className="fa-solid fa-times me-2"></i>
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-warning px-4"
                                    onClick={discardChanges}
                                >
                                    <i className="fa-solid fa-trash me-2"></i>
                                    Discard Changes
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