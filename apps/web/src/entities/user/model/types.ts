export interface AuthUser {
  id: number;
  username: string;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: "bearer";
}
