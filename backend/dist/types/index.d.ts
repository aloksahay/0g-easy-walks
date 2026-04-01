export interface Creator {
    id: string;
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
    tags: string[];
    photo_hashes: string[];
    text_hash: string;
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
    item_ids: string[];
    contributions: Record<string, number>;
    price_og: string;
    route_hash: string | null;
    contract_route_id: number | null;
    created_at: number;
}
export interface Purchase {
    id: string;
    route_id: string;
    buyer_id: string;
    tx_hash: string;
    price_og: string;
    purchased_at: number;
}
export interface GenerateRouteRequest {
    city: string;
    duration: "1h" | "2h" | "3h" | "half-day";
    categories: Array<"place" | "activity" | "eatery">;
    interests: string[];
    startLocation?: {
        lat: number;
        lng: number;
    };
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
export interface JWTPayload {
    walletAddress: string;
    iat?: number;
    exp?: number;
}
//# sourceMappingURL=index.d.ts.map