export interface User {
  id: number;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
  is_premium?: boolean;
  plan?: string;
}