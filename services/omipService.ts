
export interface OmipDataPoint {
  timestamp: string; // Used for X-Axis (Date)
  value: number;     // Price
  label?: string;    // Product Label (e.g., "Nov-24")
}

export interface OmipDashboardData {
    tableData: {
        label: string;
        price: number;
        change: number;
        trend: 'up' | 'down' | 'stable';
    }[];
    chartData: OmipDataPoint[];
    lastUpdate: string;
}

// Target URL
const TARGET_URL = "https://www.omip.pt/pt/dados-mercado/futuros/eletricidade-diario";

// CACHE SYSTEM
let omipCache: { data: OmipDashboardData; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 Minutes

// ANCHOR DATE: 14 Dec 2025
const ANCHOR_DATE = new Date('2025-12-14T12:00:00Z');

// Helper to parse PT/ES number formats
const parsePrice = (str: string): number | null => {
  if (!str) return null;
  let clean = str.replace(/[€$£\s\u00A0\t\n\r]/g, '');
  if (!clean) return null;

  const lastCommaIndex = clean.lastIndexOf(',');
  const lastDotIndex = clean.lastIndexOf('.');

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
      if (lastCommaIndex > lastDotIndex) {
          clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
          clean = clean.replace(/,/g, '');
      }
  } else if (lastCommaIndex !== -1) {
      clean = clean.replace(',', '.');
  }

  const val = parseFloat(clean);
  if (isNaN(val) || val <= 0 || val > 2000) return null;
  return val;
};

// Mock History Generator for Chart (Anchored to Dec 2025)
const generateHistory = (currentPrice: number, days = 180): OmipDataPoint[] => {
    const data: OmipDataPoint[] = [];
    
    // We start from the ANCHOR DATE and go backwards
    const endDate = new Date(ANCHOR_DATE);
    
    // Last point (Current/Spot for the target date)
    data.push({
        timestamp: endDate.toISOString(),
        value: currentPrice,
        label: 'Spot 14-Dez'
    });

    let currentVal = currentPrice;

    for (let i = 1; i < days; i++) {
        const date = new Date(endDate);
        date.setDate(endDate.getDate() - i);
        
        // Simular volatilidade de inverno (mais alta em Nov/Dez)
        const volatility = i < 30 ? 2.5 : 1.2; 
        const change = (Math.random() - 0.48) * volatility; // Ligeira tendência de subida ao recuar (preços eram mais baixos antes)
        
        currentVal = currentVal - change;
        
        // Ensure somewhat realistic limits
        currentVal = Math.max(35, Math.min(180, currentVal));

        data.unshift({
            timestamp: date.toISOString(),
            value: Number(currentVal.toFixed(2)),
            label: 'Histórico'
        });
    }
    return data;
};

const getFallbackData = (): OmipDashboardData => {
    // Cenário DEZEMBRO 2025
    // Spot Domingo 14/12/2025
    const spotPrice = 57.43; 

    const history = generateHistory(spotPrice);
    
    return {
        tableData: [
            { label: 'OMIE Spot PT (14-Dez)', price: spotPrice, change: 4.12, trend: 'up' }, // Domingo frio, preço sobe ligeiramente
            { label: 'FPB-PT Wk51-25', price: 62.10, change: 1.5, trend: 'up' },
            { label: 'FPB-PT Jan-26', price: 68.35, change: 0.8, trend: 'up' },
            { label: 'FPB-PT Q1-26', price: 61.58, change: 0.2, trend: 'up' },
            { label: 'FPB-PT YR-26', price: 59.75, change: -0.45, trend: 'down' },
            { label: 'FPB-PT YR-27', price: 56.78, change: -0.12, trend: 'down' },
            { label: 'FPB-PT YR-28', price: 55.58, change: 0.15, trend: 'up' }
        ],
        chartData: history,
        lastUpdate: ANCHOR_DATE.toISOString()
    };
};

export const fetchOmipData = async (): Promise<{ data: OmipDashboardData, isFallback: boolean }> => {
  // Check Cache
  if (omipCache && (Date.now() - omipCache.timestamp < CACHE_TTL)) {
      return { data: omipCache.data, isFallback: true }; // Always return fallback/simulation for this scenario
  }

  // FORCE FALLBACK TO SIMULATE 2025 DATE
  const data = getFallbackData();
  omipCache = { data, timestamp: Date.now() };
  return { data, isFallback: true };
};
