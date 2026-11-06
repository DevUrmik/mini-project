import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  CloudSun,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  Lightbulb,
  TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from 'recharts';

import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  getTimeAnalytics,
  getWeatherAnalytics,
  getInfrastructureAnalytics
} from '../services/api';
import {
  TimeAnalyticsResponse,
  WeatherAnalyticsResponse,
  InfrastructureAnalyticsResponse
} from '../types';

export const Analytics: React.FC = () => {
  const [timeData, setTimeData] = useState<TimeAnalyticsResponse | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherAnalyticsResponse | null>(null);
  const [infraData, setInfraData] = useState<InfrastructureAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, wRes, iRes] = await Promise.all([
        getTimeAnalytics(),
        getWeatherAnalytics(),
        getInfrastructureAnalytics()
      ]);
      setTimeData(tRes);
      setWeatherData(wRes);
      setInfraData(iRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch road safety analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={3} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton height="h-80" />
          <ChartSkeleton height="h-80" />
        </div>
      </div>
    );
  }

  if (error || !timeData || !weatherData || !infraData) {
    return <ErrorBanner message={error || undefined} onRetry={fetchAnalytics} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            Road Safety Analytics & Empirical Insights
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Multivariate analysis across temporal cycles, weather atmospheric variables, and roadway engineering elements.
          </p>
        </div>
      </div>

      {/* Row 1: Day of Week & Temperature Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of Week */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                Accident Frequency by Day of Week
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Weekday commercial traffic vs weekend leisure travel volumes
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Weekly Pattern
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData.daily} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} accidents`, 'Volume']}
                />
                <Bar
                  dataKey="count"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Temperature Bins vs Average Severity */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CloudSun className="w-4 h-4 text-amber-400" />
                Temperature Brackets & Traffic Delay Index
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Freezing conditions correlate with higher average traffic disruption duration
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Temperature
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weatherData.temperature_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="temp_range" stroke="#64748b" fontSize={10} angle={-20} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} incidents`, 'Incidents']}
                />
                <Bar dataKey="accident_count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Infrastructure Feature Prevalence & Impact */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Roadway Engineering Feature Comparison
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Incident occurrence and traffic severity comparisons at highway junctions, signals, and crosswalks
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Road Infrastructure
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {infraData.features.map((feat) => (
            <div key={feat.feature} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200">{feat.feature}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400">
                  {feat.present_percentage}% share
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {feat.present_count.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1.5">accidents</span>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span>With feature:</span>
                  <span className="font-mono text-sky-400">Sev {feat.present_avg_severity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Without feature:</span>
                  <span className="font-mono text-slate-400">Sev {feat.absent_avg_severity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Academic Road Safety Observations & Critical Insights */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 space-y-3">
        <h4 className="font-bold text-sm text-sky-400 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Empirical Road Safety Insights & Analytical Caveats
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] leading-relaxed">
          <div className="space-y-1">
            <span className="font-semibold text-slate-200 block">Exposure (VMT) Bias</span>
            <p className="text-slate-400">
              The high absolute number of accidents during fair weather is driven by vehicular exposure (more vehicles on roads during good weather). Raw accident counts must not be interpreted as proving fair weather is more hazardous.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-slate-200 block">Junction Bottlenecking</span>
            <p className="text-slate-400">
              Highway junctions exhibit longer average delay durations because highway merges concentrate multi-lane collisions, impeding emergency recovery vehicle access.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-slate-200 block">Severity Interpretation</span>
            <p className="text-slate-400">
              Sobhan Moosavi's severity metric (1 to 4) is formally defined by traffic delay time, not bodily harm or fatality. Safe transportation planning requires distinguishing traffic disruption from fatal crash analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

