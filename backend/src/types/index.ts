export interface Creator {
  id: string; // wallet address
  display_name: string;
  bio: string | null;
  avatar_hash: string | null;
  created_at: number;
}

export interface ContentItem {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: "place" | "activity" | "eatery";
  latitude: number;
  longitude: number;
  city: string;
  tags: string[]; // stored as JSON in DB
  photo_hashes: string[]; // 0G Storage root hashes, stored as JSON in DB
  text_hash: string; // 0G Storage root hash for description blob
  created_at: number;
  status: "active" | "flagged" | "removed";
}

export interface Route {
  id: string;
  title: string;
  description: string;
  city: string;
  duration_mins: number | null;
  distance_km: number | null;
  item_ids: string[]; // ordered content item IDs, stored as JSON
  contributions: Record<string, number>; // {creator_id: share_pct}, stored as JSON
  price_og: string; // price in wei as string
  route_hash: string | null;
  contract_route_id: number | null;
  created_at: number;
}

export interface Purchase {
  id: string;
  route_id: string;
  buyer_id: string; // wallet address
  tx_hash: string;
  price_og: string;
  purchased_at: number;
}

// API request/response types
export interface GenerateRouteRequest {
  city: string;
  duration: "1h" | "2h" | "3h" | "half-day";
  categories: Array<"place" | "activity" | "eatery">;
  interests: string[];
  startLocation?: { lat: number; lng: number };
  maxDistance?: number;
}

export interface RouteStop {
  contentItem: ContentItem;
  order: number;
  walkTimeMins: number;
}

export interface GeneratedRoute {
  id: string;
  title: string;
  description: string;
  stops: RouteStop[];
  totalDuration: number;
  totalDistance: number;
  contributions: Record<string, number>;
  priceOg: string;
}

// JWT payload
export interface JWTPayload {
  walletAddress: string;
  iat?: number;
  exp?: number;
}
