
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

// Mock History Generator for Chart
const generateHistory = (currentPrice: number, days = 180): OmipDataPoint[] => {
    const data: OmipDataPoint[] = [];
    let price = currentPrice + (Math.random() * 15 - 7.5); // Start slightly offset
    
    // We want to end exactly at currentPrice
    // So we generate backwards
    const now = new Date();
    data.push({
        timestamp: now.toISOString(),
        value: currentPrice,
        label: 'Atual'
    });

    for (let i = 1; i < days; i++) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        
        // Random daily change + drift towards start
        const change = (Math.random() - 0.5) * 2.0; 
        price = data[0].value + (change * i) + (Math.random() * 5); // Add volatility
        
        // Ensure somewhat realistic
        price = Math.max(20, price);

        data.unshift({
            timestamp: date.toISOString(),
            value: Number(price.toFixed(2)),
            label: 'Histórico'
        });
    }
    return data;
};

const parseOmipHtml = (htmlText: string): OmipDashboardData | null => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const tableItems: any[] = [];
        let yr26Price = 0;

        // Try to target specific tables usually present in OMIP for Portugal
        const rows = doc.querySelectorAll('tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                const productLabel = cells[0].textContent?.trim() || "";
                
                // Prioritize "FTB-Portugal" or generic base load terms if explicitly labeled
                const isRelevant = /Base|Peak|Spot|Dia|Semana|M\+|Q\+|Y\+|Ano|Yr-|FTB|FPB/i.test(productLabel);
                
                if (isRelevant) {
                    let priceVal: number | null = null;
                    // Try settlement or last columns
                    const priorityIndices = [4, 8, 5, 3];
                    for (const idx of priorityIndices) {
                        if (cells[idx]) {
                            const val = parsePrice(cells[idx].textContent || "");
                            if (val !== null) { priceVal = val; break; }
                        }
                    }

                    if (priceVal === null) {
                         // Fallback scan
                         for (let i = 1; i < cells.length; i++) {
                             const val = parsePrice(cells[i].textContent || "");
                             if (val !== null) { priceVal = val; break; }
                         }
                    }

                    if (priceVal !== null) {
                        let change = 0;
                        const changeVal = parsePrice(cells[6]?.textContent || "") || parsePrice(cells[9]?.textContent || "");
                        if (changeVal) change = changeVal;
                        else change = (Math.random() - 0.5); // Fallback if change not parsed

                        let displayLabel = productLabel;
                        // Normalize label for UI
                        if (displayLabel.includes("Portugal")) displayLabel = displayLabel.replace("Portugal", "PT");

                        tableItems.push({
                            label: displayLabel,
                            price: priceVal,
                            change: change,
                            trend: change >= 0 ? 'up' : 'down'
                        });

                        // Capture YR-26 or equivalent for chart
                        if (productLabel.includes('YR-26') || productLabel.includes('Yr-26') || productLabel.includes('Ano-26') || productLabel.includes('Y+1')) {
                            yr26Price = priceVal;
                        }
                    }
                }
            }
        });

        // Use Spot if YR-26 not found
        if (yr26Price === 0 && tableItems.length > 0) yr26Price = tableItems[0].price;

        const chartData = generateHistory(yr26Price);
        const sortedTable = tableItems.slice(0, 10); 

        return {
            tableData: sortedTable,
            chartData: chartData,
            lastUpdate: new Date().toISOString()
        };

    } catch (e) {
        console.warn("HTML Parsing Error", e);
        return null;
    }
};

const getFallbackData = (): OmipDashboardData => {
    const base = 56.75;
    const history = generateHistory(base);
    return {
        tableData: [
            { label: 'FPB-Portugal Spot', price: 97.19, change: 1.2, trend: 'up' },
            { label: 'FPB-PT Wk51-25', price: 76.10, change: 0.5, trend: 'up' },
            { label: 'FPB-PT Jan-26', price: 68.35, change: 0.8, trend: 'up' },
            { label: 'FPB-PT Q1-26', price: 58.58, change: 0.2, trend: 'up' },
            { label: 'FPB-PT YR-26', price: 56.75, change: -0.45, trend: 'down' },
            { label: 'FPB-PT YR-27', price: 55.78, change: -0.12, trend: 'down' },
            { label: 'FPB-PT YR-28', price: 56.58, change: 0.15, trend: 'up' }
        ],
        chartData: history,
        lastUpdate: new Date().toISOString()
    };
};

export const fetchOmipData = async (): Promise<{ data: OmipDashboardData, isFallback: boolean }> => {
  // Check Cache
  if (omipCache && (Date.now() - omipCache.timestamp < CACHE_TTL)) {
      console.log("Serving OMIP data from cache");
      return { data: omipCache.data, isFallback: false };
  }

  const cb = Date.now();
  const proxies = [
      { name: 'AllOrigins', getUrl: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&_cb=${cb}`, isJson: true },
      { name: 'CorsProxy', getUrl: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}&_cb=${cb}`, isJson: false },
  ];

  for (const proxy of proxies) {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const response = await fetch(proxy.getUrl(TARGET_URL), { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (response.ok) {
              let html = "";
              if (proxy.isJson) {
                  const json = await response.json();
                  html = json.contents;
              } else {
                  html = await response.text();
              }

              if (html && html.length > 500) {
                  const result = parseOmipHtml(html);
                  if (result && result.tableData.length > 0) {
                      // Update Cache
                      omipCache = { data: result, timestamp: Date.now() };
                      return { data: result, isFallback: false };
                  }
              }
          }
      } catch (e) {
          console.warn(`OMIP Fetch via ${proxy.name} failed`);
      }
  }

  return { data: getFallbackData(), isFallback: true };
};
