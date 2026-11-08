import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';

/**
 * Reaction concentration history chart with multiple tabs for telemetry.
 */
export const ChemChart: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'concentration' | 'temperature' | 'energy'>('concentration');

  // Generating 30 data points for realistic chemical curve simulation
  const mockData = Array.from({ length: 30 }, (_, i) => {
    const t = i;
    const hcl = Math.exp(-0.1 * t);
    const naoh = Math.exp(-0.12 * t);
    const nacl = 1 / (1 + Math.exp(-0.3 * (t - 10)));
    const h2o = 1.2 / (1 + Math.exp(-0.25 * (t - 8)));
    
    // Temperature rising curve
    const temp = 298 + 42 * (1 / (1 + Math.exp(-0.5 * (t - 5))));
    
    return { t, hcl, naoh, nacl, h2o, temp };
  });

  const energyData = [
    { name: 'ΔH', value: -114.0 },
    { name: 'ΔG', value: -118.9 },
    { name: 'ΔS', value: -16.4 },
  ];

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Chart Tabs */}
      <div className="flex gap-1 p-1 mb-2">
        {(['concentration', 'temperature', 'energy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab 
                ? 'bg-[var(--chem-surface3)] text-[var(--chem-teal)] border border-[var(--chem-border)]' 
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'concentration' ? (
            <LineChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chem-border)" vertical={false} />
              <XAxis 
                dataKey="t" 
                tick={{ fontSize: 9, fill: '#8892a4' }} 
                axisLine={{ stroke: 'var(--chem-border)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: '#8892a4' }} 
                axisLine={{ stroke: 'var(--chem-border)' }}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--chem-surface2)', border: '1px solid var(--chem-border)', fontSize: '10px' }}
                itemStyle={{ padding: '0px' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="hcl" name="[HCl]" stroke="#1a9e7a" strokeWidth={2} dot={false} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="naoh" name="[NaOH]" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="nacl" name="[NaCl]" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="h2o" name="[H2O]" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          ) : activeTab === 'temperature' ? (
            <AreaChart data={mockData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chem-border)" vertical={false} />
              <XAxis 
                dataKey="t" 
                tick={{ fontSize: 9, fill: '#8892a4' }} 
                axisLine={{ stroke: 'var(--chem-border)' }}
              />
              <YAxis 
                domain={[290, 350]}
                tick={{ fontSize: 9, fill: '#8892a4' }} 
                axisLine={{ stroke: 'var(--chem-border)' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--chem-surface2)', border: '1px solid var(--chem-border)', fontSize: '10px' }}
              />
              <Area type="monotone" dataKey="temp" name="Temp (K)" stroke="#ef4444" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
            </AreaChart>
          ) : (
            <BarChart data={energyData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chem-border)" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#8892a4', fontWeight: 'bold' }} 
                axisLine={{ stroke: 'var(--chem-border)' }}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: '#8892a4' }} 
                axisLine={{ stroke: 'var(--chem-border)' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--chem-surface2)', border: '1px solid var(--chem-border)', fontSize: '10px' }}
                cursor={{ fill: 'var(--chem-surface2)', opacity: 0.1 }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {energyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.value < 0 ? '#ef4444' : '#1a9e7a'} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
