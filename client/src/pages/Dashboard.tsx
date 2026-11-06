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

  // Format Severity for Bar Chart
  const severityData = Object.entries(summary.severity_distribution).map(([key, val]) => ({
    severity: `Level ${key}`,
    count: val,
    pct: ((val / summary.total_accidents) * 100).toFixed(1)
  }));

  // Format Top Cities
  const topCitiesData = Object.entries(summary.top_cities).slice(0, 7).map(([city, count]) => ({
    city,
    count
  }));

  // Format Weather Conditions
  const weatherData = Object.entries(summary.top_weather_conditions).slice(0, 6).map(([condition, count]) => ({
    condition,
    count
  }));

  const mostAffectedState = Object.keys(summary.top_states)[0] || 'CA';
  const stateRecordCount = summary.top_states[mostAffectedState] || 0;

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1]">
        <h1 className="text-xl font-bold tracking-tight text-[#252923]">
          Accident Overview
        </h1>
        <p className="text-xs text-[#777D78] mt-1">
          Historical analysis of recorded US traffic incidents, temporal patterns, and road delay severity.
        </p>
      </div>

      {/* 4 Focused KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Accident records analysed"
          value={summary.total_accidents.toLocaleString()}
          description="Continental US verified GPS records"
        />
        <StatCard
          label="Average recorded severity"
          value={`${summary.average_severity}`}
          detail="out of 4.0"
          description="Measured by traffic delay duration"
        />
        <StatCard
          label="High-impact traffic delays"
          value={`${summary.high_impact_percentage}%`}
          description="Severity 3 and 4 prolonged road impacts"
        />
        <StatCard
          label="Most affected area"
          value={mostAffectedState}
          detail={`${stateRecordCount.toLocaleString()} records`}
          description="State with highest incident density"
        />
      </div>

      {/* Primary Charts: Time of Day & Severity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Accidents by hour of day
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Incident volume peaks during standard morning and evening commute windows
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

        {/* Severity Distribution */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Accidents by severity
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Severity 2 (moderate delay) represents the majority of recorded incidents
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="severity" stroke="#777D78" fontSize={11} />
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

      {/* Secondary Charts: Weather & Metro Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weather Conditions */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Weather during accidents
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Incident count by dominant recorded atmospheric conditions
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

        {/* Top Cities */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Cities with the most recorded accidents
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Urban metro areas with high historical incident counts
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCitiesData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
              >
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#777D78" fontSize={11} />
                <YAxis dataKey="city" type="category" stroke="#252923" fontSize={11} width={85} />
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
                <Bar dataKey="count" fill="#D69A43" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Road Features Comparison (Integrated from Analytics) */}
      {infraData && infraData.features.length > 0 && (
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#252923]">
              Roadway features in recorded incidents
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Prevalence and average traffic delay impact near road infrastructure
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
