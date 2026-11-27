import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Cell
} from 'recharts';

import { StatCard } from '../components/StatCard';
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  getDashboardSummary,
  getTimeAnalytics,
  getInfrastructureAnalytics
} from '../services/api';
import {
  DashboardSummary,
  TimeAnalyticsResponse,
  InfrastructureAnalyticsResponse
} from '../types';

const SEVERITY_PALETTE = ['#529871', '#28634D', '#D69A43', '#C24E42'];

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

const formatCompactCount = (val: number) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
  return String(val);
};

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [timeData, setTimeData] = useState<TimeAnalyticsResponse | null>(null);
  const [infraData, setInfraData] = useState<InfrastructureAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, timeRes, infraRes] = await Promise.all([
        getDashboardSummary(),
        getTimeAnalytics(),
        getInfrastructureAnalytics()
      ]);
      setSummary(sumRes);
      setTimeData(timeRes);
      setInfraData(infraRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load accident data from the server.');
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
          <ChartSkeleton height="h-72" />
          <ChartSkeleton height="h-72" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <ErrorBanner message={error || undefined} onRetry={fetchData} />;
  }

  const severityLabels: Record<string, string> = {
    '1': 'Level 1 — Minor Accident',
    '2': 'Level 2 — Moderate Accident',
    '3': 'Level 3 — Serious Accident',
    '4': 'Level 4 — Critical Accident'
  };

  const severityData = Object.entries(summary.severity_distribution).map(([key, val]) => ({
    levelKey: key,
    severity: severityLabels[key] || `Level ${key}`,
    count: val,
    pct: ((val / summary.total_accidents) * 100).toFixed(1)
  }));

  const stateData = Object.entries(summary.top_states).map(([st, count]) => ({
    stateCode: st,
    stateName: US_STATE_NAMES[st] || st,
    count,
    pct: ((count / summary.total_accidents) * 100).toFixed(1)
  }));

  const weatherData = Object.entries(summary.top_weather_conditions).slice(0, 6).map(([condition, count]) => ({
    condition,
    count
  }));

  let peakHourStr = '17:00';
  if (timeData?.hourly && timeData.hourly.length > 0) {
    const maxHourObj = [...timeData.hourly].sort((a, b) => b.count - a.count)[0];
    if (maxHourObj) {
      peakHourStr = `${String(maxHourObj.hour).padStart(2, '0')}:00`;
    }
  }

  const earliestDate = summary.temporal_range?.earliest?.slice(0, 10) || '2016';
  const latestDate = summary.temporal_range?.latest?.slice(0, 10) || '2023';
  const level2Pct = severityData.find((s) => s.levelKey === '2')?.pct ?? '79.7';

  return (
    <div className="space-y-7">
      {/* Header & Compact Dataset Scope */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-[#252923]">
          Overview
        </h1>
        <p className="text-xs text-[#777D78]">
          {summary.data_source} · {earliestDate} to {latestDate} · {summary.total_states || 49} states ·{' '}
          {summary.total_cities ? summary.total_cities.toLocaleString() : '20,281'} cities
        </p>
      </div>

      {/* 4 Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total accidents"
          value={summary.total_accidents.toLocaleString()}
        />
        <StatCard
          label="Average severity"
          value={summary.average_severity.toFixed(2)}
          detail="/ 4.0"
        />
        <StatCard
          label="Serious & critical (3–4)"
          value={`${summary.high_impact_percentage}%`}
        />
        <StatCard
          label="Peak hour"
          value={peakHourStr}
        />
      </div>

      {/* Primary Charts: Hourly Volume & Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <h2 className="text-sm font-semibold text-[#252923] mb-4">
            Accidents by hour
          </h2>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData?.hourly || []} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="#777D78"
                  fontSize={11}
                  tickFormatter={(val) => `${val}:00`}
                />
                <YAxis stroke="#777D78" fontSize={11} tickFormatter={formatCompactCount} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  labelFormatter={(val) => `${String(val).padStart(2, '0')}:00`}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} records`, 'Accidents']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#28634D"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#28634D' }}
                  activeDot={{ r: 5, fill: '#28634D' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Severity distribution
            </h2>
            <span className="text-xs text-[#777D78]">Level 2: {level2Pct}%</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="levelKey" stroke="#777D78" fontSize={11} tickFormatter={(val) => `Level ${val}`} />
                <YAxis stroke="#777D78" fontSize={11} tickFormatter={formatCompactCount} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  formatter={(val: any, _name: any, item: any) => [
                    `${Number(val).toLocaleString()} (${item.payload.pct}%)`,
                    item.payload.severity
                  ]}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {severityData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_PALETTE[index % SEVERITY_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts: Weather Conditions & Accidents by State */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <h2 className="text-sm font-semibold text-[#252923] mb-4">
            Weather conditions
          </h2>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weatherData} margin={{ top: 8, right: 12, left: -10, bottom: 20 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="condition" stroke="#777D78" fontSize={11} angle={-20} textAnchor="end" />
                <YAxis stroke="#777D78" fontSize={11} tickFormatter={formatCompactCount} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()}`, 'Accidents']}
                />
                <Bar dataKey="count" fill="#28634D" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Accidents by state
            </h2>
            <span className="text-xs text-[#777D78]">Top {stateData.length} of {summary.total_states || 49}</span>
          </div>

          <div className="space-y-3">
            {stateData.map((st) => (
              <div key={st.stateCode} className="space-y-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-medium text-[#252923]">
                    {st.stateName} ({st.stateCode})
                  </span>
                  <span className="text-[#777D78] tabular-nums">
                    <span className="font-semibold text-[#252923]">{st.count.toLocaleString()}</span> ({st.pct}%)
                  </span>
                </div>
                <div className="w-full bg-[#F0F2ED] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#28634D] rounded-full"
                    style={{ width: `${Math.max(Number(st.pct), 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Road Infrastructure */}
      {infraData && infraData.features.length > 0 && (
        <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <h2 className="text-sm font-semibold text-[#252923] mb-4">
            Road infrastructure
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {infraData.features.map((item) => (
              <div key={item.feature} className="p-3.5 bg-[#F7F7F4] rounded-md">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-xs text-[#252923]">{item.feature}</span>
                  <span className="text-xs text-[#777D78] font-mono">{item.present_percentage}%</span>
                </div>
                <div className="text-base font-semibold text-[#252923] mt-1 tabular-nums">
                  {item.present_count.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-[#777D78]">
                  Avg severity: <span className="font-medium text-[#28634D]">Level {item.present_avg_severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
