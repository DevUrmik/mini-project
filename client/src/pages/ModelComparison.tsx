import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Info, AlertCircle, CheckCircle2, ShieldCheck, Scale, AlertTriangle, Clock } from 'lucide-react';

import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { getModelMetrics } from '../services/api';
import { ModelMetricsResponse, ModelMetricDetails } from '../types';

export const ModelComparison: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('random_forest');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getModelMetrics();
      setMetrics(data);
      if (data.selected_best_model && data.models[data.selected_best_model]) {
        setSelectedModelKey(data.selected_best_model);
      } else if (data.models && Object.keys(data.models).length > 0) {
        setSelectedModelKey(Object.keys(data.models)[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load model evaluation metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={4} />
        <ChartSkeleton height="h-72" />
      </div>
    );
  }

  if (error || !metrics) {
    return <ErrorBanner message={error || undefined} onRetry={fetchMetrics} />;
  }

  const modelsList: ModelMetricDetails[] = Object.values(metrics.models);
  const activeModel = metrics.models[selectedModelKey] || metrics.models.random_forest || modelsList[0];
  const activeCM = activeModel.confusion_matrix;
  const maxCellValue = Math.max(...activeCM.flat());

  const severityDefinitions: Record<string, { title: string; desc: string }> = {
    '1': { title: 'Level 1 — Minimal Delay', desc: 'Negligible vehicular traffic disruption (< 15 min delay)' },
    '2': { title: 'Level 2 — Moderate Delay', desc: 'Standard incident with localized freeway slowdown (15–45 min)' },
    '3': { title: 'Level 3 — High Delay', desc: 'Substantial congestion with multi-lane blockage (45–90 min)' },
    '4': { title: 'Level 4 — Significant Disruption', desc: 'Prolonged full corridor closure or major arterial shutdown' }
  };

  // Chart data comparing models + majority baseline
  const chartData = [
    ...(metrics.majority_baseline ? [{
      name: 'Majority Baseline',
      accuracy: metrics.majority_baseline.accuracy,
      macro_f1: metrics.majority_baseline.macro_f1,
      balanced_accuracy: metrics.majority_baseline.balanced_accuracy,
      isBaseline: true
    }] : []),
    ...modelsList.map((m) => ({
      name: m.name.replace(' Classifier', ''),
      accuracy: m.accuracy,
      macro_f1: m.macro_f1,
      balanced_accuracy: m.balanced_accuracy,
      isBaseline: false
    }))
  ];

  // Class distribution bar data
  const classDistData = Object.entries(metrics.target_info.class_distribution).map(([cls, count]) => {
    const total = metrics.dataset_split.total_samples;
    const pct = ((count / total) * 100).toFixed(2);
    return {
      name: `Level ${cls}`,
      count,
      percentage: Number(pct),
      label: severityDefinitions[cls]?.title || `Severity ${cls}`
    };
  });

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#252923]">
              ML Model Analysis & Evaluation
            </h1>
            <p className="text-xs text-[#777D78] mt-1">
              Supervised traffic-impact classification benchmarks across a nationwide 20% test partition ({metrics.dataset_split.test_samples.toLocaleString()} incidents).
            </p>
          </div>
          <div className="text-[11px] text-[#777D78] bg-white border border-[#E5E7E1] px-2.5 py-1 rounded">
            Partition: <strong className="text-[#252923]">{metrics.dataset_split.train_samples.toLocaleString()} train</strong> / <strong className="text-[#252923]">{metrics.dataset_split.test_samples.toLocaleString()} test</strong>
          </div>
        </div>
      </div>

      {/* Majority-Class Baseline Warning Card */}
      <div className="bg-[#F0F2ED] border border-[#E5E7E1] rounded-lg p-4 space-y-2 text-xs text-[#252923]">
        <div className="flex items-center gap-2 font-semibold text-xs text-[#28634D]">
          <Scale className="w-4 h-4 shrink-0" />
          <span>Investigation: Extreme Class Imbalance & The Fallacy of Raw Accuracy</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="md:col-span-2 space-y-1 text-xs text-[#777D78] leading-relaxed">
            <p>
              The authentic dataset exhibits severe class imbalance: <strong>Level 2 represents 79.65%</strong> of all records, whereas <strong>Level 1 (0.88%)</strong> and <strong>Level 4 (2.66%)</strong> are rare minority events.
            </p>
            <p>
              A trivial dummy model that always predicts Level 2 scores <strong>79.65% raw accuracy</strong>, but has <strong>0.0% recall</strong> on minority classes (Balanced Accuracy = 25.0%). Therefore, <strong>Macro F1</strong> and <strong>Balanced Accuracy</strong> serve as our primary scientific benchmarks.
            </p>
          </div>
          <div className="bg-white border border-[#E5E7E1] rounded p-3 text-xs space-y-1">
            <div className="text-[11px] font-semibold text-[#252923]">Majority Baseline Benchmark:</div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#777D78]">Dummy Accuracy:</span>
              <span className="font-bold text-[#252923]">{metrics.majority_baseline?.accuracy ?? 79.65}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#777D78]">Dummy Balanced Acc:</span>
              <span className="font-bold text-[#C24E42]">25.00%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#777D78]">Dummy Macro F1:</span>
              <span className="font-bold text-[#C24E42]">22.17%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Model Comparison Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modelsList.map((model) => {
          const isSelected = selectedModelKey === model.model_key;
          const isPrimary = model.model_key === metrics.selected_best_model;

          return (
            <div
              key={model.model_key}
              onClick={() => setSelectedModelKey(model.model_key)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white border-[#28634D] shadow-md ring-1 ring-[#28634D]'
                  : 'bg-white border-[#E5E7E1] hover:border-[#28634D]/50 shadow-subtle'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-[#252923]">{model.name}</span>
                {isPrimary && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EBF2EE] text-[#28634D] border border-[#28634D]/30">
                    Primary
                  </span>
                )}
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#777D78]">Macro F1:</span>
                  <span className="font-bold text-sm text-[#28634D]">{model.macro_f1}%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#777D78]">Balanced Acc:</span>
                  <span className="font-semibold text-[#252923]">{model.balanced_accuracy}%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#777D78]">Overall Accuracy:</span>
                  <span className="font-medium text-[#252923]">{model.accuracy}%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#777D78]">Weighted F1:</span>
                  <span className="text-[#777D78]">{model.weighted_f1}%</span>
                </div>
                {model.training_time_sec !== undefined && (
                  <div className="flex justify-between items-baseline pt-1 border-t border-[#E5E7E1] text-[10px] text-[#777D78]">
                    <span>Training Latency:</span>
                    <span>{model.training_time_sec}s</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-side: Metric Benchmark Multi-Bar Chart & Class Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metric Comparison Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Accuracy vs. Balanced Metrics Benchmark
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Comparison across candidate classifiers and the majority-class baseline. Note how the baseline collapses on Balanced Accuracy.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#777D78" fontSize={11} />
                <YAxis stroke="#777D78" fontSize={11} domain={[0, 90]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  formatter={(val: any) => [`${val}%`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="accuracy" name="Accuracy" fill="#28634D" radius={[3, 3, 0, 0]} />
                <Bar dataKey="macro_f1" name="Macro F1" fill="#D69A43" radius={[3, 3, 0, 0]} />
                <Bar dataKey="balanced_accuracy" name="Balanced Accuracy" fill="#889088" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dataset Class Distribution Chart (1 col) */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[#252923]">
              Target Class Distribution
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Empirical frequency of traffic delay severity in training partition
            </p>
          </div>

          <div className="space-y-3 my-2">
            {classDistData.map((cd) => (
              <div key={cd.name} className="space-y-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-semibold text-[#252923]">{cd.name}</span>
                  <span className="text-[11px] text-[#777D78]">
                    {cd.count.toLocaleString()} ({cd.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-[#F0F2ED] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#28634D] rounded-full"
                    style={{ width: `${Math.max(cd.percentage, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-[#777D78] pt-2 border-t border-[#E5E7E1] leading-tight">
            Level 2 represents 79.7% of incidents. Levels 1 & 4 require class-weighted cost penalties.
          </div>
        </div>
      </div>

      {/* Per-Class Precision, Recall, and F1 Table */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#252923]">
              Per-Class Breakdown: {activeModel.name}
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Precision, recall, and F1 score for each discrete traffic-delay severity level
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#777D78]">Inspect Model:</span>
            <select
              value={selectedModelKey}
              onChange={(e) => setSelectedModelKey(e.target.value)}
              className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2.5 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
            >
              {modelsList.map((m) => (
                <option key={m.model_key} value={m.model_key}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#252923]">
            <thead className="bg-[#F7F7F4] border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
              <tr>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">Impact Definition</th>
                <th className="py-2.5 px-3 text-right">Test Support</th>
                <th className="py-2.5 px-3 text-right">Test Share</th>
                <th className="py-2.5 px-3 text-right">Precision</th>
                <th className="py-2.5 px-3 text-right">Recall</th>
                <th className="py-2.5 px-3 text-right">F1 Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7E1]">
              {Object.entries(activeModel.per_class).map(([cls, pc]) => {
                const supportPct = ((pc.support / metrics.dataset_split.test_samples) * 100).toFixed(1);
                const isMinority = cls === '1' || cls === '4';
                return (
                  <tr key={cls} className={`transition-colors ${isMinority ? 'bg-[#FAFAF8]' : 'hover:bg-[#F7F7F4]'}`}>
                    <td className="py-2.5 px-3 font-semibold text-[#28634D]">
                      Level {cls}
                    </td>
                    <td className="py-2.5 px-3 text-[#252923]">
                      <div className="font-medium">{severityDefinitions[cls]?.title || `Severity ${cls}`}</div>
                      <div className="text-[10px] text-[#777D78]">{severityDefinitions[cls]?.desc}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {pc.support.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#777D78]">
                      {supportPct}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                      {pc.precision.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                      {pc.recall.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] font-bold text-[#28634D]">
                      {pc.f1_score.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-side: Confusion Matrix & Feature Importances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[#252923]">
              Confusion Matrix: {activeModel.name}
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Rows represent true recorded severity; columns represent model predictions
            </p>
          </div>

          <div className="overflow-x-auto my-3">
            <div className="inline-block min-w-full text-center">
              <div className="text-[11px] text-[#777D78] mb-2 font-medium">
                Predicted Severity Class
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs">
                {/* Header Row */}
                <div className="text-[#777D78] p-2 text-right text-[11px] font-medium">Actual</div>
                {[1, 2, 3, 4].map((c) => (
                  <div key={`header-${c}`} className="bg-[#F0F2ED] text-[#252923] font-semibold p-2 rounded">
                    Level {c}
                  </div>
                ))}

                {/* Matrix Rows */}
                {activeCM.map((row, rIdx) => (
                  <React.Fragment key={`row-${rIdx}`}>
                    <div className="bg-[#F0F2ED] text-[#252923] font-semibold p-2 rounded flex items-center justify-center text-[11px]">
                      Level {rIdx + 1}
                    </div>
                    {row.map((val, cIdx) => {
                      const isDiagonal = rIdx === cIdx;
                      const ratio = maxCellValue > 0 ? val / maxCellValue : 0;
                      return (
                        <div
                          key={`cell-${rIdx}-${cIdx}`}
                          className={`p-2.5 rounded border text-xs flex flex-col items-center justify-center transition ${
                            isDiagonal
                              ? 'bg-[#EBF2EE] border-[#28634D]/40 font-bold text-[#28634D]'
                              : ratio > 0.3
                              ? 'bg-[#F7F7F4] border-[#E5E7E1] text-[#252923]'
                              : 'bg-white border-[#E5E7E1] text-[#777D78]'
                          }`}
                        >
                          <span className="text-xs">{val.toLocaleString()}</span>
                          <span className="text-[10px] text-[#777D78]">
                            {((val / metrics.dataset_split.test_samples) * 100).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-[#777D78] pt-2 border-t border-[#E5E7E1] flex justify-between">
            <span>Diagonal cells indicate correct predictions</span>
            <span>Total test partition: {metrics.dataset_split.test_samples.toLocaleString()}</span>
          </div>
        </div>

        {/* Feature Importances (Random Forest) */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[#252923]">
              Top Pre-Incident Predictive Features
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Gini split contributions from Random Forest (Zero post-incident outcome leakage)
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.feature_importances.slice(0, 8).reverse()}
                layout="vertical"
                margin={{ top: 5, right: 25, left: 50, bottom: 5 }}
              >
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#777D78" fontSize={11} domain={[0, 'dataMax + 2']} />
                <YAxis dataKey="feature" type="category" stroke="#252923" fontSize={11} width={115} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#252923',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  formatter={(val: any) => [`${val}%`, 'Relative Importance']}
                />
                <Bar dataKey="importance" fill="#28634D" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-[#777D78] pt-2 border-t border-[#E5E7E1]">
            Spatial coordinates (Lat/Lng), state context, weather measurements, and cyclical peak hours drive feature splits.
          </div>
        </div>
      </div>

      {/* Operational Binary High-Impact (Severity 3-4 vs 1-2) Benchmark */}
      {metrics.binary_high_impact && (
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7E1] pb-2">
            <div>
              <h2 className="text-sm font-semibold text-[#252923]">
                Operational Formulation: High-Impact (Severity 3–4) vs Standard (Severity 1–2)
              </h2>
              <p className="text-xs text-[#777D78] mt-0.5">
                {metrics.binary_high_impact.name} — evaluates corridor-level disruption risk without post-incident leakage.
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EBF2EE] text-[#28634D] border border-[#28634D]/20 self-start sm:self-auto">
              ROC-AUC: {metrics.binary_high_impact.roc_auc}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1]">
              <div className="text-[11px] text-[#777D78]">Binary Accuracy</div>
              <div className="text-base font-bold text-[#252923] mt-0.5">{metrics.binary_high_impact.accuracy}%</div>
            </div>
            <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1]">
              <div className="text-[11px] text-[#777D78]">Balanced Accuracy</div>
              <div className="text-base font-bold text-[#28634D] mt-0.5">{metrics.binary_high_impact.balanced_accuracy}%</div>
            </div>
            <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1]">
              <div className="text-[11px] text-[#777D78]">Macro F1</div>
              <div className="text-base font-bold text-[#28634D] mt-0.5">{metrics.binary_high_impact.macro_f1}%</div>
            </div>
            <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1]">
              <div className="text-[11px] text-[#777D78]">High-Impact F1</div>
              <div className="text-base font-bold text-[#252923] mt-0.5">{metrics.binary_high_impact.high_impact_f1}%</div>
            </div>
            <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1]">
              <div className="text-[11px] text-[#777D78]">High-Impact Recall / Prec</div>
              <div className="text-sm font-bold text-[#252923] mt-0.5">
                {metrics.binary_high_impact.high_impact_recall}% / {metrics.binary_high_impact.high_impact_precision}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Viva-Ready Methodology & Limitation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#252923]">
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[#28634D]">
            <Scale className="w-3.5 h-3.5" />
            <span>Why Macro F1 Matters</span>
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            The dataset contains substantially more Level 2 incidents (~79.7%) than Level 1 (0.88%) and Level 4 (2.66%) incidents. Accuracy can look deceptively reasonable (79.65%) even when the model fails completely on minority categories. Macro F1 gives each of the four severity classes equal importance.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[#28634D]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>What the Model Predicts</span>
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            The target variable represents recorded <strong>traffic-impact severity</strong> (delay duration and roadway blockage), graded on an integer scale from 1 (minor impact) to 4 (major corridor disruption). It does not measure physical injuries or human fatalities.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[#D69A43]">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Important Modeling Limitation</span>
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            This model classifies traffic-impact severity <em>given</em> pre-incident conditions at an accident occurrence. It does not establish the baseline spatial probability or likelihood that an accident will occur at a specific coordinate or highway intersection.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[#28634D]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Data Leakage Protocol</span>
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            Post-incident outcome fields (clearance time, incident duration, road closure distance, and descriptive text) were strictly excluded from model training. The feature matrix contains solely pre-incident environmental, temporal, and infrastructure indicators.
          </p>
        </div>
      </div>
    </div>
  );
};
