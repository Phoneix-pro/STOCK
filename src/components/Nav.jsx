import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Nav.css";

function NAV() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Check screen size on mount and resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const navLinks = [
    { path: "/", label: "DASHBOARD", icon: "fa-chart-pie" },
    { path: "/Inward", label: "INWARD", icon: "fa-up-down" },
    { path: "/Stocks", label: "STOCKS", icon: "fa-box-open" },
    { path: "/Production", label: "PRODUCTION", icon: "fa-brands fa-product-hunt" },
    { path: "/Sales", label: "SALES", icon: "fa-hand-holding-heart" }
  ];

  return (
    <nav className="nav-container">
      <div className="nav-content">
        {/* Logo and Brand Section */}
        <div className="brand-section">
          <div className="brand-logo">
            <i className="fa-solid fa-boxes-stacked"></i>
          </div>
          <h1 className="brand-title">Stock Management</h1>
          
          {/* Mobile Menu Toggle Button */}
          {isMobile && (
            <button 
              className={`mobile-menu-toggle ${mobileMenuOpen ? 'open' : ''}`}
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          )}
        </div>

        {/* Desktop Navigation Items */}
        {!isMobile && (
          <div className="nav-items">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
              >
                <i className={`fa-solid ${link.icon}`}></i>
                <span className="link-text">{link.label}</span>
                {location.pathname === link.path && (
                  <span className="active-indicator"></span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Mobile Navigation Menu */}
        {isMobile && mobileMenuOpen && (
          <div className="mobile-nav-menu">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={toggleMobileMenu}
              >
                <i className={`fa-solid ${link.icon}`}></i>
                <span className="link-text">{link.label}</span>
                {location.pathname === link.path && (
                  <span className="mobile-active-indicator"></span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* User Profile/Status (Optional) */}
        <div className="nav-status">
          <div className="status-dot"></div>
          <span className="status-text">System Online</span>
        </div>
      </div>
    </nav>
  );
}

export default NAV;