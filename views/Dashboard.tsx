
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecentClients } from '../services/firebase';
import { fetchOmipData, OmipDashboardData } from '../services/omipService';
import { ClientData } from '../types';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [recentClients, setRecentClients] = useState<ClientData[]>([]);
  const [marketData, setMarketData] = useState<OmipDashboardData | null>(null);
  const [loadingOmip, setLoadingOmip] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [timeRange, setTimeRange] = useState<'1W' | '1M' | '3M' | '6M'>('1M');

  useEffect(() => {
    getRecentClients().then(setRecentClients);
    loadOmipData();
    const interval = setInterval(loadOmipData, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const loadOmipData = async () => {
      const result = await fetchOmipData();
      setMarketData(result.data);
      setIsFallback(result.isFallback);
      setLoadingOmip(false);
  };

  const getFilteredData = () => {
      if (!marketData?.chartData) return [];
      const now = new Date();
      let daysToSubtract = 30;
      
      switch(timeRange) {
          case '1W': daysToSubtract = 7; break;
          case '1M': daysToSubtract = 30; break;
          case '3M': daysToSubtract = 90; break;
          case '6M': daysToSubtract = 180; break;
      }
      
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - daysToSubtract);
      
      return marketData.chartData.filter(d => new Date(d.timestamp) >= cutoff);
  };

  const filteredData = getFilteredData();
  const latestPrice = filteredData.length > 0 ? filteredData[filteredData.length - 1].value : 0;
  const kwhPrice = latestPrice / 1000;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      return (
        <div className="bg-[#050505]/90 backdrop-blur-xl border border-white/10 p-4 shadow-2xl rounded-2xl text-white font-sans transform transition-all">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{new Date(label).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-watton-lime tracking-tighter">€{val.toFixed(2)}</span>
              <div className="flex flex-col items-start leading-none gap-1">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">Preço MWh</span>
                  <span className="text-[10px] font-bold text-white">~€{(val/1000).toFixed(4)} / kWh</span>
              </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* 1. HERO HEADER WITH ACTION */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-watton-lime animate-pulse"></div>
                <span className="text-[10px] font-bold text-watton-lime uppercase tracking-[0.2em]">Live Market Data</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter leading-none">Market<span className="text-transparent bg-clip-text bg-gradient-to-r from-watton-lime to-green-600">Pulse</span></h2>
            <p className="text-sm text-gray-400 font-medium tracking-wide mt-2 max-w-lg">
                Visão estratégica do mercado OMIP e gestão integrada de portfólio de energia.
            </p>
        </div>
        
        {/* BUTTON: Clean & Minimalist Premium */}
        <Link 
            to="/simulation" 
            className="group relative flex items-center gap-6 bg-watton-dark px-8 py-4 rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-[0_20px_40px_-10px_rgba(46,90,39,0.5)] hover:-translate-y-1 ring-1 ring-white/10"
        >
            {/* Subtle Lighting Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-watton-lime rounded-full blur-[50px] opacity-10 group-hover:opacity-30 transition-opacity duration-500 translate-x-10 -translate-y-10"></div>
            
            <div className="flex flex-col relative z-10">
                <span className="text-[9px] font-bold text-watton-lime uppercase tracking-[0.25em] mb-0.5">Novo Estudo</span>
                <span className="text-xl font-bold text-white tracking-tight">Criar Simulação</span>
            </div>
            
            <div className="relative z-10 w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-watton-lime group-hover:bg-watton-lime group-hover:text-black transition-all duration-300 group-hover:scale-110 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </div>
        </Link>
      </div>

      {/* 2. BENTO GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Futures Table (Glass Card) */}
          <div className="lg:col-span-3 flex flex-col h-full">
              <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 p-5 h-full flex flex-col shadow-2xl overflow-hidden relative">
                  {/* Decorative noise/gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                  
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-xs text-white font-bold uppercase tracking-widest flex items-center gap-2">
                        OMIP Futures
                    </h3>
                    <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-gray-300">PT</span>
                  </div>
                  
                  <div className="flex-1 overflow-auto pr-1 custom-scrollbar relative z-10">
                      <div className="space-y-2">
                          {loadingOmip ? (
                              <div className="space-y-3">
                                  {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse"></div>)}
                              </div>
                          ) : marketData?.tableData.map((item, idx) => (
                              <div key={idx} className={`flex justify-between items-center p-3.5 rounded-xl border transition-all duration-300 group cursor-default ${item.label.includes('YR-26') || item.label.includes('Yr-26') ? 'bg-watton-lime/10 border-watton-lime/30 shadow-[0_0_15px_rgba(139,197,63,0.1)]' : 'bg-black/20 border-transparent hover:bg-white/5 hover:border-white/5'}`}>
                                  <div className="flex flex-col">
                                      <span className={`font-bold text-xs ${item.label.includes('YR-26') ? 'text-watton-lime' : 'text-gray-400 group-hover:text-gray-200'}`}>{item.label}</span>
                                      {item.label.includes('YR-26') && <span className="text-[7px] text-watton-lime uppercase font-bold tracking-wider opacity-80">Benchmark</span>}
                                  </div>
                                  <div className="text-right">
                                      <div className="font-mono font-bold text-white text-sm tracking-tight">€{item.price.toFixed(2)}</div>
                                      <div className={`text-[9px] font-bold flex items-center justify-end gap-1 ${item.trend === 'up' ? 'text-emerald-400' : item.trend === 'down' ? 'text-rose-400' : 'text-gray-500'}`}>
                                          {item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '−'}
                                          {Math.abs(item.change).toFixed(2)}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
                  {isFallback && <p className="text-[8px] text-gray-600 mt-4 text-center border-t border-white/5 pt-2">Fonte Indisponível</p>}
              </div>
          </div>

          {/* RIGHT: Advanced Chart (Glass Card) */}
          <div className="lg:col-span-9 h-[500px]">
               <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 p-1 h-full shadow-2xl relative overflow-hidden group">
                   
                   {/* Background Elements */}
                   <div className="absolute top-0 right-0 w-96 h-96 bg-watton-lime/5 rounded-full blur-[100px] pointer-events-none"></div>
                   <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>

                   {/* Chart Header Overlay */}
                   <div className="absolute top-6 left-6 z-10">
                        <div className="flex items-center gap-3">
                            <h3 className="text-white font-black text-2xl tracking-tight">
                                Power PT Base Load <span className="text-gray-500 text-lg font-medium">YR-26</span>
                            </h3>
                            <span className="bg-watton-lime text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">Bullish</span>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3">
                             <div className="flex flex-col">
                                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Último Fecho</span>
                                 <span className="text-white font-mono font-bold text-lg">€{latestPrice.toFixed(2)}</span>
                             </div>
                             <div className="w-px h-8 bg-white/10"></div>
                             <div className="flex flex-col">
                                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Conversão kWh</span>
                                 <span className="text-watton-lime font-mono font-bold text-lg">{kwhPrice.toFixed(4)} €</span>
                             </div>
                        </div>
                   </div>

                   {/* Time Range Selectors */}
                   <div className="absolute top-6 right-6 z-10 flex bg-black/40 backdrop-blur rounded-xl p-1 border border-white/10">
                       {(['1W', '1M', '3M', '6M'] as const).map((r) => (
                           <button
                               key={r}
                               onClick={() => setTimeRange(r)}
                               className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${timeRange === r ? 'bg-watton-lime text-black shadow-lg shadow-watton-lime/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                           >
                               {r}
                           </button>
                       ))}
                   </div>

                   {loadingOmip ? (
                       <div className="h-full flex items-center justify-center text-gray-500 animate-pulse font-bold tracking-widest uppercase text-xs">A carregar dados de mercado...</div>
                   ) : (
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={filteredData} margin={{ top: 100, right: 0, left: 0, bottom: 0 }}>
                               <defs>
                                   <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#8BC53F" stopOpacity={0.4}/>
                                       <stop offset="95%" stopColor="#8BC53F" stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" opacity={0.05} />
                               <XAxis 
                                    dataKey="timestamp" 
                                    tickFormatter={(str) => {
                                        const d = new Date(str);
                                        return `${d.getDate()} ${d.toLocaleString('pt-PT', { month: 'short' }).replace('.', '')}`;
                                    }}
                                    tick={{fill: '#525252', fontSize: 10, fontWeight: 600}}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={15}
                                    minTickGap={50}
                               />
                               <YAxis 
                                    domain={['auto', 'auto']} 
                                    orientation="right"
                                    tick={{fill: '#525252', fontSize: 11, fontWeight: 600, fontFamily: 'monospace'}}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                    tickFormatter={(val) => `€${val.toFixed(0)}`}
                                />
                               <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8BC53F', strokeWidth: 1, strokeDasharray: '4 4' }} />
                               <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#8BC53F" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorPrice)" 
                                    activeDot={{ r: 8, strokeWidth: 4, stroke: '#000', fill: '#8BC53F' }}
                                    animationDuration={1500}
                                    animationEasing="ease-out"
                               />
                           </AreaChart>
                       </ResponsiveContainer>
                   )}
               </div>
          </div>
      </div>

      {/* 3. CARDS GRID (Recent Simulations) */}
      <div className="pt-8">
        <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3 tracking-tight">
            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/5">📋</span> 
            Últimas Simulações
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {recentClients.length === 0 ? (
            <div className="col-span-full py-20 text-center text-gray-600 bg-white/5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center">
              <span className="text-4xl block mb-4 opacity-30 grayscale">📂</span>
              <p className="font-medium">Nenhuma simulação no histórico.</p>
            </div>
          ) : (
              recentClients.map(client => (
                <Link key={client.id} to={`/simulation?id=${client.id}`} className="group relative bg-white/5 backdrop-blur-sm border border-white/5 rounded-3xl p-6 hover:border-watton-lime/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-watton-lime/10 overflow-hidden">
                  
                  {/* Card Gradient Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-watton-lime/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Header */}
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex-1 pr-4">
                        <div className="font-bold text-white text-lg group-hover:text-watton-lime transition duration-300 truncate tracking-tight">{client.companyName || 'Sem Nome'}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-1 tracking-wider">{client.nif}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/5 group-hover:bg-watton-lime group-hover:text-black group-hover:scale-110 transition-all duration-300 shadow-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex gap-3 mb-6 relative z-10">
                      <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                          <span className="text-[8px] text-gray-500 uppercase font-bold block mb-0.5">Tensão</span>
                          <span className="text-gray-200 font-bold text-xs">{client.tensionLevel}</span>
                      </div>
                      <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                          <span className="text-[8px] text-gray-500 uppercase font-bold block mb-0.5">Produto</span>
                          <span className="text-gray-200 font-bold text-xs">{client.productType}</span>
                      </div>
                  </div>
                  
                  {/* Footer Stats */}
                  <div className="flex justify-between items-end pt-4 border-t border-white/5 relative z-10">
                      <div className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-1 rounded">
                          {new Date(client.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-white leading-none group-hover:text-watton-lime transition duration-300 tracking-tighter">
                            {(client.annualSavingsPercent || 0).toFixed(1)}<span className="text-lg text-gray-500 font-medium">%</span>
                        </div>
                        <div className="text-[9px] text-gray-500 uppercase font-bold mt-1 tracking-wider">Poupança Est.</div>
                      </div>
                  </div>
                </Link>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
