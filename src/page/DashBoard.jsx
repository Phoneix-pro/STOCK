import "./DashBoard.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

function DashBoard({ products }) {
  // === Dashboard calculations ===
  const totalProducts = products.length;
  const totalPrice = products.reduce(
    (total, item) => total + item.price * item.Quantity,
    0
  );
  const totalStock = products.reduce((total, item) => total + item.Quantity, 0);
  const lowStock = products.filter((item) => item.Quantity <= 5).length;
  const outStock = products.filter((item) => item.Quantity === 0).length;

  // === Data for PieChart ===
  const pieData = [
    { name: "Available", value: totalStock },
    { name: "Low Stock", value: lowStock },
    { name: "Out of Stock", value: outStock },
  ];

  const COLORS = ["#00C49F", "#FFBB28", "#FF4444"];

  // === Data for BarChart ===
  const barData = products.map((p) => ({
    name: p.name,
    stock: p.Quantity,
  }));

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4 text-primary fw-bold">
        Inventory Dashboard
      </h2>

      {/* === Summary Boxes === */}
      <div className="row text-center mb-5">
        <div className="col-md-3 mb-3">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title text-muted">Total Products</h5>
              <h3 className="text-primary">{totalProducts}</h3>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title text-muted">Total Stock Value</h5>
              <h3 className="text-success">₹{totalPrice}</h3>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title text-muted">Low Stock</h5>
              <h3 className="text-warning">{lowStock}</h3>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title text-muted">Out of Stock</h5>
              <h3 className="text-danger">{outStock}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* === Charts Section === */}
      <div className="row">
        {/* Pie Chart */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm border-0 p-3">
            <h5 className="text-center text-secondary">Stock Distribution</h5>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm border-0 p-3">
            <h5 className="text-center text-secondary">Product-wise Stock</h5>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashBoard;
