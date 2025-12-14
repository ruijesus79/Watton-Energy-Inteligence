
import { Period, InvoiceData, WattonStrategy, PriceTable } from './types';

export const PERIODS: Period[] = ['Ponta', 'Cheias', 'Vazio', 'Super Vazio'];
export const TENSION_LEVELS = ['AT', 'MT', 'BTE', 'BTN'];
export const CYCLES = ['Simples', 'Bi-Horário', 'Tri-Horário', 'Tetra-Horário', 'Opcional'];
export const PRODUCT_TYPES = ['Fixo', 'Indexado'];
export const BILLING_PERIOD_TYPES = ['Diário', 'Semanal Opcional', 'Semanal c/ Feriados', 'Semanal s/ Feriados'];

// ==================================================================================
// [CAMADA 2: BASE DE DADOS MESTRA - ZUG/WATTON]
// Valores baseados no ficheiro "251118_ZUG PT_Simulador HEDGING"
// ==================================================================================

export const MASTER_STRATEGIES: WattonStrategy[] = [
    {
        id: 'zug_m12',
        name: 'Watton Móvil 12 Meses',
        type: 'HEDGING',
        description: 'Vigência 01.12.2025 -> 30.11.2026. Segurança total a curto prazo.',
        basePriceMWh: 63.84, // Table 1
        eric: 0.0025,
        losses: 15.0, 
        proposalPowerPriceDaily: 1.5249
    },
    {
        id: 'zug_m18',
        name: 'Watton Móvil 18 Meses',
        type: 'HEDGING',
        description: 'Vigência 01.12.2025 -> 31.05.2027. Otimização de médio prazo.',
        basePriceMWh: 59.67, // Table 1
        eric: 0.0025,
        losses: 15.0, 
        proposalPowerPriceDaily: 1.5249
    },
    {
        id: 'zug_cal27',
        name: 'Watton CAL 2027',
        type: 'FIXED',
        description: 'Vigência Ano Civil 2027. Para planeamento orçamental de longo prazo.',
        basePriceMWh: 60.50, // Table 1
        eric: 0.0025,
        losses: 15.0, 
        proposalPowerPriceDaily: 1.5249
    },
    {
        id: 'zug_q1_26',
        name: 'Watton Início Q+1 (2026)',
        type: 'HEDGING',
        description: 'Vigência Ano 2026 completo. Estabilidade anual.',
        basePriceMWh: 61.32, // Table 1
        eric: 0.0025,
        losses: 15.0, 
        proposalPowerPriceDaily: 1.5249
    },
    {
        id: 'zug_q2_26',
        name: 'Watton Início Q+2 (Abr 26)',
        type: 'HEDGING',
        description: 'Vigência 01.04.2026 -> 31.03.2027.',
        basePriceMWh: 59.92, // Table 1
        eric: 0.0025,
        losses: 15.0, 
        proposalPowerPriceDaily: 1.5249
    }
];

// TABLE 2: SPREADS (Costs added to Base Price)
// Values in €/kWh
export const ZUG_SPREADS = {
    'BTN': {
        'Simples': 0.059137,
        'Vazio': 0.059137,
        'Fora Vazio': 0.071358,
        'Ponta': 0.071358,
        'Cheias': 0.071358 // Fallback mapping
    },
    'BTE': {
        'Vazio': 0.054136,
        'Super Vazio': 0.054136, // Fallback
        'Ponta': 0.080945,
        'Cheias': 0.080945
    },
    'MT': {
        'Vazio': 0.06095,
        'Super Vazio': 0.06095,
        'Ponta': 0.06261,
        'Cheias': 0.06261
    },
    // Fallback defaults
    'AT': {
        'Vazio': 0.05,
        'Ponta': 0.06,
        'Cheias': 0.06
    }
};

export const DEFAULT_INVOICE_DATA: InvoiceData = {
  companyName: '',
  nif: '',
  cpe: '',
  tensionLevel: 'BTE',
  cycleType: 'Tri-Horário',
  productType: 'Indexado',
  billingPeriodType: 'Semanal c/ Feriados',
  contractedPowerKw: 0,
  dailyPowerCostEur: 0,
  daysInPeriod: 30,
  maxPowerRecordedKw: 0,
  reactiveCostEur: 0,
  consumptionData: PERIODS.map(p => ({
    period: p,
    kwh: 0,
    currentPriceEur: 0,
    percentage: 0
  }))
};

export const EMPTY_STRATEGY: WattonStrategy = {
    id: 'custom',
    name: 'Personalizado',
    type: 'FIXED',
    description: '',
    basePriceMWh: 0,
    eric: 0,
    losses: 0,
    proposalPowerPriceDaily: 1.5249
};

export const EMPTY_PRICE_TABLE: PriceTable = {
    ...EMPTY_STRATEGY,
    createdAt: 0,
    prices: PERIODS.map(p => ({ period: p, basePrice: 0 }))
};
