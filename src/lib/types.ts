export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Alias {
  id: string;
  alias_email: string;
  site_name?: string;
  group_name?: string;
  created_at: string;
  generated_password: string;
}

export interface BreachReport {
  status: 'SAFE' | 'COMPROMISED' | 'ERROR';
  action?: 'REPLACE_PASSWORD' | 'MONITOR';
  breach_count?: number;
  breaches?: string[];
  details?: any[];
  message?: string;
}

export interface Leak {
  id: string;
  alias_id?: string;
  breach_source: string;
  detected_at: string;
}

export interface IncidentCorrelation {
  id: string;
  leak_id: string;
  session_id: string;
  alias_id?: string;
  correlation_confidence: number;
  correlation_factors: string[];
  correlated_at: string;
  is_resolved: boolean;
  resolution_notes?: string;
}

export interface SessionTab {
  id: string;
  session_id: string;
  url: string;
}

export interface Session {
  id: string;
  user_id: string;
  start_time: string;
  tabs: SessionTab[];
}

export interface AIClassification {
  classification: 'GOOD' | 'BAD';
  recommendation: 'ALLOW' | 'BLOCK';
}

export interface PasswordBreachResponse {
  status: 'SAFE' | 'PWNED' | 'ERROR';
  message: string;
  count?: number;
}