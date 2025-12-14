
import { GoogleGenAI, Type } from "@google/genai";
import { ClientData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    diagnosisPriceText: { type: Type.STRING, description: "Diagnóstico Financeiro: Comparação de preços unitários e impacto na Ponta." }, 
    diagnosisOppText: { type: Type.STRING, description: "Análise de Risco: Exposição ao mercado spot vs Segurança do Hedging Watton." },
    strategyText: { type: Type.STRING, description: "Estratégia Watton: Explicação técnica do bloqueio de preço e benefícios." },
    efficiencyStrategy: { type: Type.STRING, description: "Otimização Operacional: Sugestões práticas para reduzir consumo na Ponta." },
    insightText: { type: Type.STRING, description: "Conclusão Executiva: O 'Elevator Pitch' final baseado na poupança anual." },
    vulnerabilityScore: { type: Type.STRING }
  }
};

export const generateExpertAnalysis = async (client: ClientData) => {
  try {
    const monthlyStats = client.monthlyStats || [];
    const totalKwh = monthlyStats.reduce((acc, s) => acc + s.kwh, 0) || 1;
    
    // Análise Granular por Período
    const ponta = monthlyStats.find(s => s.period.toLowerCase().includes('ponta'));
    const vazio = monthlyStats.find(s => s.period.toLowerCase().includes('vazio'));
    
    const pontaKwh = ponta?.kwh || 0;
    const pontaPriceDiff = (ponta?.currentUnit || 0) - (ponta?.wattonUnit || 0);
    const pontaSavings = pontaKwh * pontaPriceDiff;
    
    const annualSavings = client.annualSavingsEur || 0;
    const savingsPct = client.annualSavingsPercent || 0;

    // Cálculo Algorítmico do Score (Quanto maior a poupança, mais vulnerável estava o cliente)
    let score = 5;
    if (savingsPct > 30) score = 10;
    else if (savingsPct > 20) score = 8;
    else if (savingsPct > 10) score = 7;
    else score = 4;

    const contextMetrics = `
      DADOS TÉCNICOS DA FATURA (EMPRESA: ${client.companyName}):
      - Consumo Total: ${totalKwh.toLocaleString()} kWh
      - Consumo em Ponta (Crítico): ${pontaKwh.toLocaleString()} kWh.
      - Diferencial de Preço na Ponta: O cliente paga ${(ponta?.currentUnit || 0).toFixed(4)}€/kWh. A Watton propõe ${(ponta?.wattonUnit || 0).toFixed(4)}€/kWh.
      - Poupança só na Ponta: ~${pontaSavings.toFixed(0)}€.
      - Poupança Anual Total: ${annualSavings.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})} (${savingsPct.toFixed(1)}%).
      - Estratégia Proposta: ${client.appliedStrategyName || 'Hedging Personalizado'}.
    `;

    const prompt = `
      ATUA COMO UM ANALISTA FINANCEIRO DE ELITE E ESPECIALISTA EM MERCADOS DE ENERGIA (OMIP/MIBEL). IQ 300.
      O teu objetivo é criar um relatório de vulnerabilidade irrefutável para o cliente.

      Escreve em Português de Portugal (PT-PT), tom corporativo, direto e persuasivo.

      1. DIAGNÓSTICO PREÇO (diagnosisPriceText):
         - Analisa o "Spread" excessivo que o cliente paga atualmente, especialmente nas horas de Ponta.
         - Menciona explicitamente que a tarifa atual está desajustada face aos fundamentais do mercado grossista.
         - Se o consumo em Ponta for alto, alerta para a ineficiência financeira.

      2. ANÁLISE DE RISCO (diagnosisOppText):
         - Explica o risco de manter um contrato indexado sem "teto" ou um contrato fixo com "prémio de risco" alto demais.
         - Introduz a Watton como parceiro de confiança que elimina prémios ocultos.

      3. ESTRATÉGIA IMPLEMENTADA (strategyText):
         - Explica a estratégia de Hedging da Watton: Bloqueio de preço nas horas de volatilidade (Ponta/Cheias) e aproveitamento de oportunidades no Vazio.
         - Reforça a previsibilidade orçamental.

      4. OTIMIZAÇÃO (efficiencyStrategy):
         - Dá 2 exemplos práticos para reduzir os ${pontaKwh} kWh de ponta (ex: desvio de produção, automação de frio/calor).
         - Sê técnico mas acessível.

      5. INSIGHT FINAL (insightText):
         - Uma frase de fecho poderosa. Ex: "Ao não agir, a empresa desperdiça ${annualSavings.toFixed(0)}€ anuais em custos de ineficiência contratual."
         - Reforça que a Watton defende os interesses do cliente, não das elétricas.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: contextMetrics + "\n\n" + prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.3
      }
    });

    const text = response.text;
    if (!text) throw new Error("No analysis generated");
    
    const result = JSON.parse(text);
    // Force the calculated score
    result.vulnerabilityScore = score.toString();
    
    return result;

  } catch (error) {
    console.error("AI Analysis Error:", error);
    // Fallback Inteligente
    return {
        diagnosisPriceText: "Identificámos um spread excessivo no preço de energia ativa, especificamente no período de Ponta, onde a tarifa atual penaliza o perfil de consumo da empresa.",
        diagnosisOppText: "A estrutura atual expõe a tesouraria à volatilidade diária do OMIP. A ausência de um mecanismo de fixação (Hedging) representa um risco financeiro elevado.",
        strategyText: "Implementação de modelo Híbrido/Hedging: Fixação de custo nas horas críticas para eliminar risco, mantendo indexação nas horas de vazio para capturar baixas de mercado.",
        efficiencyStrategy: "Sugerimos análise técnica para deslocação de cargas térmicas ou processos industriais intensivos para o período 'Vazio', reduzindo o custo médio ponderado.",
        insightText: `A inércia contratual está a custar ${client.annualSavingsEur?.toFixed(0)}€ por ano. A Proposta Watton corrige imediatamente esta ineficiência de mercado.`,
        vulnerabilityScore: client.annualSavingsPercent && client.annualSavingsPercent > 20 ? "8" : "6"
    };
  }
};
