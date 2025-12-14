import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { NewSimulation } from './views/NewSimulation';
import { Clients } from './views/Clients';
import { PriceTables } from './views/PriceTables';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulation" element={<NewSimulation />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/tables" element={<PriceTables />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
