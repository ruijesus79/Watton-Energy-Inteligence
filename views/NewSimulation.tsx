
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InvoiceData, ClientData, Period, WattonStrategy } from '../types';
import { DEFAULT_INVOICE_DATA, TENSION_LEVELS, CYCLES, PRODUCT_TYPES, BILLING_PERIOD_TYPES, MASTER_STRATEGIES } from '../constants';
import { saveClient, getClientById } from '../services/firebase';
import { parseInvoice } from '../services/ocrService';
import { simulateWattonProposal } from '../services/calculationEngine';
import { generateExpertAnalysis } from '../services/aiAnalysisService';
import { VulnerabilityReport } from './VulnerabilityReport';

interface ExtendedPeriodData {
    period: string;
    kwh: number;
    currentPriceEur: number;
    manualWattonPrice?: number;
}

export const NewSimulation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'upload' | 'edit' | 'report'>('upload');
  
  // Data State
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(DEFAULT_INVOICE_DATA);
  const [extendedConsumption, setExtendedConsumption] = useState<ExtendedPeriodData[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<ClientData['invoiceFile']>(undefined);
  
  // Configuration State
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(MASTER_STRATEGIES[0].id);
  const [activeStrategy, setActiveStrategy] = useState<WattonStrategy>(MASTER_STRATEGIES[0]);
  const [manualMargin, setManualMargin] = useState<number | undefined>(undefined);
  
  // POWER PRICE LOGIC
  const [powerSpread, setPowerSpread] = useState<number>(0.2500);
  const [manualPowerPrice, setManualPowerPrice] = useState<number | undefined>(undefined);

  // Result State
  const [result, setResult] = useState<any>({
    annualCostCurrent: 0,
    annualCostWatton: 0,
    annualSavingsEur: 0,
    annualSavingsPercent: 0,
    appliedMarginEurKwh: 0,
    monthlyStats: [],
    monthlyTotals: { 
        currentEnergy: 0, wattonEnergy: 0, 
        currentPower: 0, wattonPower: 0,
        currentTotal: 0, wattonTotal: 0 
    }
  });

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [reportConfig, setReportConfig] = useState<ClientData['reportData']>({});
  const [savedVulnerabilityScore, setSavedVulnerabilityScore] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get('id');
    const viewMode = searchParams.get('view');

    if (id) {
      setLoading(true);
      getClientById(id).then(client => {
        if (client) {
          setClientId(client.id);
          setInvoiceData(client);
          setInvoiceFile(client.invoiceFile);
          
          const overrides = (client.simulationConfig as any)?.priceOverrides || {};
          
          const safeConsumption = client.consumptionData || [];
          setExtendedConsumption(safeConsumption.map((c, idx) => ({
              ...c,
              manualWattonPrice: overrides[c.period] !== undefined ? overrides[c.period] : undefined 
          })));
          
          setReportConfig(client.reportData || {});
          setSavedVulnerabilityScore(client.vulnerabilityScore);
          
          if (client.simulationConfig?.strategyId) {
             const strat = MASTER_STRATEGIES.find(s => s.id === client.simulationConfig?.strategyId);
             if (strat) {
                 setSelectedStrategyId(strat.id);
                 setActiveStrategy(strat);
             }
          }
          if (client.simulationConfig?.manualMargin !== undefined) setManualMargin(client.simulationConfig.manualMargin);
          if (client.simulationConfig?.manualPowerPrice !== undefined) setManualPowerPrice(client.simulationConfig.manualPowerPrice);
          
          if (viewMode === 'report') setStep('report');
          else setStep('edit');
        }
        setLoading(false);
      });
    } else {
        setExtendedConsumption(DEFAULT_INVOICE_DATA.consumptionData.map(c => ({...c})));
    }
  }, [searchParams]);

  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedStrategyId(id);
      const strat = MASTER_STRATEGIES.find(s => s.id === id);
      if (strat) {
          setActiveStrategy(strat);
      }
  };

  const handleSpreadChange = (val: number) => setPowerSpread(val);
  const handleFinalPowerPriceChange = (val: number) => setManualPowerPrice(val);
  const resetPowerPrice = () => setManualPowerPrice(undefined);

  useEffect(() => {
    if (activeStrategy && extendedConsumption.length > 0) {
      const syncInvoice: InvoiceData = { 
          ...invoiceData, 
          consumptionData: extendedConsumption.map(c => ({
              period: c.period,
              kwh: c.kwh,
              currentPriceEur: c.currentPriceEur,
              percentage: 0
          }))
      };

      const overrides: Record<string, number> = {};
      extendedConsumption.forEach(c => {
          if (c.manualWattonPrice !== undefined && !isNaN(c.manualWattonPrice)) {
              overrides[c.period] = c.manualWattonPrice;
          }
      });

      const calculatedPowerPrice = manualPowerPrice !== undefined 
          ? manualPowerPrice 
          : (activeStrategy.proposalPowerPriceDaily + powerSpread);

      const effectiveStrategy = {
          ...activeStrategy,
          proposalPowerPriceDaily: calculatedPowerPrice
      };

      const engineResult = simulateWattonProposal(syncInvoice, effectiveStrategy, manualMargin, overrides);
      setResult(engineResult);
    }
  }, [
      invoiceData.daysInPeriod, 
      invoiceData.dailyPowerCostEur, 
      invoiceData.companyName, 
      invoiceData.nif, 
      invoiceData.tensionLevel, 
      invoiceData.cycleType, 
      extendedConsumption, 
      activeStrategy, 
      manualMargin, 
      manualPowerPrice,
      powerSpread 
  ]);

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const data = await parseInvoice(base64String, file.type);
        
        const newConsumption = data.consumptionData ? data.consumptionData.map((c: any) => ({...c, manualWattonPrice: undefined})) : extendedConsumption;

        const newInvoiceData = {
          ...invoiceData,
          ...data,
          consumptionData: newConsumption,
          daysInPeriod: data.daysInPeriod || invoiceData.daysInPeriod || 30
        };

        const fileData = {
            name: file.name,
            mimeType: file.type,
            data: base64String
        };

        setInvoiceData(newInvoiceData as InvoiceData);
        setExtendedConsumption(newConsumption);
        setInvoiceFile(fileData);
        
        const initialResult = simulateWattonProposal(newInvoiceData as InvoiceData, activeStrategy, manualMargin);
        
        const clientPayload: ClientData = {
            ...(newInvoiceData as InvoiceData),
            ...initialResult,
            invoiceFile: fileData,
            vulnerabilityScore: 'PENDING',
            notes: 'OCR Import',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            simulationConfig: { strategyId: selectedStrategyId, manualMargin, manualPowerPrice }
        };

        const newId = await saveClient(clientPayload);
        setClientId(newId);
        setStep('edit');
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Falha ao ler fatura.");
      setLoading(false);
      setStep('edit');
    }
  };

  const buildClientPayload = (): ClientData => {
     const syncInvoice = { 
        ...invoiceData, 
        consumptionData: extendedConsumption.map(c => ({
            period: c.period,
            kwh: c.kwh,
            currentPriceEur: c.currentPriceEur,
            percentage: 0
        }))
    };
    
    const finalPower = manualPowerPrice !== undefined ? manualPowerPrice : (activeStrategy.proposalPowerPriceDaily + powerSpread);
    
    let calcScore = "5";
    if (result.annualSavingsPercent > 30) calcScore = "10";
    else if (result.annualSavingsPercent > 20) calcScore = "8";
    else if (result.annualSavingsPercent > 10) calcScore = "7";
    else if (result.annualSavingsPercent > 5) calcScore = "6";

    const overrides: Record<string, number> = {};
    extendedConsumption.forEach(c => {
        if (c.manualWattonPrice !== undefined && !isNaN(c.manualWattonPrice)) {
            overrides[c.period] = c.manualWattonPrice;
        }
    });

    const finalScore = (savedVulnerabilityScore && savedVulnerabilityScore !== 'PENDING') 
        ? savedVulnerabilityScore 
        : calcScore;

    return {
        ...syncInvoice,
        ...result,
        id: clientId,
        invoiceFile: invoiceFile,
        vulnerabilityScore: finalScore,
        notes: '',
        createdAt: 0, 
        updatedAt: 0,
        reportData: reportConfig,
        simulationConfig: { 
            strategyId: selectedStrategyId, 
            manualMargin, 
            manualPowerPrice: finalPower,
            priceOverrides: overrides 
        }
    };
  };

  const handleSaveProgress = async () => {
      if (!invoiceData.companyName) return alert("Preencha o nome da empresa.");
      const payload = buildClientPayload();
      const btn = document.getElementById('btn-save-progress');
      if (btn) btn.innerText = '💾 A Gravar...';
      try {
        const id = await saveClient(payload);
        setClientId(id);
        if (btn) {
            btn.innerText = '✅ Gravado!';
            setTimeout(() => btn.innerText = '💾 GRAVAR', 2000);
        }
      } catch (e) {
          alert("Erro ao gravar.");
          if (btn) btn.innerText = '❌ Erro';
      }
  };

  const handleGenerateAnalysis = async () => {
    if (!invoiceData.companyName) return alert("Preencha o nome da empresa.");
    setAnalyzing(true);
    setAnalysisStep("A analisar perfis de consumo e fator de carga...");
    await new Promise(r => setTimeout(r, 800));
    setAnalysisStep(`A analisar estratégia: ${activeStrategy.name}...`);
    const clientForAnalysis = buildClientPayload();
    clientForAnalysis.appliedStrategyName = activeStrategy.name;

    try {
        const analysis = await generateExpertAnalysis(clientForAnalysis, activeStrategy.type);
        setAnalysisStep("A gerar estratégia de otimização...");
        await new Promise(r => setTimeout(r, 600));

        const newReportConfig = {
            diagnosisText: `${analysis.diagnosisPriceText}|${analysis.diagnosisOppText}`,
            strategyText: analysis.strategyText,
            insightText: analysis.insightText,
            marketContextText: analysis.visionText,
            regulatoryText: analysis.regulatoryAdvice,
            riskAnalysisText: analysis.riskAnalysis,
            efficiencyText: analysis.efficiencyStrategy,
            logoUrl: reportConfig?.logoUrl || "https://picsum.photos/200/80",
            marketGraphUrl: reportConfig?.marketGraphUrl,
            predictionGraphUrl: reportConfig?.predictionGraphUrl
        };

        setReportConfig(newReportConfig);
        setSavedVulnerabilityScore(analysis.vulnerabilityScore);

        const clientPayload: ClientData = {
            ...clientForAnalysis,
            vulnerabilityScore: analysis.vulnerabilityScore,
            reportData: newReportConfig,
            updatedAt: Date.now()
        };
        const id = await saveClient(clientPayload);
        setClientId(id);
        setStep('report');
    } catch (e) {
        alert("Erro na análise AI. Tente novamente.");
    } finally {
        setAnalyzing(false);
        setAnalysisStep("");
    }
  };

  const handleRowChange = (index: number, field: keyof ExtendedPeriodData, value: string | number) => {
      const newCons = [...extendedConsumption];
      // @ts-ignore
      newCons[index][field] = value;
      setExtendedConsumption(newCons);
  };
  const addRow = () => setExtendedConsumption([...extendedConsumption, { period: 'Novo Período', kwh: 0, currentPriceEur: 0 }]);
  const removeRow = (index: number) => setExtendedConsumption(extendedConsumption.filter((_, i) => i !== index));

  if (loading) return <div className="min-h-screen flex items-center justify-center text-watton-lime animate-pulse text-xl font-bold">A processar dados e a guardar...</div>;

  if (analyzing) {
      return (
          <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-8 backdrop-blur-md">
              <div className="w-24 h-24 mb-6 relative">
                  <div className="absolute inset-0 border-4 border-watton-lime/30 rounded-full animate-ping"></div>
                  <div className="absolute inset-2 border-4 border-watton-lime rounded-full animate-spin border-t-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-4xl">🧠</div>
              </div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Watton AI Analyst</h2>
              <p className="text-watton-lime font-mono text-sm animate-pulse">{analysisStep}</p>
              <div className="mt-8 w-full max-w-md bg-gray-800 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-watton-lime animate-progress-indeterminate"></div></div>
          </div>
      );
  }

  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-fade-in">
        <h2 className="text-4xl font-bold text-white mb-2">Simulador Watton</h2>
        <div className="border-2 border-dashed border-gray-700 rounded-2xl p-12 hover:border-watton-lime transition cursor-pointer bg-gray-900 relative">
            <input type="file" accept="image/*,application/pdf" onChange={handleInvoiceUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="text-white font-bold text-lg">Upload Fatura (PDF)</div>
            <p className="text-gray-500 text-sm mt-2">A fatura ficará gravada no portfólio do cliente.</p>
        </div>
        <button onClick={() => setStep('edit')} className="text-gray-500 hover:text-white underline text-sm">Entrada Manual</button>
      </div>
    );
  }

  if (step === 'report') {
    return <VulnerabilityReport data={{...buildClientPayload(), id: clientId}} onBack={() => setStep('edit')} />;
  }

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex justify-between items-center border-b border-gray-800 pb-6">
        <div className="flex items-center gap-3"><h2 className="text-3xl font-bold text-white tracking-tight">Simulador <span className="text-watton-lime">Watton</span></h2></div>
        <div className="flex items-center gap-4">
            <button onClick={() => { if(window.confirm('Reiniciar?')) setStep('upload'); }} className="h-11 px-4 rounded-xl font-bold text-xs uppercase bg-gray-900/50 text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-500/50 transition-all flex items-center gap-2"><span>↺ Reiniciar</span></button>
            <button id="btn-save-progress" onClick={handleSaveProgress} className="h-11 px-6 rounded-xl font-bold text-xs uppercase bg-gray-900 text-white border border-watton-dark hover:bg-watton-dark transition-all flex items-center gap-2"><span>💾 Gravar</span></button>
            <button onClick={handleGenerateAnalysis} className="h-11 px-8 rounded-xl font-bold text-xs uppercase bg-gradient-to-r from-watton-lime to-green-500 text-black hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-green-900/50"><span className="text-lg">✨</span> Gerar Relatório AI</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
            <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl shadow-lg">
                <h3 className="text-watton-lime font-bold mb-4 text-sm uppercase flex items-center gap-2">📄 1. Dados da Fatura</h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Empresa</label>
                        <input className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm font-bold focus:border-watton-lime outline-none" value={invoiceData.companyName} onChange={e => setInvoiceData({...invoiceData, companyName: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[10px] text-gray-500 font-bold uppercase">NIF</label><input className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm" value={invoiceData.nif} onChange={e => setInvoiceData({...invoiceData, nif: e.target.value})} /></div>
                        <div><label className="text-[10px] text-gray-500 font-bold uppercase">CPE</label><input className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm" value={invoiceData.cpe} onChange={e => setInvoiceData({...invoiceData, cpe: e.target.value})} /></div>
                    </div>
                    <div className="border-t border-gray-800 pt-4 grid grid-cols-2 gap-3">
                         <div className="bg-black p-2 rounded border border-gray-700">
                             <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Tensão</label>
                             <select className="w-full bg-transparent text-white font-bold text-sm outline-none" value={invoiceData.tensionLevel} onChange={e => setInvoiceData({...invoiceData, tensionLevel: e.target.value as any})}>{TENSION_LEVELS.map(t => <option key={t} value={t} className="bg-gray-900">{t}</option>)}</select>
                         </div>
                         <div className="bg-black p-2 rounded border border-gray-700">
                             <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Ciclo Horário</label>
                             <select className="w-full bg-transparent text-white font-bold text-sm outline-none" value={invoiceData.cycleType} onChange={e => setInvoiceData({...invoiceData, cycleType: e.target.value as any})}>{CYCLES.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}</select>
                         </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 border-t border-gray-800 pt-4">
                         <div><label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Dias</label><input type="number" className="w-full bg-black border border-gray-700 rounded p-1 text-white text-right text-xs" value={invoiceData.daysInPeriod} onChange={e => setInvoiceData({...invoiceData, daysInPeriod: parseFloat(e.target.value)})} /></div>
                         <div><label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Potência kW</label><input type="number" className="w-full bg-black border border-gray-700 rounded p-1 text-white text-right text-xs" value={invoiceData.contractedPowerKw} onChange={e => setInvoiceData({...invoiceData, contractedPowerKw: parseFloat(e.target.value)})} /></div>
                         <div><label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Pot. €/dia</label><input type="number" step="0.0001" className="w-full bg-black border border-gray-700 rounded p-1 text-red-400 text-right text-xs font-bold" value={invoiceData.dailyPowerCostEur} onChange={e => setInvoiceData({...invoiceData, dailyPowerCostEur: parseFloat(e.target.value)})} /></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                    <h3 className="text-watton-lime font-bold text-sm uppercase">⚙️ 2. Estratégia</h3>
                    <select value={selectedStrategyId} onChange={handleStrategyChange} className="bg-watton-dark text-white font-bold text-sm px-4 py-2 rounded border border-green-700">{MASTER_STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-800/50 p-4 rounded border-l-4 border-watton-lime flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-sm text-gray-300"><span className="font-bold text-white block">Energia</span><span className="text-xs">Base: {activeStrategy.basePriceMWh.toFixed(2)} €/MWh</span></div>
                                <div className="text-right"><div className="text-[10px] text-gray-400 uppercase font-bold">Margem Aplicada</div><div className="text-xl font-mono text-watton-lime font-bold">{result.appliedMarginEurKwh.toFixed(4)} <span className="text-xs">€/kWh</span></div></div>
                            </div>
                        </div>

                        <div className="bg-gray-800/50 p-4 rounded border-l-4 border-blue-500 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-300"><span className="font-bold text-white block">Potência</span><span className="text-xs">Base: {activeStrategy.proposalPowerPriceDaily.toFixed(4)} €/dia</span></div>
                                <div className="text-right"><div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Spread Potência</div><input type="number" step="0.0001" value={powerSpread} onChange={(e) => handleSpreadChange(parseFloat(e.target.value))} className="bg-black/50 border border-gray-600 rounded text-right w-24 px-2 py-1 text-blue-400 font-bold font-mono outline-none focus:border-blue-500 focus:bg-gray-900" /></div>
                            </div>
                            <div className="mt-2 text-right border-t border-gray-700 pt-2 flex justify-between items-center">
                                <span className="text-[10px] uppercase font-bold text-gray-500">Final Proposta</span>
                                <div className="flex items-center justify-end gap-2">
                                    {manualPowerPrice !== undefined && (<button onClick={resetPowerPrice} className="text-[9px] text-red-400 hover:text-red-300 underline mr-2">Reset (Auto)</button>)}
                                    <input type="number" step="0.0001" value={manualPowerPrice !== undefined ? manualPowerPrice : (activeStrategy.proposalPowerPriceDaily + powerSpread)} onChange={(e) => handleFinalPowerPriceChange(parseFloat(e.target.value))} className={`bg-transparent text-lg font-mono font-bold outline-none w-28 text-right border-b border-transparent hover:border-blue-500 focus:border-blue-500 transition-colors ${manualPowerPrice !== undefined ? 'text-yellow-400' : 'text-blue-400'}`} title={manualPowerPrice !== undefined ? "Valor manual definido" : "Valor calculado automaticamente"} />
                                    <span className="text-xs text-blue-500 font-bold">€/dia</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
                        <div className="bg-gray-950 px-3 py-2 border-b border-gray-800 text-[10px] text-gray-500 uppercase font-bold flex justify-between"><span>Comparador Detalhado</span><button onClick={addRow} className="text-watton-lime">+ Período</button></div>
                        <table className="w-full text-xs text-right">
                            <thead className="bg-gray-900 text-gray-500"><tr><th className="p-3 text-left">Período</th><th className="p-3 text-white">kWh</th><th className="p-3 text-red-300">Preço Atual</th><th className="p-3 text-red-300">Total Atual</th><th className="p-3 text-green-300 bg-green-900/10">Preço Watton</th><th className="p-3 text-green-300 bg-green-900/10">Total Watton</th><th className="p-1"></th></tr></thead>
                            <tbody className="divide-y divide-gray-800">
                                {extendedConsumption.map((row, idx) => {
                                    const currentTotal = row.kwh * row.currentPriceEur;
                                    const strategyStat = result.monthlyStats[idx];
                                    const wattonUnit = strategyStat?.wattonUnit || 0;
                                    const wattonTotal = strategyStat?.wattonTotal || 0;
                                    return (
                                        <tr key={idx} className="hover:bg-gray-900/50 group">
                                            <td className="p-3 text-left"><input type="text" value={row.period} onChange={e => handleRowChange(idx, 'period', e.target.value)} className="bg-transparent text-gray-300 font-bold outline-none w-full" /></td>
                                            <td className="p-3"><input type="number" value={row.kwh} onChange={e => handleRowChange(idx, 'kwh', parseFloat(e.target.value))} className="bg-gray-800 text-right w-20 rounded border border-gray-700 text-white font-bold" /></td>
                                            <td className="p-3"><input type="number" step="0.0001" value={row.currentPriceEur} onChange={e => handleRowChange(idx, 'currentPriceEur', parseFloat(e.target.value))} className="bg-gray-800 text-right w-20 rounded border border-gray-700 text-red-400 font-bold" /></td>
                                            <td className="p-3 text-red-400 font-bold opacity-70">{currentTotal.toFixed(2)} €</td>
                                            <td className="p-3 bg-green-900/10"><input type="number" step="0.0001" value={row.manualWattonPrice !== undefined ? row.manualWattonPrice : wattonUnit} onChange={e => handleRowChange(idx, 'manualWattonPrice', parseFloat(e.target.value))} placeholder={wattonUnit.toFixed(4)} className="bg-gray-800 text-right w-20 rounded border border-green-700 text-watton-lime font-bold shadow-sm shadow-green-900/20" /></td>
                                            <td className="p-3 bg-green-900/10 text-watton-lime font-bold">{wattonTotal.toFixed(2)} €</td>
                                            <td className="p-1 text-center"><button onClick={() => removeRow(idx)} className="text-gray-600 hover:text-red-500">×</button></td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-700 text-xs">
                                    <td className="p-3 text-left">TOTAL ENERGIA</td>
                                    <td className="p-3">-</td>
                                    <td className="p-3">-</td>
                                    <td className="p-3 text-red-400">{result.monthlyTotals?.currentEnergy.toFixed(2)} €</td>
                                    <td className="p-3 bg-green-900/10">-</td>
                                    <td className="p-3 bg-green-900/10 text-watton-lime">{result.monthlyTotals?.wattonEnergy.toFixed(2)} €</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg mt-8 border-t-4 border-t-white">
                <h3 className="text-white font-bold mb-6 text-sm uppercase flex items-center gap-2">🏁 3. Conclusão da Simulação</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-black/40 rounded-lg p-4 border border-gray-800">
                        <div className="text-[10px] text-gray-500 uppercase font-bold mb-3 tracking-widest">Comparativo Mensal</div>
                        <div className="space-y-3">
                             <div className="flex justify-between items-center pt-1 border-b border-gray-800 pb-1">
                                 <span className="text-gray-500 font-bold uppercase text-[9px]">Custo Potência Total</span>
                                 <div className="flex gap-3 text-xs">
                                     <span className="text-red-400 font-bold">{result.monthlyTotals?.currentPower.toFixed(2)} €</span>
                                     <span className="text-blue-400 font-black">{result.monthlyTotals?.wattonPower.toFixed(2)} €</span>
                                 </div>
                             </div>
                             <div className="flex justify-between items-center pt-1">
                                 <span className="text-white font-bold uppercase text-[10px]">Total Fatura</span>
                                 <div className="flex gap-3 text-sm">
                                     <span className="text-red-400 font-bold">{result.monthlyTotals?.currentTotal.toFixed(2)} €</span>
                                     <span className="text-watton-lime font-black">{result.monthlyTotals?.wattonTotal.toFixed(2)} €</span>
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
};
