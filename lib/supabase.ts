export type Category = "grocery" | "alcohol";
export type Status = "open" | "resolved";
export type StatusKind = "out" | "low" | "emergency";
export type Destination = "owner" | "manager";

export const DESTINATION_LABEL: Record<Destination, string> = {
  owner: "Bob's list",
  manager: "Manager's list",
};

export type OosReport = {
  id: string;
  item: string;
  category: Category | null;
  days_left: number | null;
  is_emergency: boolean;
  note: string | null;
  submitted_by: string;
  status: Status;
  created_at: string;
  resolved_at: string | null;
  catalog_item_id: string | null;
  destination: Destination;
  status_kind: StatusKind | null;
  qty_left: number | null;
};

export type CatalogItem = {
  id: string;
  name: string;
  category: Category;
  active: boolean;
  created_at: string;
  created_by: string | null;
  destination: Destination;
  supplier: string | null;
};

export type AllowedEmail = {
  email: string;
  role: "admin" | "staff";
  created_at: string;
  created_by: string | null;
};

export type InviteLink = {
  id: string;
  role: "admin" | "staff";
  active: boolean;
  label: string | null;
  created_at: string;
  created_by: string | null;
};
