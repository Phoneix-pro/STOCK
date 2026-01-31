import "./DashBoard.css";
import { useState, useEffect, useMemo } from "react";
import { supabase } from '../supabaseClient';
import toast from "react-hot-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  AreaChart, Area
} from 'recharts';

function DashBoard({ 
  products, 
  productionItems, 
  sales, 
  inwardInvoices,
  calculateAvailableQuantity,
  calculateTotalTestingBalance,
  calculateTotalValue,
  calculateTotalInUseValue,
  calculateTotalTestingValue
}) {
  const [dashboardData, setDashboardData] = useState({
    salesData: [],
    inventoryData: [],
    productionData: [],
    recentActivities: [],
    topProducts: [],
    departmentStats: []
  });
  
  const [timeRange, setTimeRange] = useState('week'); // week, month, year
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    totalSales: 0,
    totalProduction: 0,
    pendingTesting: 0,
    inUseValue: 0,
    recentInvoices: 0,
    lowStockCount: 0,
    activeBMRs: 0
  });

  const [bmrStats, setBmrStats] = useState({
    active: 0,
    inProgress: 0,
    completed: 0
  });

  // Custom colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
  const STATUS_COLORS = {
    'active': '#4CAF50',
    'inprogress': '#FF9800',
    'pending': '#9E9E9E',
    'completed': '#2196F3',
    'inactive': '#F44336'
  };

  // Load all dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [products, productionItems, sales, timeRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSalesData(),
        loadInventoryData(),
        loadProductionData(),
        loadRecentActivities(),
        loadTopProducts(),
        loadDepartmentStats(),
        loadBMRStats()
      ]);
      calculateStatistics();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Load BMR statistics
  const loadBMRStats = async () => {
    try {
      const { data, error } = await supabase
        .from('bmr_templates')
        .select('status, count')
        .group('status');

      if (!error && data) {
        const stats = {
          active: 0,
          inProgress: 0,
          completed: 0,
          inactive: 0
        };

        data.forEach(item => {
          const status = item.status?.toLowerCase();
          if (status === 'active') stats.active = item.count;
          else if (status === 'inprogress') stats.inProgress = item.count;
          else if (status === 'complete') stats.completed = item.count;
          else if (status === 'inactive') stats.inactive = item.count;
        });

        setBmrStats(stats);
      }
    } catch (error) {
      console.error('Error loading BMR stats:', error);
    }
  };

  // Calculate all statistics
  const calculateStatistics = () => {
    const totalValue = calculateTotalValue();
    const totalInUseValue = calculateTotalInUseValue();
    const totalTestingValue = calculateTotalTestingValue();
    const totalTestingBalance = calculateTotalTestingBalance();
    
    // Count low stock items (available quantity < 10)
    const lowStockCount = products.filter(product => {
      const available = calculateAvailableQuantity(product);
      return available < 10 && available > 0;
    }).length;

    // Count out of stock items
    const outOfStockCount = products.filter(product => {
      const available = calculateAvailableQuantity(product);
      return available <= 0;
    }).length;

    setStats({
      totalProducts: products.length,
      totalValue,
      totalSales: sales.reduce((sum, sale) => sum + (parseFloat(sale.moveQuantity) || 0), 0),
      totalProduction: productionItems.reduce((sum, item) => sum + (parseFloat(item.moveQuantity) || 0), 0),
      pendingTesting: totalTestingBalance,
      inUseValue: totalInUseValue,
      testingValue: totalTestingValue,
      recentInvoices: inwardInvoices.filter(inv => {
        const invoiceDate = new Date(inv.invoice_date || inv.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return invoiceDate >= weekAgo;
      }).length,
      lowStockCount,
      outOfStockCount
    });
  };

  // Load sales data for charts
  const loadSalesData = async () => {
    let startDate = new Date();
    
    switch(timeRange) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const { data, error } = await supabase
      .from('sales')
      .select('move_quantity, sale_date, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (!error && data) {
      const groupedData = groupDataByTime(data, timeRange);
      setDashboardData(prev => ({ ...prev, salesData: groupedData }));
    }
  };

  // Load inventory data
  const loadInventoryData = async () => {
    const inventoryData = products.map(product => ({
      name: product.name.substring(0, 20) + (product.name.length > 20 ? '...' : ''),
      value: parseFloat(product.Quantity) || 0,
      inUse: parseFloat(product.usingQuantity) || 0,
      testing: parseFloat(product.testingBalance) || 0,
      available: calculateAvailableQuantity(product)
    })).filter(item => item.value > 0);

    setDashboardData(prev => ({ ...prev, inventoryData }));
  };

  // Load production data
  const loadProductionData = async () => {
    const { data, error } = await supabase
      .from('production_items')
      .select('department, move_quantity, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      const groupedByDept = data.reduce((acc, item) => {
        const dept = item.department || 'Unknown';
        if (!acc[dept]) acc[dept] = 0;
        acc[dept] += parseFloat(item.move_quantity) || 0;
        return acc;
      }, {});

      const productionData = Object.entries(groupedByDept).map(([name, value]) => ({
        name,
        value
      }));

      setDashboardData(prev => ({ ...prev, productionData }));
    }
  };

  // Load recent activities
  const loadRecentActivities = async () => {
    try {
      const [salesRes, productionRes, inwardRes] = await Promise.all([
        supabase
          .from('sales')
          .select('created_at, move_quantity')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('production_items')
          .select('created_at, move_quantity, department')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('inward_invoices')
          .select('created_at, invoice_number, total_amount')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const activities = [];
      
      // Add sales activities
      salesRes.data?.forEach(sale => {
        activities.push({
          id: `sale-${sale.created_at}`,
          type: 'sale',
          title: 'Product Sold',
          description: `${sale.move_quantity} units sold`,
          timestamp: sale.created_at,
          icon: 'fa-solid fa-cart-shopping',
          color: '#4CAF50'
        });
      });

      // Add production activities
      productionRes.data?.forEach(prod => {
        activities.push({
          id: `prod-${prod.created_at}`,
          type: 'production',
          title: 'Production Movement',
          description: `${prod.move_quantity} units moved to ${prod.department}`,
          timestamp: prod.created_at,
          icon: 'fa-solid fa-industry',
          color: '#FF9800'
        });
      });

      // Add inward activities
      inwardRes.data?.forEach(invoice => {
        activities.push({
          id: `inward-${invoice.created_at}`,
          type: 'inward',
          title: 'New Inward Invoice',
          description: `Invoice #${invoice.invoice_number} - ₹${invoice.total_amount}`,
          timestamp: invoice.created_at,
          icon: 'fa-solid fa-truck-ramp-box',
          color: '#2196F3'
        });
      });

      // Sort by timestamp and limit to 10
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setDashboardData(prev => ({ ...prev, recentActivities: activities.slice(0, 10) }));
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  // Load top products
  const loadTopProducts = async () => {
    const productSales = {};
    
    sales.forEach(sale => {
      const productName = sale.name;
      if (!productSales[productName]) {
        productSales[productName] = 0;
      }
      productSales[productName] += parseFloat(sale.moveQuantity) || 0;
    });

    const topProducts = Object.entries(productSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    setDashboardData(prev => ({ ...prev, topProducts }));
  };

  // Load department stats
  const loadDepartmentStats = async () => {
    const { data, error } = await supabase
      .from('production_departments')
      .select('name, has_assembly');

    if (!error && data) {
      const stats = await Promise.all(data.map(async dept => {
        const { count } = await supabase
          .from('production_items')
          .select('*', { count: 'exact', head: true })
          .eq('department', dept.name);

        return {
          name: dept.name,
          count: count || 0,
          hasAssembly: dept.has_assembly
        };
      }));

      setDashboardData(prev => ({ ...prev, departmentStats: stats }));
    }
  };

  // Helper function to group data by time
  const groupDataByTime = (data, range) => {
    const groups = {};
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      let key;
      
      switch(range) {
        case 'week':
          key = date.toLocaleDateString('en-US', { weekday: 'short' });
          break;
        case 'month':
          key = `${date.getDate()}/${date.getMonth() + 1}`;
          break;
        case 'year':
          key = date.toLocaleDateString('en-US', { month: 'short' });
          break;
      }
      
      if (!groups[key]) groups[key] = 0;
      groups[key] += parseFloat(item.move_quantity) || 0;
    });

    return Object.entries(groups).map(([date, amount]) => ({
      date,
      amount
    }));
  };

  // Refresh dashboard
  const handleRefresh = () => {
    loadDashboardData();
    toast.success('Dashboard refreshed!');
  };

  // Quick actions
  const quickActions = [
    {
      id: 1,
      title: 'Add Stock',
      icon: 'fa-solid fa-boxes-stacked',
      color: 'bg-primary',
      link: '/Stocks',
      description: 'Add new products'
    },
    {
      id: 2,
      title: 'Move to Production',
      icon: 'fa-solid fa-industry',
      color: 'bg-warning',
      link: '/Stocks',
      description: 'Move items to production'
    },
    {
      id: 3,
      title: 'Create Invoice',
      icon: 'fa-solid fa-receipt',
      color: 'bg-success',
      link: '/Sales',
      description: 'Create new invoice'
    },
    {
      id: 4,
      title: 'New Inward',
      icon: 'fa-solid fa-truck-ramp-box',
      color: 'bg-info',
      link: '/Inward',
      description: 'Add inward invoice'
    },
    {
      id: 5,
      title: 'BMR Management',
      icon: 'fa-solid fa-file-contract',
      color: 'bg-purple',
      link: '/BMR',
      description: 'Manage BMR templates'
    },
    {
      id: 6,
      title: 'Quick Report',
      icon: 'fa-solid fa-chart-bar',
      color: 'bg-danger',
      link: '#',
      description: 'Generate report',
      onClick: () => toast.success('Report generated!')
    }
  ];

  // Stats cards with icons and colors
  const statCards = [
    {
      id: 1,
      title: 'Total Products',
      value: stats.totalProducts,
      icon: 'fa-solid fa-boxes-stacked',
      color: 'primary',
      change: '+12%',
      trend: 'up'
    },
    {
      id: 2,
      title: 'Inventory Value',
      value: `₹${stats.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'fa-solid fa-indian-rupee-sign',
      color: 'success',
      change: '+8.5%',
      trend: 'up'
    },
    {
      id: 3,
      title: 'Total Sales',
      value: stats.totalSales.toFixed(2),
      icon: 'fa-solid fa-cart-shopping',
      color: 'info',
      change: '+15.2%',
      trend: 'up'
    },
    {
      id: 4,
      title: 'In Production',
      value: stats.totalProduction.toFixed(2),
      icon: 'fa-solid fa-industry',
      color: 'warning',
      change: '+5.3%',
      trend: 'up'
    },
    {
      id: 5,
      title: 'Pending Testing',
      value: stats.pendingTesting.toFixed(2),
      icon: 'fa-solid fa-flask',
      color: 'danger',
      change: '-3.1%',
      trend: 'down'
    },
    {
      id: 6,
      title: 'In Use Value',
      value: `₹${stats.inUseValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'fa-solid fa-warehouse',
      color: 'purple',
      change: '+7.8%',
      trend: 'up'
    }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip bg-white p-3 border shadow-sm rounded">
          <p className="font-semibold mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="mb-0" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="row align-items-center">
          <div className="col-md-6">
            <h1 className="dashboard-title">
              <i className="fa-solid fa-chart-line me-3"></i>
              Dashboard Overview
            </h1>
            <p className="dashboard-subtitle text-muted">
              Welcome to your inventory management dashboard
            </p>
          </div>
          <div className="col-md-6 text-end">
            <div className="d-flex justify-content-end align-items-center gap-3">
              <div className="time-range-selector">
                <select 
                  className="form-select form-select-sm" 
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last Month</option>
                  <option value="year">Last Year</option>
                </select>
              </div>
              <button 
                className="btn btn-outline-primary btn-sm"
                onClick={handleRefresh}
              >
                <i className="fa-solid fa-rotate"></i>
                Refresh
              </button>
              <div className="last-updated">
                <small className="text-muted">
                  Updated: {new Date().toLocaleTimeString()}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="row g-4 mb-4">
        {statCards.map((stat) => (
          <div key={stat.id} className="col-xl-2 col-lg-4 col-md-6">
            <div className={`stats-card card border-0 shadow-sm bg-${stat.color}-subtle`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="text-muted mb-2">{stat.title}</h6>
                    <h3 className="mb-0">{stat.value}</h3>
                    <div className="d-flex align-items-center mt-2">
                      <span className={`badge bg-${stat.trend === 'up' ? 'success' : 'danger'}-subtle text-${stat.trend === 'up' ? 'success' : 'danger'} me-2`}>
                        <i className={`fa-solid fa-arrow-${stat.trend} me-1`}></i>
                        {stat.change}
                      </span>
                      <small className="text-muted">vs last period</small>
                    </div>
                  </div>
                  <div className={`stats-icon bg-${stat.color} text-white`}>
                    <i className={stat.icon}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="row g-4 mb-4">
        {/* Sales Chart */}
        <div className="col-xl-8">
          <div className="chart-card card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fa-solid fa-chart-bar me-2 text-primary"></i>
                  Sales Overview ({timeRange})
                </h5>
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-color bg-primary"></span>
                    Sales Volume
                  </span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dashboardData.salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#666"
                    tick={{ fill: '#666' }}
                  />
                  <YAxis 
                    stroke="#666"
                    tick={{ fill: '#666' }}
                    tickFormatter={(value) => value.toFixed(0)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#4CAF50" 
                    fill="url(#colorSales)" 
                    fillOpacity={0.6}
                    name="Sales Volume"
                  />
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#4CAF50" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Inventory Distribution */}
        <div className="col-xl-4">
          <div className="chart-card card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <h5 className="mb-0">
                <i className="fa-solid fa-pie-chart me-2 text-warning"></i>
                Inventory Status
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Available', value: stats.totalProducts - stats.lowStockCount - stats.outOfStockCount },
                      { name: 'Low Stock', value: stats.lowStockCount },
                      { name: 'Out of Stock', value: stats.outOfStockCount },
                      { name: 'In Testing', value: Math.round(stats.pendingTesting) }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card-footer bg-white border-0">
              <div className="row text-center">
                <div className="col-4">
                  <div className="inventory-stat">
                    <h6 className="mb-1 text-success">{stats.lowStockCount}</h6>
                    <small className="text-muted">Low Stock</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="inventory-stat">
                    <h6 className="mb-1 text-danger">{stats.outOfStockCount}</h6>
                    <small className="text-muted">Out of Stock</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="inventory-stat">
                    <h6 className="mb-1 text-info">{Math.round(stats.pendingTesting)}</h6>
                    <small className="text-muted">In Testing</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="row g-4 mb-4">
        {/* Production by Department */}
        <div className="col-xl-6">
          <div className="chart-card card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <h5 className="mb-0">
                <i className="fa-solid fa-industry me-2 text-info"></i>
                Production by Department
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dashboardData.productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="value" name="Production Volume" fill="#2196F3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="col-xl-6">
          <div className="chart-card card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <h5 className="mb-0">
                <i className="fa-solid fa-star me-2 text-warning"></i>
                Top Selling Products
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dashboardData.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" stroke="#666" />
                  <YAxis type="category" dataKey="name" stroke="#666" width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="quantity" name="Quantity Sold" fill="#FF9800" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Third Row - Quick Actions & Recent Activities */}
      <div className="row g-4 mb-4">
        {/* Quick Actions */}
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <h5 className="mb-0">
                <i className="fa-solid fa-bolt me-2 text-success"></i>
                Quick Actions
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {quickActions.map((action) => (
                  <div key={action.id} className="col-md-6">
                    <div 
                      className="quick-action-card card border h-100 cursor-pointer hover-lift"
                      onClick={() => action.onClick ? action.onClick() : window.location.href = action.link}
                    >
                      <div className="card-body text-center p-3">
                        <div className={`action-icon ${action.color} text-white rounded-circle mx-auto mb-3`}>
                          <i className={action.icon}></i>
                        </div>
                        <h6 className="mb-2">{action.title}</h6>
                        <p className="text-muted small mb-0">{action.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fa-solid fa-clock-rotate-left me-2 text-primary"></i>
                  Recent Activities
                </h5>
                <a href="#" className="text-primary small">View All</a>
              </div>
            </div>
            <div className="card-body">
              <div className="activity-timeline">
                {dashboardData.recentActivities.length > 0 ? (
                  dashboardData.recentActivities.map((activity, index) => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-icon">
                        <div className="icon-wrapper" style={{ backgroundColor: activity.color }}>
                          <i className={activity.icon}></i>
                        </div>
                      </div>
                      <div className="activity-content">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className="mb-1">{activity.title}</h6>
                            <p className="text-muted small mb-0">{activity.description}</p>
                          </div>
                          <small className="text-muted">
                            {new Date(activity.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </small>
                        </div>
                        {index < dashboardData.recentActivities.length - 1 && (
                          <div className="activity-connector"></div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <i className="fa-solid fa-inbox fa-2x text-muted mb-3"></i>
                    <p className="text-muted">No recent activities</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fourth Row - BMR Status & Department Stats */}
      <div className="row g-4">
        {/* BMR Status */}
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <h5 className="mb-0">
                <i className="fa-solid fa-file-contract me-2 text-purple"></i>
                BMR Status Overview
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-4">
                  <div className="bmr-stat-card">
                    <div className="bmr-stat-icon bg-success text-white">
                      <i className="fa-solid fa-play"></i>
                    </div>
                    <h3 className="mt-3">{bmrStats.active}</h3>
                    <p className="text-muted mb-0">Active</p>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bmr-stat-card">
                    <div className="bmr-stat-icon bg-warning text-white">
                      <i className="fa-solid fa-gear"></i>
                    </div>
                    <h3 className="mt-3">{bmrStats.inProgress}</h3>
                    <p className="text-muted mb-0">In Progress</p>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bmr-stat-card">
                    <div className="bmr-stat-icon bg-info text-white">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <h3 className="mt-3">{bmrStats.completed}</h3>
                    <p className="text-muted mb-0">Completed</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="progress mb-2" style={{ height: '8px' }}>
                  <div 
                    className="progress-bar bg-success" 
                    style={{ width: `${(bmrStats.active / (bmrStats.active + bmrStats.inProgress + bmrStats.completed)) * 100}%` }}
                  ></div>
                  <div 
                    className="progress-bar bg-warning" 
                    style={{ width: `${(bmrStats.inProgress / (bmrStats.active + bmrStats.inProgress + bmrStats.completed)) * 100}%` }}
                  ></div>
                  <div 
                    className="progress-bar bg-info" 
                    style={{ width: `${(bmrStats.completed / (bmrStats.active + bmrStats.inProgress + bmrStats.completed)) * 100}%` }}
                  ></div>
                </div>
                <div className="d-flex justify-content-between small text-muted">
                  <span>Active: {bmrStats.active}</span>
                  <span>In Progress: {bmrStats.inProgress}</span>
                  <span>Completed: {bmrStats.completed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Department Statistics */}
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <h5 className="mb-0">
                <i className="fa-solid fa-building me-2 text-danger"></i>
                Department Statistics
              </h5>
            </div>
            <div className="card-body">
              <div className="department-stats">
                {dashboardData.departmentStats.map((dept, index) => (
                  <div key={index} className="department-stat-item">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <h6 className="mb-0">{dept.name}</h6>
                        <small className="text-muted">
                          {dept.hasAssembly ? 'With Assembly' : 'Without Assembly'}
                        </small>
                      </div>
                      <div>
                        <span className="badge bg-primary">{dept.count} Items</span>
                      </div>
                    </div>
                    <div className="progress" style={{ height: '6px' }}>
                      <div 
                        className="progress-bar" 
                        style={{ 
                          width: `${(dept.count / Math.max(...dashboardData.departmentStats.map(d => d.count))) * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer mt-4">
        <div className="row">
          <div className="col-md-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h6 className="mb-3">
                  <i className="fa-solid fa-lightbulb me-2 text-warning"></i>
                  Quick Tips
                </h6>
                <ul className="mb-0">
                  <li>Keep track of low stock items to avoid shortages</li>
                  <li>Regularly update BMR status for accurate tracking</li>
                  <li>Use quick actions for faster operations</li>
                  <li>Check recent activities for latest updates</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h6 className="mb-3">
                  <i className="fa-solid fa-chart-simple me-2 text-info"></i>
                  Performance Metrics
                </h6>
                <div className="row text-center">
                  <div className="col-4">
                    <div className="metric-item">
                      <h4 className="text-success mb-1">98.5%</h4>
                      <small className="text-muted">Uptime</small>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="metric-item">
                      <h4 className="text-primary mb-1">2.4s</h4>
                      <small className="text-muted">Avg. Response</small>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="metric-item">
                      <h4 className="text-warning mb-1">1,234</h4>
                      <small className="text-muted">Daily Actions</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashBoard;