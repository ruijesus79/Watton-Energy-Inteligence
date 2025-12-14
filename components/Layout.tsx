
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [appLogo, setAppLogo] = useState<string | null>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem('watton_app_logo');
    if (savedLogo) setAppLogo(savedLogo);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAppLogo(result);
        localStorage.setItem('watton_app_logo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { path: '/simulation', label: 'Nova Simulação', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { path: '/clients', label: 'Portfólio', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { path: '/tables', label: 'Tabelas & Preços', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-gray-200 overflow-hidden font-sans print:h-auto print:overflow-visible print:block print:bg-white print:text-black selection:bg-watton-lime selection:text-black">
      
      {/* Background Ambient Glows (Behance Style) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 no-print">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-watton-dark/20 blur-[120px] mix-blend-screen animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-watton-lime/5 blur-[100px] mix-blend-screen"></div>
      </div>

      {/* Sidebar - Floating Glass Pane */}
      <aside className="w-72 relative z-20 flex flex-col no-print my-4 ml-4 rounded-3xl border border-white/5 bg-black/40 backdrop-blur-xl shadow-2xl">
        <div className="p-8 pb-4 relative group">
          {/* Logo Section */}
          <div className="relative cursor-pointer mb-6">
            {appLogo ? (
                <img src={appLogo} alt="Watton Logo" className="h-14 w-auto object-contain transition-all duration-300 group-hover:scale-105" />
            ) : (
                <div className="flex flex-col">
                    <h1 className="text-3xl font-black text-white tracking-tighter leading-none">
                        WATTON <span className="text-watton-lime">.</span>
                    </h1>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1 ml-0.5">Energy Intelligence</span>
                </div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="bg-black/80 text-white text-[9px] px-2 py-1 rounded backdrop-blur">Alterar Logo</span>
            </div>
            
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
                <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                    isActive
                    ? 'text-white shadow-lg shadow-watton-lime/10'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
                >
                {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-watton-lime/10 to-transparent border-l-2 border-watton-lime opacity-100 transition-all"></div>
                )}
                
                <svg className={`w-5 h-5 transition-colors ${isActive ? 'text-watton-lime' : 'text-gray-600 group-hover:text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d={item.icon} clipRule="evenodd" />
                </svg>
                
                <span className={`text-sm font-bold tracking-wide relative z-10 ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                </Link>
            );
          })}
        </nav>
        
        <div className="p-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-watton-lime/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <h4 className="text-xs font-bold text-white mb-1 relative z-10">Suporte Watton</h4>
                <p className="text-[10px] text-gray-500 relative z-10">Precisa de ajuda com a plataforma?</p>
                <div className="w-2 h-2 rounded-full bg-green-500 absolute top-4 right-4 animate-pulse"></div>
            </div>
            <div className="mt-4 text-[9px] text-center text-gray-600 font-mono">
                v1.1.2 • Watton EIP
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative z-10 print:overflow-visible print:h-auto print:bg-white print:block print:w-full">
        <div className="max-w-[1600px] mx-auto p-8 lg:p-10 print:p-0 print:max-w-none print:mx-0">
          {children}
        </div>
      </main>
    </div>
  );
};
