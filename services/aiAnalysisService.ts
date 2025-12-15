
import { GoogleGenAI, Type } from "@google/genai";
import { ClientData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    diagnosisPriceText: { type: Type.STRING, description: "Diagnóstico Financeiro: Comparação de preços unitários e impacto na Ponta." }, 
    diagnosisOppText: { type: Type.STRING, description: "Análise de Risco: Exposição ao mercado spot vs Segurança da Proposta." },
    strategyText: { type: Type.STRING, description: "Estratégia Watton: Explicação técnica da solução (Fixo ou Hedging)." },
    efficiencyStrategy: { type: Type.STRING, description: "Otimização Operacional: Sugestões práticas para reduzir consumo na Ponta." },
    insightText: { type: Type.STRING, description: "Conclusão Executiva: O 'Elevator Pitch' final baseado na poupança anual." },
    vulnerabilityScore: { type: Type.STRING }
  }
};

export const generateExpertAnalysis = async (client: ClientData, strategyType: 'HEDGING' | 'FIXED' = 'FIXED') => {
  try {
    const monthlyStats = client.monthlyStats || [];
    const totalKwh = monthlyStats.reduce((acc, s) => acc + s.kwh, 0) || 1;
    
    // Análise Granular por Período
    const ponta = monthlyStats.find(s => s.period.toLowerCase().includes('ponta'));
    
    const pontaKwh = ponta?.kwh || 0;
    const pontaPriceDiff = (ponta?.currentUnit || 0) - (ponta?.wattonUnit || 0);
    const pontaSavings = pontaKwh * pontaPriceDiff;
    
    const annualSavings = client.annualSavingsEur || 0;
    const savingsPct = client.annualSavingsPercent || 0;
    const strategyName = client.appliedStrategyName || 'Proposta Personalizada';

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
      - Estratégia Proposta SELECIONADA: "${strategyName}" (TIPO: ${strategyType}).
    `;

    const prompt = `
      ATUA COMO UM ANALISTA FINANCEIRO DE ELITE E ESPECIALISTA EM MERCADOS DE ENERGIA (OMIP/MIBEL). IQ 300.
      O teu objetivo é criar um relatório de vulnerabilidade irrefutável para o cliente.

      Escreve em Português de Portugal (PT-PT), tom corporativo, direto e persuasivo.

      REGRAS CRÍTICAS DE ESTRATÉGIA:
      1. Se o TIPO for 'FIXED', NUNCA fales em "Indexado gerido", "Hedging", "Watton Móvil" ou "Híbrido". Fala em "Estabilidade Total", "Orçamento Fechado" e "Preço Fixo Garantido". Usa estritamente o nome "${strategyName}".
      2. Se o TIPO for 'HEDGING', explica o benefício de bloquear o preço nas horas caras e aproveitar o mercado nas horas baratas.
      3. NÃO ALUCINES Nomes de Produtos. Usa apenas "${strategyName}".

      SECÇÕES A GERAR:

      1. DIAGNÓSTICO PREÇO (diagnosisPriceText):
         - Analisa o "Spread" excessivo que o cliente paga atualmente.
         - Se poupança for negativa (prejuízo), explica que o cliente já tem um bom contrato mas a Watton oferece melhor serviço. Se positiva, destrói o preço atual.

      2. ANÁLISE DE RISCO (diagnosisOppText):
         - Explica o risco de manter o contrato atual versus a segurança da solução Watton.

      3. ESTRATÉGIA IMPLEMENTADA (strategyText):
         - Explica a solução "${strategyName}" baseada no TIPO ${strategyType}.
         - Sê técnico sobre como este produto específico resolve o problema do cliente.

      4. OTIMIZAÇÃO (efficiencyStrategy):
         - Dá 2 exemplos práticos para reduzir consumo.

      5. INSIGHT FINAL (insightText):
         - Uma frase de fecho poderosa baseada no valor anual de ${annualSavings.toFixed(0)}€.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: contextMetrics + "\n\n" + prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.2
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
        diagnosisOppText: "A estrutura atual expõe a tesouraria à volatilidade. A proposta Watton mitiga este risco.",
        strategyText: `Implementação da estratégia ${client.appliedStrategyName || 'Watton Energy'} para garantir competitividade e redução de custos operacionais.`,
        efficiencyStrategy: "Sugerimos análise técnica para deslocação de cargas térmicas ou processos industriais intensivos para o período 'Vazio'.",
        insightText: `A inércia contratual está a custar ${client.annualSavingsEur?.toFixed(0)}€ por ano. A Proposta Watton corrige imediatamente esta ineficiência.`,
        vulnerabilityScore: client.annualSavingsPercent && client.annualSavingsPercent > 20 ? "8" : "6"
    };
  }
};
