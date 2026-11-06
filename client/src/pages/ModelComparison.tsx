import React, { useEffect, useState } from 'react';
import {
  Cpu,
  BarChart2,
  Award,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Sliders,
  Layers
} from 'lucide-react';
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
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve machine learning metrics.');
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
        <ChartSkeleton height="h-80" />
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

  // Benchmark chart data
  const comparisonChartData = modelsList.map((m) => ({
    name: m.name.replace(' Classifier', ''),
    accuracy: m.accuracy,
    balanced_accuracy: m.balanced_accuracy,
    macro_f1: m.macro_f1,
    weighted_f1: m.weighted_f1
  }));

  const activeModel = metrics.models[selectedModelKey];
  const activeCM = activeModel.confusion_matrix;
  const maxCellValue = Math.max(...activeCM.flat());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            Machine Learning Model Benchmark & Evaluation
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Empirical comparative analysis of Logistic Regression, Decision Tree, and Random Forest on stratified test partitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            Selected Primary: {metrics.models[metrics.selected_best_model as keyof typeof metrics.models]?.name}
          </span>
        </div>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {modelsList.map((model) => {
          const isSelected = selectedModelKey === model.model_key;
          const isBest = model.model_key === metrics.selected_best_model;

          return (
            <div
              key={model.model_key}
              onClick={() => setSelectedModelKey(model.model_key as any)}
              className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 relative ${
                isSelected
                  ? 'bg-slate-900 border-sky-500 ring-1 ring-sky-500/40 shadow-lg'
                  : 'bg-[#111827] border-slate-800 hover:border-slate-700'
              }`}
            >
              {isBest && (
                <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 flex items-center gap-1 shadow-md">
                  <CheckCircle className="w-3 h-3" /> BEST PERFORMING
                </span>
              )}

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">{model.name}</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {model.model_key}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Accuracy</span>
                  <span className="text-lg font-bold font-mono text-white">{model.accuracy}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Macro F1</span>
                  <span className="text-lg font-bold font-mono text-amber-400">{model.macro_f1}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Balanced Acc</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{model.balanced_accuracy}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Weighted F1</span>
                  <span className="text-lg font-bold font-mono text-sky-400">{model.weighted_f1}%</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                <span>Test Split: {metrics.dataset_split.test_samples.toLocaleString()} samples</span>
                <span className={`font-semibold ${isSelected ? 'text-sky-400' : 'text-slate-500'}`}>
                  {isSelected ? 'Viewing Matrices ↓' : 'Click to View Matrix'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Benchmark Metric Bar Chart */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-sky-400" />
              Comparative Performance Across Evaluation Metrics
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Macro F1 is the definitive benchmark because of class imbalance (Severity 2 makes up ~72% of records)
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Stratified 80/20 Split
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={11} domain={[0, 80]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: any) => [`${val}%`, 'Score']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="accuracy" name="Accuracy" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="balanced_accuracy" name="Balanced Accuracy" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="macro_f1" name="Macro F1" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="weighted_f1" name="Weighted F1" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Confusion Matrix & Feature Importances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Confusion Matrix */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Confusion Matrix: {activeModel.name}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                4 × 4 Severity Scale
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Rows represent Actual Severity; Columns represent Model Predicted Severity
            </p>
          </div>

          {/* Matrix Heatmap Grid */}
          <div className="overflow-x-auto py-2">
            <div className="inline-block min-w-full text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                Predicted Severity Class
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
                {/* Header Row */}
                <div className="text-slate-500 font-bold p-2 text-right pr-3">Actual</div>
                {[1, 2, 3, 4].map((col) => (
                  <div key={`col-${col}`} className="bg-slate-800/80 text-sky-400 font-bold p-2 rounded-lg">
                    Pred {col}
                  </div>
                ))}

                {/* Data Rows */}
                {activeCM.map((row, rIdx) => (
                  <React.Fragment key={`row-${rIdx}`}>
                    <div className="bg-slate-800/80 text-sky-400 font-bold p-2 rounded-lg flex items-center justify-center">
                      Act {rIdx + 1}
                    </div>
                    {row.map((val, cIdx) => {
                      const isDiagonal = rIdx === cIdx;
                      const intensity = maxCellValue > 0 ? val / maxCellValue : 0;
                      return (
                        <div
                          key={`cell-${rIdx}-${cIdx}`}
                          className={`p-3 rounded-lg flex flex-col items-center justify-center transition border ${
                            isDiagonal
                              ? 'bg-sky-500/25 border-sky-500/50 text-white font-bold'
                              : intensity > 0.3
                              ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                              : 'bg-slate-900 border-slate-800/60 text-slate-400'
                          }`}
                        >
                          <span className="text-sm font-bold">{val.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400">
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

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Highlighted diagonal cells indicate accurate classifications</span>
            <span className="font-mono text-sky-400">Accuracy: {activeModel.accuracy}%</span>
          </div>
        </div>

        {/* Feature Importances (Random Forest) */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Random Forest Feature Importances
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Top predictors for accident traffic delay duration (Gini importance)
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              100 Estimators
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.feature_importances.slice(0, 10).reverse()}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 45, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'dataMax + 2']} />
                <YAxis dataKey="feature" type="category" stroke="#94a3b8" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => [`${val}%`, 'Importance']}
                />
                <Bar dataKey="importance" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Academic Methodology & Viva Explanations */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 space-y-3">
        <h4 className="font-bold text-sm text-sky-400 flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Key ML Evaluation Methodologies for Academic Evaluation (Viva Q&A)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed">
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">1. Why Macro F1 Over Simple Accuracy?</p>
            <p className="text-slate-400">
              In the Moosavi US Accidents dataset, Severity 2 comprises over 70% of all incidents. A naive dummy classifier predicting Severity 2 for every record would achieve ~70% accuracy while failing completely on critical severe events (Classes 3 & 4). Macro F1 computes the unweighted mean of F1 across all 4 classes, penalizing poor performance on minority severe classes.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">2. Zero Data Leakage Policy</p>
            <p className="text-slate-400">
              Post-incident fields such as `Duration_Minutes`, `End_Time`, and `Distance(mi)` were strictly eliminated from the feature matrix. These variables directly encode the outcome (longer clearance times mean higher severity). Using only pre-incident factors (weather, hour, road geometry) guarantees a genuine predictive task.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

