export interface Comment {
  id: string;
  article_id: string;
  expert_email: string;
  expert_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface EmailToken {
  token: string;
  expert_email: string;
  article_id: string;
  expires_at: string;
  used: boolean;
}

export interface Expert {
  email: string;
  name: string;
  title?: string;
  organization?: string;
  h_index?: number;
  citations?: number;
  verified: boolean;
}
