export interface DashboardSummary {
  total_accidents: number;
  total_states?: number;
  total_cities?: number;
  average_severity: number;
  high_impact_percentage: number;
  data_source: string;
  is_synthetic: boolean;
  severity_distribution: Record<string, number>;
  top_states: Record<string, number>;
  top_cities: Record<string, number>;
  top_weather_conditions: Record<string, number>;
  road_features_prevalence: {
    junction_pct: number;
    crossing_pct: number;
    traffic_signal_pct: number;
    stop_pct: number;
  };
  temporal_range: {
    earliest: string;
    latest: string;
  };
}

export interface AccidentRecord {
  id: string;
  severity: number;
  start_time: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  weather_condition: string;
  temperature_f: number;
  junction: boolean;
  traffic_signal: boolean;
}

export interface PaginatedAccidentsResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: AccidentRecord[];
}

export interface StateSummary {
  state: string;
  name: string;
  count: number;
}

export interface CitySummary {
  city: string;
  state: string;
  count: number;
}

export interface GeoBoundsResponse {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  bounds: [[number, number], [number, number]];
  total_records: number;
}

export interface HotspotCluster {
  cluster_id: number;
  center_lat: number;
  center_lng: number;
  accident_count: number;
  accident_percentage: number;
  average_severity: number;
  spread_radius_km: number;
  dominant_city: string;
  state?: string;
}

export interface KMeansResponse {
  algorithm: string;
  k: number;
  inertia: number;
  total_clusters: number;
  clusters: HotspotCluster[];
}

export interface DBSCANResponse {
  algorithm: string;
  distance_metric: string;
  parameters: {
    eps_km: number;
    eps_radians: number;
    min_samples: number;
  };
  total_analyzed_points: number;
  identified_clusters_count: number;
  clustered_points_count: number;
  noise_points_count: number;
  noise_percentage: number;
  clusters: HotspotCluster[];
}

export interface ModelMetricDetails {
  model_key: string;
  name: string;
  accuracy: number;
  balanced_accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
  training_time_sec?: number;
  inference_time_sec?: number;
  confusion_matrix: number[][];
  classes: number[];
  class_labels: string[];
  per_class: Record<string, {
    precision: number;
    recall: number;
    f1_score: number;
    support: number;
  }>;
}

export interface FeatureImportance {
  feature: string;
  raw_feature: string;
  importance: number;
}

export interface MajorityBaseline {
  name: string;
  description: string;
  majority_class: number;
  accuracy: number;
  balanced_accuracy: number;
  macro_f1: number;
  explanation: string;
}

export interface ModelMetricsResponse {
  dataset_split: {
    total_samples: number;
    train_samples: number;
    test_samples: number;
    test_ratio: number;
    stratified: boolean;
  };
  target_info: {
    target_variable: string;
    scale_meaning: string;
    class_distribution: Record<string, number>;
    class_proportions?: Record<string, number>;
  };
  majority_baseline?: MajorityBaseline;
  selected_best_model: string;
  models: Record<string, ModelMetricDetails>;
  feature_importances: FeatureImportance[];
  evaluation_notes: string[];
}

export interface PredictionRequest {
  temperature: number;
  humidity: number;
  visibility: number;
  wind_speed: number;
  weather_condition: string;
  hour: number;
  day_of_week: string;
  junction: boolean;
  crossing: boolean;
  traffic_signal: boolean;
  stop: boolean;
}

export interface ClassProbability {
  severity_class: number;
  label: string;
  probability: number;
  percentage: number;
}

export interface PredictionResponse {
  predicted_severity: number;
  severity_category: string;
  traffic_impact_description: string;
  model_used: string;
  class_probabilities: ClassProbability[];
  input_summary: {
    weather: string;
    temperature: string;
    time: string;
    is_rush_hour: boolean;
    road_features: string[];
  };
  disclaimer: string;
}

export interface TimeAnalyticsResponse {
  hourly: Array<{
    hour: number;
    count: number;
    percentage: number;
    is_rush_hour: boolean;
  }>;
  daily: Array<{
    day: string;
    count: number;
    percentage: number;
    is_weekend: boolean;
  }>;
  rush_hour_breakdown: {
    rush_hour_accidents: number;
    non_rush_hour_accidents: number;
    rush_hour_percentage: number;
    rush_hours: string;
    observation: string;
  };
}

export interface WeatherAnalyticsResponse {
  weather_conditions: Array<{
    condition: string;
    accident_count: number;
    average_severity: number;
    percentage: number;
  }>;
  temperature_distribution: Array<{
    temp_range: string;
    accident_count: number;
    average_severity: number;
  }>;
  insights: string[];
}

export interface InfrastructureAnalyticsResponse {
  features: Array<{
    feature: string;
    present_count: number;
    absent_count: number;
    present_avg_severity: number;
    absent_avg_severity: number;
    present_percentage: number;
  }>;
  insights: string[];
}

