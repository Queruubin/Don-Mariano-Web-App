export interface CustomerAddress {
  id: number;
  address: string;
  notes: string;
  last_used_at: string;
}

export interface Customer {
  id: number;
  phone: string;
  name: string;
  /** Most recently used first. */
  addresses: CustomerAddress[];
  created_at: string;
  updated_at: string;
}
