
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
    visionText: { type: Type.STRING, description: "Visão de Mercado: Contexto atual do OMIP e tendências." },
    regulatoryText: { type: Type.STRING, description: "Aconselhamento Regulatório: Impacto de taxas e diretivas ESG/CSRD." },
    riskAnalysisText: { type: Type.STRING, description: "Análise de Risco Detalhada: Volatilidade e proteção." },
    vulnerabilityScore: { type: Type.STRING }
  },
  required: ["diagnosisPriceText", "diagnosisOppText", "strategyText", "efficiencyStrategy", "insightText", "visionText", "regulatoryText", "riskAnalysisText", "vulnerabilityScore"]
};

export const generateExpertAnalysis = async (client: ClientData, strategyType: 'HEDGING' | 'FIXED' = 'FIXED') => {
  try {
    const monthlyStats = client.monthlyStats || [];
    const totalKwh = monthlyStats.reduce((acc, s) => acc + s.kwh, 0) || 1;
    const ponta = monthlyStats.find(s => s.period.toLowerCase().includes('ponta'));
    const pontaKwh = ponta?.kwh || 0;
    const annualSavings = client.annualSavingsEur || 0;
    const savingsPct = client.annualSavingsPercent || 0;
    const strategyName = client.appliedStrategyName || 'Proposta Personalizada';

    let score = 5;
    if (savingsPct > 30) score = 10;
    else if (savingsPct > 20) score = 8;
    else if (savingsPct > 10) score = 7;
    else score = 4;

    const contextMetrics = `
      DADOS TÉCNICOS (EMPRESA: ${client.companyName}):
      - Consumo Total: ${totalKwh.toLocaleString()} kWh.
      - Consumo em Ponta: ${pontaKwh.toLocaleString()} kWh.
      - Poupança Anual: ${annualSavings.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'})} (${savingsPct.toFixed(1)}%).
      - Estratégia: "${strategyName}" (TIPO: ${strategyType}).
    `;

    // AGENTE 1: ANALISTA DE MERCADO (GERADOR)
    const genPrompt = `
      ATUA COMO ANALISTA DE MERCADO SÉNIOR. Gera uma análise inicial de vulnerabilidade energética.
      Regras: PT-PT, tom persuasivo, foca no diferencial de preço e risco de mercado.
      Estratégia: ${strategyName}.
      ${contextMetrics}
    `;

    const genResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: genPrompt }] }],
      config: { temperature: 0.7 }
    });

    const initialDraft = genResponse.text;

    // AGENTE 2: CRÍTICO ESTRATÉGICO (REVISOR)
    const criticPrompt = `
      ATUA COMO UM CRÍTICO FINANCEIRO IMPLACÁVEL.
      Analisa este rascunho de relatório e identifica onde ele falha em ser "irrefutável".
      Rascunho: "${initialDraft}"
      Contexto: ${contextMetrics}
      Sugere melhorias técnicas e de copy para maximizar o impacto psicológico da poupança de ${annualSavings.toFixed(0)}€.
    `;

    const criticResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: criticPrompt }] }],
      config: { temperature: 0.3 }
    });

    const critique = criticResponse.text;

    // AGENTE 3: SINTETIZADOR EXECUTIVO (FINALIZADOR)
    const synthPrompt = `
      CONSOLIDA A ANÁLISE FINAL. Atua como o Diretor Geral da Watton Energy.
      Usa o rascunho inicial e a crítica para gerar o JSON final perfeito para o relatório de vulnerabilidade.

      Rascunho: ${initialDraft}
      Crítica: ${critique}
      Contexto: ${contextMetrics}

      REGRAS CRÍTICAS:
      1. Se TIPO='FIXED', fala em "Estabilidade Total", NUNCA em indexado ou variável.
      2. Se TIPO='HEDGING', explica o benefício de proteção contra volatilidade vs oportunidade de mercado.
      3. Sê extremamente persuasivo sobre a poupança anual de ${annualSavings.toFixed(0)}€.
      4. JSON output deve seguir rigorosamente o schema fornecido.
    `;

    const finalResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: synthPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.2
      }
    });

    const result = JSON.parse(finalResponse.text);
    result.vulnerabilityScore = score.toString();
    
    return result;

  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
        diagnosisPriceText: "Identificámos um spread excessivo no preço de energia ativa, penalizando o perfil de consumo da empresa.",
        diagnosisOppText: "A estrutura atual expõe a tesouraria à volatilidade desnecessária.",
        strategyText: `Implementação da estratégia ${client.appliedStrategyName || 'Watton Energy'} para garantir competitividade.`,
        efficiencyStrategy: "Sugerimos análise técnica para deslocação de cargas térmicas para o período 'Vazio'.",
        insightText: `A inércia contratual custa ${client.annualSavingsEur?.toFixed(0)}€/ano.`,
        visionText: "Mercado OMIP com volatilidade elevada devido ao contexto geopolítico.",
        regulatoryText: "Necessidade de adaptação às novas diretrizes de reporte de sustentabilidade (CSRD).",
        riskAnalysisText: "Risco de subida de preços no mercado spot durante picos de inverno.",
        vulnerabilityScore: client.annualSavingsPercent && client.annualSavingsPercent > 20 ? "8" : "6"
    };
  }
};
