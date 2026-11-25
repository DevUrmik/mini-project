import React, { useState } from 'react';
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
    state: 'CA',
    month: 6,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preset scenarios in natural language
  const applyPreset = (presetName: string) => {
    if (presetName === 'storm_rush') {
      setFormData({
        temperature: 52,
        humidity: 90,
        visibility: 2.5,
        wind_speed: 22,
        weather_condition: 'Heavy Rain',
        hour: 17,
        day_of_week: 'Friday',
        junction: true,
        crossing: false,
        traffic_signal: true,
        stop: false,
      });
    } else if (presetName === 'night_fog') {
      setFormData({
        temperature: 45,
        humidity: 98,
        visibility: 1.0,
        wind_speed: 4,
        weather_condition: 'Fog',
        hour: 2,
        day_of_week: 'Sunday',
        junction: true,
        crossing: false,
        traffic_signal: false,
        stop: false,
      });
    } else if (presetName === 'clear_midday') {
      setFormData({
        temperature: 72,
        humidity: 45,
        visibility: 10,
        wind_speed: 6,
        weather_condition: 'Clear',
        hour: 13,
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
      setError(err?.response?.data?.detail || err?.message || 'Inference request failed. Please check inputs.');
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
        return 'bg-[#EBF2EE] text-[#28634D] border-[#28634D]/40 font-bold';
      case 3:
        return 'bg-[#FDF6ED] text-[#D69A43] border-[#D69A43]/40 font-bold';
      case 4:
        return 'bg-[#FDF2F0] text-[#C24E42] border-[#C24E42]/40 font-bold';
      default:
        return 'bg-[#F0F2ED] text-[#252923] border-[#E5E7E1]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1] flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#252923]">
            Severity Prediction
          </h1>
          <p className="text-xs text-[#777D78] mt-1">
            Estimate expected traffic delay duration based on weather conditions, time of day, and road features.
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#777D78]">Example scenarios:</span>
          <button
            type="button"
            onClick={() => applyPreset('storm_rush')}
            className="text-xs px-2.5 py-1 rounded bg-white border border-[#E5E7E1] hover:bg-[#F0F2ED] text-[#252923] transition"
          >
            Rain during rush hour
          </button>
          <button
            type="button"
            onClick={() => applyPreset('night_fog')}
            className="text-xs px-2.5 py-1 rounded bg-white border border-[#E5E7E1] hover:bg-[#F0F2ED] text-[#252923] transition"
          >
            Nighttime fog
          </button>
          <button
            type="button"
            onClick={() => applyPreset('clear_midday')}
            className="text-xs px-2.5 py-1 rounded bg-white border border-[#E5E7E1] hover:bg-[#F0F2ED] text-[#252923] transition"
          >
            Clear midday
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Group 1: Weather & Atmosphere */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#777D78] mb-3">
                Weather & Atmosphere
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Weather Condition */}
                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">
                    Weather Condition
                  </label>
                  <select
                    value={formData.weather_condition}
                    onChange={(e) => setFormData({ ...formData, weather_condition: e.target.value })}
                    className="w-full bg-[#F7F7F4] border border-[#E5E7E1] rounded px-3 py-2 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
                  >
                    {['Fair', 'Clear', 'Mostly Cloudy', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Rain', 'Heavy Rain', 'Fog', 'Haze', 'Thunderstorm'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-[#252923]">Temperature</label>
                    <span className="text-xs font-semibold text-[#252923]">{formData.temperature}°F</span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={115}
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#E5E7E1] rounded appearance-none cursor-pointer accent-[#28634D]"
                  />
                </div>

                {/* Humidity */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-[#252923]">Humidity</label>
                    <span className="text-xs font-semibold text-[#252923]">{formData.humidity}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={formData.humidity}
                    onChange={(e) => setFormData({ ...formData, humidity: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#E5E7E1] rounded appearance-none cursor-pointer accent-[#28634D]"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-[#252923]">Visibility</label>
                    <span className="text-xs font-semibold text-[#252923]">{formData.visibility} mi</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={10}
                    step={0.2}
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#E5E7E1] rounded appearance-none cursor-pointer accent-[#28634D]"
                  />
                </div>

                {/* Wind Speed */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-[#252923]">Wind Speed</label>
                    <span className="text-xs font-semibold text-[#252923]">{formData.wind_speed} mph</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={formData.wind_speed}
                    onChange={(e) => setFormData({ ...formData, wind_speed: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#E5E7E1] rounded appearance-none cursor-pointer accent-[#28634D]"
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Time & Date */}
            <div className="pt-3 border-t border-[#E5E7E1]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#777D78] mb-3">
                Time & Date
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hour */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-[#252923]">Hour of Day</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#252923]">
                        {String(formData.hour).padStart(2, '0')}:00
                      </span>
                      {isRushHour && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FDF6ED] text-[#D69A43] font-medium border border-[#D69A43]/30">
                          Commute peak
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
                    className="w-full h-1.5 bg-[#E5E7E1] rounded appearance-none cursor-pointer accent-[#28634D]"
                  />
                </div>

                {/* Day of Week */}
                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">Day of Week</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                    className="w-full bg-[#F7F7F4] border border-[#E5E7E1] rounded px-3 py-2 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* State & Month */}
                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">US State</label>
                  <select
                    value={formData.state || 'CA'}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full bg-[#F7F7F4] border border-[#E5E7E1] rounded px-3 py-2 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
                  >
                    {['CA', 'FL', 'TX', 'NY', 'SC', 'NC', 'VA', 'PA', 'MN', 'OR', 'AZ', 'GA', 'IL', 'TN', 'MI', 'WA', 'OH', 'CO', 'NJ', 'MA', 'MD'].map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#252923] mb-1">Month</label>
                  <select
                    value={formData.month || 6}
                    onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
                    className="w-full bg-[#F7F7F4] border border-[#E5E7E1] rounded px-3 py-2 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
                  >
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Group 3: Roadway Features */}
            <div className="pt-3 border-t border-[#E5E7E1]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#777D78] mb-3">
                Road Infrastructure
              </h2>
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
                      className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer transition text-xs ${
                        isChecked
                          ? 'bg-[#EBF2EE] border-[#28634D] text-[#28634D] font-medium'
                          : 'bg-[#F7F7F4] border-[#E5E7E1] text-[#252923] hover:bg-[#F0F2ED]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                        className="rounded border-[#E5E7E1] text-[#28634D] focus:ring-[#28634D]"
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Clear Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-md bg-[#28634D] hover:bg-[#1F4E3C] text-white font-medium text-xs tracking-wide transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Evaluating Model...' : 'Predict Severity'}
              </button>
            </div>
          </form>
        </div>

        {/* Prediction Results Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {response ? (
            <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle space-y-4">
              <div className="border-b border-[#E5E7E1] pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#777D78]">
                  Prediction Result
                </span>
              </div>

              {/* Severity Card */}
              <div className="p-4 rounded-lg bg-[#F7F7F4] border border-[#E5E7E1] text-center space-y-2">
                <span className="text-xs text-[#777D78]">
                  Predicted traffic impact
                </span>
                <div>
                  <span className={`inline-block text-2xl font-bold px-3 py-1 rounded border ${getSeverityBadgeClass(response.predicted_severity)}`}>
                    Level {response.predicted_severity}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#252923]">
                  {response.severity_category}
                </h3>
                <p className="text-xs text-[#777D78] leading-relaxed max-w-sm mx-auto">
                  {response.traffic_impact_description}
                </p>
                {response.high_impact_risk && (
                  <div className="pt-2 border-t border-[#E5E7E1]/80 flex items-center justify-between text-xs px-2">
                    <span className="text-[#777D78]">High-Impact Risk (Level 3–4):</span>
                    <span className={`font-semibold px-2 py-0.5 rounded border ${
                      response.high_impact_risk.high_impact_percentage >= 50
                        ? 'bg-[#FDF6ED] text-[#D69A43] border-[#D69A43]/40'
                        : 'bg-[#EBF2EE] text-[#28634D] border-[#28634D]/30'
                    }`}>
                      {response.high_impact_risk.high_impact_percentage}% — {response.high_impact_risk.classification}
                    </span>
                  </div>
                )}
              </div>

              {/* Class Probability Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#252923] block">
                  Class Probabilities
                </span>
                {response.class_probabilities.map((prob) => {
                  const isWinner = prob.severity_class === response.predicted_severity;
                  return (
                    <div key={prob.severity_class} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={isWinner ? 'text-[#28634D] font-semibold' : 'text-[#777D78]'}>
                          Level {prob.severity_class}
                        </span>
                        <span className="font-mono text-[#252923] text-xs">{prob.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#F0F2ED] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isWinner ? 'bg-[#28634D]' : 'bg-[#D0D4CA]'
                          }`}
                          style={{ width: `${prob.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Natural Human Disclaimer */}
              <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1] text-[11px] text-[#777D78] leading-relaxed">
                This prediction represents traffic delay impact derived from historical records. It does not predict personal injury or fatality probability.
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7E1] rounded-lg p-6 text-center flex flex-col items-center justify-center min-h-[350px] shadow-subtle">
              <h3 className="text-sm font-semibold text-[#252923] mb-1">
                Ready for Input
              </h3>
              <p className="text-xs text-[#777D78] max-w-xs leading-relaxed">
                Adjust weather, time, and road conditions on the left, then click Predict Severity to calculate estimated traffic delay duration.
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
