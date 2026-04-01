import { ContentItem, GenerateRouteRequest, GeneratedRoute } from "../types";
interface CuratedSelection {
    selectedIds: string[];
    title: string;
    description: string;
    estimatedDurationMins: number;
}
/**
 * Use AI (0G Compute) to select and order content items into a walking route.
 * Falls back to nearest-neighbor ordering if AI is unavailable.
 */
export declare function curateRoute(items: ContentItem[], preferences: GenerateRouteRequest, startLocation?: {
    lat: number;
    lng: number;
}): Promise<CuratedSelection>;
/**
 * Compute contribution shares from an ordered list of stops.
 * Each stop contributes equally. If a creator has multiple stops, they get proportional share.
 */
export declare function computeContributions(stops: ContentItem[]): Record<string, number>;
/**
 * Convert contribution percentages to basis points (sum = 10000).
 */
export declare function contributionsToBps(contributions: Record<string, number>): {
    creators: string[];
    sharesBps: number[];
};
/**
 * Build the full GeneratedRoute from a curation result and the content item lookup.
 */
export declare function buildGeneratedRoute(id: string, curated: CuratedSelection, itemsById: Map<string, ContentItem>): Omit<GeneratedRoute, "priceOg"> & {
    distance: number;
};
export {};
//# sourceMappingURL=curator.d.ts.map