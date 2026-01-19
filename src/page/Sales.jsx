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
    invoices, 
    setInvoices,
    deliveryChalans,
    setDeliveryChalans 
}) {
    const [moveBackQuantity, setMoveBackQuantity] = useState({});
    const [selectedSaleForMove, setSelectedSaleForMove] = useState(null);
    const [selectedSalesForInvoice, setSelectedSalesForInvoice] = useState([]);
    const [selectedSalesForDC, setSelectedSalesForDC] = useState([]);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showDCModal, setShowDCModal] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState({
        invoice_number: "",
        customer_name: "",
        customer_address: ""
    });
    const [dcForm, setDcForm] = useState({
        dc_number: "",
        customer_name: "",
        customer_address: ""
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

    useEffect(() => {
        loadInvoiceItems();
        loadDCItems();
        loadSalesWithDCInfo();
    }, [sales]);

    const loadSalesWithDCInfo = async () => {
        try {
            // Get all DC items grouped by variant_id
            const { data: dcItemsData, error: dcError } = await supabase
                .from('delivery_chalan_items')
                .select('variant_id, quantity');

            if (dcError) throw dcError;

            // Get all Invoice items grouped by variant_id
            const { data: invoiceItemsData, error: invoiceError } = await supabase
                .from('invoice_items')
                .select('variant_id, quantity');

            if (invoiceError) throw invoiceError;

            // Calculate total DC quantity per variant
            const dcQuantityMap = {};
            if (dcItemsData) {
                dcItemsData.forEach(item => {
                    const variantId = item.variant_id;
                    if (!dcQuantityMap[variantId]) {
                        dcQuantityMap[variantId] = 0;
                    }
                    dcQuantityMap[variantId] += item.quantity;
                });
            }
            setDcQuantities(dcQuantityMap);

            // Calculate total Invoice quantity per variant
            const invoiceQuantityMap = {};
            if (invoiceItemsData) {
                invoiceItemsData.forEach(item => {
                    const variantId = item.variant_id;
                    if (!invoiceQuantityMap[variantId]) {
                        invoiceQuantityMap[variantId] = 0;
                    }
                    invoiceQuantityMap[variantId] += item.quantity;
                });
            }
            setInvoiceQuantities(invoiceQuantityMap);

            const salesWithInfo = sales.map(sale => {
                const variantId = sale.variantId;
                const totalDCQuantity = dcQuantityMap[variantId] || 0;
                const totalInvoiceQuantity = invoiceQuantityMap[variantId] || 0;
                
                // Available for DC = total sale quantity - already in DC
                const availableForDC = Math.max(0, sale.moveQuantity - totalDCQuantity);
                
                // Available for Invoice = total sale quantity - already in invoice
                const availableForInvoice = Math.max(0, sale.moveQuantity - totalInvoiceQuantity);
                
                return {
                    ...sale,
                    dcQuantity: totalDCQuantity,
                    invoiceQuantity: totalInvoiceQuantity,
                    remainingDCQuantity: availableForDC,
                    remainingInvoiceQuantity: availableForInvoice,
                    isFullyInDC: totalDCQuantity >= sale.moveQuantity,
                    isFullyInInvoice: totalInvoiceQuantity >= sale.moveQuantity,
                    isPartiallyInDC: totalDCQuantity > 0 && totalDCQuantity < sale.moveQuantity,
                    isPartiallyInInvoice: totalInvoiceQuantity > 0 && totalInvoiceQuantity < sale.moveQuantity
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
                        invoice_date,
                        invoice_time,
                        total_amount
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

    const deleteSale = async (saleId) => {
        if (!window.confirm('Are you sure you want to delete this sale? This will move the quantity back to stock.')) return

        try {
            // First get the sale details
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .select('*')
                .eq('id', saleId)
                .single();

            if (saleError) throw saleError;

            // Get the variant details
            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('id', saleData.variant_id)
                .single();

            if (variantError) {
                toast.error(`Variant not found!`);
                return;
            }

            // Restore quantity to variant
            const newVariantUsing = Math.max(0, (variant.using_quantity || 0) - saleData.move_quantity);
            const newVariantQty = (variant.quantity || 0) + saleData.move_quantity;

            await supabase
                .from('stock_variants')
                .update({
                    using_quantity: newVariantUsing,
                    quantity: newVariantQty,
                    updated_at: new Date().toISOString()
                })
                .eq('id', variant.id);

            // Record movement
            await supabase
                .from('stock_movements')
                .insert([{
                    variant_id: variant.id,
                    movement_type: 'in',
                    quantity: saleData.move_quantity,
                    remaining_quantity: newVariantQty,
                    reference_type: 'sales_return',
                    movement_date: new Date().toISOString()
                }]);

            // Update stock totals
            const { data: allVariants, error: variantsError } = await supabase
                .from('stock_variants')
                .select('quantity, using_quantity, pending_testing, price')
                .eq('stock_id', variant.stock_id);

            if (!variantsError && allVariants) {
                let totalQuantity = 0;
                let totalUsingQuantity = 0;
                let totalTestingBalance = 0;
                let totalValue = 0;
                let totalReceived = 0;
                
                allVariants.forEach(v => {
                    const qty = v.quantity || 0;
                    const using = v.using_quantity || 0;
                    const pending = v.pending_testing || 0;
                    const price = v.price || 0;
                    
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
                    .eq('id', variant.stock_id);
            }

            // Now delete the sale
            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', saleId)

            if (error) throw error

            toast.success('Sale deleted successfully! Quantity restored to stock.')
            await loadAllData();
            await loadSalesWithDCInfo();
        } catch (error) {
            toast.error('Error deleting sale: ' + error.message)
        }
    }

    const handleMoveBackQuantityChange = (saleId, quantity) => {
        const sale = sales.find(sale => sale.id === saleId);
        const maxQuantity = sale.moveQuantity;
        setMoveBackQuantity(prev => ({
            ...prev,
            [saleId]: Math.min(Math.max(1, quantity), maxQuantity)
        }));
    }

    const moveSaleBackToStock = async (sale) => {
        const quantityToMove = moveBackQuantity[sale.id] || sale.moveQuantity
        
        try {
            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select('*')
                .eq('bare_code', sale.BareCode)
                .single()

            if (variantError) {
                toast.error(`Variant with barcode ${sale.BareCode} not found!`)
                return
            }

            const newVariantUsing = Math.max(0, (variant.using_quantity || 0) - quantityToMove)
            const newVariantQty = (variant.quantity || 0) + quantityToMove

            await supabase
                .from('stock_variants')
                .update({
                    using_quantity: newVariantUsing,
                    quantity: newVariantQty,
                    updated_at: new Date().toISOString()
                })
                .eq('id', variant.id)

            await supabase
                .from('stock_movements')
                .insert([{
                    variant_id: variant.id,
                    movement_type: 'in',
                    quantity: quantityToMove,
                    remaining_quantity: newVariantQty + newVariantUsing,
                    reference_type: 'sales_return',
                    movement_date: new Date().toISOString()
                }])

            const { data: stock, error: stockError } = await supabase
                .from('stocks')
                .select('quantity, using_quantity')
                .eq('id', variant.stock_id)
                .single()

            if (!stockError) {
                const newStockUsing = Math.max(0, (stock.using_quantity || 0) - quantityToMove)
                const newStockQty = (stock.quantity || 0) + quantityToMove

                await supabase
                    .from('stocks')
                    .update({
                        using_quantity: newStockUsing,
                        quantity: newStockQty,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', variant.stock_id)
            }

            if (quantityToMove === sale.moveQuantity) {
                const { error: deleteError } = await supabase
                    .from('sales')
                    .delete()
                    .eq('id', sale.id)

                if (deleteError) throw deleteError
            } else {
                const { error: updateSaleError } = await supabase
                    .from('sales')
                    .update({
                        move_quantity: sale.moveQuantity - quantityToMove
                    })
                    .eq('id', sale.id)

                if (updateSaleError) throw updateSaleError
            }

            toast.success(`Moved ${quantityToMove} ${sale.name} back to stock`)
            setMoveBackQuantity(prev => {
                const newState = { ...prev }
                delete newState[sale.id]
                return newState
            })
            setSelectedSaleForMove(null)
            await loadAllData();
            await loadSalesWithDCInfo();
        } catch (error) {
            toast.error('Error moving back to stock: ' + error.message)
        }
    }

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
    }

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
    }

    const handleInvoiceQuantityChange = (saleId, quantity) => {
        const sale = salesWithDCInfo.find(s => s.id === saleId);
        const maxQuantity = sale?.remainingInvoiceQuantity || 0;
        
        setInvoiceItemQuantities(prev => ({
            ...prev,
            [saleId]: Math.min(Math.max(1, quantity), maxQuantity)
        }));
    };

    const handleDCQuantityChange = (saleId, quantity) => {
        const sale = salesWithDCInfo.find(s => s.id === saleId);
        const maxQuantity = sale?.remainingDCQuantity || 0;
        
        setDCItemQuantities(prev => ({
            ...prev,
            [saleId]: Math.min(Math.max(1, quantity), maxQuantity)
        }));
    };

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
            // Check for duplicate invoice number
            const { data: existingInvoice, error: checkError } = await supabase
                .from('invoices')
                .select('id')
                .eq('invoice_number', invoiceForm.invoice_number.trim())
                .single();

            if (existingInvoice && !checkError) {
                toast.error('Invoice number already exists!');
                return;
            }

            // Calculate total amount
            let totalAmount = 0;
            const invoiceItemsToInsert = [];

            for (const sale of selectedSalesForInvoice) {
                const quantity = invoiceItemQuantities[sale.id] || sale.remainingInvoiceQuantity || sale.moveQuantity;
                
                // Find variant by barcode to get actual price
                const { data: variantData, error: variantError } = await supabase
                    .from('stock_variants')
                    .select('*')
                    .eq('bare_code', sale.BareCode)
                    .single();

                if (!variantError && variantData) {
                    // Use variant price
                    const variantPrice = variantData.price || sale.price || 0;
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
                        total_price: itemTotal,
                        variant_price: variantPrice
                    });
                }
            }

            // Create invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .insert([{
                    invoice_number: invoiceForm.invoice_number.trim(),
                    customer_name: invoiceForm.customer_name.trim(),
                    customer_address: invoiceForm.customer_address.trim(),
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
            if (finalInvoiceItems.length > 0) {
                const { error: itemsError } = await supabase
                    .from('invoice_items')
                    .insert(finalInvoiceItems);

                if (itemsError) throw itemsError;
            }

            toast.success(`Invoice ${invoiceForm.invoice_number} created successfully!`);
            
            // Reset form and selections
            setInvoiceForm({
                invoice_number: "",
                customer_name: "",
                customer_address: ""
            });
            setSelectedSalesForInvoice([]);
            setInvoiceItemQuantities({});
            setShowInvoiceModal(false);
            
            // Reload all data
            await loadAllData();
            await loadInvoiceItems();
            await loadSalesWithDCInfo();
            
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
        }
    };

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
            // Check for duplicate DC number if provided
            if (dcForm.dc_number.trim()) {
                const { data: existingDC, error: checkError } = await supabase
                    .from('delivery_chalans')
                    .select('id')
                    .eq('dc_number', dcForm.dc_number.trim())
                    .single();

                if (existingDC && !checkError) {
                    toast.error('DC number already exists!');
                    return;
                }
            }

            const dcNumber = dcForm.dc_number.trim() || `DC-${Date.now().toString().slice(-6)}`;
            
            // Create delivery chalan
            const { data: dcData, error: dcError } = await supabase
                .from('delivery_chalans')
                .insert([{
                    dc_number: dcNumber,
                    customer_name: dcForm.customer_name.trim(),
                    customer_address: dcForm.customer_address.trim(),
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
                const quantity = dcItemQuantities[sale.id] || sale.remainingDCQuantity || sale.moveQuantity;
                
                if (quantity > 0) {
                    // Find variant to get actual price
                    const { data: variantData, error: variantError } = await supabase
                        .from('stock_variants')
                        .select('*')
                        .eq('bare_code', sale.BareCode)
                        .single();

                    if (!variantError && variantData) {
                        const variantPrice = variantData.price || sale.price || 0;
                        
                        dcItemsToInsert.push({
                            dc_id: dcData.id,
                            stock_id: sale.stockId,
                            variant_id: variantData.id,
                            bare_code: sale.BareCode,
                            part_no: sale.PartNo,
                            product_name: sale.name,
                            price: variantPrice,
                            quantity: quantity,
                            variant_price: variantPrice
                        });
                    }
                }
            }

            // Insert DC items
            if (dcItemsToInsert.length > 0) {
                const { error: itemsError } = await supabase
                    .from('delivery_chalan_items')
                    .insert(dcItemsToInsert);

                if (itemsError) throw itemsError;
            }

            toast.success(`Delivery Chalan ${dcNumber} created successfully!`);
            
            // Reset form and selections
            setDcForm({
                dc_number: "",
                customer_name: "",
                customer_address: ""
            });
            setSelectedSalesForDC([]);
            setDCItemQuantities({});
            setShowDCModal(false);
            
            // Reload data
            await loadDCItems();
            await loadSalesWithDCInfo();
            await loadAllData();
            
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
            customer_address: invoice.customer_address || ""
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
                customer_address: ""
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
            customer_address: dc.customer_address || ""
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
                customer_address: ""
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

    const deleteInvoice = async (invoiceId) => {
        if (!window.confirm('Are you sure you want to delete this invoice? This will NOT restore stock quantities.')) return;

        try {
            // Delete invoice items
            const { error: deleteItemsError } = await supabase
                .from('invoice_items')
                .delete()
                .eq('invoice_id', invoiceId);

            if (deleteItemsError) throw deleteItemsError;

            // Delete the invoice
            const { error: deleteInvoiceError } = await supabase
                .from('invoices')
                .delete()
                .eq('id', invoiceId);

            if (deleteInvoiceError) throw deleteInvoiceError;

            toast.success('Invoice deleted successfully!');
            
            // Reload all data
            await loadAllData();
            await loadInvoiceItems();
            await loadSalesWithDCInfo();
            
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
        }
    };

    const deleteDC = async (dcId) => {
        if (!window.confirm('Are you sure you want to delete this delivery chalan?')) return;

        try {
            // Delete DC items
            const { error: deleteItemsError } = await supabase
                .from('delivery_chalan_items')
                .delete()
                .eq('dc_id', dcId);

            if (deleteItemsError) throw deleteItemsError;

            // Delete the DC
            const { error: deleteDCError } = await supabase
                .from('delivery_chalans')
                .delete()
                .eq('id', dcId);

            if (deleteDCError) throw deleteDCError;

            toast.success('Delivery Chalan deleted successfully!');
            
            // Reload data
            await loadDCItems();
            await loadSalesWithDCInfo();
            await loadAllData();
            
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
        }
    };

    const printInvoice = (invoice) => {
        // Get items for this invoice
        const items = invoice.items || invoiceItems.filter(item => item.invoice_id === invoice.id);
        
        const printWindow = window.open('', '_blank');
        
        const printContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Invoice - ${invoice.invoice_number}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 20px; 
                            line-height: 1.6;
                        }
                        .invoice-header {
                            text-align: center;
                            margin-bottom: 30px;
                            border-bottom: 3px solid #000;
                            padding-bottom: 20px;
                        }
                        .invoice-header h1 {
                            margin: 0;
                            color: #333;
                        }
                        .invoice-header h2 {
                            margin: 5px 0 0 0;
                            color: #666;
                        }
                        .company-info {
                            float: right;
                            text-align: right;
                            margin-bottom: 20px;
                        }
                        .customer-info {
                            margin-bottom: 30px;
                            padding: 15px;
                            background-color: #f9f9f9;
                            border-radius: 5px;
                            border: 1px solid #ddd;
                        }
                        .invoice-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 20px;
                        }
                        .invoice-table th {
                            background-color: #f2f2f2;
                            font-weight: bold;
                            text-align: left;
                            padding: 12px;
                            border: 1px solid #ddd;
                        }
                        .invoice-table td {
                            padding: 12px;
                            border: 1px solid #ddd;
                        }
                        .invoice-table tr:nth-child(even) {
                            background-color: #f9f9f9;
                        }
                        .total-section {
                            margin-top: 30px;
                            padding: 20px;
                            background-color: #e9f7fe;
                            border-radius: 5px;
                            text-align: right;
                            font-size: 1.1em;
                        }
                        .total-section h3 {
                            margin: 0;
                            color: #333;
                        }
                        .footer {
                            margin-top: 40px;
                            text-align: center;
                            font-size: 0.9em;
                            color: #666;
                            border-top: 1px solid #ddd;
                            padding-top: 20px;
                        }
                        @media print {
                            body { margin: 0; padding: 10px; }
                            .no-print { display: none; }
                            .invoice-table th, .invoice-table td {
                                padding: 8px;
                            }
                        }
                        .print-controls {
                            margin-top: 20px;
                            text-align: center;
                            padding: 15px;
                            background-color: #f8f9fa;
                            border-radius: 5px;
                        }
                        .print-btn {
                            padding: 10px 25px;
                            background-color: #007bff;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                            margin: 0 5px;
                        }
                        .print-btn:hover {
                            background-color: #0056b3;
                        }
                        .close-btn {
                            padding: 10px 25px;
                            background-color: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                            margin: 0 5px;
                        }
                        .close-btn:hover {
                            background-color: #545b62;
                        }
                    </style>
                </head>
                <body>
                    <div class="invoice-header">
                        <h1>INVOICE</h1>
                        <h2>${invoice.invoice_number}</h2>
                    </div>
                    
                    <div class="company-info">
                        <p><strong>Your Company Name</strong></p>
                        <p>Your Company Address</p>
                        <p>Phone: (123) 456-7890</p>
                        <p>Email: info@company.com</p>
                    </div>
                    
                    <div style="clear: both;"></div>
                    
                    <div class="customer-info">
                        <p><strong>Bill To:</strong></p>
                        <p>${invoice.customer_name}</p>
                        <p>${invoice.customer_address || 'Address not specified'}</p>
                        <p><strong>Invoice Date:</strong> ${invoice.invoice_date}</p>
                        <p><strong>Invoice Time:</strong> ${invoice.invoice_time}</p>
                    </div>
                    
                    ${items.length > 0 ? `
                        <table class="invoice-table">
                            <thead>
                                <tr>
                                    <th width="5%">#</th>
                                    <th width="25%">Product Name</th>
                                    <th width="15%">Barcode</th>
                                    <th width="15%">Part No</th>
                                    <th width="10%">Quantity</th>
                                    <th width="15%">Unit Price (₹)</th>
                                    <th width="15%">Total (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${item.product_name}</td>
                                        <td>${item.bare_code}</td>
                                        <td>${item.part_no}</td>
                                        <td>${item.quantity}</td>
                                        <td>₹${parseFloat(item.price).toFixed(2)}</td>
                                        <td>₹${parseFloat(item.total_price || item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="total-section">
                            <h3>Total Amount: ₹${parseFloat(invoice.total_amount || items.reduce((sum, item) => sum + (item.total_price || item.price * item.quantity), 0)).toFixed(2)}</h3>
                            <p>Total Items: ${items.length}</p>
                            <p>Total Quantity: ${items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; background-color: #f8f9fa; border-radius: 5px;">
                            <h3 style="color: #666;">No items found for this invoice.</h3>
                        </div>
                    `}
                    
                    <div class="footer">
                        <p>Thank you for your business!</p>
                        <p>For any queries, please contact us at support@company.com</p>
                        <p>This is a computer generated invoice and does not require a signature.</p>
                    </div>
                    
                    <div class="print-controls no-print">
                        <button class="print-btn" onclick="window.print()">
                            Print Invoice
                        </button>
                        <button class="close-btn" onclick="window.close()">
                            Close Window
                        </button>
                    </div>
                    
                    <script>
                        // Auto focus print button
                        window.onload = function() {
                            const printBtn = document.querySelector('.print-btn');
                            if (printBtn) printBtn.focus();
                        };
                    </script>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    const printDC = (dc) => {
        // Get items for this DC
        const items = dc.items || dcItems.filter(item => item.dc_id === dc.id);
        
        const printWindow = window.open('', '_blank');
        
        const printContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Delivery Chalan - ${dc.dc_number || 'N/A'}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 20px; 
                            line-height: 1.6;
                        }
                        .dc-header {
                            text-align: center;
                            margin-bottom: 30px;
                            border-bottom: 3px solid #000;
                            padding-bottom: 20px;
                        }
                        .dc-header h1 {
                            margin: 0;
                            color: #333;
                        }
                        .dc-header h2 {
                            margin: 5px 0 0 0;
                            color: #666;
                        }
                        .company-info {
                            float: right;
                            text-align: right;
                            margin-bottom: 20px;
                        }
                        .customer-info {
                            margin-bottom: 30px;
                            padding: 15px;
                            background-color: #f9f9f9;
                            border-radius: 5px;
                            border: 1px solid #ddd;
                        }
                        .dc-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 20px;
                        }
                        .dc-table th {
                            background-color: #f2f2f2;
                            font-weight: bold;
                            text-align: left;
                            padding: 12px;
                            border: 1px solid #ddd;
                        }
                        .dc-table td {
                            padding: 12px;
                            border: 1px solid #ddd;
                        }
                        .dc-table tr:nth-child(even) {
                            background-color: #f9f9f9;
                        }
                        .summary-section {
                            margin-top: 30px;
                            padding: 20px;
                            background-color: #e9f7fe;
                            border-radius: 5px;
                            text-align: right;
                            font-size: 1.1em;
                        }
                        .summary-section h3 {
                            margin: 0;
                            color: #333;
                        }
                        .footer {
                            margin-top: 40px;
                            text-align: center;
                            font-size: 0.9em;
                            color: #666;
                            border-top: 1px solid #ddd;
                            padding-top: 20px;
                        }
                        @media print {
                            body { margin: 0; padding: 10px; }
                            .no-print { display: none; }
                            .dc-table th, .dc-table td {
                                padding: 8px;
                            }
                        }
                        .print-controls {
                            margin-top: 20px;
                            text-align: center;
                            padding: 15px;
                            background-color: #f8f9fa;
                            border-radius: 5px;
                        }
                        .print-btn {
                            padding: 10px 25px;
                            background-color: #007bff;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                            margin: 0 5px;
                        }
                        .print-btn:hover {
                            background-color: #0056b3;
                        }
                        .close-btn {
                            padding: 10px 25px;
                            background-color: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                            margin: 0 5px;
                        }
                        .close-btn:hover {
                            background-color: #545b62;
                        }
                    </style>
                </head>
                <body>
                    <div class="dc-header">
                        <h1>DELIVERY CHALAN</h1>
                        <h2>${dc.dc_number || 'N/A'}</h2>
                    </div>
                    
                    <div class="company-info">
                        <p><strong>Your Company Name</strong></p>
                        <p>Your Company Address</p>
                        <p>Phone: (123) 456-7890</p>
                        <p>Email: info@company.com</p>
                    </div>
                    
                    <div style="clear: both;"></div>
                    
                    <div class="customer-info">
                        <p><strong>Deliver To:</strong></p>
                        <p>${dc.customer_name}</p>
                        <p>${dc.customer_address || 'Address not specified'}</p>
                        <p><strong>DC Date:</strong> ${dc.dc_date}</p>
                        <p><strong>DC Time:</strong> ${dc.dc_time}</p>
                        <p><strong>Status:</strong> ${dc.status || 'Pending'}</p>
                    </div>
                    
                    ${items.length > 0 ? `
                        <table class="dc-table">
                            <thead>
                                <tr>
                                    <th width="5%">#</th>
                                    <th width="25%">Product Name</th>
                                    <th width="20%">Barcode</th>
                                    <th width="20%">Part No</th>
                                    <th width="15%">Quantity</th>
                                    <th width="15%">Unit Price (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${item.product_name}</td>
                                        <td>${item.bare_code}</td>
                                        <td>${item.part_no}</td>
                                        <td>${item.quantity}</td>
                                        <td>₹${parseFloat(item.price).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="summary-section">
                            <h3>Delivery Summary</h3>
                            <p>Total Items: ${items.length}</p>
                            <p>Total Quantity: ${items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                            <p>Total Value: ₹${items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</p>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 40px; background-color: #f8f9fa; border-radius: 5px;">
                            <h3 style="color: #666;">No items found for this delivery chalan.</h3>
                        </div>
                    `}
                    
                    <div class="footer">
                        <p><strong>Delivery Instructions:</strong></p>
                        <p>Please check all items against this delivery chalan.</p>
                        <p>Report any discrepancies within 24 hours.</p>
                        <p>Receiver's Signature: _________________________</p>
                        <p>Date Received: _________________________</p>
                    </div>
                    
                    <div class="print-controls no-print">
                        <button class="print-btn" onclick="window.print()">
                            Print Delivery Chalan
                        </button>
                        <button class="close-btn" onclick="window.close()">
                            Close Window
                        </button>
                    </div>
                    
                    <script>
                        // Auto focus print button
                        window.onload = function() {
                            const printBtn = document.querySelector('.print-btn');
                            if (printBtn) printBtn.focus();
                        };
                    </script>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    return(
        <div className="container">
            {/* Move Back to Stock Modal */}
            <div className="modal fade" id="moveBackModal" tabIndex="-1" aria-labelledby="moveBackModalLabel" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="moveBackModalLabel">Move Back to Stock</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            {selectedSaleForMove && (
                                <>
                                    <div className="mb-3">
                                        <p><strong>Product:</strong> {selectedSaleForMove.name}</p>
                                        <p><strong>Sold Quantity:</strong> {selectedSaleForMove.moveQuantity}</p>
                                        <p><strong>Barcode:</strong> {selectedSaleForMove.BareCode}</p>
                                        <p><strong>Price:</strong> ₹{selectedSaleForMove.price}</p>
                                    </div>
                                    <div className="form-floating mb-3">
                                        <input 
                                            type="number" 
                                            className="form-control" 
                                            placeholder="Quantity to move back"
                                            min="1"
                                            max={selectedSaleForMove.moveQuantity}
                                            value={moveBackQuantity[selectedSaleForMove.id] || selectedSaleForMove.moveQuantity}
                                            onChange={(e) => handleMoveBackQuantityChange(selectedSaleForMove.id, parseInt(e.target.value) || 1)}
                                        />
                                        <label>Quantity to move back to stock</label>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={() => moveSaleBackToStock(selectedSaleForMove)}
                                data-bs-dismiss="modal"
                            >
                                Move to Stock
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice Modal */}
            {showInvoiceModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {selectedInvoice ? 'Edit Invoice' : 'Create Invoice'}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => {
                                    setShowInvoiceModal(false);
                                    setSelectedInvoice(null);
                                    setInvoiceForm({
                                        invoice_number: "",
                                        customer_name: "",
                                        customer_address: ""
                                    });
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Invoice Number"
                                                value={invoiceForm.invoice_number}
                                                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                                                disabled={!!selectedInvoice}
                                            />
                                            <label>Invoice Number *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Customer Name"
                                                value={invoiceForm.customer_name}
                                                onChange={(e) => setInvoiceForm(prev => ({ ...prev, customer_name: e.target.value }))}
                                            />
                                            <label>Customer Name *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <textarea
                                                className="form-control"
                                                placeholder="Customer Address"
                                                value={invoiceForm.customer_address}
                                                onChange={(e) => setInvoiceForm(prev => ({ ...prev, customer_address: e.target.value }))}
                                                style={{ height: '100px' }}
                                            />
                                            <label>Customer Address</label>
                                        </div>
                                    </div>
                                </div>

                                {!selectedInvoice && selectedSalesForInvoice.length > 0 && (
                                    <div className="mt-3">
                                        <h6>Selected Items for Invoice ({selectedSalesForInvoice.length})</h6>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-bordered">
                                                <thead>
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
                                                        const availableQty = saleInfo?.remainingInvoiceQuantity || sale.moveQuantity;
                                                        const quantity = invoiceItemQuantities[sale.id] || availableQty;
                                                        const total = (sale.price || 0) * quantity;
                                                        
                                                        return (
                                                            <tr key={index}>
                                                                <td>{sale.name}</td>
                                                                <td>{sale.BareCode}</td>
                                                                <td>
                                                                    <span className="badge bg-info">{availableQty}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleInvoiceQuantityChange(sale.id, quantity - 1)}
                                                                            disabled={quantity <= 1}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <input
                                                                            type="number"
                                                                            className="form-control form-control-sm text-center"
                                                                            style={{ width: '70px' }}
                                                                            min="1"
                                                                            max={availableQty}
                                                                            value={quantity}
                                                                            onChange={(e) => handleInvoiceQuantityChange(sale.id, parseInt(e.target.value) || 1)}
                                                                        />
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleInvoiceQuantityChange(sale.id, quantity + 1)}
                                                                            disabled={quantity >= availableQty}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td>₹{sale.price}</td>
                                                                <td>₹{total}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan="4" className="text-end"><strong>Total:</strong></td>
                                                        <td></td>
                                                        <td>
                                                            <strong>₹{selectedSalesForInvoice.reduce((sum, sale) => {
                                                                const quantity = invoiceItemQuantities[sale.id] || (salesWithDCInfo.find(s => s.id === sale.id)?.remainingInvoiceQuantity || sale.moveQuantity);
                                                                return sum + (sale.price * quantity);
                                                            }, 0)}</strong>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowInvoiceModal(false);
                                    setSelectedInvoice(null);
                                    setInvoiceForm({
                                        invoice_number: "",
                                        customer_name: "",
                                        customer_address: ""
                                    });
                                }}>
                                    Cancel
                                </button>
                                {selectedInvoice ? (
                                    <button type="button" className="btn btn-primary" onClick={updateInvoice}>
                                        Update Invoice
                                    </button>
                                ) : (
                                    <button type="button" className="btn btn-primary" onClick={createInvoice}>
                                        Create Invoice
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DC Modal */}
            {showDCModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {selectedDC ? 'Edit Delivery Chalan' : 'Create Delivery Chalan'}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => {
                                    setShowDCModal(false);
                                    setSelectedDC(null);
                                    setDcForm({
                                        dc_number: "",
                                        customer_name: "",
                                        customer_address: ""
                                    });
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="DC Number (Optional)"
                                                value={dcForm.dc_number}
                                                onChange={(e) => setDcForm(prev => ({ ...prev, dc_number: e.target.value }))}
                                            />
                                            <label>DC Number (Optional)</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Customer Name"
                                                value={dcForm.customer_name}
                                                onChange={(e) => setDcForm(prev => ({ ...prev, customer_name: e.target.value }))}
                                            />
                                            <label>Customer Name *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <textarea
                                                className="form-control"
                                                placeholder="Customer Address"
                                                value={dcForm.customer_address}
                                                onChange={(e) => setDcForm(prev => ({ ...prev, customer_address: e.target.value }))}
                                                style={{ height: '100px' }}
                                            />
                                            <label>Customer Address</label>
                                        </div>
                                    </div>
                                </div>

                                {!selectedDC && selectedSalesForDC.length > 0 && (
                                    <div className="mt-3">
                                        <h6>Selected Items for Delivery Chalan ({selectedSalesForDC.length})</h6>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-bordered">
                                                <thead>
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
                                                        const availableQty = saleInfo?.remainingDCQuantity || sale.moveQuantity;
                                                        const quantity = dcItemQuantities[sale.id] || availableQty;
                                                        const total = (sale.price || 0) * quantity;
                                                        
                                                        return (
                                                            <tr key={index}>
                                                                <td>{sale.name}</td>
                                                                <td>{sale.BareCode}</td>
                                                                <td>
                                                                    <span className="badge bg-info">{availableQty}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleDCQuantityChange(sale.id, quantity - 1)}
                                                                            disabled={quantity <= 1}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <input
                                                                            type="number"
                                                                            className="form-control form-control-sm text-center"
                                                                            style={{ width: '70px' }}
                                                                            min="1"
                                                                            max={availableQty}
                                                                            value={quantity}
                                                                            onChange={(e) => handleDCQuantityChange(sale.id, parseInt(e.target.value) || 1)}
                                                                        />
                                                                        <button
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => handleDCQuantityChange(sale.id, quantity + 1)}
                                                                            disabled={quantity >= availableQty}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td>₹{sale.price}</td>
                                                                <td>₹{total}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan="4" className="text-end"><strong>Total:</strong></td>
                                                        <td></td>
                                                        <td>
                                                            <strong>₹{selectedSalesForDC.reduce((sum, sale) => {
                                                                const quantity = dcItemQuantities[sale.id] || (salesWithDCInfo.find(s => s.id === sale.id)?.remainingDCQuantity || sale.moveQuantity);
                                                                return sum + (sale.price * quantity);
                                                            }, 0)}</strong>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowDCModal(false);
                                    setSelectedDC(null);
                                    setDcForm({
                                        dc_number: "",
                                        customer_name: "",
                                        customer_address: ""
                                    });
                                }}>
                                    Cancel
                                </button>
                                {selectedDC ? (
                                    <button type="button" className="btn btn-primary" onClick={updateDC}>
                                        Update DC
                                    </button>
                                ) : (
                                    <button type="button" className="btn btn-primary" onClick={createDeliveryChalan}>
                                        Create Delivery Chalan
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice History Modal */}
            {showInvoiceHistory && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Invoice History</h5>
                                <button type="button" className="btn-close" onClick={() => setShowInvoiceHistory(false)}></button>
                            </div>
                            <div className="modal-body">
                                {invoices.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No invoices found.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Invoice No</th>
                                                    <th>Customer Name</th>
                                                    <th>Date</th>
                                                    <th>Time</th>
                                                    <th>Total Amount</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {invoices.map((invoice, index) => (
                                                    <tr key={invoice.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <strong>{invoice.invoice_number}</strong>
                                                        </td>
                                                        <td>{invoice.customer_name}</td>
                                                        <td>{invoice.invoice_date}</td>
                                                        <td>{invoice.invoice_time}</td>
                                                        <td>₹{invoice.total_amount}</td>
                                                        <td>
                                                            <span className={`badge ${
                                                                invoice.status === 'completed' ? 'bg-success' : 
                                                                invoice.status === 'pending' ? 'bg-warning' : 
                                                                'bg-secondary'
                                                            }`}>
                                                                {invoice.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => viewInvoiceDetails(invoice)}
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => printInvoice(invoice)}
                                                                >
                                                                    <i className="fa-solid fa-print"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-secondary me-1"
                                                                    onClick={() => editInvoice(invoice)}
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => deleteInvoice(invoice.id)}
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
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowInvoiceHistory(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DC History Modal */}
            {showDCHistory && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Delivery Chalan History</h5>
                                <button type="button" className="btn-close" onClick={() => setShowDCHistory(false)}></button>
                            </div>
                            <div className="modal-body">
                                {deliveryChalans.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No delivery chalans found.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>DC No</th>
                                                    <th>Customer Name</th>
                                                    <th>Date</th>
                                                    <th>Time</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deliveryChalans.map((dc, index) => (
                                                    <tr key={dc.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <strong>{dc.dc_number || 'N/A'}</strong>
                                                        </td>
                                                        <td>{dc.customer_name}</td>
                                                        <td>{dc.dc_date}</td>
                                                        <td>{dc.dc_time}</td>
                                                        <td>
                                                            <span className={`badge ${
                                                                dc.status === 'completed' ? 'bg-success' : 
                                                                dc.status === 'pending' ? 'bg-warning' : 
                                                                'bg-secondary'
                                                            }`}>
                                                                {dc.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => viewDCDetails(dc)}
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => printDC(dc)}
                                                                >
                                                                    <i className="fa-solid fa-print"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-secondary me-1"
                                                                    onClick={() => editDC(dc)}
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => deleteDC(dc.id)}
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
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowDCHistory(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal */}
            {selectedInvoice && !showInvoiceModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Invoice Details - {selectedInvoice.invoice_number}</h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedInvoice(null)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Invoice Number:</strong> {selectedInvoice.invoice_number}</p>
                                                <p><strong>Customer Name:</strong> {selectedInvoice.customer_name}</p>
                                                <p><strong>Date:</strong> {selectedInvoice.invoice_date}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Customer Address:</strong> {selectedInvoice.customer_address || 'N/A'}</p>
                                                <p><strong>Time:</strong> {selectedInvoice.invoice_time}</p>
                                                <p><strong>Total Amount:</strong> ₹{selectedInvoice.total_amount}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5>Items</h5>
                                {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-bordered">
                                            <thead>
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
                                                        <td>{item.bare_code}</td>
                                                        <td>{item.part_no}</td>
                                                        <td>{item.quantity}</td>
                                                        <td>₹{item.price}</td>
                                                        <td>₹{item.total_price}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        No items found for this invoice.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>
                                    Close
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => printInvoice(selectedInvoice)}>
                                    <i className="fa-solid fa-print me-2"></i>
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DC Detail Modal */}
            {selectedDC && !showDCModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Delivery Chalan Details - {selectedDC.dc_number || 'N/A'}</h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedDC(null)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>DC Number:</strong> {selectedDC.dc_number || 'N/A'}</p>
                                                <p><strong>Customer Name:</strong> {selectedDC.customer_name}</p>
                                                <p><strong>Date:</strong> {selectedDC.dc_date}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Customer Address:</strong> {selectedDC.customer_address || 'N/A'}</p>
                                                <p><strong>Time:</strong> {selectedDC.dc_time}</p>
                                                <p><strong>Status:</strong> {selectedDC.status}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5>Items</h5>
                                {selectedDC.items && selectedDC.items.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-bordered">
                                            <thead>
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
                                                        <td>{item.bare_code}</td>
                                                        <td>{item.part_no}</td>
                                                        <td>{item.quantity}</td>
                                                        <td>₹{item.price}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        No items found for this delivery chalan.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedDC(null)}>
                                    Close
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => printDC(selectedDC)}>
                                    <i className="fa-solid fa-print me-2"></i>
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="Sales-head mb-4">
                <h2>Sales</h2>
                <div className="Activity">
                    <button 
                        className="btn btn-primary me-2"
                        onClick={() => setShowInvoiceModal(true)}
                        disabled={selectedSalesForInvoice.length === 0}
                    >
                        <i className="fa-solid fa-file-invoice me-2"></i>
                        Invoice ({selectedSalesForInvoice.length})
                    </button>
                    <button 
                        className="btn btn-secondary me-2"
                        onClick={() => setShowDCModal(true)}
                        disabled={selectedSalesForDC.length === 0}
                    >
                        <i className="fa-solid fa-truck me-2"></i>
                        Delivery Chalan ({selectedSalesForDC.length})
                    </button>
                    <button 
                        className="btn btn-outline-info me-2"
                        onClick={() => setShowInvoiceHistory(true)}
                    >
                        <i className="fa-solid fa-history me-2"></i>
                        Invoice History ({invoices.length})
                    </button>
                    <button 
                        className="btn btn-outline-warning"
                        onClick={() => setShowDCHistory(true)}
                    >
                        <i className="fa-solid fa-history me-2"></i>
                        DC History ({deliveryChalans.length})
                    </button>
                </div>
            </div>
            
            {salesWithDCInfo.length > 0 ? (
                <div className="table-responsive">
                    <table className="table table-striped table-hover table-bordered caption-top align-middle text-center border-secondary shadow-sm">
                        <caption className="fw-bold text-secondary">
                            Sales History - Select items for Invoice or Delivery Chalan
                            <br/>
                            <small className="text-muted">
                                <span className="badge bg-success me-2">Available for Invoice</span>
                                <span className="badge bg-warning me-2">Available for DC</span>
                                <span className="badge bg-danger me-2">Fully Allocated</span>
                            </small>
                        </caption>
                        <thead>
                            <tr>
                                <th>
                                    <input 
                                        type="checkbox" 
                                        className="form-check-input"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const availableSales = salesWithDCInfo.filter(sale => 
                                                    sale.remainingInvoiceQuantity > 0
                                                );
                                                setSelectedSalesForInvoice(availableSales);
                                            } else {
                                                setSelectedSalesForInvoice([]);
                                            }
                                        }}
                                        checked={selectedSalesForInvoice.length > 0 && 
                                                selectedSalesForInvoice.length === salesWithDCInfo.filter(s => s.remainingInvoiceQuantity > 0).length}
                                    />
                                    <br/>
                                    <small>Invoice</small>
                                </th>
                                <th>
                                    <input 
                                        type="checkbox" 
                                        className="form-check-input"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const availableSales = salesWithDCInfo.filter(sale => 
                                                    sale.remainingDCQuantity > 0
                                                );
                                                setSelectedSalesForDC(availableSales);
                                            } else {
                                                setSelectedSalesForDC([]);
                                            }
                                        }}
                                        checked={selectedSalesForDC.length > 0 && 
                                                selectedSalesForDC.length === salesWithDCInfo.filter(s => s.remainingDCQuantity > 0).length}
                                    />
                                    <br/>
                                    <small>DC</small>
                                </th>
                                <th>#</th>
                                <th>Barecode</th>
                                <th>PartNo</th>
                                <th>Product</th>
                                <th>Price</th>
                                <th>Sold Qty</th>
                                <th>Invoice Qty</th>
                                <th>DC Qty</th>
                                <th>Available for Invoice</th>
                                <th>Available for DC</th>
                                <th>Sale Date</th>
                                <th>Sale Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesWithDCInfo.map((sale, index) => {
                                const rowClass = sale.isFullyInInvoice && sale.isFullyInDC ? 'table-danger' : 
                                               sale.isPartiallyInInvoice || sale.isPartiallyInDC ? 'table-warning' : '';
                                return (
                                    <tr key={sale.id} className={rowClass}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                className="form-check-input"
                                                checked={selectedSalesForInvoice.some(s => s.id === sale.id)}
                                                onChange={(e) => handleInvoiceCheckboxChange(sale, e.target.checked)}
                                                disabled={sale.remainingInvoiceQuantity <= 0}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                className="form-check-input"
                                                checked={selectedSalesForDC.some(s => s.id === sale.id)}
                                                onChange={(e) => handleDCCheckboxChange(sale, e.target.checked)}
                                                disabled={sale.remainingDCQuantity <= 0}
                                            />
                                        </td>
                                        <td>{index + 1}</td>
                                        <td>{sale.BareCode}</td>
                                        <td>{sale.PartNo}</td>
                                        <td>
                                            {sale.name}
                                            {sale.isFullyInInvoice && (
                                                <span className="badge bg-danger ms-2">Invoice Complete</span>
                                            )}
                                            {sale.isFullyInDC && (
                                                <span className="badge bg-danger ms-2">DC Complete</span>
                                            )}
                                        </td>
                                        <td>₹{sale.price}</td>
                                        <td>
                                            <span className="badge bg-primary">{sale.moveQuantity}</span>
                                        </td>
                                        <td>
                                            {sale.invoiceQuantity > 0 ? (
                                                <span className="badge bg-info">{sale.invoiceQuantity}</span>
                                            ) : (
                                                <span className="badge bg-secondary">0</span>
                                            )}
                                        </td>
                                        <td>
                                            {sale.dcQuantity > 0 ? (
                                                <span className="badge bg-warning">{sale.dcQuantity}</span>
                                            ) : (
                                                <span className="badge bg-secondary">0</span>
                                            )}
                                        </td>
                                        <td>
                                            {sale.remainingInvoiceQuantity > 0 ? (
                                                <span className="badge bg-success">{sale.remainingInvoiceQuantity}</span>
                                            ) : (
                                                <span className="badge bg-danger">0</span>
                                            )}
                                        </td>
                                        <td>
                                            {sale.remainingDCQuantity > 0 ? (
                                                <span className="badge bg-success">{sale.remainingDCQuantity}</span>
                                            ) : (
                                                <span className="badge bg-danger">0</span>
                                            )}
                                        </td>
                                        <td>{sale.saleDate}</td>
                                        <td>{sale.saleTime}</td>
                                        <td>
                                            <button 
                                                className="btn btn-sm btn-outline-success me-1"
                                                onClick={() => setSelectedSaleForMove(sale)}
                                                data-bs-toggle="modal" 
                                                data-bs-target="#moveBackModal"
                                                title="Move back to stock"
                                            >
                                                <i className="fa-solid fa-arrow-left"></i>
                                            </button>
                                            <button 
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => deleteSale(sale.id)}
                                                title="Delete sale"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="alert alert-info text-center">
                    <i className="fa-solid fa-cart-shopping fa-3x mb-3"></i>
                    <h4>No Sales Yet</h4>
                    <p>Products moved to sales will appear here.</p>
                </div>
            )}
        </div>
    )   
}

export default Sales