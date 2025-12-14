
import { InvoiceData, WattonStrategy, SimulationResult, MonthlyStat, Period } from '../types';
import { ZUG_SPREADS } from '../constants';

// --- HELPER: SPREADS ---
const getSpread = (tension: string, period: string): number => {
    const t = tension as keyof typeof ZUG_SPREADS;
    if (!ZUG_SPREADS[t]) return 0.06;

    const map = ZUG_SPREADS[t];
    // @ts-ignore
    if (map[period]) return map[period];

    const lowerP = period.toLowerCase();
    if (lowerP.includes('vazio')) return map['Vazio'] || map['Simples'] || 0.05;
    if (lowerP.includes('ponta')) return map['Ponta'] || map['Fora Vazio'] || 0.07;
    if (lowerP.includes('cheia')) return map['Cheias'] || map['Ponta'] || 0.07;

    return 0.06;
};

// --- ARREDONDAMENTO FINANCEIRO ---
const roundCurrency = (val: number): number => {
    return Math.round((val + Number.EPSILON) * 100) / 100;
};

// --- FÓRMULA CANÓNICA DE ANUALIZAÇÃO ---
// Custo Anual = (Custo Total Período / Dias) × 365
const calculateAnnualProjection = (periodTotal: number, daysInPeriod: number): number => {
    if (daysInPeriod <= 0) return 0;
    const dailyCost = periodTotal / daysInPeriod;
    return roundCurrency(dailyCost * 365);
};

// --- SIMULAÇÃO ÚNICA (SINGLE SOURCE OF TRUTH) ---
export const simulateWattonProposal = (
  invoice: InvoiceData,
  strategy: WattonStrategy,
  manualMargin?: number,
  manualPriceOverrides?: Record<string, number>
): SimulationResult => {
  const daysInPeriod = (invoice.daysInPeriod && invoice.daysInPeriod > 0) ? invoice.daysInPeriod : 30;

  // 1. CÁLCULO CUSTO ATUAL (CLIENTE)
  let periodEnergyCurrent = 0;
  
  invoice.consumptionData.forEach(c => {
      // Current Energy = kWh * CurrentPrice
      const cost = (c.kwh || 0) * (c.currentPriceEur || 0);
      periodEnergyCurrent += cost; // Sum raw first
  });
  // Round total energy current
  periodEnergyCurrent = roundCurrency(periodEnergyCurrent);

  const periodPowerCurrent = roundCurrency((invoice.dailyPowerCostEur || 0) * daysInPeriod);
  const periodReactive = roundCurrency(invoice.reactiveCostEur || 0);
  
  const currentTotalPeriod = roundCurrency(periodEnergyCurrent + periodPowerCurrent + periodReactive);
  const currentTotalAnnual = calculateAnnualProjection(currentTotalPeriod, daysInPeriod);

  // 2. CÁLCULO CUSTO WATTON (PROPOSTA)
  const basePricePerKwh = strategy.basePriceMWh / 1000;
  
  // A. Determinar Margem (Auto ou Manual)
  let appliedMargin = 0;
  
  // Preparar dados para cálculo de margem automática
  let totalKwhPeriod = 0;
  let totalBaseCostPeriod = 0; // Custo Watton sem margem

  invoice.consumptionData.forEach(c => {
      const spread = getSpread(invoice.tensionLevel, c.period);
      const baseUnitCost = (basePricePerKwh + spread + strategy.eric) * (1 + (strategy.losses / 100));
      totalKwhPeriod += (c.kwh || 0);
      totalBaseCostPeriod += (c.kwh || 0) * baseUnitCost;
  });

  const wattonPowerPeriod = roundCurrency(strategy.proposalPowerPriceDaily * daysInPeriod);

  if (manualMargin !== undefined) {
      appliedMargin = manualMargin;
  } else {
      // Auto-Otimização: Target Poupança Mínima 5%
      // CurrentAnnual * 0.95 = TargetAnnual
      const targetSavingsPct = 0.05;
      const targetAnnual = currentTotalAnnual * (1 - targetSavingsPct);
      const targetPeriod = targetAnnual / (365 / daysInPeriod);

      if (totalKwhPeriod > 0) {
          const calculatedMargin = (targetPeriod - wattonPowerPeriod - totalBaseCostPeriod) / totalKwhPeriod;
          appliedMargin = Math.max(0, calculatedMargin); // Nunca prejuízo
      }
  }

  // B. Calcular Totais Watton Finais
  const monthlyStats: MonthlyStat[] = [];
  const wattonFinalPrices: any[] = [];
  let periodEnergyWatton = 0;

  invoice.consumptionData.forEach(c => {
      const spread = getSpread(invoice.tensionLevel, c.period);
      const baseComponent = (basePricePerKwh + spread + strategy.eric) * (1 + (strategy.losses / 100));
      let finalUnit = baseComponent + appliedMargin;

      // Overrides Manuais (Edição na Tabela)
      if (manualPriceOverrides && manualPriceOverrides[c.period] !== undefined) {
          finalUnit = manualPriceOverrides[c.period];
      }

      // Watton Cost for this period
      const wattonCost = roundCurrency((c.kwh || 0) * finalUnit);
      
      // Current Cost for this period (for stats display)
      const currentCost = roundCurrency((c.kwh || 0) * (c.currentPriceEur || 0));

      periodEnergyWatton += wattonCost;

      monthlyStats.push({
          period: c.period,
          kwh: c.kwh || 0,
          currentUnit: c.currentPriceEur || 0,
          currentTotal: currentCost,
          wattonUnit: finalUnit,
          wattonTotal: wattonCost
      });

      wattonFinalPrices.push({
          period: c.period,
          base: basePricePerKwh,
          spread: spread,
          finalPrice: finalUnit
      });
  });
  
  // Ensure totals are rounded
  periodEnergyWatton = roundCurrency(periodEnergyWatton);

  const wattonTotalPeriod = roundCurrency(periodEnergyWatton + wattonPowerPeriod);
  const wattonTotalAnnual = calculateAnnualProjection(wattonTotalPeriod, daysInPeriod);

  // 3. RESULTADOS FINAIS
  const annualSavingsEur = roundCurrency(currentTotalAnnual - wattonTotalAnnual);
  const annualSavingsPercent = currentTotalAnnual > 0 ? (annualSavingsEur / currentTotalAnnual) * 100 : 0;

  return {
    annualCostCurrent: currentTotalAnnual,
    annualCostWatton: wattonTotalAnnual,
    annualSavingsEur,
    annualSavingsPercent,
    appliedMarginEurKwh: appliedMargin,
    wattonFinalPrices,
    appliedStrategyName: strategy.name,
    monthlyStats,
    monthlyTotals: {
        currentEnergy: periodEnergyCurrent,
        wattonEnergy: periodEnergyWatton,
        currentPower: periodPowerCurrent,
        wattonPower: wattonPowerPeriod,
        currentTotal: currentTotalPeriod,
        wattonTotal: wattonTotalPeriod
    }
  };
};

// Manter alias para compatibilidade se necessário, mas redirecionar para a nova função
export const calculateSimulation = simulateWattonProposal;
