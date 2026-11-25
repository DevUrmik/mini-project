import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Scale, ShieldCheck } from 'lucide-react';

import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatCard } from '../components/StatCard';
import { getModelMetrics } from '../services/api';
import { ModelMetricsResponse } from '../types';

export const ModelComparison: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getModelMetrics();
      setMetrics(data);
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

  const selectedModel =
    metrics.models[metrics.selected_best_model] ||
    metrics.models.hist_gradient_boosting ||
    Object.values(metrics.models)[0];

  const activeCM = selectedModel.confusion_matrix;
  const maxCellValue = Math.max(...activeCM.flat());

  const severityDefinitions: Record<string, { title: string; desc: string }> = {
    '1': { title: 'Level 1 — Minimal Delay', desc: 'Short traffic disruption (< 15 min delay)' },
    '2': { title: 'Level 2 — Moderate Delay', desc: 'Standard incident with localized slowdown' },
    '3': { title: 'Level 3 — High Delay', desc: 'Multi-lane blockage or significant corridor delay' },
    '4': { title: 'Level 4 — Severe Disruption', desc: 'Prolonged road closure or major arterial impact' }
  };

  const classDistData = Object.entries(metrics.target_info.class_distribution).map(([cls, count]) => {
    const total = metrics.dataset_split.total_samples;
    const pct = ((count / total) * 100).toFixed(2);
    return {
      name: `Level ${cls}`,
      count,
      percentage: Number(pct)
    };
  });

  const level2Pct = classDistData.find((c) => c.name === 'Level 2')?.percentage ?? 79.65;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-2 border-b border-[#E5E7E1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#252923]">
            ML Model Analysis
          </h1>
          <p className="text-xs text-[#777D78] mt-0.5">
            Selected classifier: <strong className="text-[#252923]">{selectedModel.name}</strong> · 28 pre-incident features · Stratified 80/20 split ({metrics.dataset_split.total_samples.toLocaleString()} sampled records)
          </p>
        </div>
        <div className="text-[11px] text-[#777D78] bg-white border border-[#E5E7E1] px-2.5 py-1 rounded self-start sm:self-auto">
          Train: <strong className="text-[#252923]">{metrics.dataset_split.train_samples.toLocaleString()}</strong> · Test: <strong className="text-[#252923]">{metrics.dataset_split.test_samples.toLocaleString()}</strong>
        </div>
      </div>

      {/* Selected Model Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Overall Accuracy"
          value={`${selectedModel.accuracy}%`}
          description={`Majority baseline: ${metrics.majority_baseline?.accuracy ?? 79.67}%`}
        />
        <StatCard
          label="Macro F1-Score"
          value={`${selectedModel.macro_f1}%`}
          description={`Majority baseline: ${metrics.majority_baseline?.macro_f1 ?? 22.17}%`}
        />
        <StatCard
          label="Balanced Accuracy"
          value={`${selectedModel.balanced_accuracy}%`}
          description={`Majority baseline: ${metrics.majority_baseline?.balanced_accuracy ?? 25.0}%`}
        />
        <StatCard
          label="Weighted F1-Score"
          value={`${selectedModel.weighted_f1}%`}
          description="Class-frequency weighted average"
        />
      </div>

      {/* Majority-Class Baseline & Class Imbalance Explanation */}
      <div className="bg-[#F0F2ED] border border-[#E5E7E1] rounded-lg p-4 text-xs text-[#252923] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-1.5 font-semibold text-[#28634D]">
            <Scale className="w-4 h-4 shrink-0" />
            <span>Why Accuracy Alone Is Insufficient (Majority-Class Baseline)</span>
          </div>
          <p className="text-[#777D78] leading-relaxed">
            Because <strong>Level 2 accounts for {level2Pct}%</strong> of all traffic incidents, a dummy classifier predicting Level 2 for every input achieves <strong>{metrics.majority_baseline?.accuracy ?? 79.67}% accuracy</strong> with <strong>0.0% recall</strong> on Levels 1, 3, and 4 (<strong>{metrics.majority_baseline?.balanced_accuracy ?? 25.0}% balanced accuracy</strong>, <strong>{metrics.majority_baseline?.macro_f1 ?? 22.17}% macro F1</strong>). Smoothed inverse-frequency weighting improves minority-class detection while maintaining {selectedModel.accuracy}% accuracy.
          </p>
        </div>
        <div className="bg-white border border-[#E5E7E1] rounded px-3.5 py-2.5 shrink-0 space-y-1 min-w-[210px]">
          <div className="text-[11px] font-semibold text-[#252923]">Majority Baseline (Always Level 2)</div>
          <div className="flex justify-between text-[11px] text-[#777D78]">
            <span>Accuracy:</span>
            <span className="font-semibold text-[#252923]">{metrics.majority_baseline?.accuracy ?? 79.67}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-[#777D78]">
            <span>Balanced Acc:</span>
            <span className="font-semibold text-[#C24E42]">{metrics.majority_baseline?.balanced_accuracy ?? 25.0}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-[#777D78]">
            <span>Macro F1:</span>
            <span className="font-semibold text-[#C24E42]">{metrics.majority_baseline?.macro_f1 ?? 22.17}%</span>
          </div>
        </div>
      </div>

      {/* Per-Class Performance Table */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#252923]">
            Per-Class Performance: {selectedModel.name}
          </h2>
          <p className="text-xs text-[#777D78] mt-0.5">
            Precision, recall, and F1-score evaluated on the {metrics.dataset_split.test_samples.toLocaleString()}-record un-resampled test split
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#252923]">
            <thead className="bg-[#F7F7F4] border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
              <tr>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">Traffic Impact Definition</th>
                <th className="py-2.5 px-3 text-right">Test Support</th>
                <th className="py-2.5 px-3 text-right">Share</th>
                <th className="py-2.5 px-3 text-right">Precision</th>
                <th className="py-2.5 px-3 text-right">Recall</th>
                <th className="py-2.5 px-3 text-right">F1-Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7E1]">
              {Object.entries(selectedModel.per_class).map(([cls, pc]) => {
                const supportPct = ((pc.support / metrics.dataset_split.test_samples) * 100).toFixed(2);
                const isMinority = cls === '1' || cls === '4';
                return (
                  <tr key={cls} className={isMinority ? 'bg-[#FAFAF8]' : 'hover:bg-[#F7F7F4]'}>
                    <td className="py-2.5 px-3 font-semibold text-[#28634D]">Level {cls}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-[#252923]">{severityDefinitions[cls]?.title || `Severity ${cls}`}</div>
                      <div className="text-[11px] text-[#777D78]">{severityDefinitions[cls]?.desc}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">{pc.support.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-[#777D78]">{supportPct}%</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">{pc.precision.toFixed(2)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">{pc.recall.toFixed(2)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] font-bold text-[#28634D]">{pc.f1_score.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confusion Matrix & Class Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Confusion Matrix (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#252923]">
              Confusion Matrix (Test Set, N = {metrics.dataset_split.test_samples.toLocaleString()})
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Rows show actual recorded traffic severity; columns show predicted traffic severity
            </p>
          </div>

          <div className="overflow-x-auto my-2">
            <div className="inline-block min-w-full text-center">
              <div className="text-[11px] text-[#777D78] mb-1.5 font-medium">
                Predicted Traffic Severity
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs">
                <div className="text-[#777D78] p-2 text-right text-[11px] font-medium">Actual</div>
                {[1, 2, 3, 4].map((c) => (
                  <div key={`header-${c}`} className="bg-[#F0F2ED] text-[#252923] font-semibold p-2 rounded">
                    Level {c}
                  </div>
                ))}

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
                          className={`p-2 rounded border text-xs flex flex-col items-center justify-center ${
                            isDiagonal
                              ? 'bg-[#EBF2EE] border-[#28634D]/40 font-bold text-[#28634D]'
                              : ratio > 0.3
                              ? 'bg-[#F7F7F4] border-[#E5E7E1] text-[#252923]'
                              : 'bg-white border-[#E5E7E1] text-[#777D78]'
                          }`}
                        >
                          <span>{val.toLocaleString()}</span>
                          <span className="text-[10px] text-[#777D78]">
                            {((val / metrics.dataset_split.test_samples) * 100).toFixed(2)}%
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#777D78] pt-2 border-t border-[#E5E7E1] flex justify-between">
            <span>Diagonal cells represent correct classifications</span>
            <span>Inference latency: {selectedModel.inference_time_sec}s / batch</span>
          </div>
        </div>

        {/* Class Distribution (1 col) */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#252923]">
              Class Distribution (500k Sample)
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Stratified from the 7,728,394-record dataset
            </p>
          </div>

          <div className="space-y-3 my-4">
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

          <div className="text-[11px] text-[#777D78] pt-2 border-t border-[#E5E7E1] leading-relaxed">
            Test split retains the exact un-resampled class proportions.
          </div>
        </div>
      </div>

      {/* Binary High-Impact Formulation & Top Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metrics.binary_high_impact && (
          <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-[#E5E7E1] pb-2">
              <div>
                <h2 className="text-sm font-semibold text-[#252923]">
                  Binary High-Impact (Level 3–4 vs. 1–2)
                </h2>
                <p className="text-xs text-[#777D78] mt-0.5">
                  Secondary operational classifier for severe corridor disruption risk
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EBF2EE] text-[#28634D] border border-[#28634D]/20 shrink-0">
                ROC-AUC: {metrics.binary_high_impact.roc_auc}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1]">
                <div className="text-[11px] text-[#777D78]">Accuracy</div>
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
              <div className="p-3 rounded bg-[#F7F7F4] border border-[#E5E7E1] col-span-2">
                <div className="text-[11px] text-[#777D78]">High-Impact Precision / Recall</div>
                <div className="text-base font-bold text-[#252923] mt-0.5">
                  {metrics.binary_high_impact.high_impact_precision}% / {metrics.binary_high_impact.high_impact_recall}%
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#777D78] pt-2 border-t border-[#E5E7E1]">
              Grouping Levels 1–2 vs. 3–4 reduces ambiguity between adjacent delay tiers using pre-incident inputs only.
            </div>
          </div>
        )}

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[#252923]">
              Top Pre-Incident Predictive Features
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Relative split importance across spatial, weather, and temporal inputs
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.feature_importances.slice(0, 7).reverse()}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 45, bottom: 5 }}
              >
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#777D78" fontSize={11} domain={[0, 'dataMax + 2']} />
                <YAxis dataKey="feature" type="category" stroke="#252923" fontSize={11} width={110} />
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
        </div>
      </div>

      {/* Concise Methodology & Scope Note */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 text-xs text-[#777D78] flex items-start gap-2.5 shadow-subtle">
        <ShieldCheck className="w-4 h-4 text-[#28634D] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#252923]">Target & Zero-Leakage Protocol:</strong> The model predicts <strong>traffic-impact severity</strong> (delay duration and road blockage from 1 to 4, not physical injury severity) using only pre-incident environmental, temporal, spatial, and roadway features. Post-incident fields (<code className="text-[#252923]">End_Time</code>, <code className="text-[#252923]">Distance(mi)</code>) are excluded.
        </p>
      </div>
    </div>
  );
};
