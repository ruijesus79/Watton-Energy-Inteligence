
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  query,
  orderBy,
  limit,
  Firestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { ClientData, PriceTable } from '../types';

let db: Firestore | null = null;
let auth: any = null;
let useMock = true;

try {
    if (process.env.__firebase_config) {
        const firebaseConfig = JSON.parse(process.env.__firebase_config);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        useMock = false;
        console.log("Firebase initialized successfully.");
    } else {
        console.warn("No __firebase_config found. Using LocalStorage mock.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
    useMock = true;
}

// --- LocalStorage Helpers ---
const getMockData = <T>(key: string): T[] => {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
};

const saveMockData = (key: string, data: any[]) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } 
    catch (e) { console.error("LocalStorage Error:", e); }
};

export const ensureAuth = async () => {
    if (useMock || !auth) return null;
    if (!auth.currentUser) {
        try { 
            await signInAnonymously(auth); 
        } catch (e) { 
            console.warn("Firebase Auth failed, switching to mock mode.", e);
            useMock = true; 
            return null; 
        }
    }
    return auth.currentUser;
};

// --- ROBUST RETRY WITH LOCAL STORAGE FALLBACK ---
const withRetryAndFallback = async <T>(
    operation: () => Promise<T>, 
    fallbackOperation: () => Promise<T> | T,
    maxRetries = 3
): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (e) {
            console.warn(`Firebase attempt ${i + 1} failed:`, e);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i))); // Exponential Backoff
            }
        }
    }
    console.error("All Firebase retries failed. Switching to Local Fallback.");
    // Fallback to LocalStorage to prevent data loss
    return fallbackOperation();
};

// --- Local Logic Helpers (Extracted for direct access) ---

const saveClientLocal = (clientData: ClientData): string => {
    const clients = getMockData<ClientData>('watton_clients');
    const now = Date.now();
    let id = clientData.id;
    
    // Mark as "Local Draft" if needed, but for now just save
    const safeData = { ...clientData, updatedAt: now };
    
    if (id) {
        const index = clients.findIndex(c => c.id === id);
        if (index !== -1) clients[index] = safeData;
        else clients.push(safeData);
    } else {
        id = 'local_' + Math.random().toString(36).substr(2, 9);
        clients.push({ ...safeData, id, createdAt: now });
    }
    
    saveMockData('watton_clients', clients);
    return id!;
};

const deleteClientLocal = (clientId: string) => {
    const clients = getMockData<ClientData>('watton_clients');
    const filtered = clients.filter(c => c.id !== clientId);
    saveMockData('watton_clients', filtered);
};

const getClientsLocal = (): ClientData[] => {
    const clients = getMockData<ClientData>('watton_clients');
    return clients.sort((a, b) => b.updatedAt - a.updatedAt);
};

const getClientByIdLocal = (id: string): ClientData | null => {
    const clients = getMockData<ClientData>('watton_clients');
    return clients.find(c => c.id === id) || null;
};

const savePriceTableLocal = (table: PriceTable): string => {
    const tables = getMockData<PriceTable>('watton_tables');
    let id = table.id;
    if (id) {
         const index = tables.findIndex(t => t.id === id);
         if (index !== -1) tables[index] = table;
    } else {
        id = 'table_' + Math.random().toString(36).substr(2, 9);
        tables.push({ ...table, id, createdAt: Date.now() });
    }
    saveMockData('watton_tables', tables);
    return id!;
};

const getPriceTablesLocal = (): PriceTable[] => {
    const tables = getMockData<PriceTable>('watton_tables');
    return tables.sort((a, b) => b.createdAt - a.createdAt);
};


// --- Service Exports ---

export const saveClient = async (clientData: ClientData) => {
    // 1. Check Mock Mode FIRST to avoid unnecessary retries/errors
    if (useMock) return saveClientLocal(clientData);

    const saveDataToFirebase = async () => {
        if (!db) throw new Error("Firebase disabled");
        await ensureAuth();
        if (useMock) throw new Error("Auth failed"); // Re-check if auth forced mock mode

        const dataToSave = { ...clientData, updatedAt: Date.now() };
        if (clientData.id) {
            const docRef = doc(db, 'clients', clientData.id);
            await updateDoc(docRef, dataToSave);
            return clientData.id;
        } else {
            const docRef = await addDoc(collection(db, 'clients'), {
                ...dataToSave,
                createdAt: Date.now()
            });
            return docRef.id;
        }
    };

    return withRetryAndFallback(saveDataToFirebase, () => saveClientLocal(clientData));
};

export const deleteClient = async (clientId: string) => {
    if (useMock) {
        deleteClientLocal(clientId);
        return;
    }

    try {
        await ensureAuth();
        if (useMock || !db) throw new Error("Mock");
        const docRef = doc(db, 'clients', clientId);
        await deleteDoc(docRef);
    } catch (e) {
        // Silent failover for delete
        deleteClientLocal(clientId);
    }
};

export const getClients = async () => {
    if (useMock) return getClientsLocal();

    const fetchRemote = async () => {
        if (!db) throw new Error("Mock mode");
        await ensureAuth();
        if (useMock) throw new Error("Auth failed");

        const q = query(collection(db, 'clients'), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientData));
    };

    return withRetryAndFallback(fetchRemote, getClientsLocal, 2);
};

export const getRecentClients = async (limitCount = 5) => {
    // Re-use getClients (which handles caching/mock logic)
    const all = await getClients();
    return all.slice(0, limitCount);
};

export const getClientById = async (id: string) => {
    if (useMock) return getClientByIdLocal(id);

    const fetchRemote = async () => {
        if (!db) throw new Error("Mock mode");
        await ensureAuth();
        if (useMock) throw new Error("Auth failed");

        const docRef = doc(db, 'clients', id);
        const snap = await getDoc(docRef);
        return snap.exists() ? { id: snap.id, ...snap.data() } as ClientData : null;
    };
    
    return withRetryAndFallback(fetchRemote, () => getClientByIdLocal(id), 2);
};

// --- Price Tables Service ---

export const savePriceTable = async (table: PriceTable) => {
    if (useMock) return savePriceTableLocal(table);

    const saveRemote = async () => {
        if (!db) throw new Error("Mock mode");
        await ensureAuth();
        if (useMock) throw new Error("Auth failed");

        if (table.id) {
            const docRef = doc(db, 'price_tables', table.id);
            await updateDoc(docRef, { ...table });
            return table.id;
        } else {
            const docRef = await addDoc(collection(db, 'price_tables'), {
                ...table,
                createdAt: Date.now()
            });
            return docRef.id;
        }
    };

    return withRetryAndFallback(saveRemote, () => savePriceTableLocal(table));
};

export const getPriceTables = async () => {
    if (useMock) return getPriceTablesLocal();

    const fetchRemote = async () => {
        if (!db) throw new Error("Mock mode");
        await ensureAuth();
        if (useMock) throw new Error("Auth failed");

        const q = query(collection(db, 'price_tables'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceTable));
    };

    return withRetryAndFallback(fetchRemote, getPriceTablesLocal);
};
