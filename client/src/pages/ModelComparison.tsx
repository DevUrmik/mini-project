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

  const severityDefinitions: Record<string, string> = {
    '1': 'Level 1 — Minor Accident',
    '2': 'Level 2 — Moderate Accident',
    '3': 'Level 3 — Serious Accident',
    '4': 'Level 4 — Critical Accident'
  };

  const classDistData = Object.entries(metrics.target_info.class_distribution).map(([cls, count]) => {
    const total = metrics.dataset_split.total_samples;
    const pct = ((count / total) * 100).toFixed(2);
    return {
      name: severityDefinitions[cls] || `Level ${cls}`,
      count,
      percentage: Number(pct)
    };
  });

  const level2Pct = classDistData.find((c) => c.name.startsWith('Level 2'))?.percentage ?? 79.67;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-[#252923]">
          ML Model Analysis
        </h1>
        <p className="text-xs text-[#777D78]">
          {selectedModel.name} · 28 pre-incident features · {metrics.dataset_split.train_samples.toLocaleString()} train / {metrics.dataset_split.test_samples.toLocaleString()} test
        </p>
      </div>

      {/* Compact Model Metrics & Baseline */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Overall accuracy"
          value={`${selectedModel.accuracy}%`}
        />
        <StatCard
          label="Macro F1"
          value={`${selectedModel.macro_f1}%`}
        />
        <StatCard
          label="Balanced accuracy"
          value={`${selectedModel.balanced_accuracy}%`}
        />
        <StatCard
          label="Weighted F1"
          value={`${selectedModel.weighted_f1}%`}
        />
        <StatCard
          label="Majority baseline"
          value={`${metrics.majority_baseline?.accuracy ?? 79.67}%`}
          description={`Bal acc ${metrics.majority_baseline?.balanced_accuracy ?? 25.0}% · Macro F1 ${metrics.majority_baseline?.macro_f1 ?? 22.17}%`}
        />
      </div>

      {/* Per-Class Performance Table */}
      <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4">
          <h2 className="text-sm font-semibold text-[#252923]">
            Per-class performance
          </h2>
          <span className="text-xs text-[#777D78]">
            Level 2 accounts for {level2Pct}% of records; Macro F1 weights all four classes equally
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#252923]">
            <thead className="border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
              <tr>
                <th className="py-2.5 px-3">Severity Level</th>
                <th className="py-2.5 px-3 text-right">Support</th>
                <th className="py-2.5 px-3 text-right">Share</th>
                <th className="py-2.5 px-3 text-right">Precision</th>
                <th className="py-2.5 px-3 text-right">Recall</th>
                <th className="py-2.5 px-3 text-right">F1-Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2ED]">
              {Object.entries(selectedModel.per_class).map(([cls, pc]) => {
                const supportPct = ((pc.support / metrics.dataset_split.test_samples) * 100).toFixed(2);
                return (
                  <tr key={cls} className="hover:bg-[#F7F7F4]">
                    <td className="py-2.5 px-3 font-medium text-[#252923]">
                      {severityDefinitions[cls] || `Level ${cls}`}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{pc.support.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-[#777D78] tabular-nums">{supportPct}%</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{pc.precision.toFixed(2)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{pc.recall.toFixed(2)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#28634D] tabular-nums">
                      {pc.f1_score.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confusion Matrix (2 cols) & Class Distribution (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Confusion matrix
            </h2>
            <span className="text-xs text-[#777D78]">
              Test set: {metrics.dataset_split.test_samples.toLocaleString()} · Rows: actual, Columns: predicted
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[460px] text-center">
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="p-2 text-right text-[11px] font-medium text-[#777D78] self-end">
                  Actual \ Pred
                </div>
                {[1, 2, 3, 4].map((c) => (
                  <div key={`header-${c}`} className="bg-[#F7F7F4] text-[#252923] font-semibold py-2 px-2 rounded">
                    Level {c}
                  </div>
                ))}

                {activeCM.map((row, rIdx) => (
                  <React.Fragment key={`row-${rIdx}`}>
                    <div className="bg-[#F7F7F4] text-[#252923] font-semibold py-2 px-2 rounded flex items-center justify-end text-xs">
                      Level {rIdx + 1}
                    </div>
                    {row.map((val, cIdx) => {
                      const isDiagonal = rIdx === cIdx;
                      const ratio = maxCellValue > 0 ? val / maxCellValue : 0;
                      return (
                        <div
                          key={`cell-${rIdx}-${cIdx}`}
                          className={`py-3 px-2 rounded border text-xs flex flex-col items-center justify-center tabular-nums ${
                            isDiagonal
                              ? 'bg-[#EBF2EE] border-[#28634D]/35 font-semibold text-[#28634D]'
                              : ratio > 0.3
                              ? 'bg-[#F7F7F4] border-[#E5E7E1] text-[#252923]'
                              : 'bg-white border-[#F0F2ED] text-[#777D78]'
                          }`}
                        >
                          <span className="text-sm">{val.toLocaleString()}</span>
                          <span className="text-[11px] opacity-75">
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
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#252923]">
                Class distribution
              </h2>
              <span className="text-xs text-[#777D78]">500k sample</span>
            </div>

            <div className="space-y-4">
              {classDistData.map((cd) => (
                <div key={cd.name} className="space-y-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-medium text-[#252923]">{cd.name}</span>
                    <span className="text-[#777D78] tabular-nums">
                      {cd.count.toLocaleString()} ({cd.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F0F2ED] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#28634D] rounded-full"
                      style={{ width: `${Math.max(cd.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-[#777D78] mt-5">
            Pre-incident features only; End_Time and Distance(mi) excluded.
          </p>
        </div>
      </div>

      {/* Binary Serious/Critical (3-4 vs 1-2) & Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metrics.binary_high_impact && (
          <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#252923]">
                Binary classification (Level 3–4 vs. 1–2)
              </h2>
              <span className="text-xs font-semibold text-[#28634D]">
                ROC-AUC {metrics.binary_high_impact.roc_auc}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-[#F7F7F4]">
                <div className="text-[#777D78]">Accuracy</div>
                <div className="text-base font-semibold text-[#252923] mt-0.5 tabular-nums">{metrics.binary_high_impact.accuracy}%</div>
              </div>
              <div className="p-3 rounded bg-[#F7F7F4]">
                <div className="text-[#777D78]">Balanced accuracy</div>
                <div className="text-base font-semibold text-[#28634D] mt-0.5 tabular-nums">{metrics.binary_high_impact.balanced_accuracy}%</div>
              </div>
              <div className="p-3 rounded bg-[#F7F7F4]">
                <div className="text-[#777D78]">Macro F1</div>
                <div className="text-base font-semibold text-[#28634D] mt-0.5 tabular-nums">{metrics.binary_high_impact.macro_f1}%</div>
              </div>
              <div className="p-3 rounded bg-[#F7F7F4]">
                <div className="text-[#777D78]">Serious/Critical F1</div>
                <div className="text-base font-semibold text-[#252923] mt-0.5 tabular-nums">{metrics.binary_high_impact.high_impact_f1}%</div>
              </div>
              <div className="p-3 rounded bg-[#F7F7F4] col-span-2">
                <div className="text-[#777D78]">Serious/Critical precision / recall</div>
                <div className="text-base font-semibold text-[#252923] mt-0.5 tabular-nums">
                  {metrics.binary_high_impact.high_impact_precision}% / {metrics.binary_high_impact.high_impact_recall}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-[#E5E7E1] rounded-md p-5 shadow-subtle">
          <h2 className="text-sm font-semibold text-[#252923] mb-4">
            Feature importance
          </h2>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.feature_importances.slice(0, 7).reverse()}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 45, bottom: 4 }}
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
                  formatter={(val: any) => [`${val}%`, 'Importance']}
                />
                <Bar dataKey="importance" fill="#28634D" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
