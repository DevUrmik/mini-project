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
import { Info, AlertCircle } from 'lucide-react';

import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { getModelMetrics } from '../services/api';
import { ModelMetricsResponse, ModelMetricDetails } from '../types';

export const ModelComparison: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<'random_forest' | 'decision_tree' | 'logistic_regression'>('random_forest');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getModelMetrics();
      setMetrics(data);
      if (data.selected_best_model) {
        setSelectedModelKey(data.selected_best_model as any);
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
        <CardSkeleton count={3} />
        <ChartSkeleton height="h-72" />
      </div>
    );
  }

  if (error || !metrics) {
    return <ErrorBanner message={error || undefined} onRetry={fetchMetrics} />;
  }

  const modelsList: ModelMetricDetails[] = [
    metrics.models.logistic_regression,
    metrics.models.decision_tree,
    metrics.models.random_forest
  ];

  const chartData = modelsList.map((m) => ({
    name: m.name.replace(' Classifier', ''),
    accuracy: m.accuracy,
    macro_f1: m.macro_f1,
    balanced_accuracy: m.balanced_accuracy,
  }));

  const activeModel = metrics.models[selectedModelKey] || metrics.models.random_forest;
  const activeCM = activeModel.confusion_matrix;
  const maxCellValue = Math.max(...activeCM.flat());

  const severityDefinitions: Record<string, string> = {
    '1': 'Minimal traffic impact',
    '2': 'Moderate traffic impact',
    '3': 'High traffic impact',
    '4': 'Significant traffic disruption'
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1]">
        <h1 className="text-xl font-bold tracking-tight text-[#252923]">
          ML Model Analysis
        </h1>
        <p className="text-xs text-[#777D78] mt-1">
          Supervised classification benchmarks on a stratified 20% test partition (7,000 incidents) comparing Logistic Regression, Decision Tree, and Random Forest.
        </p>
      </div>

      {/* Class Imbalance & Minority Performance Investigation Card */}
      <div className="bg-[#F0F2ED] border border-[#E5E7E1] rounded-lg p-4 space-y-2 text-xs text-[#252923]">
        <div className="flex items-center gap-2 font-semibold text-xs text-[#28634D]">
          <Info className="w-4 h-4 shrink-0" />
          <span>Investigation: Extreme Class Imbalance & Minority Performance</span>
        </div>
        <p className="text-xs text-[#777D78] leading-relaxed">
          The dataset shows severe class skew: <strong>Level 2 represents 71.8%</strong> of all incidents, whereas Level 1 is only 2.8% and Level 4 is 7.2%.
          An unweighted baseline would collapse toward predicting Level 2 exclusively, artificially yielding ~72% accuracy while failing on extreme disruptions.
          Consequently, Random Forest achieves <strong>59.91% accuracy</strong> but <strong>25.23% balanced accuracy</strong> and <strong>24.99% Macro F1</strong>.
          Even with balanced class weights, pre-incident environmental and road features lack sufficient variance to reliably separate minority severe delays from standard incidents without introducing excessive false positives.
        </p>
      </div>

      {/* Model Benchmark Summary Table */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#252923]">
            Algorithm Benchmark Comparison
          </h2>
          <p className="text-xs text-[#777D78] mt-0.5">
            Macro F1 and balanced accuracy are the primary comparative metrics rather than raw accuracy
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#252923]">
            <thead className="bg-[#F7F7F4] border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
              <tr>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3 text-right">Accuracy</th>
                <th className="py-2.5 px-3 text-right">Macro F1</th>
                <th className="py-2.5 px-3 text-right">Balanced Accuracy</th>
                <th className="py-2.5 px-3 text-right">Weighted F1</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7E1]">
              {modelsList.map((model) => {
                const isSelected = selectedModelKey === model.model_key;
                const isBest = model.model_key === metrics.selected_best_model;

                return (
                  <tr
                    key={model.model_key}
                    onClick={() => setSelectedModelKey(model.model_key as any)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EBF2EE]' : 'hover:bg-[#F7F7F4]'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#252923]">{model.name}</div>
                      <div className="text-[11px] text-[#777D78]">
                        {model.model_key === 'random_forest'
                          ? '100 ensemble trees with balanced class weighting'
                          : model.model_key === 'decision_tree'
                          ? 'Max depth 12 with min split 20'
                          : 'L2 regularization, balanced weights'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      {model.accuracy}%
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#28634D]">
                      {model.macro_f1}%
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      {model.balanced_accuracy}%
                    </td>
                    <td className="py-3 px-3 text-right text-[#777D78]">
                      {model.weighted_f1}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isBest ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EBF2EE] text-[#28634D] border border-[#28634D]/30">
                          Best evaluated model
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#777D78]">
                          Baseline
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Class Precision, Recall, and F1 Table */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#252923]">
              Per-Class Performance: {activeModel.name}
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Detailed breakdown of precision, recall, and F1 score across each discrete severity label
            </p>
          </div>
          <select
            value={selectedModelKey}
            onChange={(e) => setSelectedModelKey(e.target.value as any)}
            className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2.5 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
          >
            <option value="random_forest">Random Forest</option>
            <option value="decision_tree">Decision Tree</option>
            <option value="logistic_regression">Logistic Regression</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#252923]">
            <thead className="bg-[#F7F7F4] border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
              <tr>
                <th className="py-2.5 px-3">Class Label</th>
                <th className="py-2.5 px-3">Dataset Definition</th>
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
                return (
                  <tr key={cls} className="hover:bg-[#F7F7F4] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#28634D]">
                      Level {cls}
                    </td>
                    <td className="py-2.5 px-3 text-[#252923]">
                      {severityDefinitions[cls] || `Severity ${cls}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {pc.support.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#777D78]">
                      {supportPct}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                      {(pc.precision * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                      {(pc.recall * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] font-bold text-[#28634D]">
                      {(pc.f1_score * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-side: Metric Bar Chart & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metric Comparison Chart */}
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#252923]">
              Accuracy vs. Balanced Metrics
            </h2>
            <p className="text-xs text-[#777D78] mt-0.5">
              Evaluating raw accuracy against balanced accuracy and unweighted Macro F1
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="#E5E7E1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#777D78" fontSize={11} />
                <YAxis stroke="#777D78" fontSize={11} domain={[0, 80]} />
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
                <div className="text-[#777D78] p-2 text-right text-[11px]">Actual</div>
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
            <span>Total test samples: {metrics.dataset_split.test_samples.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Feature Importances (Random Forest) */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#252923]">
            Top predictive factors for severity (Random Forest)
          </h2>
          <p className="text-xs text-[#777D78] mt-0.5">
            Features with highest relative contribution to classification splits
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
                formatter={(val: any) => [`${val}%`, 'Contribution']}
              />
              <Bar dataKey="importance" fill="#28634D" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Editorial Methodology Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#252923]">
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#28634D]">
            Why Macro F1 is the Primary Metric
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            In this dataset, over 71% of all records fall into Severity 2. A trivial baseline predicting Severity 2 for every record would achieve ~72% accuracy while completely failing to identify severe delays (Severity 3 & 4). Macro F1 calculates the unweighted mean of F1 scores across all four classes, giving equal importance to minority severe categories.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#252923]">
            Preventing Data Leakage
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            Post-incident fields such as clearance time, incident duration, and road closure distance were intentionally excluded from model training. These attributes directly describe the consequence of the incident. Using only pre-incident variables (weather, hour, day, road infrastructure) ensures genuine predictive evaluation.
          </p>
        </div>
      </div>
    </div>
  );
};
