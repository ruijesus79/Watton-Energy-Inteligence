
import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema simplificado
const INVOICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    NomeEmpresa: { type: Type.STRING },
    CPE: { type: Type.STRING },
    NIF: { type: Type.STRING },
    PotenciaContratada_kVA: { type: Type.NUMBER },
    TarifaTensao: { type: Type.STRING },
    CicloHorario: { type: Type.STRING },
    Dias_Faturacao: { type: Type.NUMBER },
    Consumo_Ponta: { type: Type.NUMBER },
    Consumo_Cheias: { type: Type.NUMBER },
    Consumo_Vazio: { type: Type.NUMBER },
    Consumo_SuperVazio: { type: Type.NUMBER },
    Preco_Ponta: { type: Type.NUMBER },
    Preco_Cheias: { type: Type.NUMBER },
    Preco_Vazio: { type: Type.NUMBER },
    Preco_SuperVazio: { type: Type.NUMBER },
    Preco_Potencia_Dia: { type: Type.NUMBER },
    RawText: { type: Type.STRING, description: "O texto bruto completo extraído da fatura para validação" }
  }
};

// --- CAMADA 2 & 3: FALLBACK ENGINE ---
const extractWithFallback = (
    data: any, 
    rawText: string, 
    fieldKey: string, 
    regexPatterns: RegExp[], 
    keywords: string[]
): number => {
    // 1. Tentar valor do Gemini
    if (data[fieldKey] !== undefined && data[fieldKey] !== null && data[fieldKey] > 0) {
        return data[fieldKey];
    }

    if (!rawText) return 0;

    // 2. Tentar Regex no Texto Bruto
    for (const pattern of regexPatterns) {
        const match = rawText.match(pattern);
        if (match && match[1]) {
            const val = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(val)) return val;
        }
    }

    // 3. Tentar Semântica (Linha com keyword + número)
    const lines = rawText.split('\n');
    for (const line of lines) {
        if (keywords.some(kw => line.toLowerCase().includes(kw))) {
            const nums = line.match(/\d+[\.,]\d{2,}/); // Procura número decimal
            if (nums) {
                 const val = parseFloat(nums[0].replace(',', '.'));
                 if (!isNaN(val)) return val;
            }
        }
    }

    return 0; // Falhou
};

const mapTension = (val: string): any => {
    if (!val) return 'BTE';
    const v = val.toUpperCase();
    if (v.includes('BTN')) return 'BTN';
    if (v.includes('MT')) return 'MT';
    if (v.includes('AT')) return 'AT';
    return 'BTE';
};

const mapCycle = (val: string): any => {
    if (!val) return 'Tri-Horário';
    const v = val.toLowerCase();
    if (v.includes('tetra')) return 'Tetra-Horário';
    if (v.includes('tri')) return 'Tri-Horário';
    if (v.includes('bi')) return 'Bi-Horário';
    if (v.includes('simples')) return 'Simples';
    return 'Tri-Horário';
};

export const parseInvoice = async (base64Image: string, mimeType: string): Promise<Partial<InvoiceData>> => {
  try {
    // CAMADA 1: GEMINI VISION + RAW TEXT REQUEST
    const promptInstructions = `
    ATUA COMO O 'ANALISTA DE FATURAS DE ENERGIA'.
    A tua missão é extrair TODOS os dados de consumo e preço com precisão absoluta.
    
    1. PROCURA EXAUSTIVAMENTE por tabelas de detalhe de consumo. Extrai Ponta, Cheias, Vazio e Super Vazio.
    2. Se um período tiver valor 0 ou não existir, coloca 0.
    3. Para a Potência Contratada, procura kVA ou kW.
    4. Para os Preços Unitários, procura a coluna de preços unitários (€/kWh) correspondente a cada período.
    
    Extrai para o JSON schema fornecido.
    No campo 'RawText', coloca uma transcrição das secções relevantes da fatura.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: promptInstructions }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: INVOICE_SCHEMA,
        temperature: 0.1
      }
    });

    const data = JSON.parse(response.text || "{}");
    const rawText = data.RawText || "";
    
    // --- CAMADA DE VALIDAÇÃO COM FALLBACKS ---
    
    // Potência kVA
    const powerKw = extractWithFallback(data, rawText, 'PotenciaContratada_kVA', [/(\d+[\.,]\d+)\s*kVA/i], ['contratada', 'potência']);
    
    // Dias
    const days = extractWithFallback(data, rawText, 'Dias_Faturacao', [/(\d+)\s*dias/i], ['dias de faturação', 'período', 'n.º dias']);
    
    // Consumos
    const kwhPonta = extractWithFallback(data, rawText, 'Consumo_Ponta', [/ponta.*?(\d+[\.,]\d+)/i], ['ponta', 'peak']);
    const kwhCheias = extractWithFallback(data, rawText, 'Consumo_Cheias', [/cheias.*?(\d+[\.,]\d+)/i], ['cheias']);
    const kwhVazio = extractWithFallback(data, rawText, 'Consumo_Vazio', [/vazio.*?(\d+[\.,]\d+)/i], ['vazio']);
    const kwhSuper = extractWithFallback(data, rawText, 'Consumo_SuperVazio', [/super.*?(\d+[\.,]\d+)/i], ['super vazio']);

    // Preços
    const pricePonta = extractWithFallback(data, rawText, 'Preco_Ponta', [], ['preço ponta']); 
    const priceCheias = extractWithFallback(data, rawText, 'Preco_Cheias', [], ['preço cheias']);
    const priceVazio = extractWithFallback(data, rawText, 'Preco_Vazio', [], ['preço vazio']);
    
    // Potência Preço
    let dailyPower = data.Preco_Potencia_Dia || 0;
    if (dailyPower > 5 && days > 0) dailyPower = dailyPower / days; // Sanity check: > 5€/dia é impossível para potências normais, deve ser mensal

    const consumptionData = [
        { period: 'Ponta', kwh: kwhPonta, currentPriceEur: pricePonta, percentage: 0 },
        { period: 'Cheias', kwh: kwhCheias, currentPriceEur: priceCheias, percentage: 0 },
        { period: 'Vazio', kwh: kwhVazio, currentPriceEur: priceVazio, percentage: 0 },
        { period: 'Super Vazio', kwh: kwhSuper, currentPriceEur: data.Preco_SuperVazio || 0, percentage: 0 },
    ];

    const totalKwh = consumptionData.reduce((acc, c) => acc + c.kwh, 0);
    if (totalKwh > 0) consumptionData.forEach(c => c.percentage = (c.kwh / totalKwh) * 100);

    return {
        companyName: data.NomeEmpresa || "",
        nif: data.NIF || "",
        cpe: data.CPE || "",
        tensionLevel: mapTension(data.TarifaTensao),
        cycleType: mapCycle(data.CicloHorario),
        productType: 'Indexado',
        contractedPowerKw: powerKw,
        daysInPeriod: days > 0 ? days : 30,
        dailyPowerCostEur: dailyPower,
        consumptionData: consumptionData as any
    };

  } catch (error) {
    console.error("OCR Failed:", error);
    return {
        consumptionData: [
            { period: 'Ponta', kwh: 0, currentPriceEur: 0, percentage: 0 },
            { period: 'Cheias', kwh: 0, currentPriceEur: 0, percentage: 0 },
            { period: 'Vazio', kwh: 0, currentPriceEur: 0, percentage: 0 },
            { period: 'Super Vazio', kwh: 0, currentPriceEur: 0, percentage: 0 },
        ]
    };
  }
};

export const parseWattonProposal = async (base64Image: string, mimeType: string) => { return null; };
export const parseWattonProposalFromText = async (textContext: string) => { return null; };
