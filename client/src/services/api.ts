import axios from 'axios';
import {
  DashboardSummary,
  AccidentRecord,
  KMeansResponse,
  DBSCANResponse,
  ModelMetricsResponse,
  PredictionRequest,
  PredictionResponse,
  TimeAnalyticsResponse,
  WeatherAnalyticsResponse,
  InfrastructureAnalyticsResponse
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getHealth = async () => {
  const { data } = await api.get('/health');
  return data;
};

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary');
  return data;
};

export const getAccidents = async (params?: {
  limit?: number;
  state?: string;
  city?: string;
  severity?: number;
}): Promise<AccidentRecord[]> => {
  const { data } = await api.get<AccidentRecord[]>('/accidents', { params });
  return data;
};

export const getKMeansHotspots = async (k: number = 10): Promise<KMeansResponse> => {
  const { data } = await api.get<KMeansResponse>('/hotspots', { params: { k } });
  return data;
};

export const getDBSCANHotspots = async (): Promise<DBSCANResponse> => {
  const { data } = await api.get<DBSCANResponse>('/hotspots/dbscan');
  return data;
};

export const getClusteringComparison = async () => {
  const { data } = await api.get('/hotspots/comparison');
  return data;
};

export const getModelMetrics = async (): Promise<ModelMetricsResponse> => {
  const { data } = await api.get<ModelMetricsResponse>('/models/metrics');
  return data;
};

export const predictSeverity = async (
  payload: PredictionRequest
): Promise<PredictionResponse> => {
  const { data } = await api.post<PredictionResponse>('/predict/severity', payload);
  return data;
};

export const getTimeAnalytics = async (): Promise<TimeAnalyticsResponse> => {
  const { data } = await api.get<TimeAnalyticsResponse>('/analytics/time');
  return data;
};

export const getWeatherAnalytics = async (): Promise<WeatherAnalyticsResponse> => {
  const { data } = await api.get<WeatherAnalyticsResponse>('/analytics/weather');
  return data;
};

export const getInfrastructureAnalytics = async (): Promise<InfrastructureAnalyticsResponse> => {
  const { data } = await api.get<InfrastructureAnalyticsResponse>('/analytics/infrastructure');
  return data;
};

export default api;

