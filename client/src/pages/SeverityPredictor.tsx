import React, { useState } from 'react';
import { DigitalTimePicker } from '../components/DigitalTimePicker';
import { predictSeverity } from '../services/api';
import { PredictionRequest, PredictionResponse } from '../types';

const WEATHER_OPTIONS = [
  'Fair',
  'Clear',
  'Mostly Cloudy',
  'Partly Cloudy',
  'Overcast',
  'Light Rain',
  'Rain',
  'Heavy Rain',
  'Fog',
  'Haze',
  'Thunderstorm',
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const US_STATES = [
  'CA', 'FL', 'TX', 'NY', 'SC', 'NC', 'VA', 'PA', 'MN', 'OR',
  'AZ', 'GA', 'IL', 'TN', 'MI', 'WA', 'OH', 'CO', 'NJ', 'MA', 'MD',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PRESETS: Record<string, { label: string; data: PredictionRequest }> = {
  storm_rush: {
    label: 'Rain / Rush Hour',
    data: {
      temperature: 52,
      humidity: 90,
      visibility: 2.5,
      wind_speed: 22,
      weather_condition: 'Heavy Rain',
      hour: 17,
      minute: 30,
      day_of_week: 'Friday',
      junction: true,
      crossing: false,
      traffic_signal: true,
      stop: false,
      state: 'CA',
      month: 11,
    },
  },
  night_fog: {
    label: 'Nighttime Fog',
    data: {
      temperature: 45,
      humidity: 98,
      visibility: 1.0,
      wind_speed: 4,
      weather_condition: 'Fog',
      hour: 2,
      minute: 15,
      day_of_week: 'Sunday',
      junction: true,
      crossing: false,
      traffic_signal: false,
      stop: false,
      state: 'CA',
      month: 1,
    },
  },
  clear_midday: {
    label: 'Clear Midday',
    data: {
      temperature: 72,
      humidity: 45,
      visibility: 10,
      wind_speed: 6,
      weather_condition: 'Clear',
      hour: 13,
      minute: 0,
      day_of_week: 'Wednesday',
      junction: false,
      crossing: true,
      traffic_signal: true,
      stop: false,
      state: 'CA',
      month: 6,
    },
  },
};

export const SeverityPredictor: React.FC = () => {
  const [formData, setFormData] = useState<PredictionRequest>({
    temperature: 65,
    humidity: 55,
    visibility: 10,
    wind_speed: 8,
    weather_condition: 'Fair',
    hour: 8,
    minute: 0,
    day_of_week: 'Tuesday',
    junction: true,
    crossing: false,
    traffic_signal: false,
    stop: false,
    state: 'CA',
    month: 6,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNumberChange = (
    field: 'temperature' | 'humidity' | 'visibility' | 'wind_speed',
    raw: string,
    min: number,
    max: number
  ) => {
    const parsed = raw === '' ? min : Number(raw);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    setFormData((prev) => ({ ...prev, [field]: clamped }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await predictSeverity(formData);
      setResponse(res);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Inference request failed. Please verify input values.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isRushHour = [7, 8, 9, 16, 17, 18].includes(formData.hour);

  const getSeverityBadgeClass = (sev: number) => {
    switch (sev) {
      case 1:
        return 'bg-[#EBF2EE] text-[#28634D] border-[#28634D]/30';
      case 2:
        return 'bg-[#EBF2EE] text-[#28634D] border-[#28634D]/40';
      case 3:
        return 'bg-[#FDF6ED] text-[#D69A43] border-[#D69A43]/40';
      case 4:
        return 'bg-[#FDF2F0] text-[#C24E42] border-[#C24E42]/40';
      default:
        return 'bg-[#F0F2ED] text-[#252923] border-[#E5E7E1]';
    }
  };

  const inputBaseClass =
    'w-full bg-[#F7F7F4] border border-[#E5E7E1] rounded-md px-3 py-2 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D] focus:bg-white transition-colors';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-[#252923]">
          Accident Severity Prediction
        </h1>

        {/* Scenario Presets */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-xs text-[#777D78] mr-1">Presets:</span>
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData(preset.data)}
              className="text-xs font-medium px-2.5 py-1 rounded border border-[#E5E7E1] bg-white hover:bg-[#F0F2ED] text-[#252923] whitespace-nowrap transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Form (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Weather */}
            <div>
              <h2 className="text-xs font-semibold text-[#777D78] mb-3">
                Weather
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Weather Condition
                  </label>
                  <select
                    value={formData.weather_condition}
                    onChange={(e) =>
                      setFormData({ ...formData, weather_condition: e.target.value })
                    }
                    className={inputBaseClass}
                  >
                    {WEATHER_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Temperature
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={-40}
                      max={130}
                      step={1}
                      value={formData.temperature}
                      onChange={(e) =>
                        handleNumberChange('temperature', e.target.value, -40, 130)
                      }
                      className={`${inputBaseClass} pr-9 font-mono`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#777D78] pointer-events-none">
                      °F
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Humidity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={formData.humidity}
                      onChange={(e) =>
                        handleNumberChange('humidity', e.target.value, 0, 100)
                      }
                      className={`${inputBaseClass} pr-8 font-mono`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#777D78] pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Visibility
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={formData.visibility}
                      onChange={(e) =>
                        handleNumberChange('visibility', e.target.value, 0, 30)
                      }
                      className={`${inputBaseClass} pr-9 font-mono`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#777D78] pointer-events-none">
                      mi
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Wind Speed
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      value={formData.wind_speed}
                      onChange={(e) =>
                        handleNumberChange('wind_speed', e.target.value, 0, 120)
                      }
                      className={`${inputBaseClass} pr-11 font-mono`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#777D78] pointer-events-none">
                      mph
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time & Location */}
            <div>
              <h2 className="text-xs font-semibold text-[#777D78] mb-3">
                Time & Location
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#252923]">
                      Time
                    </label>
                    {isRushHour && (
                      <span className="text-[10px] text-[#D69A43] font-medium">
                        Peak hour
                      </span>
                    )}
                  </div>
                  <DigitalTimePicker
                    hour={formData.hour}
                    minute={formData.minute ?? 0}
                    onChange={(h, m) =>
                      setFormData({ ...formData, hour: h, minute: m })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Day of Week
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) =>
                      setFormData({ ...formData, day_of_week: e.target.value })
                    }
                    className={inputBaseClass}
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    US State
                  </label>
                  <select
                    value={formData.state || 'CA'}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    className={inputBaseClass}
                  >
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Month
                  </label>
                  <select
                    value={formData.month || 6}
                    onChange={(e) =>
                      setFormData({ ...formData, month: Number(e.target.value) })
                    }
                    className={inputBaseClass}
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Road Infrastructure */}
            <div>
              <h2 className="text-xs font-semibold text-[#777D78] mb-3">
                Road Infrastructure
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'junction', label: 'Highway Junction' },
                  { key: 'traffic_signal', label: 'Traffic Signal' },
                  { key: 'crossing', label: 'Crosswalk' },
                  { key: 'stop', label: 'Stop Sign' },
                ].map(({ key, label }) => {
                  const isChecked = Boolean(formData[key as keyof PredictionRequest]);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors text-xs ${
                        isChecked
                          ? 'bg-[#EBF2EE] border-[#28634D]/60 text-[#28634D] font-medium'
                          : 'bg-[#F7F7F4] border-[#E5E7E1] text-[#252923] hover:bg-[#F0F2ED]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setFormData({ ...formData, [key]: e.target.checked })
                        }
                        className="rounded border-[#D0D4CA] text-[#28634D] focus:ring-[#28634D]"
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-[#28634D] hover:bg-[#1F4E3C] text-white font-medium text-xs tracking-wide transition-colors disabled:opacity-50"
              >
                {loading ? 'Running Inference...' : 'Predict Accident Severity'}
              </button>
            </div>
          </form>
        </div>

        {/* Output Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {response ? (
            <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle space-y-5">
              {/* Predicted Severity Summary */}
              <div className="p-4 rounded-md bg-[#F7F7F4] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#777D78]">Predicted severity</span>
                  <span
                    className={`text-sm font-semibold px-2.5 py-0.5 rounded border ${getSeverityBadgeClass(
                      response.predicted_severity
                    )}`}
                  >
                    Level {response.predicted_severity} — {response.severity_category}
                  </span>
                </div>
                <p className="text-xs text-[#777D78] leading-relaxed">
                  {response.traffic_impact_description}
                </p>

                {response.high_impact_risk && (
                  <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#777D78]">Serious/Critical risk (3–4)</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded border text-[11px] ${
                        response.high_impact_risk.high_impact_percentage >= 50
                          ? 'bg-[#FDF6ED] text-[#D69A43] border-[#D69A43]/40'
                          : 'bg-[#EBF2EE] text-[#28634D] border-[#28634D]/30'
                      }`}
                    >
                      {response.high_impact_risk.high_impact_percentage}% · {response.high_impact_risk.classification}
                    </span>
                  </div>
                )}
              </div>

              {/* Class Probability Breakdown */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-[#252923] block">
                  Probability distribution
                </span>
                {response.class_probabilities.map((prob) => {
                  const isWinner =
                    prob.severity_class === response.predicted_severity;
                  return (
                    <div key={prob.severity_class} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span
                          className={
                            isWinner
                              ? 'text-[#28634D] font-semibold'
                              : 'text-[#777D78]'
                          }
                        >
                          Level {prob.severity_class} — {prob.label}
                        </span>
                        <span className="font-mono text-[#252923] text-xs tabular-nums">
                          {prob.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#F0F2ED] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isWinner ? 'bg-[#28634D]' : 'bg-[#D0D4CA]'
                          }`}
                          style={{ width: `${prob.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-[#777D78]">
                {response.model_used} · {formData.state || 'CA'} ·{' '}
                {String(formData.hour).padStart(2, '0')}:{String(formData.minute ?? 0).padStart(2, '0')} ·{' '}
                {formData.weather_condition}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle space-y-1.5">
              <h3 className="text-sm font-semibold text-[#252923]">
                Prediction output
              </h3>
              <p className="text-xs text-[#777D78] leading-relaxed">
                Submit the form to predict accident severity (Level 1 — Minor Accident to Level 4 — Critical Accident).
              </p>
            </div>
          )}

          {error && (
            <div className="text-xs text-[#C24E42] bg-[#FDF2F0] border border-[#C24E42]/30 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
