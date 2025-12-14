
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClients, deleteClient } from '../services/firebase';
import { ClientData } from '../types';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    getClients().then(setClients);
  };

  const handleDelete = async (id: string, name: string) => {
      if (window.confirm(`Tem a certeza que deseja eliminar o cliente "${name}"? Esta ação não pode ser desfeita.`)) {
          await deleteClient(id);
          loadClients();
      }
  };

  const handleOpenInvoice = (client: ClientData) => {
      if (client.invoiceFile && client.invoiceFile.data) {
          const win = window.open();
          if (win) {
              const mime = client.invoiceFile.mimeType || 'application/pdf';
              if (mime === 'application/pdf') {
                  const pdfWindow = `<iframe width='100%' height='100%' src='data:${mime};base64,${client.invoiceFile.data}' style='border:none;'></iframe>`;
                  win.document.title = `Fatura - ${client.companyName}`;
                  win.document.body.style.margin = "0";
                  win.document.write(pdfWindow);
              } else {
                  win.document.title = `Fatura - ${client.companyName}`;
                  win.document.body.style.margin = "0";
                  win.document.body.style.backgroundColor = "#1a1a1a";
                  win.document.body.style.display = "flex";
                  win.document.body.style.justifyContent = "center";
                  win.document.body.style.alignItems = "center";
                  win.document.body.style.height = "100vh";
                  win.document.write(`<img src="data:${mime};base64,${client.invoiceFile.data}" style="max-width:100%; max-height:100%; box-shadow: 0 0 20px rgba(0,0,0,0.5);"/>`);
              }
          }
      } else {
          alert("Nenhuma fatura anexada a este cliente.");
      }
  };

  const handleOpenReport = (client: ClientData) => {
      if (client.generatedReportFile && client.generatedReportFile.data) {
          const win = window.open();
          if (win) {
              const mime = client.generatedReportFile.mimeType || 'application/pdf';
              // Use iframe to display PDF
              const pdfWindow = `<iframe width='100%' height='100%' src='data:${mime};base64,${client.generatedReportFile.data}' style='border:none;'></iframe>`;
              win.document.title = `Relatório - ${client.companyName}`;
              win.document.body.style.margin = "0";
              win.document.write(pdfWindow);
          }
      } else {
          // Fallback to live view if no saved report exists
          window.location.hash = `#/simulation?id=${client.id}&view=report`;
      }
  };

  const filtered = clients.filter(c => 
    c.companyName.toLowerCase().includes(search.toLowerCase()) || 
    c.nif.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-black text-white tracking-tight">Portfólio <span className="text-watton-lime">Clientes</span></h2>
      </div>
      
      <div className="relative group max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500 group-focus-within:text-watton-lime transition-colors">🔍</span>
        </div>
        <input 
            type="text" 
            placeholder="Pesquisar por Nome ou NIF..." 
            className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-watton-lime focus:ring-1 focus:ring-watton-lime transition-all placeholder-gray-600 text-sm font-medium"
            value={search}
            onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/40 text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-800">
            <tr>
              <th className="p-5">Empresa / Titular</th>
              <th className="p-5">NIF & CPE</th>
              <th className="p-5">Potencial de Poupança</th>
              <th className="p-5">Data Análise</th>
              <th className="p-5 text-right">Ações & Documentos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filtered.map(client => (
              <tr key={client.id} className="hover:bg-gray-800/40 transition-colors group">
                <td className="p-5">
                    <div className="font-bold text-white text-base mb-1">{client.companyName}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{client.tensionLevel} • {client.productType}</div>
                </td>
                <td className="p-5">
                    <div className="text-gray-300 font-mono text-xs mb-1">{client.nif}</div>
                    <div className="text-gray-500 font-mono text-[10px]">{client.cpe}</div>
                </td>
                <td className="p-5">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-watton-lime">{(client.annualSavingsPercent || 0).toFixed(1)}%</span>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-500 uppercase font-bold">Estimada</span>
                            <span className="text-xs text-white font-medium">~{Math.round(client.annualSavingsEur || 0).toLocaleString('pt-PT')}€ / ano</span>
                        </div>
                    </div>
                </td>
                <td className="p-5 text-gray-500 text-xs font-medium">
                  {new Date(client.updatedAt).toLocaleDateString('pt-PT')}
                </td>
                <td className="p-5 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {/* VIEW INVOICE BUTTON */}
                    {client.invoiceFile && (
                        <button 
                            onClick={() => handleOpenInvoice(client)}
                            className="h-8 px-3 rounded-lg border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                            title="Ver Fatura Original"
                        >
                            <span className="text-sm">📄</span> Fatura
                        </button>
                    )}

                    {/* EDIT BUTTON */}
                    <Link 
                        to={`/simulation?id=${client.id}`} 
                        className="h-8 px-3 rounded-lg border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                    >
                        <span className="text-sm">✏️</span> Editar
                    </Link>

                    {/* REPORT BUTTON (Hero Action) */}
                    <button 
                        onClick={() => handleOpenReport(client)}
                        className="h-8 px-4 rounded-lg border border-watton-lime/40 bg-watton-lime/5 text-watton-lime hover:bg-watton-lime hover:text-black hover:border-watton-lime transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_10px_rgba(139,197,63,0.05)] hover:shadow-[0_0_15px_rgba(139,197,63,0.3)]"
                    >
                        <span className="text-sm">📊</span> Relatório
                    </button>
                    
                    {/* DELETE BUTTON (Icon Only) */}
                    <button 
                        onClick={() => client.id && handleDelete(client.id, client.companyName)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-transparent text-gray-600 hover:text-red-500 hover:bg-red-500/10 transition-all ml-1"
                        title="Eliminar Cliente"
                    >
                        🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                    <div className="text-4xl mb-3 opacity-20">📂</div>
                    <div className="text-gray-500 font-medium">Nenhum cliente encontrado no portfólio.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
