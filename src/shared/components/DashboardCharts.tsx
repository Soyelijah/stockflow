import React from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { formatCurrency } from "../../lib/utils";

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface DashboardAreaChartProps {
  chartData: any[];
  isAdmin: boolean;
  isMounted: boolean;
}

export function DashboardAreaChart({ chartData, isAdmin, isMounted }: DashboardAreaChartProps) {
  if (!isMounted || chartData.length === 0 || chartData[0]?.sales === undefined) {
    return <div className="h-[300px] w-full flex items-center justify-center text-slate-400">Generando tendencias…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300} minWidth={0}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
          </linearGradient>
          {isAdmin && (
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
          tickFormatter={(val) => {
            if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `$${Math.round(val / 1000)}k`;
            return `$${val}`;
          }}
        />
        <RechartsTooltip 
          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
          labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}
          formatter={(value: any, name: any) => [formatCurrency(value), name === 'sales' ? 'Ventas' : 'Utilidad']}
        />
        <Area 
          type="monotone" 
          dataKey="sales" 
          stroke="#4f46e5" 
          strokeWidth={4}
          fillOpacity={1} 
          fill="url(#colorSales)" 
          animationDuration={1500}
        />
        {isAdmin && (
          <Area 
            type="monotone" 
            dataKey="profit" 
            stroke="#10b981" 
            strokeWidth={4}
            fillOpacity={1} 
            fill="url(#colorProfit)" 
            animationDuration={1500}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface DashboardPieChartProps {
  expenseChartData: any[];
  isMounted: boolean;
}

export function DashboardPieChart({ expenseChartData, isMounted }: DashboardPieChartProps) {
  if (!isMounted || expenseChartData.length === 0) {
    return <div className="h-[250px] w-full flex items-center justify-center text-slate-400">Generando distribución…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250} minWidth={0}>
      <PieChart>
        <Pie
          data={expenseChartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={8}
          dataKey="value"
        >
          {expenseChartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
          ))}
        </Pie>
        <RechartsTooltip 
          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          formatter={(value: any) => [formatCurrency(value), '']}
        />
        <Legend 
          verticalAlign="bottom" 
          content={({ payload }) => (
            <div className="flex flex-wrap justify-center gap-x-4 space-y-2 mt-6">
              {payload?.map((entry: any) => (
                <div key={entry.value || entry.color} className="flex items-center gap-x-1.5">
                  <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ExecutiveTrendChartProps {
  data: any[];
  isMounted: boolean;
}

export function ExecutiveTrendChart({ data, isMounted }: ExecutiveTrendChartProps) {
  if (!isMounted || data.length === 0) {
    return <div className="h-[210px] w-full flex items-center justify-center text-slate-500">Generando tendencias corporativas…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSalesCorp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorExpensesCorp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
          tickFormatter={(val) => {
            if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `$${Math.round(val / 1000)}k`;
            return `$${val}`;
          }}
        />
        <RechartsTooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
          labelStyle={{ fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}
          itemStyle={{ color: '#94a3b8' }}
          formatter={(value: any, name: any) => [formatCurrency(value), name === 'ventas' ? 'Ventas Realizadas' : 'Gastos Operacionales']}
        />
        <Area 
          type="monotone" 
          dataKey="ventas" 
          stroke="#6366f1" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorSalesCorp)" 
        />
        <Area 
          type="monotone" 
          dataKey="gastos" 
          stroke="#f43f5e" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorExpensesCorp)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
