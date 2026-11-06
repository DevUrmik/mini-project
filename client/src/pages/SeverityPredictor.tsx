import React, { useState } from 'react';
import {
  Gauge,
  Send,
  Sparkles,
  AlertCircle,
  Clock,
  Thermometer,
  Droplets,
  Eye,
  Wind,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { predictSeverity } from '../services/api';
import { PredictionRequest, PredictionResponse } from '../types';

export const SeverityPredictor: React.FC = () => {
  const [formData, setFormData] = useState<PredictionRequest>({
    temperature: 65,
    humidity: 55,
    visibility: 10,
    wind_speed: 8,
    weather_condition: 'Fair',
    hour: 8,
    day_of_week: 'Tuesday',
    junction: true,
    crossing: false,
    traffic_signal: false,
    stop: false,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick preset scenarios
  const applyPreset = (presetName: string) => {
    if (presetName === 'storm_rush') {
      setFormData({
        temperature: 52,
        humidity: 92,
        visibility: 2.5,
        wind_speed: 24,
        weather_condition: 'Heavy Rain',
        hour: 17, // Evening rush
        day_of_week: 'Friday',
        junction: true,
        crossing: false,
        traffic_signal: true,
        stop: false,
      });
    } else if (presetName === 'night_fog') {
      setFormData({
        temperature: 44,
        humidity: 98,
        visibility: 0.8,
        wind_speed: 4,
        weather_condition: 'Fog',
        hour: 2, // 2 AM
        day_of_week: 'Sunday',
        junction: true,
        crossing: false,
        traffic_signal: false,
        stop: false,
      });
    } else if (presetName === 'clear_midday') {
      setFormData({
        temperature: 74,
        humidity: 42,
        visibility: 10,
        wind_speed: 6,
        weather_condition: 'Fair',
        hour: 13, // 1 PM
        day_of_week: 'Wednesday',
        junction: false,
        crossing: true,
        traffic_signal: true,
        stop: false,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await predictSeverity(formData);
      setResponse(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to compute model inference.');
    } finally {
      setLoading(false);
    }
  };

  const isRushHour = [7, 8, 9, 16, 17, 18].includes(formData.hour);

  const getSeverityBadgeColor = (sev: number) => {
    switch (sev) {
      case 1:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 2:
        return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      case 3:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 4:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-sky-400" />
            Accident Severity Inference Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simulate environmental and geometric road conditions to evaluate predicted historical traffic delay severity.
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Scenarios:</span>
          <button
            type="button"
            onClick={() => applyPreset('storm_rush')}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
          >
            Storm + Rush Hour
          </button>
          <button
            type="button"
            onClick={() => applyPreset('night_fog')}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
          >
            Night Fog
          </button>
          <button
            type="button"
            onClick={() => applyPreset('clear_midday')}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition"
          >
            Clear Midday
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Section 1: Weather & Environment */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                Atmospheric & Environmental Factors
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Weather Condition */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Weather Condition
                  </label>
                  <select
                    value={formData.weather_condition}
                    onChange={(e) => setFormData({ ...formData, weather_condition: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                  >
                    {['Fair', 'Clear', 'Mostly Cloudy', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Rain', 'Heavy Rain', 'Fog', 'Haze', 'Thunderstorm'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">Temperature (°F)</label>
                    <span className="text-xs font-mono text-sky-400 font-bold">{formData.temperature}°F</span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={115}
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Humidity */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">Humidity (%)</label>
                    <span className="text-xs font-mono text-sky-400 font-bold">{formData.humidity}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={formData.humidity}
                    onChange={(e) => setFormData({ ...formData, humidity: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">Visibility (mi)</label>
                    <span className="text-xs font-mono text-sky-400 font-bold">{formData.visibility} mi</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={10}
                    step={0.2}
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Wind Speed */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">Wind Speed (mph)</label>
                    <span className="text-xs font-mono text-sky-400 font-bold">{formData.wind_speed} mph</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={formData.wind_speed}
                    onChange={(e) => setFormData({ ...formData, wind_speed: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Temporal & Commute Factors */}
            <div className="pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Temporal & Commute Parameters
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hour */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">Hour of Day</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-sky-400 font-bold">{String(formData.hour).padStart(2, '0')}:00</span>
                      {isRushHour && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                          Rush Hour
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={23}
                    value={formData.hour}
                    onChange={(e) => setFormData({ ...formData, hour: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Day of Week */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Day of Week</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Road Infrastructure Features */}
            <div className="pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                Road Geometry & Traffic Infrastructure
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'junction', label: 'Highway Junction' },
                  { key: 'traffic_signal', label: 'Traffic Signal' },
                  { key: 'crossing', label: 'Crosswalk' },
                  { key: 'stop', label: 'Stop Sign' },
                ].map(({ key, label }) => {
                  const isChecked = formData[key as keyof PredictionRequest] as boolean;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        isChecked
                          ? 'bg-sky-500/15 border-sky-500/40 text-white'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                        className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-900"
                      />
                      <span className="text-xs font-medium">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    <span>Evaluating Prediction Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Run Severity Prediction</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Output Results Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {response ? (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Model Prediction Output
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {response.model_used.split(' ')[0]} {response.model_used.split(' ')[1]}
                </span>
              </div>

              {/* Main Severity Badge */}
              <div className="text-center p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Predicted Traffic Delay Impact
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className={`text-3xl font-black font-mono px-4 py-1.5 rounded-2xl border ${getSeverityBadgeColor(response.predicted_severity)}`}>
                    Level {response.predicted_severity}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mt-1">
                  {response.severity_category}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  {response.traffic_impact_description}
                </p>
              </div>

              {/* Class Probability Distribution */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-300 block">
                  Class Probability Distribution
                </span>
                {response.class_probabilities.map((prob) => {
                  const isWinner = prob.severity_class === response.predicted_severity;
                  return (
                    <div key={prob.severity_class} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`font-medium ${isWinner ? 'text-sky-300 font-bold' : 'text-slate-400'}`}>
                          {prob.label}
                        </span>
                        <span className="font-mono text-slate-300">{prob.percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isWinner ? 'bg-sky-400' : 'bg-slate-600'
                          }`}
                          style={{ width: `${prob.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Academic Disclaimer Box */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>{response.disclaimer}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-sky-400 mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Inference Engine Ready</h4>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Adjust weather, temporal, and road infrastructure attributes on the left and submit to view estimated traffic delay impact and class probabilities.
              </p>
            </div>
          )}

          {error && <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-3 rounded-xl">{error}</div>}
        </div>
      </div>
    </div>
  );
};
