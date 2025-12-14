

export type Period = string; // Flexible period names

export interface TimePeriodData {
  period: Period;
  kwh: number;
  currentPriceEur: number; // Current price from invoice
  percentage: number;
}

export type TensionLevel = 'AT' | 'MT' | 'BTE' | 'BTN';
export type CycleType = 'Simples' | 'Bi-Horário' | 'Tri-Horário' | 'Tetra-Horário' | 'Opcional';
export type ProductType = 'Fixo' | 'Indexado';
export type BillingPeriodType = 'Diário' | 'Semanal Opcional' | 'Semanal c/ Feriados' | 'Semanal s/ Feriados';

export interface InvoiceData {
  companyName: string;
  nif: string;
  cpe: string;
  tensionLevel: TensionLevel;
  cycleType: CycleType;
  productType: ProductType; 
  billingPeriodType: BillingPeriodType; 
  contractedPowerKw: number;
  dailyPowerCostEur: number;
  daysInPeriod: number;
  maxPowerRecordedKw?: number;
  reactiveCostEur?: number;
  consumptionData: TimePeriodData[];
}

export interface WattonStrategy {
    id: string;
    name: string;
    type: 'HEDGING' | 'FIXED';
    description: string;
    basePriceMWh: number;
    eric: number;
    losses: number;
    proposalPowerPriceDaily: number;
}

export interface PriceTable extends WattonStrategy {
    createdAt: number;
    prices: { period: Period; basePrice: number }[];
    tensionLevel?: TensionLevel;
    cycleType?: CycleType;
}

export interface WattonFinalPrice {
    period: Period;
    base: number;
    spread: number;
    finalPrice: number;
}

export interface MonthlyStat {
    period: Period;
    kwh: number;
    currentUnit: number;
    currentTotal: number;
    wattonUnit: number;
    wattonTotal: number;
}

export interface SimulationResult {
    annualCostCurrent: number;
    annualCostWatton: number;
    annualSavingsEur: number;
    annualSavingsPercent: number;
    appliedMarginEurKwh: number;
    wattonFinalPrices: WattonFinalPrice[];
    appliedStrategyName: string;
    monthlyStats: MonthlyStat[];
    monthlyTotals: {
        currentEnergy: number;
        wattonEnergy: number;
        currentPower: number;
        wattonPower: number;
        currentTotal: number;
        wattonTotal: number;
    };
}

export interface ClientData extends InvoiceData, SimulationResult {
    id?: string;
    createdAt: number;
    updatedAt: number;
    vulnerabilityScore: string;
    notes: string;
    invoiceFile?: {
        name: string;
        data: string; // Base64 string
        mimeType: string;
    };
    generatedReportFile?: {
        name: string;
        data: string; // Base64 string
        mimeType: string;
    };
    simulationConfig?: {
        strategyId?: string;
        manualMargin?: number;
        manualPowerPrice?: number;
        priceOverrides?: Record<string, number>;
    };
    reportData?: {
        logoUrl?: string;
        marketGraphUrl?: string;
        predictionGraphUrl?: string;
        diagnosisText?: string;
        strategyText?: string;
        marketContextText?: string;
        regulatoryText?: string;
        riskAnalysisText?: string;
        efficiencyText?: string;
        insightText?: string;
    };
}