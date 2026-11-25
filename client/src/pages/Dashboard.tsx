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
import { Info } from 'lucide-react';

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

  // Discrete severity levels (1, 2, 3, 4) from dataset
  const severityLabels: Record<string, string> = {
    '1': 'Level 1 (Minimal)',
    '2': 'Level 2 (Moderate)',
    '3': 'Level 3 (High)',
    '4': 'Level 4 (Severe)'
  };

  const severityData = Object.entries(summary.severity_distribution).map(([key, val]) => ({
    levelKey: key,
    severity: severityLabels[key] || `Level ${key}`,
    count: val,
    pct: ((val / summary.total_accidents) * 100).toFixed(1)
  }));

  // Geographic distribution by State
  const stateData = Object.entries(summary.top_states).map(([st, count]) => ({
    stateCode: st,
    stateName: US_STATE_NAMES[st] || st,
    count,
    pct: ((count / summary.total_accidents) * 100).toFixed(1)
  }));

  // Weather conditions
  const weatherData = Object.entries(summary.top_weather_conditions).slice(0, 6).map(([condition, count]) => ({
    condition,
    count
  }));

  // Peak hour computation
  let peakHourStr = '17:00 (5 PM)';
  if (timeData?.hourly && timeData.hourly.length > 0) {
    const maxHourObj = [...timeData.hourly].sort((a, b) => b.count - a.count)[0];
    if (maxHourObj) {
      peakHourStr = `${String(maxHourObj.hour).padStart(2, '0')}:00`;
    }
  }

  const earliestDate = summary.temporal_range?.earliest?.slice(0, 10) || '2016';
  const latestDate = summary.temporal_range?.latest?.slice(0, 10) || '2023';

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1]">
        <h1 className="text-xl font-bold tracking-tight text-[#252923]">
          Accident Overview
        </h1>
        <p className="text-xs text-[#777D78] mt-1">
          Empirical patterns across recorded US traffic incidents, temporal distributions, and road impact severities.
        </p>
      </div>

      {/* Dataset Scope & Severity Meaning Banner */}
      <div className="bg-[#F0F2ED] border border-[#E5E7E1] rounded-lg p-3 text-xs text-[#252923] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#28634D] shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <span className="font-semibold text-[#252923]">Dataset Information: </span>
          Source: {summary.data_source} ({earliestDate} to {latestDate}) · 
          <strong> {summary.total_accidents.toLocaleString()} records</strong> across {summary.total_states || 49} states ({summary.total_cities ? summary.total_cities.toLocaleString() : '20,281'} unique cities).
          Severity is an integer score (1–4) representing the extent of vehicular traffic disruption and delay caused by the incident; it does not measure injuries or fatalities.
        </div>
      </div>

      {/* 4 Focused KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total accident records"
          value={summary.total_accidents.toLocaleString()}
          description={`${earliestDate} to ${latestDate}`}
        />
        <StatCard
          label="Average recorded severity"
          value={`${summary.average_severity.toFixed(2)}`}
          detail="out of 4.0"
          description="Traffic delay impact scale"
        />
        <StatCard
          label="Higher-impact incident rate"
          value={`${summary.high_impact_percentage}%`}
          description="Severity 3 & 4 prolonged road disruptions"
        />
        <StatCard
          label="Peak accident hour"
          value={peakHourStr}
          description="Highest incident frequency window"
        />
      </div>

      {/* Primary Charts Row: Hourly Volume & Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume (Line Chart) */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Accident frequency by hour
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Incident count plotted across 24 hours showing morning (07:00–09:00) and evening (16:00–18:00) commute peaks
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData?.hourly || []} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="#777D78"
                  fontSize={11}
                  tickFormatter={(val) => `${val}:00`}
                />
                <YAxis stroke="#777D78" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  labelFormatter={(val) => `${val}:00`}
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

        {/* Severity Distribution (Bar Chart with Discrete 1 to 4) */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Traffic severity distribution
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Level 2 (moderate delay) represents {severityData.find((s) => s.levelKey === '2')?.pct ?? '79.7'}% of recorded incidents
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="levelKey" stroke="#777D78" fontSize={11} tickFormatter={(val) => `Level ${val}`} />
                <YAxis stroke="#777D78" fontSize={11} />
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
                    `${Number(val).toLocaleString()} records (${item.payload.pct}%)`,
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

      {/* Secondary Charts: Weather Distribution & Geographic Distribution by State */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weather Conditions Distribution */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Weather distribution
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Incident count by dominant recorded weather condition
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weatherData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="condition" stroke="#777D78" fontSize={11} angle={-20} textAnchor="end" />
                <YAxis stroke="#777D78" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} records`, 'Count']}
                />
                <Bar dataKey="count" fill="#28634D" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geographic Distribution by State */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Geographic distribution by state
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Top states by incident count across all {summary.total_states || 49} states + DC
            </p>
          </div>

          <div className="space-y-3.5 my-auto">
            {stateData.map((st) => (
              <div key={st.stateCode} className="space-y-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-semibold text-[#252923]">
                    {st.stateName} ({st.stateCode})
                  </span>
                  <span className="text-[#777D78]">
                    <span className="font-bold text-[#252923]">{st.count.toLocaleString()}</span> records ({st.pct}%)
                  </span>
                </div>
                <div className="w-full bg-[#F0F2ED] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#28634D] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(Number(st.pct), 2)}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-[#E5E7E1] text-[11px] text-[#777D78] leading-tight">
              Dynamic multi-state distribution across all {summary.total_states || 49} US states and {summary.total_cities ? summary.total_cities.toLocaleString() : '20,281'} unique cities.
            </div>
          </div>
        </div>
      </div>

      {/* Road Features Infrastructure Impact */}
      {infraData && infraData.features.length > 0 && (
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#252923]">
              Roadway features in recorded incidents
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Prevalence and average traffic delay severity near road infrastructure
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {infraData.features.map((item) => (
              <div key={item.feature} className="p-3.5 bg-[#F7F7F4] border border-[#E5E7E1] rounded-md">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-xs text-[#252923]">{item.feature}</span>
                  <span className="text-xs text-[#777D78] font-mono">{item.present_percentage}%</span>
                </div>
                <div className="text-sm font-bold text-[#252923] mt-1">
                  {item.present_count.toLocaleString()}
                  <span className="text-xs font-normal text-[#777D78] ml-1">incidents</span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#E5E7E1] flex justify-between text-xs text-[#777D78]">
                  <span>Avg delay severity:</span>
                  <span className="font-medium text-[#28634D]">Level {item.present_avg_severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
