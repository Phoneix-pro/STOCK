import "./Sales.css"
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { supabase } from '../supabaseClient';

function Sales({ 
    sales, 
    setSales, 
    products, 
    setProducts, 
    loadAllData, 
    reloadModuleData,
    invoices, 
    setInvoices,
    deliveryChalans,
    setDeliveryChalans 
}) {
    const [selectedSalesForInvoice, setSelectedSalesForInvoice] = useState([]);
    const [selectedSalesForDC, setSelectedSalesForDC] = useState([]);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showDCModal, setShowDCModal] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState({
        invoice_number: "",
        customer_name: "",
        customer_address: "",
        customer_phone: "",
        customer_gst: ""
    });
    const [dcForm, setDcForm] = useState({
        dc_number: "",
        customer_name: "",
        customer_address: "",
        customer_phone: "",
        customer_gst: ""
    });
    const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
    const [showDCHistory, setShowDCHistory] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedDC, setSelectedDC] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [dcItems, setDCItems] = useState([]);
    const [salesWithDCInfo, setSalesWithDCInfo] = useState([]);
    const [dcQuantities, setDcQuantities] = useState({});
    const [invoiceQuantities, setInvoiceQuantities] = useState({});
    const [dcItemQuantities, setDCItemQuantities] = useState({});
    const [invoiceItemQuantities, setInvoiceItemQuantities] = useState({});
    const [loading, setLoading] = useState({
        invoice: false,
        dc: false,
        delete: false,
        general: false,
        moveToStock: false
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredSales, setFilteredSales] = useState([]);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalValue: 0,
        pendingInvoices: 0,
        pendingDCs: 0
    });
    
    // New states for confirmation modals
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState({
        type: '', // 'delete_sale', 'move_to_stock', 'delete_invoice', 'delete_dc'
        title: '',
        message: '',
        action: null,
        data: null
    });
    const [moveToStockQty, setMoveToStockQty] = useState('');

    useEffect(() => {
        loadSalesWithDCInfo();
        loadInvoiceItems();
        loadDCItems();
        calculateStats();
    }, [sales]);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredSales(salesWithDCInfo);
        } else {
            const filtered = salesWithDCInfo.filter(sale =>
                sale.BareCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sale.PartNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sale.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredSales(filtered);
        }
    }, [salesWithDCInfo, searchTerm]);

    const calculateStats = () => {
        const totalSales = sales.reduce((sum, sale) => sum + (parseFloat(sale.moveQuantity) || 0), 0);
        const totalValue = sales.reduce((sum, sale) => sum + ((parseFloat(sale.price) || 0) * (parseFloat(sale.moveQuantity) || 0)), 0);
        const pendingInvoices = salesWithDCInfo.filter(s => s.remainingInvoiceQuantity > 0).length;
        const pendingDCs = salesWithDCInfo.filter(s => s.remainingDCQuantity > 0).length;
        
        setStats({
            totalSales,
            totalValue,
            pendingInvoices,
            pendingDCs
        });
    };

    const loadSalesWithDCInfo = async () => {
        try {
            setLoading(prev => ({ ...prev, general: true }));

            // Get all DC items grouped by variant_id with decimal support
            const { data: dcItemsData, error: dcError } = await supabase
                .from('delivery_chalan_items')
                .select('variant_id, quantity');

            if (dcError) throw dcError;

            // Get all Invoice items grouped by variant_id with decimal support
            const { data: invoiceItemsData, error: invoiceError } = await supabase
                .from('invoice_items')
                .select('variant_id, quantity');

            if (invoiceError) throw invoiceError;

            // Calculate total DC quantity per variant with decimal support
            const dcQuantityMap = {};
            if (dcItemsData) {
                dcItemsData.forEach(item => {
                    const variantId = item.variant_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    if (!dcQuantityMap[variantId]) {
                        dcQuantityMap[variantId] = 0;
                    }
                    dcQuantityMap[variantId] += quantity;
                });
            }
            setDcQuantities(dcQuantityMap);

            // Calculate total Invoice quantity per variant with decimal support
            const invoiceQuantityMap = {};
            if (invoiceItemsData) {
                invoiceItemsData.forEach(item => {
                    const variantId = item.variant_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    if (!invoiceQuantityMap[variantId]) {
                        invoiceQuantityMap[variantId] = 0;
                    }
                    invoiceQuantityMap[variantId] += quantity;
                });
            }
            setInvoiceQuantities(invoiceQuantityMap);

            const salesWithInfo = sales.map(sale => {
                const variantId = sale.variantId;
                const totalDCQuantity = dcQuantityMap[variantId] || 0;
                const totalInvoiceQuantity = invoiceQuantityMap[variantId] || 0;
                const saleQuantity = parseFloat(sale.moveQuantity) || 0;
                
                // Calculate remaining quantities
                const remainingInvoiceQuantity = Math.max(0, saleQuantity - totalInvoiceQuantity);
                const remainingDCQuantity = Math.max(0, saleQuantity - totalDCQuantity);
                
                return {
                    ...sale,
                    dcQuantity: totalDCQuantity,
                    invoiceQuantity: totalInvoiceQuantity,
                    remainingDCQuantity: remainingDCQuantity,
                    remainingInvoiceQuantity: remainingInvoiceQuantity,
                    isFullyInDC: totalDCQuantity >= saleQuantity,
                    isFullyInInvoice: totalInvoiceQuantity >= saleQuantity,
                    isPartiallyInDC: totalDCQuantity > 0 && totalDCQuantity < saleQuantity,
                    isPartiallyInInvoice: totalInvoiceQuantity > 0 && totalInvoiceQuantity < saleQuantity
                };
            });
            
            setSalesWithDCInfo(salesWithInfo);
            
            // Initialize DC and Invoice item quantities with remaining quantities
            const initialDCQuantities = {};
            const initialInvoiceQuantities = {};
            
            salesWithInfo.forEach(sale => {
                if (sale.remainingDCQuantity > 0) {
                    initialDCQuantities[sale.id] = sale.remainingDCQuantity;
                }
                if (sale.remainingInvoiceQuantity > 0) {
                    initialInvoiceQuantities[sale.id] = sale.remainingInvoiceQuantity;
                }
            });
            
            setDCItemQuantities(initialDCQuantities);
            setInvoiceItemQuantities(initialInvoiceQuantities);
        } catch (error) {
            console.error('Error loading sales with DC info:', error);
            toast.error('Error loading sales data: ' + error.message);
        } finally {
            setLoading(prev => ({ ...prev, general: false }));
        }
    };

    const loadInvoiceItems = async () => {
        try {
            const { data, error } = await supabase
                .from('invoice_items')
                .select(`
                    *,
                    stock_variants!inner (
                        bare_code,
                        price
                    ),
                    invoices!inner (
                        invoice_number,
                        customer_name,
                        customer_address,
                        customer_phone,
                        customer_gst,
                        invoice_date,
                        invoice_time,
                        total_amount,
                        status
                    )
                `)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setInvoiceItems(data);
            }
        } catch (error) {
            console.error('Error loading invoice items:', error);
        }
    };

    const loadDCItems = async () => {
        try {
            const { data, error } = await supabase
                .from('delivery_chalan_items')
                .select(`
                    *,
                    stock_variants!inner (
                        bare_code,
                        price
                    ),
                    delivery_chalans!inner (
                        dc_number,
                        customer_name,
                        customer_address,
                        customer_phone,
                        customer_gst,
                        dc_date,
                        dc_time,
                        status
                    )
                `)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setDCItems(data);
            }
        } catch (error) {
            console.error('Error loading DC items:', error);
        }
    };

    // Show confirmation modal
    const showConfirmation = (type, data = null, title = '', message = '') => {
        let modalTitle = '';
        let modalMessage = '';
        let action = null;

        switch(type) {
            case 'delete_sale':
                modalTitle = 'Delete Sale Permanently';
                modalMessage = `Are you sure you want to permanently delete this sale?\n\nProduct: ${data.name}\nQuantity: ${data.moveQuantity}\nThis action cannot be undone and stock will NOT be restored.`;
                action = () => deleteSale(data.id);
                break;
            case 'move_to_stock':
                modalTitle = 'Move Back to Stock';
                modalMessage = `How much quantity do you want to move back to stock?\n\nProduct: ${data.name}\nAvailable in Sale: ${data.moveQuantity} units\n\nEnter quantity to move:`;
                action = () => moveSaleBackToStock(data, parseFloat(moveToStockQty) || 0);
                break;
            case 'delete_invoice':
                modalTitle = 'Delete Invoice';
                modalMessage = `Are you sure you want to delete invoice ${data.invoice_number}?\n\nCustomer: ${data.customer_name}\nAmount: ₹${data.total_amount}\nThis action cannot be undone.`;
                action = () => deleteInvoice(data.id);
                break;
            case 'delete_dc':
                modalTitle = 'Delete Delivery Chalan';
                modalMessage = `Are you sure you want to delete delivery chalan ${data.dc_number || data.customer_name}?\n\nThis action cannot be undone.`;
                action = () => deleteDC(data.id);
                break;
            default:
                return;
        }

        setConfirmModalData({
            type,
            title: title || modalTitle,
            message: message || modalMessage,
            action,
            data
        });
        setShowConfirmModal(true);
        if (type === 'move_to_stock') {
            setMoveToStockQty(data.moveQuantity);
        }
    };

    // Handle confirmation action
    const handleConfirmAction = async () => {
        if (confirmModalData.action) {
            try {
                await confirmModalData.action();
                toast.success('Action completed successfully!');
            } catch (error) {
                toast.error('Error performing action: ' + error.message);
            }
        }
        setShowConfirmModal(false);
        setMoveToStockQty('');
    };

    // Delete sale - permanently remove from sales (WITHOUT restoring stock)
    const deleteSale = async (saleId) => {
        try {
            setLoading(prev => ({ ...prev, delete: true }));

            // Simply delete the sale - do NOT restore stock quantities
            const { error: deleteError } = await supabase
                .from('sales')
                .delete()
                .eq('id', saleId);

            if (deleteError) throw deleteError;

            toast.success('Sale permanently deleted!');
            
            // Reload data
            await Promise.all([
                reloadModuleData('sales'),
                loadSalesWithDCInfo()
            ]);
            
        } catch (error) {
            console.error('Error deleting sale:', error);
            toast.error('Error deleting sale: ' + error.message);
        } finally {
            setLoading(prev => ({ ...prev, delete: false }));
        }
    };

    // Move sale back to stock - with decimal support
    const moveSaleBackToStock = async (sale, quantityToMove = null) => {
        const qty = quantityToMove || parseFloat(moveToStockQty) || parseFloat(sale.moveQuantity) || 0;
        
        if (qty <= 0) {
            toast.error('Please enter a valid quantity to move back');
            return;
        }

        if (qty > parseFloat(sale.moveQuantity)) {
            toast.error(`Cannot move more than available quantity (${sale.moveQuantity})`);
            return;
        }

        try {
            setLoading(prev => ({ ...prev, moveToStock: true }));

            // Find variant by barcode
            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('bare_code', sale.BareCode)
                .single()

            if (variantError) {
                toast.error(`Variant with barcode ${sale.BareCode} not found!`)
                return
            }

            // Calculate new quantities with decimal support
            const currentUsingQty = parseFloat(variant.using_quantity) || 0;
            const currentAvailableQty = parseFloat(variant.quantity) || 0;
            
            if (currentUsingQty < qty) {
                toast.error(`Cannot move back ${qty.toFixed(2)}. Only ${currentUsingQty.toFixed(2)} is in use.`);
                return;
            }

            const newVariantUsing = currentUsingQty - qty;
            const newVariantQty = currentAvailableQty + qty;

            // Update variant quantities
            const { error: updateVariantError } = await supabase
                .from('stock_variants')
                .update({
                    using_quantity: newVariantUsing,
                    quantity: newVariantQty,
                    updated_at: new Date().toISOString()
                })
                .eq('id', variant.id)

            if (updateVariantError) throw updateVariantError;

            // Record stock movement
            await supabase
                .from('stock_movements')
                .insert([{
                    variant_id: variant.id,
                    movement_type: 'in',
                    quantity: qty,
                    remaining_quantity: newVariantQty,
                    reference_type: 'sales_return',
                    reference_id: sale.id,
                    movement_date: new Date().toISOString()
                }])

            // Update stock totals
            const { data: allVariants, error: variantsError } = await supabase
                .from('stock_variants')
                .select('quantity, using_quantity, pending_testing, price')
                .eq('stock_id', variant.stock_id)

            if (!variantsError && allVariants) {
                let totalQuantity = 0;
                let totalUsingQuantity = 0;
                let totalTestingBalance = 0;
                let totalValue = 0;
                let totalReceived = 0;

                allVariants.forEach(v => {
                    const qty = parseFloat(v.quantity) || 0;
                    const using = parseFloat(v.using_quantity) || 0;
                    const pending = parseFloat(v.pending_testing) || 0;
                    const price = parseFloat(v.price) || 0;

                    totalQuantity += qty;
                    totalUsingQuantity += using;
                    totalTestingBalance += pending;
                    totalValue += (qty + using + pending) * price;
                    totalReceived += qty + using + pending;
                });

                const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0;

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

            // Update or delete sale record
            const saleQuantity = parseFloat(sale.moveQuantity) || 0;
            const remainingQuantity = saleQuantity - qty;
            
            if (remainingQuantity <= 0) {
                // Delete sale if all quantity moved back
                const { error: deleteError } = await supabase
                    .from('sales')
                    .delete()
                    .eq('id', sale.id)

                if (deleteError) throw deleteError;
            } else {
                // Update sale with remaining quantity
                const { error: updateSaleError } = await supabase
                    .from('sales')
                    .update({
                        move_quantity: remainingQuantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', sale.id)

                if (updateSaleError) throw updateSaleError;
            }

            toast.success(`Moved ${qty.toFixed(2)} ${sale.name} back to stock`);
            
            // Reload data
            await Promise.all([
                reloadModuleData('sales'),
                reloadModuleData('stocks'),
                loadSalesWithDCInfo()
            ]);
            
        } catch (error) {
            console.error('Error moving back to stock:', error);
            toast.error('Error moving back to stock: ' + error.message);
        } finally {
            setLoading(prev => ({ ...prev, moveToStock: false }));
            setMoveToStockQty('');
        }
    };

    const handleInvoiceCheckboxChange = (sale, checked) => {
        if (checked) {
            setSelectedSalesForInvoice(prev => [...prev, sale]);
        } else {
            setSelectedSalesForInvoice(prev => prev.filter(s => s.id !== sale.id));
            setInvoiceItemQuantities(prev => {
                const newState = { ...prev };
                delete newState[sale.id];
                return newState;
            });
        }
    };

    const handleDCCheckboxChange = (sale, checked) => {
        if (checked) {
            setSelectedSalesForDC(prev => [...prev, sale]);
        } else {
            setSelectedSalesForDC(prev => prev.filter(s => s.id !== sale.id));
            setDCItemQuantities(prev => {
                const newState = { ...prev };
                delete newState[sale.id];
                return newState;
            });
        }
    };

    // Handle decimal quantity changes
    const handleQuantityChange = (value, field, saleId, maxQuantity) => {
        // Allow decimal values
        const sanitizedValue = value.replace(/[^0-9.]/g, '');
        const parts = sanitizedValue.split('.');
        
        if (parts.length > 2) return;
        
        // Limit to 2 decimal places
        let finalValue = sanitizedValue;
        if (parts[1] && parts[1].length > 2) {
            finalValue = parts[0] + '.' + parts[1].substring(0, 2);
        }
        
        const parsedValue = parseFloat(finalValue) || 0;
        const maxQty = parseFloat(maxQuantity) || 0;
        const clampedValue = Math.min(Math.max(0.01, parsedValue), maxQty);
        
        if (field === 'invoice') {
            setInvoiceItemQuantities(prev => ({
                ...prev,
                [saleId]: clampedValue
            }));
        } else if (field === 'dc') {
            setDCItemQuantities(prev => ({
                ...prev,
                [saleId]: clampedValue
            }));
        }
    };

    // Create Invoice with decimal support - CORRECTED STOCK REDUCTION
const createInvoice = async () => {
    if (selectedSalesForInvoice.length === 0) {
        toast.error('Please select at least one sale item for invoice!');
        return;
    }

    if (!invoiceForm.invoice_number.trim() || !invoiceForm.customer_name.trim()) {
        toast.error('Please fill invoice number and customer name!');
        return;
    }

    try {
        setLoading(prev => ({ ...prev, invoice: true }));

        // Check for duplicate invoice number
        const { data: existingInvoice, error: checkError } = await supabase
            .from('invoices')
            .select('id')
            .eq('invoice_number', invoiceForm.invoice_number.trim())
            .single();

        if (existingInvoice && !checkError) {
            toast.error('Invoice number already exists!');
            setLoading(prev => ({ ...prev, invoice: false }));
            return;
        }

        // Calculate total amount and prepare items
        let totalAmount = 0;
        const invoiceItemsToInsert = [];
        const stockUpdates = [];

        for (const sale of selectedSalesForInvoice) {
            const saleInfo = salesWithDCInfo.find(s => s.id === sale.id);
            const quantity = parseFloat(invoiceItemQuantities[sale.id]) || parseFloat(saleInfo?.remainingInvoiceQuantity || sale.moveQuantity);
            
            if (quantity <= 0) {
                toast.error(`Invalid quantity for ${sale.name}`);
                continue;
            }

            // Find variant to get actual price
            const { data: variantData, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('bare_code', sale.BareCode)
                .single();

            if (!variantError && variantData) {
                // Use variant price
                const variantPrice = parseFloat(variantData.price) || parseFloat(sale.price) || 0;
                const itemTotal = variantPrice * quantity;
                totalAmount += itemTotal;
                
                // Add to invoice items
                invoiceItemsToInsert.push({
                    invoice_id: null, // Will be set after invoice creation
                    stock_id: sale.stockId,
                    variant_id: variantData.id,
                    bare_code: sale.BareCode,
                    part_no: sale.PartNo,
                    product_name: sale.name,
                    price: variantPrice,
                    quantity: quantity,
                    total_price: itemTotal
                });

                // Store stock update information
                stockUpdates.push({
                    variantId: variantData.id,
                    quantity: quantity,
                    stockId: sale.stockId,
                    currentUsingQty: parseFloat(variantData.using_quantity) || 0,
                    currentAvailableQty: parseFloat(variantData.quantity) || 0
                });

            } else {
                toast.error(`Variant not found for ${sale.name}`);
            }
        }

        if (invoiceItemsToInsert.length === 0) {
            toast.error('No valid items to invoice');
            setLoading(prev => ({ ...prev, invoice: false }));
            return;
        }

        // Create invoice
        const { data: invoiceData, error: invoiceError } = await supabase
            .from('invoices')
            .insert([{
                invoice_number: invoiceForm.invoice_number.trim(),
                customer_name: invoiceForm.customer_name.trim(),
                customer_address: invoiceForm.customer_address.trim(),
                customer_phone: invoiceForm.customer_phone.trim(),
                customer_gst: invoiceForm.customer_gst.trim(),
                invoice_date: new Date().toLocaleDateString(),
                invoice_time: new Date().toLocaleTimeString(),
                total_amount: totalAmount,
                status: 'completed'
            }])
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // Update invoice items with invoice ID
        const finalInvoiceItems = invoiceItemsToInsert.map(item => ({
            ...item,
            invoice_id: invoiceData.id
        }));

        // Insert invoice items
        const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(finalInvoiceItems);

        if (itemsError) throw itemsError;

        // CORRECTED: Reduce stock ONLY from using_quantity (not from quantity)
        for (const update of stockUpdates) {
            const newVariantUsing = Math.max(0, update.currentUsingQty - update.quantity);

            // Update variant - reduce ONLY from using_quantity
            const { error: updateVariantError } = await supabase
                .from('stock_variants')
                .update({
                    using_quantity: newVariantUsing,
                    updated_at: new Date().toISOString()
                })
                .eq('id', update.variantId);

            if (updateVariantError) throw updateVariantError;

            // Record stock movement
            await supabase
                .from('stock_movements')
                .insert([{
                    variant_id: update.variantId,
                    movement_type: 'out',
                    quantity: update.quantity,
                    remaining_quantity: update.currentAvailableQty, // Available quantity remains same
                    reference_type: 'invoice',
                    reference_id: invoiceData.id,
                    movement_date: new Date().toISOString()
                }]);

            // Update stock totals - Get ALL variants for correct calculation
            const { data: allVariants, error: variantsError } = await supabase
                .from('stock_variants')
                .select('quantity, using_quantity, pending_testing, price')
                .eq('stock_id', update.stockId)

            if (!variantsError && allVariants) {
                let totalQuantity = 0;
                let totalUsingQuantity = 0;
                let totalTestingBalance = 0;
                let totalValue = 0;
                let totalReceived = 0;

                allVariants.forEach(v => {
                    const qty = parseFloat(v.quantity) || 0;
                    const using = parseFloat(v.using_quantity) || 0;
                    const pending = parseFloat(v.pending_testing) || 0;
                    const price = parseFloat(v.price) || 0;

                    totalQuantity += qty;
                    totalUsingQuantity += using;
                    totalTestingBalance += pending;
                    totalValue += (qty + using + pending) * price;
                    totalReceived += qty + using + pending;
                });

                const averagePrice = totalReceived > 0 ? totalValue / totalReceived : 0;

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
                    .eq('id', update.stockId)
            }
        }

        // Update sales quantities
        for (const sale of selectedSalesForInvoice) {
            const quantity = parseFloat(invoiceItemQuantities[sale.id]) || parseFloat(sale.moveQuantity);
            const saleQuantity = parseFloat(sale.moveQuantity) || 0;
            const remainingQuantity = saleQuantity - quantity;
            
            if (remainingQuantity <= 0) {
                // Delete sale if all quantity invoiced
                const { error: deleteError } = await supabase
                    .from('sales')
                    .delete()
                    .eq('id', sale.id);

                if (deleteError) throw deleteError;
            } else {
                // Update sale with remaining quantity
                const { error: updateSaleError } = await supabase
                    .from('sales')
                    .update({
                        move_quantity: remainingQuantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', sale.id);

                if (updateSaleError) throw updateSaleError;
            }
        }

        toast.success(`Invoice ${invoiceForm.invoice_number} created successfully!`);
        
        // Reset form and selections
        setInvoiceForm({
            invoice_number: "",
            customer_name: "",
            customer_address: "",
            customer_phone: "",
            customer_gst: ""
        });
        setSelectedSalesForInvoice([]);
        setInvoiceItemQuantities({});
        setShowInvoiceModal(false);
        
        // Reload all data
        await Promise.all([
            reloadModuleData('sales'),
            reloadModuleData('stocks'),
            loadInvoiceItems(),
            loadSalesWithDCInfo()
        ]);
        
        // Load updated invoices list
        const { data: updatedInvoices, error: loadError } = await supabase
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false });

        if (!loadError && updatedInvoices) {
            setInvoices(updatedInvoices);
        }

    } catch (error) {
        console.error('Error creating invoice:', error);
        toast.error('Error creating invoice: ' + error.message);
    } finally {
        setLoading(prev => ({ ...prev, invoice: false }));
    }
};

    // Create Delivery Chalan - WITHOUT stock reduction
    const createDeliveryChalan = async () => {
        if (selectedSalesForDC.length === 0) {
            toast.error('Please select at least one sale item for delivery chalan!');
            return;
        }

        if (!dcForm.customer_name.trim()) {
            toast.error('Please fill customer name!');
            return;
        }

        try {
            setLoading(prev => ({ ...prev, dc: true }));

            // Check for duplicate DC number if provided
            if (dcForm.dc_number.trim()) {
                const { data: existingDC, error: checkError } = await supabase
                    .from('delivery_chalans')
                    .select('id')
                    .eq('dc_number', dcForm.dc_number.trim())
                    .single();

                if (existingDC && !checkError) {
                    toast.error('DC number already exists!');
                    setLoading(prev => ({ ...prev, dc: false }));
                    return;
                }
            }

            const dcNumber = dcForm.dc_number.trim() || `DC-${Date.now().toString().slice(-8)}`;
            
            // Create delivery chalan
            const { data: dcData, error: dcError } = await supabase
                .from('delivery_chalans')
                .insert([{
                    dc_number: dcNumber,
                    customer_name: dcForm.customer_name.trim(),
                    customer_address: dcForm.customer_address.trim(),
                    customer_phone: dcForm.customer_phone.trim(),
                    customer_gst: dcForm.customer_gst.trim(),
                    dc_date: new Date().toLocaleDateString(),
                    dc_time: new Date().toLocaleTimeString(),
                    status: 'pending'
                }])
                .select()
                .single();

            if (dcError) throw dcError;

            // Create DC items
            const dcItemsToInsert = [];

            for (const sale of selectedSalesForDC) {
                const saleInfo = salesWithDCInfo.find(s => s.id === sale.id);
                const quantity = parseFloat(dcItemQuantities[sale.id]) || parseFloat(saleInfo?.remainingDCQuantity || sale.moveQuantity);
                
                if (quantity <= 0) {
                    continue;
                }

                // Find variant to get actual price
                const { data: variantData, error: variantError } = await supabase
                    .from('stock_variants')
                    .select('*')
                    .eq('bare_code', sale.BareCode)
                    .single();

                if (!variantError && variantData) {
                    const variantPrice = parseFloat(variantData.price) || parseFloat(sale.price) || 0;
                    
                    dcItemsToInsert.push({
                        dc_id: dcData.id,
                        stock_id: sale.stockId,
                        variant_id: variantData.id,
                        bare_code: sale.BareCode,
                        part_no: sale.PartNo,
                        product_name: sale.name,
                        price: variantPrice,
                        quantity: quantity
                    });

                    // Note: Do NOT update stock quantities when creating DC
                }
            }

            if (dcItemsToInsert.length === 0) {
                toast.error('No valid items for delivery chalan');
                // Delete the empty DC record
                await supabase
                    .from('delivery_chalans')
                    .delete()
                    .eq('id', dcData.id);
                setLoading(prev => ({ ...prev, dc: false }));
                return;
            }

            // Insert DC items
            const { error: itemsError } = await supabase
                .from('delivery_chalan_items')
                .insert(dcItemsToInsert);

            if (itemsError) throw itemsError;

            toast.success(`Delivery Chalan ${dcNumber} created successfully!`);
            
            // Reset form and selections
            setDcForm({
                dc_number: "",
                customer_name: "",
                customer_address: "",
                customer_phone: "",
                customer_gst: ""
            });
            setSelectedSalesForDC([]);
            setDCItemQuantities({});
            setShowDCModal(false);
            
            // Reload DC data
            await Promise.all([
                loadDCItems(),
                loadSalesWithDCInfo()
            ]);
            
            // Load updated DC list
            const { data: updatedDCs, error: loadError } = await supabase
                .from('delivery_chalans')
                .select('*')
                .order('created_at', { ascending: false });

            if (!loadError && updatedDCs) {
                setDeliveryChalans(updatedDCs);
            }

        } catch (error) {
            console.error('Error creating delivery chalan:', error);
            toast.error('Error creating delivery chalan: ' + error.message);
        } finally {
            setLoading(prev => ({ ...prev, dc: false }));
        }
    };

    const viewInvoiceDetails = async (invoice) => {
        try {
            const { data: items, error } = await supabase
                .from('invoice_items')
                .select(`
                    *,
                    stock_variants!inner (
                        bare_code,
                        price
                    )
                `)
                .eq('invoice_id', invoice.id);

            if (!error && items) {
                setSelectedInvoice({ ...invoice, items });
            } else {
                setSelectedInvoice(invoice);
            }
        } catch (error) {
            console.error('Error loading invoice details:', error);
            toast.error('Error loading invoice details');
        }
    };

    const viewDCDetails = async (dc) => {
        try {
            const { data: items, error } = await supabase
                .from('delivery_chalan_items')
                .select(`
                    *,
                    stock_variants!inner (
                        bare_code,
                        price
                    )
                `)
                .eq('dc_id', dc.id);

            if (!error && items) {
                setSelectedDC({ ...dc, items });
            } else {
                setSelectedDC(dc);
            }
        } catch (error) {
            console.error('Error loading DC details:', error);
            toast.error('Error loading DC details');
        }
    };

    const editInvoice = (invoice) => {
        setInvoiceForm({
            invoice_number: invoice.invoice_number,
            customer_name: invoice.customer_name,
            customer_address: invoice.customer_address || "",
            customer_phone: invoice.customer_phone || "",
            customer_gst: invoice.customer_gst || ""
        });
        setSelectedInvoice(invoice);
        setShowInvoiceModal(true);
    };

    const updateInvoice = async () => {
        if (!selectedInvoice) return;

        try {
            const { error } = await supabase
                .from('invoices')
                .update({
                    customer_name: invoiceForm.customer_name.trim(),
                    customer_address: invoiceForm.customer_address.trim(),
                    customer_phone: invoiceForm.customer_phone.trim(),
                    customer_gst: invoiceForm.customer_gst.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedInvoice.id);

            if (error) throw error;

            toast.success('Invoice updated successfully!');
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
            setInvoiceForm({
                invoice_number: "",
                customer_name: "",
                customer_address: "",
                customer_phone: "",
                customer_gst: ""
            });
            
            const { data: updatedInvoices, error: loadError } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (!loadError && updatedInvoices) {
                setInvoices(updatedInvoices);
            }
        } catch (error) {
            toast.error('Error updating invoice: ' + error.message);
        }
    };

    const editDC = (dc) => {
        setDcForm({
            dc_number: dc.dc_number || "",
            customer_name: dc.customer_name,
            customer_address: dc.customer_address || "",
            customer_phone: dc.customer_phone || "",
            customer_gst: dc.customer_gst || ""
        });
        setSelectedDC(dc);
        setShowDCModal(true);
    };

    const updateDC = async () => {
        if (!selectedDC) return;

        try {
            const updateData = {
                customer_name: dcForm.customer_name.trim(),
                customer_address: dcForm.customer_address.trim(),
                customer_phone: dcForm.customer_phone.trim(),
                customer_gst: dcForm.customer_gst.trim(),
                updated_at: new Date().toISOString()
            };

            if (dcForm.dc_number.trim() && dcForm.dc_number.trim() !== selectedDC.dc_number) {
                const { data: existingDC, error: checkError } = await supabase
                    .from('delivery_chalans')
                    .select('id')
                    .eq('dc_number', dcForm.dc_number.trim())
                    .neq('id', selectedDC.id)
                    .single();

                if (existingDC && !checkError) {
                    toast.error('DC number already exists!');
                    return;
                }
                updateData.dc_number = dcForm.dc_number.trim();
            }

            const { error } = await supabase
                .from('delivery_chalans')
                .update(updateData)
                .eq('id', selectedDC.id);

            if (error) throw error;

            toast.success('Delivery Chalan updated successfully!');
            setShowDCModal(false);
            setSelectedDC(null);
            setDcForm({
                dc_number: "",
                customer_name: "",
                customer_address: "",
                customer_phone: "",
                customer_gst: ""
            });
            
            const { data: updatedDCs, error: loadError } = await supabase
                .from('delivery_chalans')
                .select('*')
                .order('created_at', { ascending: false });

            if (!loadError && updatedDCs) {
                setDeliveryChalans(updatedDCs);
            }
        } catch (error) {
            toast.error('Error updating delivery chalan: ' + error.message);
        }
    };

    // Delete invoice permanently - WITHOUT restoring stock
    const deleteInvoice = async (invoiceId) => {
        try {
            setLoading(prev => ({ ...prev, delete: true }));

            // First delete all invoice items
            const { error: deleteItemsError } = await supabase
                .from('invoice_items')
                .delete()
                .eq('invoice_id', invoiceId);

            if (deleteItemsError) throw deleteItemsError;

            // Then delete the invoice
            const { error: deleteInvoiceError } = await supabase
                .from('invoices')
                .delete()
                .eq('id', invoiceId);

            if (deleteInvoiceError) throw deleteInvoiceError;

            toast.success('Invoice permanently deleted!');
            
            // Reload invoice data
            await Promise.all([
                loadInvoiceItems(),
                loadSalesWithDCInfo()
            ]);
            
            // Load updated invoices list
            const { data: updatedInvoices, error: loadError } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (!loadError && updatedInvoices) {
                setInvoices(updatedInvoices);
            }

        } catch (error) {
            console.error('Error deleting invoice:', error);
            toast.error('Error deleting invoice: ' + error.message);
        } finally {
            setLoading(prev => ({ ...prev, delete: false }));
        }
    };

    // Delete DC permanently - WITHOUT restoring sales
    const deleteDC = async (dcId) => {
        try {
            setLoading(prev => ({ ...prev, delete: true }));

            // First delete all DC items
            const { error: deleteItemsError } = await supabase
                .from('delivery_chalan_items')
                .delete()
                .eq('dc_id', dcId);

            if (deleteItemsError) throw deleteItemsError;

            // Then delete the DC
            const { error: deleteDCError } = await supabase
                .from('delivery_chalans')
                .delete()
                .eq('id', dcId);

            if (deleteDCError) throw deleteDCError;

            toast.success('Delivery Chalan permanently deleted!');
            
            // Reload DC data
            await Promise.all([
                loadDCItems(),
                loadSalesWithDCInfo()
            ]);
            
            // Load updated DC list
            const { data: updatedDCs, error: loadError } = await supabase
                .from('delivery_chalans')
                .select('*')
                .order('created_at', { ascending: false });

            if (!loadError && updatedDCs) {
                setDeliveryChalans(updatedDCs);
            }

        } catch (error) {
            console.error('Error deleting delivery chalan:', error);
            toast.error('Error deleting delivery chalan: ' + error.message);
        } finally {
            setLoading(prev => ({ ...prev, delete: false }));
        }
    };

    // Simple Print Invoice
    const printInvoice = (invoice) => {
        const items = invoice.items || invoiceItems.filter(item => item.invoice_id === invoice.id);
        const totalAmount = invoice.total_amount || items.reduce((sum, item) => sum + (item.total_price || item.price * item.quantity), 0);
        
        const printWindow = window.open('', '_blank');
        const printContent = `
            <html>
                <head>
                    <title>Invoice - ${invoice.invoice_number}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .company-info { margin-bottom: 30px; }
                        .customer-info { margin-bottom: 30px; }
                        .invoice-details { margin-bottom: 30px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .total { text-align: right; font-weight: bold; margin-top: 20px; }
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; }
                        .signature { margin-top: 50px; }
                        .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 30px; }
                        @media print {
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>TAX INVOICE</h1>
                        <h2>${invoice.invoice_number}</h2>
                    </div>
                    
                    <div class="company-info">
                        <h3>FROM:</h3>
                        <p><strong>Your Company Name</strong></p>
                        <p>123 Business Street, City, State 12345</p>
                        <p>Phone: (123) 456-7890 | GST: 27ABCDE1234F1Z5</p>
                    </div>
                    
                    <div class="customer-info">
                        <h3>BILL TO:</h3>
                        <p><strong>${invoice.customer_name}</strong></p>
                        <p>${invoice.customer_address || 'Address not specified'}</p>
                        <p>${invoice.customer_phone ? `Phone: ${invoice.customer_phone}` : ''}</p>
                        <p>${invoice.customer_gst ? `GST: ${invoice.customer_gst}` : ''}</p>
                    </div>
                    
                    <div class="invoice-details">
                        <p><strong>Invoice Date:</strong> ${invoice.invoice_date}</p>
                        <p><strong>Invoice Time:</strong> ${invoice.invoice_time}</p>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product Description</th>
                                <th>Part No</th>
                                <th>Barcode</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.product_name}</td>
                                    <td>${item.part_no}</td>
                                    <td>${item.bare_code}</td>
                                    <td>${parseFloat(item.quantity).toFixed(2)}</td>
                                    <td>₹${parseFloat(item.price).toFixed(2)}</td>
                                    <td>₹${parseFloat(item.total_price || item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="total">
                        <h3>Total Amount: ₹${parseFloat(totalAmount).toFixed(2)}</h3>
                    </div>
                    
                    <div class="signature">
                        <p>Authorized Signature</p>
                        <div class="signature-line"></div>
                    </div>
                    
                    <div class="footer">
                        <p>This is a computer generated invoice and does not require a signature.</p>
                        <p>Thank you for your business!</p>
                    </div>
                    
                    <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; margin: 20px;">
                        Print Invoice
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; cursor: pointer; margin: 20px;">
                        Close Window
                    </button>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    // Simple Print DC
    const printDC = (dc) => {
        const items = dc.items || dcItems.filter(item => item.dc_id === dc.id);
        
        const printWindow = window.open('', '_blank');
        const printContent = `
            <html>
                <head>
                    <title>Delivery Chalan - ${dc.dc_number || 'N/A'}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .company-info { margin-bottom: 30px; }
                        .customer-info { margin-bottom: 30px; }
                        .dc-details { margin-bottom: 30px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .signature { margin-top: 50px; }
                        .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 30px; }
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; }
                        @media print {
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>DELIVERY CHALAN</h1>
                        <h2>${dc.dc_number || 'N/A'}</h2>
                    </div>
                    
                    <div class="company-info">
                        <h3>FROM:</h3>
                        <p><strong>Your Company Name</strong></p>
                        <p>123 Business Street, City, State 12345</p>
                        <p>Phone: (123) 456-7890</p>
                    </div>
                    
                    <div class="customer-info">
                        <h3>DELIVER TO:</h3>
                        <p><strong>${dc.customer_name}</strong></p>
                        <p>${dc.customer_address || 'Address not specified'}</p>
                        <p>${dc.customer_phone ? `Phone: ${dc.customer_phone}` : ''}</p>
                        <p>${dc.customer_gst ? `GST: ${dc.customer_gst}` : ''}</p>
                    </div>
                    
                    <div class="dc-details">
                        <p><strong>DC Date:</strong> ${dc.dc_date}</p>
                        <p><strong>DC Time:</strong> ${dc.dc_time}</p>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product Description</th>
                                <th>Part No</th>
                                <th>Barcode</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.product_name}</td>
                                    <td>${item.part_no}</td>
                                    <td>${item.bare_code}</td>
                                    <td>${parseFloat(item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="signature">
                        <p>Received By:</p>
                        <div class="signature-line"></div>
                    </div>
                    
                    <div class="footer">
                        <p>Please check all items against this delivery chalan.</p>
                        <p>Report any discrepancies within 24 hours of delivery.</p>
                    </div>
                    
                    <button onclick="window.print()" style="padding: 10px 20px; background: #28a745; color: white; border: none; cursor: pointer; margin: 20px;">
                        Print DC
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; cursor: pointer; margin: 20px;">
                        Close Window
                    </button>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    const handleSelectAll = (type) => {
        if (type === 'invoice') {
            if (selectedSalesForInvoice.length === salesWithDCInfo.filter(s => s.remainingInvoiceQuantity > 0).length) {
                setSelectedSalesForInvoice([]);
                setInvoiceItemQuantities({});
            } else {
                const availableSales = salesWithDCInfo.filter(sale => sale.remainingInvoiceQuantity > 0);
                setSelectedSalesForInvoice(availableSales);
                const quantities = {};
                availableSales.forEach(sale => {
                    quantities[sale.id] = sale.remainingInvoiceQuantity;
                });
                setInvoiceItemQuantities(quantities);
            }
        } else if (type === 'dc') {
            if (selectedSalesForDC.length === salesWithDCInfo.filter(s => s.remainingDCQuantity > 0).length) {
                setSelectedSalesForDC([]);
                setDCItemQuantities({});
            } else {
                const availableSales = salesWithDCInfo.filter(sale => sale.remainingDCQuantity > 0);
                setSelectedSalesForDC(availableSales);
                const quantities = {};
                availableSales.forEach(sale => {
                    quantities[sale.id] = sale.remainingDCQuantity;
                });
                setDCItemQuantities(quantities);
            }
        }
    };

    return(
        <div className="container-fluid px-lg-4 px-md-3 px-2 py-3 sales-container">
            {/* Loading Overlay */}
            {loading.general && (
                <div className="loading-overlay">
                    <div className="spinner-border text-light" style={{width: '3rem', height: '3rem'}}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="row mb-4 align-items-center">
                <div className="col-lg-8 col-md-6 mb-3 mb-md-0">
                    <h1 className="display-6 fw-bold text-primary mb-2">
                        <i className="fa-solid fa-cart-shopping me-2"></i>
                        Sales Management
                    </h1>
                    <p className="text-muted mb-0">Manage sales, invoices, and delivery chalans</p>
                </div>
                <div className="col-lg-4 col-md-6">
                    <div className="d-flex flex-wrap gap-2 justify-content-md-end">
                        <button 
                            className="btn btn-success btn-lg shadow-sm"
                            onClick={() => setShowInvoiceModal(true)}
                            disabled={selectedSalesForInvoice.length === 0}
                        >
                            <i className="fa-solid fa-file-invoice me-2"></i>
                            Invoice ({selectedSalesForInvoice.length})
                        </button>
                        <button 
                            className="btn btn-warning btn-lg shadow-sm"
                            onClick={() => setShowDCModal(true)}
                            disabled={selectedSalesForDC.length === 0}
                        >
                            <i className="fa-solid fa-truck me-2"></i>
                            DC ({selectedSalesForDC.length})
                        </button>
                        <button 
                            className="btn btn-outline-info btn-lg shadow-sm"
                            onClick={() => reloadModuleData('sales')}
                        >
                            <i className="fa-solid fa-rotate me-2"></i>
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body p-3">
                            <div className="input-group input-group-lg">
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="fa-solid fa-magnifying-glass text-primary"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder="Search by Barcode, Part No, Product Name, Customer..."
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
                </div>
            </div>

            {/* Stats Cards */}
            <div className="row mb-4 g-3">
                <div className="col-xl-3 col-lg-6 col-md-6 col-12">
                    <div className="card dashboard-card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="card-subtitle mb-2 text-muted">Total Sales</h6>
                                    <h2 className="card-title mb-0">{stats.totalSales.toFixed(2)}</h2>
                                    <small className="text-muted">Units</small>
                                </div>
                                <div className="dashboard-icon bg-primary">
                                    <i className="fa-solid fa-chart-line"></i>
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
                                    <h6 className="card-subtitle mb-2 text-muted">Total Value</h6>
                                    <h2 className="card-title mb-0">₹{stats.totalValue.toFixed(2)}</h2>
                                    <small className="text-muted">Amount</small>
                                </div>
                                <div className="dashboard-icon bg-success">
                                    <i className="fa-solid fa-indian-rupee-sign"></i>
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
                                    <h6 className="card-subtitle mb-2 text-muted">Pending Invoices</h6>
                                    <h2 className="card-title mb-0">{stats.pendingInvoices}</h2>
                                    <small className="text-muted">Sales ready for invoice</small>
                                </div>
                                <div className="dashboard-icon bg-warning">
                                    <i className="fa-solid fa-file-invoice"></i>
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
                                    <h6 className="card-subtitle mb-2 text-muted">Pending DCs</h6>
                                    <h2 className="card-title mb-0">{stats.pendingDCs}</h2>
                                    <small className="text-muted">Sales ready for delivery</small>
                                </div>
                                <div className="dashboard-icon bg-info">
                                    <i className="fa-solid fa-truck"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Sales Table */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-0 py-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
                        <div>
                            <h5 className="card-title mb-0">
                                <i className="fa-solid fa-list me-2 text-primary"></i>
                                Sales History
                                <span className="badge bg-primary ms-2">{filteredSales.length} items</span>
                            </h5>
                            <small className="text-muted">
                                Select items for invoice (reduces stock) or delivery chalan (no stock change)
                            </small>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-2 mt-md-0">
                            <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => setShowInvoiceHistory(true)}
                            >
                                <i className="fa-solid fa-history me-1"></i>
                                Invoices ({invoices.length})
                            </button>
                            <button 
                                className="btn btn-outline-warning btn-sm"
                                onClick={() => setShowDCHistory(true)}
                            >
                                <i className="fa-solid fa-history me-1"></i>
                                DCs ({deliveryChalans.length})
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body p-0">
                    {filteredSales.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="fa-solid fa-cart-shopping fa-3x text-muted mb-3"></i>
                            <h5 className="text-muted">No sales found</h5>
                            <p className="text-muted">
                                {searchTerm ? 'Try adjusting your search terms' : 'Products moved to sales will appear here'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="text-center">
                                            <div className="form-check">
                                                <input 
                                                    type="checkbox" 
                                                    className="form-check-input"
                                                    onChange={() => handleSelectAll('invoice')}
                                                    checked={selectedSalesForInvoice.length > 0 && 
                                                            selectedSalesForInvoice.length === filteredSales.filter(s => s.remainingInvoiceQuantity > 0).length}
                                                    disabled={filteredSales.filter(s => s.remainingInvoiceQuantity > 0).length === 0}
                                                />
                                                <small className="d-block mt-1">Invoice</small>
                                                <small className="text-muted d-block">(Reduces Stock)</small>
                                            </div>
                                        </th>
                                        <th className="text-center">
                                            <div className="form-check">
                                                <input 
                                                    type="checkbox" 
                                                    className="form-check-input"
                                                    onChange={() => handleSelectAll('dc')}
                                                    checked={selectedSalesForDC.length > 0 && 
                                                            selectedSalesForDC.length === filteredSales.filter(s => s.remainingDCQuantity > 0).length}
                                                    disabled={filteredSales.filter(s => s.remainingDCQuantity > 0).length === 0}
                                                />
                                                <small className="d-block mt-1">DC</small>
                                                <small className="text-muted d-block">(No Stock Change)</small>
                                            </div>
                                        </th>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Part No</th>
                                        <th>Barcode</th>
                                        <th className="text-end">Price</th>
                                        <th className="text-center">Sold Qty</th>
                                        <th className="text-center">DC Qty</th>
                                        <th className="text-center">Available for Invoice</th>
                                        <th className="text-center">Available for DC</th>
                                        <th>Sale Date</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSales.map((sale, index) => {
                                        const rowClass = sale.isFullyInInvoice ? 'table-success' : 
                                                       sale.isPartiallyInInvoice ? 'table-warning' : '';
                                        return (
                                            <tr key={sale.id} className={rowClass}>
                                                <td className="text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="form-check-input"
                                                        checked={selectedSalesForInvoice.some(s => s.id === sale.id)}
                                                        onChange={(e) => handleInvoiceCheckboxChange(sale, e.target.checked)}
                                                        disabled={sale.remainingInvoiceQuantity <= 0}
                                                    />
                                                </td>
                                                <td className="text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="form-check-input"
                                                        checked={selectedSalesForDC.some(s => s.id === sale.id)}
                                                        onChange={(e) => handleDCCheckboxChange(sale, e.target.checked)}
                                                        disabled={sale.remainingDCQuantity <= 0}
                                                    />
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-dark">{index + 1}</span>
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.name}</strong>
                                                        {sale.isFullyInInvoice && (
                                                            <span className="badge bg-success ms-2">Invoiced</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge bg-secondary">{sale.PartNo}</span>
                                                </td>
                                                <td>
                                                    <code className="fw-bold">{sale.BareCode}</code>
                                                </td>
                                                <td className="text-end">
                                                    <span className="fw-bold">₹{parseFloat(sale.price).toFixed(2)}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-primary">{parseFloat(sale.moveQuantity).toFixed(2)}</span>
                                                </td>
                                                <td className="text-center">
                                                    {sale.dcQuantity > 0 ? (
                                                        <span className="badge bg-warning">{parseFloat(sale.dcQuantity).toFixed(2)}</span>
                                                    ) : (
                                                        <span className="badge bg-light text-dark">0.00</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    {sale.remainingInvoiceQuantity > 0 ? (
                                                        <span className="badge bg-success">{parseFloat(sale.remainingInvoiceQuantity).toFixed(2)}</span>
                                                    ) : (
                                                        <span className="badge bg-danger">0.00</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    {sale.remainingDCQuantity > 0 ? (
                                                        <span className="badge bg-info">{parseFloat(sale.remainingDCQuantity).toFixed(2)}</span>
                                                    ) : (
                                                        <span className="badge bg-light text-dark">0.00</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <small>{sale.saleDate}</small>
                                                    <br/>
                                                    <small className="text-muted">{sale.saleTime}</small>
                                                </td>
                                                <td className="text-center">
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <button
                                                            className="btn btn-outline-success"
                                                            onClick={() => showConfirmation('move_to_stock', sale)}
                                                            title="Move back to stock"
                                                            disabled={loading.moveToStock}
                                                        >
                                                            <i className="fa-solid fa-arrow-left"></i>
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-danger"
                                                            onClick={() => showConfirmation('delete_sale', sale)}
                                                            title="Delete sale permanently"
                                                            disabled={loading.delete}
                                                        >
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {filteredSales.length > 0 && (
                    <div className="card-footer bg-white border-0 py-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                Showing {filteredSales.length} of {salesWithDCInfo.length} sales
                            </small>
                            <div>
                                <span className="badge bg-success me-2">✓ Invoice reduces stock</span>
                                <span className="badge bg-info">⚠ DC doesn't affect stock</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Invoice Modal */}
            {showInvoiceModal && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-gradient-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-file-invoice me-2"></i>
                                    {selectedInvoice ? 'Edit Invoice' : 'Create Invoice'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => {
                                    setShowInvoiceModal(false);
                                    setSelectedInvoice(null);
                                    setInvoiceForm({
                                        invoice_number: "",
                                        customer_name: "",
                                        customer_address: "",
                                        customer_phone: "",
                                        customer_gst: ""
                                    });
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Invoice Number *</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            placeholder="INV-001"
                                            value={invoiceForm.invoice_number}
                                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                                            disabled={!!selectedInvoice}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Customer Name *</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            placeholder="Enter customer name"
                                            value={invoiceForm.customer_name}
                                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, customer_name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Customer Phone</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Enter phone number"
                                            value={invoiceForm.customer_phone}
                                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Customer GST</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Enter GST number"
                                            value={invoiceForm.customer_gst}
                                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, customer_gst: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Customer Address</label>
                                        <textarea
                                            className="form-control"
                                            placeholder="Enter customer address"
                                            value={invoiceForm.customer_address}
                                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, customer_address: e.target.value }))}
                                            rows="3"
                                        />
                                    </div>
                                </div>

                                {!selectedInvoice && selectedSalesForInvoice.length > 0 && (
                                    <div className="mt-4 pt-3 border-top">
                                        <h6>
                                            <i className="fa-solid fa-list-check me-2 text-primary"></i>
                                            Selected Items ({selectedSalesForInvoice.length})
                                            <small className="text-muted ms-2">Stock quantities will be reduced</small>
                                        </h6>
                                        <div className="table-responsive mt-3">
                                            <table className="table table-bordered">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Barcode</th>
                                                        <th>Available</th>
                                                        <th>Invoice Qty</th>
                                                        <th>Price</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSalesForInvoice.map((sale, index) => {
                                                        const saleInfo = salesWithDCInfo.find(s => s.id === sale.id);
                                                        const availableQty = saleInfo?.remainingInvoiceQuantity || parseFloat(sale.moveQuantity);
                                                        const quantity = parseFloat(invoiceItemQuantities[sale.id]) || availableQty;
                                                        const total = (parseFloat(sale.price) || 0) * quantity;
                                                        
                                                        return (
                                                            <tr key={index}>
                                                                <td>
                                                                    <div>
                                                                        <strong>{sale.name}</strong>
                                                                        <br/>
                                                                        <small className="text-muted">{sale.PartNo}</small>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <code>{sale.BareCode}</code>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-info">{availableQty.toFixed(2)}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleQuantityChange((quantity - 0.1).toString(), 'invoice', sale.id, availableQty)}
                                                                            disabled={quantity <= 0.1}
                                                                        >
                                                                            <i className="fa-solid fa-minus"></i>
                                                                        </button>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm text-center"
                                                                            style={{ width: '80px' }}
                                                                            pattern="[0-9]*\.?[0-9]{0,2}"
                                                                            value={quantity.toFixed(2)}
                                                                            onChange={(e) => handleQuantityChange(e.target.value, 'invoice', sale.id, availableQty)}
                                                                        />
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleQuantityChange((quantity + 0.1).toString(), 'invoice', sale.id, availableQty)}
                                                                            disabled={quantity >= availableQty}
                                                                        >
                                                                            <i className="fa-solid fa-plus"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td>₹{parseFloat(sale.price).toFixed(2)}</td>
                                                                <td>
                                                                    <strong className="text-success">₹{total.toFixed(2)}</strong>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="table-light">
                                                    <tr>
                                                        <td colSpan="4" className="text-end"><strong>Grand Total:</strong></td>
                                                        <td></td>
                                                        <td>
                                                            <strong className="text-success fs-5">
                                                                ₹{selectedSalesForInvoice.reduce((sum, sale) => {
                                                                    const quantity = parseFloat(invoiceItemQuantities[sale.id]) || (salesWithDCInfo.find(s => s.id === sale.id)?.remainingInvoiceQuantity || parseFloat(sale.moveQuantity));
                                                                    return sum + (parseFloat(sale.price) * quantity);
                                                                }, 0).toFixed(2)}
                                                            </strong>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary" 
                                    onClick={() => {
                                        setShowInvoiceModal(false);
                                        setSelectedInvoice(null);
                                        setInvoiceForm({
                                            invoice_number: "",
                                            customer_name: "",
                                            customer_address: "",
                                            customer_phone: "",
                                            customer_gst: ""
                                        });
                                    }} 
                                    disabled={loading.invoice}
                                >
                                    Cancel
                                </button>
                                {selectedInvoice ? (
                                    <button type="button" className="btn btn-primary" onClick={updateInvoice}>
                                        <i className="fa-solid fa-save me-2"></i>
                                        Update Invoice
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        className="btn btn-primary btn-lg" 
                                        onClick={createInvoice} 
                                        disabled={loading.invoice}
                                    >
                                        {loading.invoice ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-file-invoice me-2"></i>
                                                Create Invoice
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DC Modal */}
            {showDCModal && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-gradient-warning text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-truck me-2"></i>
                                    {selectedDC ? 'Edit Delivery Chalan' : 'Create Delivery Chalan'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => {
                                    setShowDCModal(false);
                                    setSelectedDC(null);
                                    setDcForm({
                                        dc_number: "",
                                        customer_name: "",
                                        customer_address: "",
                                        customer_phone: "",
                                        customer_gst: ""
                                    });
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label">DC Number (Optional)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="DC-001 (Auto-generated if empty)"
                                            value={dcForm.dc_number}
                                            onChange={(e) => setDcForm(prev => ({ ...prev, dc_number: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold">Customer Name *</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            placeholder="Enter customer name"
                                            value={dcForm.customer_name}
                                            onChange={(e) => setDcForm(prev => ({ ...prev, customer_name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Customer Phone</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Enter phone number"
                                            value={dcForm.customer_phone}
                                            onChange={(e) => setDcForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Customer GST</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Enter GST number"
                                            value={dcForm.customer_gst}
                                            onChange={(e) => setDcForm(prev => ({ ...prev, customer_gst: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Customer Address</label>
                                        <textarea
                                            className="form-control"
                                            placeholder="Enter customer address"
                                            value={dcForm.customer_address}
                                            onChange={(e) => setDcForm(prev => ({ ...prev, customer_address: e.target.value }))}
                                            rows="3"
                                        />
                                    </div>
                                </div>

                                {!selectedDC && selectedSalesForDC.length > 0 && (
                                    <div className="mt-4 pt-3 border-top">
                                        <h6>
                                            <i className="fa-solid fa-list-check me-2 text-warning"></i>
                                            Selected Items ({selectedSalesForDC.length})
                                            <small className="text-muted ms-2">Stock quantities will NOT be reduced</small>
                                        </h6>
                                        <div className="table-responsive mt-3">
                                            <table className="table table-bordered">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Barcode</th>
                                                        <th>Available</th>
                                                        <th>DC Qty</th>
                                                        <th>Price</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSalesForDC.map((sale, index) => {
                                                        const saleInfo = salesWithDCInfo.find(s => s.id === sale.id);
                                                        const availableQty = saleInfo?.remainingDCQuantity || parseFloat(sale.moveQuantity);
                                                        const quantity = parseFloat(dcItemQuantities[sale.id]) || availableQty;
                                                        const total = (parseFloat(sale.price) || 0) * quantity;
                                                        
                                                        return (
                                                            <tr key={index}>
                                                                <td>
                                                                    <div>
                                                                        <strong>{sale.name}</strong>
                                                                        <br/>
                                                                        <small className="text-muted">{sale.PartNo}</small>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <code>{sale.BareCode}</code>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-info">{availableQty.toFixed(2)}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleQuantityChange((quantity - 0.1).toString(), 'dc', sale.id, availableQty)}
                                                                            disabled={quantity <= 0.1}
                                                                        >
                                                                            <i className="fa-solid fa-minus"></i>
                                                                        </button>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm text-center"
                                                                            style={{ width: '80px' }}
                                                                            pattern="[0-9]*\.?[0-9]{0,2}"
                                                                            value={quantity.toFixed(2)}
                                                                            onChange={(e) => handleQuantityChange(e.target.value, 'dc', sale.id, availableQty)}
                                                                        />
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleQuantityChange((quantity + 0.1).toString(), 'dc', sale.id, availableQty)}
                                                                            disabled={quantity >= availableQty}
                                                                        >
                                                                            <i className="fa-solid fa-plus"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td>₹{parseFloat(sale.price).toFixed(2)}</td>
                                                                <td>
                                                                    <strong className="text-success">₹{total.toFixed(2)}</strong>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="table-light">
                                                    <tr>
                                                        <td colSpan="4" className="text-end"><strong>Grand Total:</strong></td>
                                                        <td></td>
                                                        <td>
                                                            <strong className="text-success fs-5">
                                                                ₹{selectedSalesForDC.reduce((sum, sale) => {
                                                                    const quantity = parseFloat(dcItemQuantities[sale.id]) || (salesWithDCInfo.find(s => s.id === sale.id)?.remainingDCQuantity || parseFloat(sale.moveQuantity));
                                                                    return sum + (parseFloat(sale.price) * quantity);
                                                                }, 0).toFixed(2)}
                                                            </strong>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary" 
                                    onClick={() => {
                                        setShowDCModal(false);
                                        setSelectedDC(null);
                                        setDcForm({
                                            dc_number: "",
                                            customer_name: "",
                                            customer_address: "",
                                            customer_phone: "",
                                            customer_gst: ""
                                        });
                                    }} 
                                    disabled={loading.dc}
                                >
                                    Cancel
                                </button>
                                {selectedDC ? (
                                    <button type="button" className="btn btn-warning" onClick={updateDC}>
                                        <i className="fa-solid fa-save me-2"></i>
                                        Update DC
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        className="btn btn-warning btn-lg" 
                                        onClick={createDeliveryChalan} 
                                        disabled={loading.dc}
                                    >
                                        {loading.dc ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-truck me-2"></i>
                                                Create Delivery Chalan
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice History Modal */}
            {showInvoiceHistory && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-gradient-info text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-history me-2"></i>
                                    Invoice History ({invoices.length})
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowInvoiceHistory(false)}></button>
                            </div>
                            <div className="modal-body">
                                {invoices.length === 0 ? (
                                    <div className="text-center py-5">
                                        <i className="fa-solid fa-file-invoice fa-3x text-muted mb-3"></i>
                                        <h5 className="text-muted">No invoices found</h5>
                                        <p className="text-muted">Create your first invoice from the sales page</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Invoice No</th>
                                                    <th>Customer</th>
                                                    <th>Date</th>
                                                    <th>Amount</th>
                                                    <th>Status</th>
                                                    <th className="text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {invoices.map((invoice, index) => (
                                                    <tr key={invoice.id}>
                                                        <td>
                                                            <span className="badge bg-light text-dark">{index + 1}</span>
                                                        </td>
                                                        <td>
                                                            <strong className="text-primary">{invoice.invoice_number}</strong>
                                                        </td>
                                                        <td>
                                                            <div>
                                                                <strong>{invoice.customer_name}</strong>
                                                                <br/>
                                                                <small className="text-muted">{invoice.customer_phone || 'No phone'}</small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <small>{invoice.invoice_date}</small>
                                                            <br/>
                                                            <small className="text-muted">{invoice.invoice_time}</small>
                                                        </td>
                                                        <td>
                                                            <strong className="text-success">₹{parseFloat(invoice.total_amount).toFixed(2)}</strong>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${
                                                                invoice.status === 'completed' ? 'bg-success' : 
                                                                invoice.status === 'pending' ? 'bg-warning' : 
                                                                'bg-secondary'
                                                            }`}>
                                                                {invoice.status}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => viewInvoiceDetails(invoice)}
                                                                    title="View Details"
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => printInvoice(invoice)}
                                                                    title="Print Invoice"
                                                                >
                                                                    <i className="fa-solid fa-print"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-warning me-1"
                                                                    onClick={() => editInvoice(invoice)}
                                                                    title="Edit Invoice"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => showConfirmation('delete_invoice', invoice)}
                                                                    disabled={loading.delete}
                                                                    title="Delete Invoice"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowInvoiceHistory(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DC History Modal */}
            {showDCHistory && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-gradient-secondary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-history me-2"></i>
                                    Delivery Chalan History ({deliveryChalans.length})
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDCHistory(false)}></button>
                            </div>
                            <div className="modal-body">
                                {deliveryChalans.length === 0 ? (
                                    <div className="text-center py-5">
                                        <i className="fa-solid fa-truck fa-3x text-muted mb-3"></i>
                                        <h5 className="text-muted">No delivery chalans found</h5>
                                        <p className="text-muted">Create your first delivery chalan from the sales page</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>DC No</th>
                                                    <th>Customer</th>
                                                    <th>Date</th>
                                                    <th>Status</th>
                                                    <th className="text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deliveryChalans.map((dc, index) => (
                                                    <tr key={dc.id}>
                                                        <td>
                                                            <span className="badge bg-light text-dark">{index + 1}</span>
                                                        </td>
                                                        <td>
                                                            <strong className="text-warning">{dc.dc_number || 'N/A'}</strong>
                                                        </td>
                                                        <td>
                                                            <div>
                                                                <strong>{dc.customer_name}</strong>
                                                                <br/>
                                                                <small className="text-muted">{dc.customer_phone || 'No phone'}</small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <small>{dc.dc_date}</small>
                                                            <br/>
                                                            <small className="text-muted">{dc.dc_time}</small>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${
                                                                dc.status === 'completed' ? 'bg-success' : 
                                                                dc.status === 'pending' ? 'bg-warning' : 
                                                                'bg-secondary'
                                                            }`}>
                                                                {dc.status}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => viewDCDetails(dc)}
                                                                    title="View Details"
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => printDC(dc)}
                                                                    title="Print DC"
                                                                >
                                                                    <i className="fa-solid fa-print"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-warning me-1"
                                                                    onClick={() => editDC(dc)}
                                                                    title="Edit DC"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => showConfirmation('delete_dc', dc)}
                                                                    disabled={loading.delete}
                                                                    title="Delete DC"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDCHistory(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal */}
            {selectedInvoice && !showInvoiceModal && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-gradient-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-file-invoice me-2"></i>
                                    Invoice Details - {selectedInvoice.invoice_number}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedInvoice(null)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Invoice Number:</strong> {selectedInvoice.invoice_number}</p>
                                                <p><strong>Customer Name:</strong> {selectedInvoice.customer_name}</p>
                                                <p><strong>Phone:</strong> {selectedInvoice.customer_phone || 'N/A'}</p>
                                                <p><strong>GST:</strong> {selectedInvoice.customer_gst || 'N/A'}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Date:</strong> {selectedInvoice.invoice_date}</p>
                                                <p><strong>Time:</strong> {selectedInvoice.invoice_time}</p>
                                                <p><strong>Status:</strong> <span className={`badge ${
                                                    selectedInvoice.status === 'completed' ? 'bg-success' : 
                                                    selectedInvoice.status === 'pending' ? 'bg-warning' : 
                                                    'bg-secondary'
                                                }`}>{selectedInvoice.status}</span></p>
                                                <p><strong>Total Amount:</strong> <span className="text-success fw-bold">₹{parseFloat(selectedInvoice.total_amount).toFixed(2)}</span></p>
                                            </div>
                                            <div className="col-12">
                                                <p><strong>Address:</strong> {selectedInvoice.customer_address || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5 className="mb-3">
                                    <i className="fa-solid fa-boxes-stacked me-2"></i>
                                    Items ({selectedInvoice.items?.length || 0})
                                </h5>
                                {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-bordered">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Product Name</th>
                                                    <th>Barcode</th>
                                                    <th>Part No</th>
                                                    <th>Quantity</th>
                                                    <th>Price</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedInvoice.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{index + 1}</td>
                                                        <td>{item.product_name}</td>
                                                        <td><code>{item.bare_code}</code></td>
                                                        <td>{item.part_no}</td>
                                                        <td>{parseFloat(item.quantity).toFixed(2)}</td>
                                                        <td>₹{parseFloat(item.price).toFixed(2)}</td>
                                                        <td>₹{parseFloat(item.total_price).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        <i className="fa-solid fa-info-circle me-2"></i>
                                        No items found for this invoice.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectedInvoice(null)}>
                                    Close
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => printInvoice(selectedInvoice)}>
                                    <i className="fa-solid fa-print me-2"></i>
                                    Print Invoice
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DC Detail Modal */}
            {selectedDC && !showDCModal && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-gradient-warning text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-truck me-2"></i>
                                    DC Details - {selectedDC.dc_number || 'N/A'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedDC(null)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>DC Number:</strong> {selectedDC.dc_number || 'N/A'}</p>
                                                <p><strong>Customer Name:</strong> {selectedDC.customer_name}</p>
                                                <p><strong>Phone:</strong> {selectedDC.customer_phone || 'N/A'}</p>
                                                <p><strong>GST:</strong> {selectedDC.customer_gst || 'N/A'}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Date:</strong> {selectedDC.dc_date}</p>
                                                <p><strong>Time:</strong> {selectedDC.dc_time}</p>
                                                <p><strong>Status:</strong> <span className={`badge ${
                                                    selectedDC.status === 'completed' ? 'bg-success' : 
                                                    selectedDC.status === 'pending' ? 'bg-warning' : 
                                                    'bg-secondary'
                                                }`}>{selectedDC.status}</span></p>
                                            </div>
                                            <div className="col-12">
                                                <p><strong>Address:</strong> {selectedDC.customer_address || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5 className="mb-3">
                                    <i className="fa-solid fa-boxes-stacked me-2"></i>
                                    Items ({selectedDC.items?.length || 0})
                                </h5>
                                {selectedDC.items && selectedDC.items.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-bordered">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Product Name</th>
                                                    <th>Barcode</th>
                                                    <th>Part No</th>
                                                    <th>Quantity</th>
                                                    <th>Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedDC.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{index + 1}</td>
                                                        <td>{item.product_name}</td>
                                                        <td><code>{item.bare_code}</code></td>
                                                        <td>{item.part_no}</td>
                                                        <td>{parseFloat(item.quantity).toFixed(2)}</td>
                                                        <td>₹{parseFloat(item.price).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        <i className="fa-solid fa-info-circle me-2"></i>
                                        No items found for this delivery chalan.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectedDC(null)}>
                                    Close
                                </button>
                                <button type="button" className="btn btn-warning" onClick={() => printDC(selectedDC)}>
                                    <i className="fa-solid fa-print me-2"></i>
                                    Print DC
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header" style={{
                                backgroundColor: confirmModalData.type === 'move_to_stock' ? '#20c997' :
                                              confirmModalData.type.includes('delete') ? '#dc3545' : '#007bff'
                            }}>
                                <h5 className="modal-title text-white">
                                    <i className={`fa-solid ${
                                        confirmModalData.type === 'move_to_stock' ? 'fa-arrow-left' :
                                        confirmModalData.type.includes('delete') ? 'fa-trash' : 'fa-exclamation-triangle'
                                    } me-2`}></i>
                                    {confirmModalData.title}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => {
                                    setShowConfirmModal(false);
                                    setMoveToStockQty('');
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="text-center mb-4">
                                    <i className={`fa-solid fa-3x mb-3 ${
                                        confirmModalData.type === 'move_to_stock' ? 'fa-arrow-left text-success' :
                                        confirmModalData.type.includes('delete') ? 'fa-trash text-danger' : 'fa-exclamation-triangle text-warning'
                                    }`}></i>
                                    <div style={{whiteSpace: 'pre-line'}}>
                                        {confirmModalData.message}
                                    </div>
                                </div>
                                
                                {confirmModalData.type === 'move_to_stock' && (
                                    <div className="form-group mb-4">
                                        <label className="form-label fw-bold">Quantity to Move:</label>
                                        <div className="input-group">
                                            <input
                                                type="number"
                                                className="form-control form-control-lg"
                                                value={moveToStockQty}
                                                onChange={(e) => setMoveToStockQty(e.target.value)}
                                                min="0.01"
                                                step="0.01"
                                                max={confirmModalData.data?.moveQuantity}
                                            />
                                            <span className="input-group-text">units</span>
                                        </div>
                                        <small className="text-muted">
                                            Max: {confirmModalData.data?.moveQuantity} units
                                        </small>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary" 
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setMoveToStockQty('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn" 
                                    style={{
                                        backgroundColor: confirmModalData.type === 'move_to_stock' ? '#20c997' :
                                                       confirmModalData.type.includes('delete') ? '#dc3545' : '#007bff',
                                        color: 'white'
                                    }}
                                    onClick={handleConfirmAction}
                                    disabled={confirmModalData.type === 'move_to_stock' && (!moveToStockQty || parseFloat(moveToStockQty) <= 0)}
                                >
                                    {confirmModalData.type === 'move_to_stock' ? 'Move to Stock' :
                                     confirmModalData.type.includes('delete') ? 'Delete' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )   
}

export default Sales