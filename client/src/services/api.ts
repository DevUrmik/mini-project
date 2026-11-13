import axios from 'axios';
import {
  DashboardSummary,
  AccidentRecord,
  PaginatedAccidentsResponse,
  StateSummary,
  CitySummary,
  GeoBoundsResponse,
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

export const getAvailableStates = async (): Promise<StateSummary[]> => {
  const { data } = await api.get<StateSummary[]>('/geo/states');
  return data;
};

export const getAvailableCities = async (state?: string): Promise<CitySummary[]> => {
  const { data } = await api.get<CitySummary[]>('/geo/cities', {
    params: { state: state && state !== 'ALL' ? state : undefined }
  });
  return data;
};

export const getDatasetBounds = async (state?: string, city?: string): Promise<GeoBoundsResponse> => {
  const { data } = await api.get<GeoBoundsResponse>('/geo/bounds', {
    params: {
      state: state && state !== 'ALL' ? state : undefined,
      city: city && city !== 'All' ? city : undefined
    }
  });
  return data;
};

export const getAccidents = async (params?: {
  page?: number;
  page_size?: number;
  limit?: number;
  state?: string;
  city?: string;
  severity?: number;
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
  start_date?: string;
  end_date?: string;
}): Promise<PaginatedAccidentsResponse> => {
  const { data } = await api.get<PaginatedAccidentsResponse>('/accidents', { params });
  return data;
};

export const getKMeansHotspots = async (k: number = 10, state?: string): Promise<KMeansResponse> => {
  const { data } = await api.get<KMeansResponse>('/hotspots', {
    params: { k, state: state && state !== 'ALL' ? state : undefined }
  });
  return data;
};

export const getDBSCANHotspots = async (state?: string): Promise<DBSCANResponse> => {
  const { data } = await api.get<DBSCANResponse>('/hotspots/dbscan', {
    params: { state: state && state !== 'ALL' ? state : undefined }
  });
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

