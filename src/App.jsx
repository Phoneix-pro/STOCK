import './App.css'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import DashBoard from './page/DashBoard'
import Production from './page/Production'
import Stocks from './page/Stocks'
import NAV from './components/Nav'
import Sales from './page/Sales'
import Inward from './page/Inward'
import BMR from './page/BMR'
import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase } from './supabaseClient'

function App() {
  const [products, setProducts] = useState([])
  const [productionDepartments, setProductionDepartments] = useState([])
  const [productionItems, setProductionItems] = useState([])
  const [sales, setSales] = useState([])
  const [bmrList, setBmrList] = useState([])
  const [bmrTemplates, setBmrTemplates] = useState([])
  const [processTemplates, setProcessTemplates] = useState([])
  const [globalTemplates, setGlobalTemplates] = useState([])
  const [invoices, setInvoices] = useState([])
  const [deliveryChalans, setDeliveryChalans] = useState([])
  const [inwardInvoices, setInwardInvoices] = useState([])
  const [stockVariants, setStockVariants] = useState([])
  const [activeProductionDepartment, setActiveProductionDepartment] = useState('')
  const [loading, setLoading] = useState(true)

  // Load all data from Supabase
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      
      // Load stocks with new structure
      await loadStocks()
      
      // Load production departments
      await loadProductionDepartments()
      
      // Load production items with unique products
      await loadProductionItems()
      
      // Load sales with unique products
      await loadSales()
      
      // Load BMR templates
      await loadBMRTemplates()
      
      // Load process templates
      await loadProcessTemplates()
      
      // Load global templates
      await loadGlobalTemplates()
      
      // Load invoices
      await loadInvoices()
      
      // Load delivery chalans
      await loadDeliveryChalans()
      
      // Load inward invoices
      await loadInwardInvoices()
      
      // Load stock variants
      await loadStockVariants()

      // Load BMR list from localStorage
      await loadBMRList()

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load BMR list from localStorage
  const loadBMRList = async () => {
    try {
      const savedBmrList = localStorage.getItem('bmrList')
      if (savedBmrList) {
        setBmrList(JSON.parse(savedBmrList))
      }
    } catch (error) {
      console.error('Error loading BMR list:', error)
    }
  }
// In App.js, update the loadStocks function
const loadStocks = async () => {
    try {
        const { data: stocksData, error: stocksError } = await supabase
            .from('stocks')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (!stocksError && stocksData) {
            // For each stock, get its variants
            const stocksWithVariants = await Promise.all(
                stocksData.map(async (item) => {
                    const { data: variants, error: variantsError } = await supabase
                        .from('stock_variants')
                        .select('*')
                        .eq('stock_id', item.id)
                        .order('received_date', { ascending: true })
                    
                    if (variantsError) {
                        console.error('Error loading variants for stock:', item.id, variantsError)
                    }
                    
                    // Calculate totals from variants
                    const totalFromVariants = variants?.reduce((sum, v) => {
                        return {
                            quantity: sum.quantity + (v.quantity || 0),
                            usingQuantity: sum.usingQuantity + (v.using_quantity || 0),
                            testingBalance: sum.testingBalance + (v.pending_testing || 0)
                        }
                    }, { quantity: 0, usingQuantity: 0, testingBalance: 0 }) || 
                    { quantity: 0, usingQuantity: 0, testingBalance: 0 }
                    
                    return {
                        id: item.id,
                        BareCode: item.bare_code,
                        PartNo: item.part_no,
                        LotNo: item.lot_no,
                        SNo: item.s_no,
                        name: item.name,
                        price: parseFloat(item.price),
                        averagePrice: parseFloat(item.average_price) || parseFloat(item.price),
                        Quantity: totalFromVariants.quantity,
                        usingQuantity: totalFromVariants.usingQuantity,
                        testingBalance: totalFromVariants.testingBalance,
                        totalReceived: item.total_received || 0,
                        variants: variants || [],
                        createdAt: item.created_at,
                        updatedAt: item.updated_at
                    }
                })
            )
            
            setProducts(stocksWithVariants)
        }
    } catch (error) {
        console.error('Error loading stocks:', error)
    }
}
  // Load stock variants
  const loadStockVariants = async () => {
    try {
      const { data: variantsData, error: variantsError } = await supabase
        .from('stock_variants')
        .select(`
          *,
          stocks (
            part_no,
            name
          )
        `)
        .order('received_date', { ascending: true })
      
      if (!variantsError && variantsData) {
        setStockVariants(variantsData)
      }
    } catch (error) {
      console.error('Error loading stock variants:', error)
    }
  }

  // Load production departments
  const loadProductionDepartments = async () => {
    try {
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('production_departments')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (!departmentsError && departmentsData) {
        setProductionDepartments(departmentsData)
      }
    } catch (error) {
      console.error('Error loading production departments:', error)
    }
  }

// Update loadProductionItems in App.js
const loadProductionItems = async () => {
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

    if (productionItemsError) throw productionItemsError

    if (productionItemsData && productionItemsData.length > 0) {
      const validItems = productionItemsData.map(item => ({
        id: item.id,
        BareCode: item.stock_variants?.bare_code || item.stocks?.bare_code || 'N/A',
        PartNo: item.stocks?.part_no || 'N/A',
        name: item.stocks?.name || 'Unknown Product',
        price: parseFloat(item.stock_variants?.price) || parseFloat(item.stocks?.price) || 0, // Use variant price first
        moveQuantity: item.move_quantity || 0,
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
    } else {
      setProductionItems([]);
    }
  } catch (error) {
    console.error('Error loading production items:', error);
    setProductionItems([]);
  }
}
const loadSales = async () => {
  try {
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        stock_variants!inner (
          bare_code,
          price,
          quantity,
          using_quantity,
          stock_id
        ),
        stocks!inner (
          part_no,
          name,
          price
        )
      `)
      .order('created_at', { ascending: false })

    if (salesError) throw salesError

    if (salesData && salesData.length > 0) {
      // Group sales by variant_id
      const salesByVariant = {};
      
      salesData.forEach(sale => {
        const variantId = sale.variant_id;
        
        if (!salesByVariant[variantId]) {
          salesByVariant[variantId] = {
            ...sale,
            totalQuantity: sale.move_quantity,
            sales: [sale],
            latestSale: sale
          };
        } else {
          salesByVariant[variantId].totalQuantity += sale.move_quantity;
          salesByVariant[variantId].sales.push(sale);
          if (new Date(sale.created_at) > new Date(salesByVariant[variantId].latestSale.created_at)) {
            salesByVariant[variantId].latestSale = sale;
          }
        }
      });

      const validSales = Object.values(salesByVariant).map(item => ({
        id: item.latestSale.id,
        BareCode: item.stock_variants?.bare_code || 'N/A',
        PartNo: item.stocks?.part_no || 'N/A',
        name: item.stocks?.name || 'Unknown Product',
        price: parseFloat(item.stock_variants?.price) || parseFloat(item.stocks?.price) || 0, // Use variant price first
        moveQuantity: item.totalQuantity,
        saleDate: item.latestSale.sale_date,
        saleTime: item.latestSale.sale_time,
        stockId: item.latestSale.stock_id,
        variantId: item.latestSale.variant_id,
        variantPrice: parseFloat(item.stock_variants?.price) || 0,
        allSaleRecords: item.sales,
        isAggregated: item.sales.length > 1,
        createdAt: item.latestSale.created_at
      }));

      setSales(validSales);
    } else {
      setSales([]);
    }
  } catch (error) {
    console.error('Error loading sales:', error);
    setSales([]);
  }
}
  const loadGlobalTemplates = async () => {
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('global_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (!templatesError && templatesData) {
        setGlobalTemplates(templatesData)
      } else {
        setGlobalTemplates([])
      }
    } catch (error) {
      console.error('Error loading global templates:', error)
      setGlobalTemplates([])
    }
  }

  const loadBMRTemplates = async () => {
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('bmr_templates')
        .select(`
          *,
          bmr_assemblies (
            name,
            type,
            product_id
          ),
          bmr_products!bmr_templates_product_id_fkey (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (!templatesError && templatesData) {
        const templatesWithDetails = templatesData.map((template) => {
          let assemblyName = 'Unknown Assembly';
          let productName = 'Unknown Product';
          let assemblyType = 'assembly';

          if (template.bmr_assemblies) {
            assemblyName = template.bmr_assemblies.name;
            assemblyType = template.bmr_assemblies.type;

            if (template.bmr_products) {
              productName = template.bmr_products.name;
            } else if (template.bmr_assemblies.product_id) {
              productName = 'Product (ID: ' + template.bmr_assemblies.product_id + ')';
            }
          }

          return {
            id: template.id,
            name: template.name,
            type: template.type,
            initialCode: template.initial_code,
            status: template.status,
            department: template.department,
            assemblyName: assemblyName,
            productName: productName,
            assemblyType: assemblyType,
            assemblyId: template.assembly_id,
            productId: template.product_id,
            createdAt: template.created_at
          }
        })

        setBmrTemplates(templatesWithDetails)
      } else {
        setBmrTemplates([])
      }
    } catch (error) {
      console.error('Error loading BMR templates:', error)
      setBmrTemplates([])
    }
  }

  const loadProcessTemplates = async () => {
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('process_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (!templatesError && templatesData) {
        setProcessTemplates(templatesData)
      } else {
        setProcessTemplates([])
      }
    } catch (error) {
      console.error('Error loading process templates:', error)
      setProcessTemplates([])
    }
  }

  const loadInvoices = async () => {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (!invoicesError && invoicesData) {
        setInvoices(invoicesData)
      } else {
        setInvoices([])
      }
    } catch (error) {
      console.error('Error loading invoices:', error)
      setInvoices([])
    }
  }

  const loadDeliveryChalans = async () => {
    try {
      const { data: dcData, error: dcError } = await supabase
        .from('delivery_chalans')
        .select('*')
        .order('created_at', { ascending: false })

      if (!dcError && dcData) {
        setDeliveryChalans(dcData)
      } else {
        setDeliveryChalans([])
      }
    } catch (error) {
      console.error('Error loading delivery chalans:', error)
      setDeliveryChalans([])
    }
  }

  const loadInwardInvoices = async () => {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('inward_invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (!invoicesError && invoicesData) {
        setInwardInvoices(invoicesData)
      } else {
        setInwardInvoices([])
      }
    } catch (error) {
      console.error('Error loading inward invoices:', error)
      setInwardInvoices([])
    }
  }

  // Get product variants for a specific product
  const getProductVariants = async (partNo) => {
    try {
      // First, find the stock for this part number
      const { data: stock, error: stockError } = await supabase
        .from('stocks')
        .select('id, name, part_no')
        .eq('part_no', partNo)
        .single()

      if (stockError) {
        console.error('Error finding stock:', stockError)
        return { stock: null, variants: [] }
      }

      // Then get all variants for this stock
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

  // Calculate available quantity for a product (excluding using quantity)
  const calculateAvailableQuantity = (product) => {
    return Math.max(0, 
      (product.Quantity || 0) - 
      (product.usingQuantity || 0)
    );
  };

  // Calculate total testing balance
  const calculateTotalTestingBalance = () => {
    return products.reduce((sum, product) => sum + (product.testingBalance || 0), 0)
  }

  // Calculate total value
  const calculateTotalValue = () => {
    return products.reduce((sum, product) => {
      const price = product.averagePrice || product.price || 0
      return sum + ((product.Quantity || 0) * price)
    }, 0)
  }

  // Calculate total in use value
  const calculateTotalInUseValue = () => {
    return products.reduce((sum, product) => {
      const price = product.averagePrice || product.price || 0
      return sum + ((product.usingQuantity || 0) * price)
    }, 0)
  }

  // Calculate total pending testing value
  const calculateTotalTestingValue = () => {
    return products.reduce((sum, product) => {
      const price = product.averagePrice || product.price || 0
      return sum + ((product.testingBalance || 0) * price)
    }, 0)
  }

  // Update BMR list
  const updateBMRList = (newBmrList) => {
    setBmrList(newBmrList)
    localStorage.setItem('bmrList', JSON.stringify(newBmrList))
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div className="ms-3">Loading Application...</div>
      </div>
    )
  }

  return (
    <Router>
      <NAV/>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={
          <DashBoard 
            products={products}
            productionItems={productionItems}
            sales={sales}
            inwardInvoices={inwardInvoices}
            calculateAvailableQuantity={calculateAvailableQuantity}
            calculateTotalTestingBalance={calculateTotalTestingBalance}
            calculateTotalValue={calculateTotalValue}
            calculateTotalInUseValue={calculateTotalInUseValue}
            calculateTotalTestingValue={calculateTotalTestingValue}
          />
        }/>
        <Route path="/Stocks" element={
          <Stocks 
            products={products} 
            setProducts={setProducts}
            productionDepartments={productionDepartments}
            productionItems={productionItems}
            setProductionItems={setProductionItems}
            sales={sales}
            setSales={setSales}
            loadAllData={loadAllData}
            bmrTemplates={bmrTemplates}
            bmrList={bmrList}
            setBmrList={updateBMRList}
            stockVariants={stockVariants}
            getProductVariants={getProductVariants}
            calculateAvailableQuantity={calculateAvailableQuantity}
          />
        }/>
        <Route path="/Production" element={
          <Production 
            productionDepartments={productionDepartments}
            setProductionDepartments={setProductionDepartments}
            productionItems={productionItems}
            setProductionItems={setProductionItems}
            products={products}
            setProducts={setProducts}
            bmrList={bmrList}
            setBmrList={updateBMRList}
            bmrTemplates={bmrTemplates}
            setBmrTemplates={setBmrTemplates}
            activeProductionDepartment={activeProductionDepartment}
            setActiveProductionDepartment={setActiveProductionDepartment}
            loadAllData={loadAllData}
            getProductVariants={getProductVariants}
          />
        }/>
        <Route path="/Sales" element={
          <Sales 
            sales={sales} 
            setSales={setSales}
            products={products}
            setProducts={setProducts}
            loadAllData={loadAllData}
            invoices={invoices}
            setInvoices={setInvoices}
            deliveryChalans={deliveryChalans}
            setDeliveryChalans={setDeliveryChalans}
            getProductVariants={getProductVariants}
          />
        }/>
        <Route path="/BMR" element={
          <BMR 
            bmrList={bmrList}
            setBmrList={updateBMRList}
            bmrTemplates={bmrTemplates}
            setBmrTemplates={setBmrTemplates}
            processTemplates={processTemplates}
            setProcessTemplates={setProcessTemplates}
            globalTemplates={globalTemplates}
            setGlobalTemplates={setGlobalTemplates}
            activeProductionDepartment={activeProductionDepartment}
            loadAllData={loadAllData}
            products={products}
            setProducts={setProducts}
            getProductVariants={getProductVariants}
          />
        }/>
        <Route path="/Inward" element={
          <Inward 
            inwardInvoices={inwardInvoices}
            setInwardInvoices={setInwardInvoices}
            products={products}
            setProducts={setProducts}
            loadAllData={loadAllData}
            getProductVariants={getProductVariants}
          />
        }/>
      </Routes>
    </Router>
  )
}

export default App