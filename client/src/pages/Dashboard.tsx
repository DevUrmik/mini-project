import React, { useEffect, useState } from 'react';
import {
  Car,
  AlertTriangle,
  Clock,
  Compass,
  TrendingUp,
  MapPin,
  CloudSun,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

import { StatCard } from '../components/StatCard';
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { getDashboardSummary, getTimeAnalytics } from '../services/api';
import { DashboardSummary, TimeAnalyticsResponse } from '../types';

const SEVERITY_COLORS = ['#38bdf8', '#3b82f6', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [timeData, setTimeData] = useState<TimeAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, timeRes] = await Promise.all([
        getDashboardSummary(),
        getTimeAnalytics()
      ]);
      setSummary(sumRes);
      setTimeData(timeRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch dashboard intelligence metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton height="h-80" />
          <ChartSkeleton height="h-80" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <ErrorBanner message={error || undefined} onRetry={fetchData} />;
  }

  // Format Severity for Pie Chart
  const severityPieData = Object.entries(summary.severity_distribution).map(([key, val]) => ({
    name: `Severity ${key}`,
    value: val,
    pct: ((val / summary.total_accidents) * 100).toFixed(1)
  }));

  // Format Top Cities for Bar Chart
  const topCitiesData = Object.entries(summary.top_cities).map(([city, count]) => ({
    city,
    count
  }));

  // Format Top Weather Conditions
  const weatherData = Object.entries(summary.top_weather_conditions).slice(0, 6).map(([cond, count]) => ({
    condition: cond,
    count
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            Overview Road Safety Intelligence
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated accident metrics and traffic delay profiles across historical incident records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {summary.is_synthetic ? (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Dev Sample Fixture (Moosavi Schema)
            </span>
          ) : (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Raw Kaggle Dataset Connected
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Incidents Analyzed"
          value={summary.total_accidents.toLocaleString()}
          subtitle="Continental US verified GPS records"
          icon={Car}
          badge="Deduplicated"
          badgeColor="blue"
        />
        <StatCard
          title="Average Traffic Delay Severity"
          value={`${summary.average_severity} / 4.0`}
          subtitle="Empirical traffic impact scale (1-4)"
          icon={AlertTriangle}
          badge="Traffic Impact"
          badgeColor="indigo"
        />
        <StatCard
          title="High Impact Incidents"
          value={`${summary.high_impact_percentage}%`}
          subtitle="Severity Levels 3 & 4 prolonged delays"
          icon={TrendingUp}
          badge="Substantial"
          badgeColor="amber"
        />
        <StatCard
          title="Commute Rush Hour Share"
          value={timeData?.rush_hour_breakdown ? `${timeData.rush_hour_breakdown.rush_hour_percentage}%` : 'N/A'}
          subtitle="7-9 AM & 4-6 PM peak travel windows"
          icon={Clock}
          badge="Peak Commute"
          badgeColor="emerald"
        />
      </div>

      {/* Row 1 Charts: Temporal Volume & Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Trend Area Chart */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                Accident Frequency by Hour of Day
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Clear morning and evening commuter peaks highlighted across the 24-hour cycle
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
              24h Commute Curve
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData?.hourly || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `${val}:00`}
                />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(val) => `Time: ${val}:00`}
                  formatter={(value: any) => [`${Number(value).toLocaleString()} accidents`, 'Incident Count']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#hourGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Breakdown Donut Chart */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Traffic Severity Breakdown
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Severity 2 (moderate delay) represents the dominant proportion
            </p>
          </div>

          <div className="h-52 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} records`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
            {severityPieData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[idx] }}></span>
                <span className="text-slate-300 font-medium">{item.name}:</span>
                <span className="text-slate-400 ml-auto font-mono">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 Charts: Geographic Cities & Weather Conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Cities */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Top Accident Concentration Metro Areas
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Metro areas with the highest recorded accident counts
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              City Level
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCitiesData} layout="vertical" margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis dataKey="city" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} accidents`, 'Count']}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weather Conditions */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CloudSun className="w-4 h-4 text-sky-400" />
                Weather Conditions at Accident Time
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Incidents occur predominantly in fair weather due to higher exposure (VMT)
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Weather Factor
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weatherData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="condition" stroke="#64748b" fontSize={10} angle={-25} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} incidents`, 'Count']}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

