import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import "./index.css";
import Devices from "./pages/Devices";
import Users from "./pages/Users";
import Keys from "./pages/Keys";
import Alerts from "./pages/Alerts";
import PortForwards from "./pages/PortForwards";
import Analytics from './pages/Analytics';
import Deployment from './pages/Deployment';
import { useWebSocket } from './hooks/useWebSocket';
import { ConfigProvider, App as AntApp } from 'antd';

// Icons component
const Icons = {
  Menu: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Close: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Devices: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  Keys: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Alerts: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM11.07 2.82a1.5 1.5 0 012.86 0l1.67 4.49 4.49 1.67a1.5 1.5 0 010 2.86l-4.49 1.67-1.67 4.49a1.5 1.5 0 01-2.86 0L9.4 13.51l-4.49-1.67a1.5 1.5 0 010-2.86l4.49-1.67L11.07 2.82z" />
    </svg>
  ),
  PortForwards: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 5v6m0 4v6M8 5v6m0 4v6" />
    </svg>
  ),
  Analytics: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  WindowsDeployment: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Logo: () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation();
  
  const navItems = [
    { 
      path: "/", 
      label: "Devices", 
      icon: Icons.Devices, 
      badge: "5", 
      description: "Manage connected devices",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
      textColor: "text-blue-700"
    },
    { 
      path: "/users", 
      label: "Users", 
      icon: Icons.Users, 
      badge: "12", 
      description: "User management",
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
      textColor: "text-green-700"
    },
    { 
      path: "/keys", 
      label: "Keys", 
      icon: Icons.Keys, 
      badge: "3", 
      description: "Authentication keys",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100",
      textColor: "text-purple-700"
    },
    { 
      path: "/analytics", 
      label: "Analytics", 
      icon: Icons.Analytics, 
      badge: "0", 
      description: "System analytics and metrics",
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-50 hover:bg-teal-100",
      textColor: "text-teal-700"
    },
    { 
      path: "/deployment", 
      label: "Deployment", 
      icon: Icons.WindowsDeployment, 
      badge: "0", 
      description: "Windows deployment management",
      color: "from-cyan-500 to-cyan-600",
      bgColor: "bg-cyan-50 hover:bg-cyan-100",
      textColor: "text-cyan-700"
    },
    { 
      path: "/port-forwards", 
      label: "Port Forwards", 
      icon: Icons.PortForwards, 
      badge: "0", 
      description: "Port forwarding rules",
      color: "from-indigo-500 to-purple-600",
      bgColor: "bg-indigo-50 hover:bg-indigo-100",
      textColor: "text-indigo-700"
    },
    { 
      path: "/alerts", 
      label: "Alerts", 
      icon: Icons.Alerts, 
      badge: "2", 
      description: "System notifications",
      color: "from-orange-500 to-red-600",
      bgColor: "bg-orange-50 hover:bg-orange-100",
      textColor: "text-orange-700"
    },
  ];

  // Close sidebar on mobile when clicking outside or pressing Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Enhanced overlay with backdrop blur */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[var(--z-overlay)] lg:hidden animate-fade-in" 
          onClick={onClose}
          style={{ zIndex: 1030 }}
        />
      )}
      
      {/* Enhanced Responsive Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full safe-padding-y
        w-full max-w-sm sm:w-84 md:w-80 lg:w-72 xl:w-80 2xl:w-84
        bg-white/98 backdrop-blur-2xl shadow-strong z-[var(--z-sidebar)]
        transform transition-all duration-500 ease-[var(--ease-spring)]
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:z-auto lg:shadow-xl lg:bg-white
        border-r border-gray-200/80
        flex flex-col overflow-hidden
      `}
      style={{ zIndex: isOpen ? 1020 : 'auto' }}
      >
        <div className="flex flex-col h-full animate-slide-up">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between mobile-padding border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 to-white/80">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-xl text-white shadow-medium animate-pulse-soft">
                <Icons.Logo />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-lg xl:text-xl text-gray-900 truncate text-rendering">ATT Tailscale</h1>
                <p className="text-sm text-gray-500 truncate">Admin Dashboard</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="lg:hidden p-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 touch-target"
              aria-label="Close sidebar"
            >
              <Icons.Close />
            </button>
          </div>

          {/* Enhanced Navigation */}
          <nav className="flex-1 mobile-padding overflow-y-auto mobile-scroll">
            <div className="responsive-spacing">
              {navItems.map((item, index) => {
                const isActive = location.pathname === item.path;
                return (
                  <div key={item.path} 
                       className="animate-slide-up" 
                       style={{ animationDelay: `${index * 0.1}s` }}>
                    <NavLink
                      to={item.path}
                      onClick={onClose}
                      className={`
                        group relative flex items-center justify-between w-full rounded-2xl 
                        transition-all duration-500 ease-[var(--ease-spring)] touch-target
                        overflow-hidden
                        ${isActive
                          ? `nav-link-active bg-gradient-to-r ${item.color} text-white shadow-xl transform scale-[1.02]`
                          : `nav-link hover:scale-[1.02] active:scale-100 ${item.bgColor} hover:shadow-md`
                        }
                      `}
                      style={{
                        padding: 'var(--space-md) var(--space-lg)',
                      }}
                    >
                      {/* Background gradient effect for active state */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50 animate-pulse-soft" />
                      )}
                      
                      <div className="flex items-center gap-4 min-w-0 flex-1 relative z-10">
                        <div className={`
                          p-2 rounded-xl transition-all duration-500 ease-[var(--ease-spring)]
                          ${isActive 
                            ? 'bg-white/20 text-white scale-110 rotate-3 animate-bounce-in' 
                            : `${item.bgColor} ${item.textColor} group-hover:scale-110 group-hover:-rotate-3`
                          }
                        `}>
                          <item.icon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`
                            font-bold text-base block truncate transition-all duration-300
                            ${isActive ? 'text-white' : 'text-gray-900 group-hover:text-gray-800'}
                          `}>
                            {item.label}
                          </span>
                          <span className={`
                            text-xs block truncate transition-all duration-300
                            ${isActive 
                              ? 'text-white/90 opacity-100' 
                              : 'text-gray-500 opacity-0 group-hover:opacity-100 group-hover:text-gray-600'
                            }
                          `}>
                            {item.description}
                          </span>
                        </div>
                      </div>
                      
                      {item.badge && (
                        <div className="relative z-10">
                          <span className={`
                            px-3 py-1.5 text-xs font-bold rounded-full min-w-[28px] text-center
                            transition-all duration-500 ease-[var(--ease-bounce)] transform
                            ${isActive 
                              ? 'bg-white/25 text-white scale-110 animate-heartbeat' 
                              : `${item.bgColor} ${item.textColor} group-hover:scale-110 group-hover:shadow-md`
                            }
                          `}>
                            {item.badge}
                          </span>
                        </div>
                      )}
                      
                      {/* Enhanced active indicator */}
                      {isActive && (
                        <>
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-white/90 rounded-r-full shadow-xl animate-pulse" />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-white/60 rounded-full animate-ping" />
                        </>
                      )}
                      
                      {/* Hover effect background */}
                      <div className={`
                        absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                        bg-gradient-to-r from-transparent via-white/5 to-transparent
                        ${!isActive ? 'block' : 'hidden'}
                      `} />
                    </NavLink>
                  </div>
                );
              })}
            </div>

            {/* Enhanced Quick Stats */}
            <div className="mt-8 card-glass animate-slide-up border-2 border-gray-100/50" style={{ animationDelay: '0.4s' }}>
              <div style={{ padding: 'var(--space-lg)' }}>
                <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="relative">
                    <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="text-base">System Overview</span>
                </h3>
                <div className="responsive-spacing">
                  <div className="group p-3 rounded-xl hover:bg-gray-50/80 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Icons.Devices />
                        </div>
                        Total Devices
                      </span>
                      <span className="font-bold text-gray-900 bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-1.5 rounded-xl text-lg group-hover:from-blue-100 group-hover:to-blue-200 group-hover:text-blue-800 transition-all duration-300">
                        5
                      </span>
                    </div>
                  </div>
                  
                  <div className="group p-3 rounded-xl hover:bg-green-50/80 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                        Online Now
                      </span>
                      <span className="font-bold text-green-700 bg-gradient-to-r from-green-100 to-green-200 px-3 py-1.5 rounded-xl text-lg flex items-center gap-2 group-hover:from-green-200 group-hover:to-green-300 transition-all duration-300">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-heartbeat"></div>
                        3
                      </span>
                    </div>
                  </div>
                  
                  <div className="group p-3 rounded-xl hover:bg-purple-50/80 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Icons.Keys />
                        </div>
                        Active Keys
                      </span>
                      <span className="font-bold text-purple-700 bg-gradient-to-r from-purple-100 to-purple-200 px-3 py-1.5 rounded-xl text-lg group-hover:from-purple-200 group-hover:to-purple-300 transition-all duration-300">
                        3
                      </span>
                    </div>
                  </div>
                  
                  <div className="group p-3 rounded-xl hover:bg-orange-50/80 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                        Uptime
                      </span>
                      <span className="font-bold text-orange-700 bg-gradient-to-r from-orange-100 to-orange-200 px-3 py-1.5 rounded-xl group-hover:from-orange-200 group-hover:to-orange-300 transition-all duration-300">
                        99.9%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Enhanced Footer */}
          <div className="mobile-padding border-t border-gray-200/60 bg-gradient-to-r from-gray-50/80 to-blue-50/80 mobile-nav">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3 text-xs">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-full font-medium">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  System Healthy
                </div>
              </div>
              <div className="text-xs text-gray-400 font-medium">
                Version 1.0.0 • Updated 2min ago
              </div>
              <div className="flex justify-center gap-1">
                <div className="w-1 h-1 bg-blue-300 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return { 
        title: 'Devices', 
        subtitle: 'Manage connected devices',
        icon: Icons.Devices,
        color: 'from-blue-500 to-blue-600'
      };
      case '/users': return { 
        title: 'Users', 
        subtitle: 'User management',
        icon: Icons.Users,
        color: 'from-green-500 to-green-600'
      };
      case '/keys': return { 
        title: 'Keys', 
        subtitle: 'Authentication keys',
        icon: Icons.Keys,
        color: 'from-purple-500 to-purple-600'
      };
      case '/analytics': return { 
        title: 'Analytics', 
        subtitle: 'System analytics and metrics',
        icon: Icons.Analytics,
        color: 'from-teal-500 to-teal-600'
      };
      case '/deployment': return { 
        title: 'Deployment', 
        subtitle: 'Deployment management',
        icon: Icons.WindowsDeployment,
        color: 'from-cyan-500 to-cyan-600'
      };
      case '/port-forwards': return { 
        title: 'Port Forwards', 
        subtitle: 'Port forwarding rules',
        icon: Icons.PortForwards,
        color: 'from-indigo-500 to-purple-600'
      };
      case '/alerts': return { 
        title: 'Alerts', 
        subtitle: 'System notifications',
        icon: Icons.Alerts,
        color: 'from-orange-500 to-red-600'
      };
      default: return { 
        title: 'Dashboard', 
        subtitle: 'Manage your Tailscale network',
        icon: Icons.Logo,
        color: 'from-blue-500 to-purple-600'
      };
    }
  };
  
  const pageInfo = getPageTitle();
  
  return (
    <header className="bg-white/98 backdrop-blur-xl shadow-soft border-b border-gray-200/80 sticky top-0 z-40 animate-slide-down">
      <div className="container-responsive">
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-md) 0' }}>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={onMenuClick}
              className="lg:hidden btn-ghost p-3 rounded-xl transition-all duration-300 ease-[var(--ease-spring)] transform hover:scale-105 active:scale-95 animate-scale-in touch-target"
              aria-label="Open menu"
            >
              <Icons.Menu />
            </button>
            
            {/* Enhanced page title with icon */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`
                hidden sm:flex p-2.5 rounded-xl bg-gradient-to-br ${pageInfo.color} text-white shadow-md 
                animate-bounce-in transform hover:scale-110 transition-transform duration-300
              `}>
                <pageInfo.icon />
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className={`
                    font-bold text-gray-900 truncate text-rendering animate-fade-in
                    text-lg sm:text-xl lg:text-2xl
                  `} style={{
                    fontSize: 'var(--text-xl)'
                  }}>
                    {pageInfo.title}
                  </h2>
                  {/* Mobile icon */}
                  <div className={`
                    sm:hidden p-1.5 rounded-lg bg-gradient-to-br ${pageInfo.color} text-white shadow-sm
                  `}>
                    <pageInfo.icon />
                  </div>
                </div>
                <p className={`
                  text-gray-600 truncate animate-fade-in-up
                  text-xs sm:text-sm
                `} 
                style={{ 
                  animationDelay: '0.1s',
                  fontSize: 'var(--text-sm)'
                }}>
                  {pageInfo.subtitle}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Enhanced network status */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded-xl font-semibold shadow-sm animate-scale-in transition-all duration-300 hover:shadow-md hover:scale-105">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="hidden xs:inline text-xs sm:text-sm font-bold">Online</span>
              <span className="xs:hidden text-green-600">●</span>
            </div>
            
            {/* Enhanced quick actions */}
            <div className="hidden md:flex items-center gap-1">
              <button className="btn-ghost p-2.5 rounded-xl transition-all duration-300 group hover:scale-110 active:scale-95" title="Notifications">
                <div className="relative">
                  <svg className="w-5 h-5 text-gray-600 group-hover:text-orange-600 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17V7a6 6 0 00-12 0v10a1 1 0 001 1h8z" />
                  </svg>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
                </div>
              </button>
              <button className="btn-ghost p-2.5 rounded-xl transition-all duration-300 group hover:scale-110 active:scale-95" title="Settings">
                <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Mobile settings button */}
            <button className="md:hidden btn-ghost p-2.5 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95" title="More options">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { connectionStatus } = useWebSocket('ws://localhost:8000/ws/admin-user');
  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Close sidebar on route change (mobile)
  const location = useLocation();
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
        <AntApp>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl text-white shadow-xl mx-auto mb-4 flex items-center justify-center animate-pulse-soft">
                <Icons.Logo />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">ATT Tailscale</h2>
              <div className="flex justify-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </AntApp>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
      <AntApp>
        {/* Connection status indicator */}
        <div className={`fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-xs ${
          connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
          connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {connectionStatus === 'connected' && '🟢 Live'}
          {connectionStatus === 'connecting' && '🟡 Connecting...'}
          {connectionStatus === 'disconnected' && '🔴 Disconnected'}
        </div>
        
        {/* Existing app content */}
        <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-white to-blue-50/30 animate-fade-in relative overflow-hidden">
          <div className="flex h-[100dvh] overflow-hidden relative">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className="flex-1 flex flex-col min-w-0 lg:ml-0 relative overflow-hidden">
              <Header onMenuClick={() => setSidebarOpen(true)} />
              
              <main className="flex-1 overflow-auto mobile-scroll safe-padding-x">
                <div className="container-responsive responsive-spacing animate-slide-up" style={{
                  padding: 'var(--space-lg) var(--space-md)',
                  minHeight: 'calc(100vh - 80px)', // Account for header height
                }}>
                  <div className="w-full">
                    <Routes>
                      <Route path="/" element={<Devices />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/keys" element={<Keys />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/deployment" element={<Deployment />} />
                      <Route path="/port-forwards" element={<PortForwards />} />
                      <Route path="/alerts" element={<Alerts />} />
                    </Routes>
                  </div>
                </div>
                
                {/* Decorative background elements */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                  <div className="absolute top-20 right-10 w-72 h-72 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-full blur-3xl animate-float"></div>
                  <div className="absolute bottom-20 left-10 w-96 h-96 bg-gradient-to-br from-green-400/10 to-blue-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-purple-400/5 to-pink-600/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>
);
