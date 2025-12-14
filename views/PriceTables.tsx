
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getPriceTables, savePriceTable } from '../services/firebase';
import { parseWattonProposal, parseWattonProposalFromText } from '../services/ocrService';
import { PriceTable } from '../types';
import { PERIODS, TENSION_LEVELS, CYCLES, EMPTY_PRICE_TABLE } from '../constants';

export const PriceTables: React.FC = () => {
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [editing, setEditing] = useState<PriceTable | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = () => getPriceTables().then(setTables);

  const handleSave = async () => {
    if (!editing) return;
    await savePriceTable(editing);
    setEditing(null);
    loadTables();
  };

  const updateBasePrice = (index: number, value: number) => {
    if (!editing || !editing.prices) return;
    const newPrices = [...editing.prices];
    newPrices[index] = { ...newPrices[index], basePrice: value };
    setEditing({ ...editing, prices: newPrices });
  };

  const startEditing = (table: PriceTable) => {
      // Ensure prices array exists to prevent crashes
      const prices = table.prices && table.prices.length > 0 
        ? table.prices 
        : PERIODS.map(p => ({ period: p, basePrice: 0 }));
      setEditing({ ...table, prices });
  };

  const applyExtractedData = (data: any) => {
    if (data) {
        setEditing(prev => {
            if (!prev) return null;
            const currentPrices = prev.prices || PERIODS.map(p => ({ period: p, basePrice: 0 }));
            return {
                ...prev,
                eric: data.eric !== undefined ? data.eric : prev.eric,
                losses: data.losses !== undefined ? data.losses : prev.losses,
                proposalPowerPriceDaily: data.proposalPowerPriceDaily !== undefined ? data.proposalPowerPriceDaily : prev.proposalPowerPriceDaily,
                prices: currentPrices.map(p => {
                    // Try exact match or loose match
                    const newP = data.prices?.find((np: any) => 
                        np.period?.toLowerCase() === p.period.toLowerCase() ||
                        (p.period === 'Cheias' && np.period?.toLowerCase().includes('cheia')) ||
                        (p.period === 'Vazio' && np.period?.toLowerCase().includes('vazio'))
                    );
                    return newP ? { ...p, basePrice: newP.basePrice } : p;
                })
            };
        });
        alert("Dados extraídos com sucesso pela IA!");
    } else {
        alert("Não foi possível extrair dados estruturados.");
    }
    setIsUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    setIsUploading(true);
    try {
        // Regex to check for Excel files including .xlsm (Macros)
        const isExcel = file.name.match(/\.(xlsx|xls|csv|xlsm)$/i);

        if (isExcel) {
             // Read as ArrayBuffer for robustness
             const arrayBuffer = await file.arrayBuffer();
             
             // IMPORTANT: { type: 'array' } is required for reading ArrayBuffer in browser correctly
             const workbook = XLSX.read(arrayBuffer, { type: 'array' });
             
             // Get first sheet
             const firstSheetName = workbook.SheetNames[0];
             const worksheet = workbook.Sheets[firstSheetName];
             
             // Convert to JSON Matrix (Array of Arrays) for AI context
             // This is better than CSV because it handles commas inside cells correctly
             const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
             
             // Convert to string for the AI Prompt
             const textContext = JSON.stringify(jsonData.slice(0, 50)); // Limit to first 50 rows to save tokens/bandwidth
             
             const extracted = await parseWattonProposalFromText(textContext);
             applyExtractedData(extracted);
        } else {
            // Logic for Images/PDF (Base64)
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                const extracted = await parseWattonProposal(base64String, file.type);
                applyExtractedData(extracted);
            };
            reader.readAsDataURL(file);
        }
    } catch (e) {
        console.error("Upload Error:", e);
        alert("Erro ao processar ficheiro. Certifique-se que o ficheiro é válido.");
        setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Tabelas de Preços</h2>
        <button onClick={() => setEditing({ ...EMPTY_PRICE_TABLE })} className="bg-watton-dark text-white px-4 py-2 rounded hover:bg-green-800 transition shadow-lg shadow-green-900/20">
          + Nova Tabela
        </button>
      </div>

      {editing && (
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl space-y-6 animate-fade-in relative">
          
          {/* Loading Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                <div className="text-watton-lime font-bold animate-pulse flex flex-col items-center">
                    <span className="text-4xl mb-3">🤖</span>
                    <span className="text-lg">A Inteligência Artificial está a ler o Excel...</span>
                </div>
            </div>
          )}

          <div className="flex justify-between items-start border-b border-gray-800 pb-4">
             <div>
                <h3 className="text-xl font-bold text-watton-lime">Editor de Tabela</h3>
                <p className="text-gray-500 text-sm">Configure manualmente ou importe de Excel/PDF.</p>
             </div>
             
             {/* Upload Button */}
             <div className="relative overflow-hidden group">
                <button className="bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded border border-gray-600 hover:bg-gray-700 hover:border-watton-lime transition flex items-center gap-2 shadow-lg">
                    📊 Importar Excel / PDF
                </button>
                <input 
                    type="file" 
                    accept="application/pdf,image/*,.xlsx,.xls,.csv,.xlsm" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Carregar PDF, Imagem ou Excel"
                />
             </div>
          </div>
          
          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Nome da Tabela</label>
              <input 
                value={editing.name} 
                onChange={e => setEditing({...editing, name: e.target.value})}
                className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-watton-lime outline-none transition-colors"
                placeholder="Ex: Indexado 2024 - BTE"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Tensão</label>
              <select 
                value={editing.tensionLevel} 
                onChange={e => setEditing({...editing, tensionLevel: e.target.value as any})}
                className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-watton-lime outline-none transition-colors"
              >
                {TENSION_LEVELS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Ciclo</label>
              <select 
                value={editing.cycleType} 
                onChange={e => setEditing({...editing, cycleType: e.target.value as any})}
                className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-watton-lime outline-none transition-colors"
              >
                {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Global Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-black/40 p-5 rounded-lg border border-gray-800">
              <div>
                  <label className="text-xs text-watton-lime uppercase font-bold block mb-2">ERIC Média (€/kWh)</label>
                  <input 
                    type="number" step="0.0001"
                    value={editing.eric}
                    onChange={e => setEditing({...editing, eric: parseFloat(e.target.value)})}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-watton-lime outline-none font-mono text-lg"
                  />
              </div>
              <div>
                  <label className="text-xs text-watton-lime uppercase font-bold block mb-2">Perdas Média (%)</label>
                  <input 
                    type="number" step="0.01"
                    value={editing.losses}
                    onChange={e => setEditing({...editing, losses: parseFloat(e.target.value)})}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-watton-lime outline-none font-mono text-lg"
                  />
              </div>
              <div>
                  <label className="text-xs text-watton-lime uppercase font-bold block mb-2">Potência Proposta (€/dia)</label>
                  <input 
                    type="number" step="0.0001"
                    value={editing.proposalPowerPriceDaily}
                    onChange={e => setEditing({...editing, proposalPowerPriceDaily: parseFloat(e.target.value)})}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-watton-lime outline-none font-mono text-lg"
                  />
              </div>
          </div>

          {/* Editable Price Table */}
          <div className="overflow-hidden rounded-lg border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-gray-300">
                  <tr>
                    <th className="py-3 px-4 font-medium">Período Horário</th>
                    <th className="py-3 px-4 font-medium">Energia Ativa Sem TAR (€/kWh) <span className="text-xs text-gray-500 font-normal">(Editável)</span></th>
                    <th className="py-3 px-4 font-medium text-right">Custo Final Estimado (€/kWh)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-black/20">
                  {editing.prices && editing.prices.length > 0 ? editing.prices.map((p, idx) => {
                    const finalPrice = (p.basePrice + editing.eric) * (1 + (editing.losses/100));
                    return (
                        <tr key={p.period} className="hover:bg-gray-800/50 transition">
                        <td className="py-3 px-4 text-gray-300 font-medium">{p.period}</td>
                        <td className="py-3 px-4">
                            <input 
                            type="number" step="0.0001"
                            value={p.basePrice}
                            onChange={e => updateBasePrice(idx, parseFloat(e.target.value))}
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white w-full max-w-[150px] focus:border-watton-lime outline-none font-mono"
                            placeholder="0.0000"
                            />
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-watton-lime font-bold text-lg">
                            {finalPrice.toFixed(4)}
                        </td>
                        </tr>
                    );
                  }) : (
                      <tr>
                          <td colSpan={3} className="text-center py-4 text-gray-500">
                              Nenhum período definido. Clique em "Nova Tabela" para reiniciar.
                          </td>
                      </tr>
                  )}
                </tbody>
              </table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button onClick={() => setEditing(null)} className="px-6 py-2 text-gray-400 hover:text-white transition rounded border border-transparent hover:border-gray-600">Cancelar</button>
            <button onClick={handleSave} className="bg-watton-lime text-black px-8 py-2 rounded font-bold hover:bg-green-400 shadow-lg shadow-green-900/20 transition transform hover:scale-105">
                💾 Salvar Tabela
            </button>
          </div>
        </div>
      )}

      {/* List of Saved Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map(table => (
          <div key={table.id} className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex flex-col justify-between hover:border-watton-lime/50 transition group shadow-lg">
            <div>
              <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-lg text-white group-hover:text-watton-lime transition">{table.name}</div>
                  <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 border border-gray-700">{table.tensionLevel}</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <p>Ciclo: {table.cycleType}</p>
                <p>ERIC: <span className="text-gray-300">{table.eric}</span> • Perdas: <span className="text-gray-300">{table.losses}%</span></p>
                <p>Potência: <span className="text-gray-300">{table.proposalPowerPriceDaily} €/dia</span></p>
              </div>
            </div>
            <button onClick={() => startEditing(table)} className="w-full text-center text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 py-2 rounded transition border border-gray-700">
                Editar Tabela
            </button>
          </div>
        ))}
        {tables.length === 0 && !editing && (
            <div className="col-span-full text-center text-gray-500 py-20 bg-gray-900/30 rounded-xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center">
                <span className="text-4xl mb-4 opacity-50">🗂️</span>
                <p>Nenhuma tabela configurada.</p>
                <p className="text-xs mt-2">Clique em "+ Nova Tabela" para começar.</p>
            </div>
        )}
      </div>
    </div>
  );
};
