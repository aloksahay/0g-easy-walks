import { ContentItem, GenerateRouteRequest, GeneratedRoute, RouteStop } from "../types";
import { chatCompletion } from "./compute";
import { config } from "../config";

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
export async function curateRoute(
  items: ContentItem[],
  preferences: GenerateRouteRequest,
  startLocation?: { lat: number; lng: number }
): Promise<CuratedSelection> {
  try {
    return await aiCurate(items, preferences, startLocation);
  } catch (err) {
    console.warn("0G Compute unavailable, falling back to nearest-neighbor:", err);
    return nearestNeighborFallback(items, preferences, startLocation);
  }
}

async function aiCurate(
  items: ContentItem[],
  preferences: GenerateRouteRequest,
  startLocation?: { lat: number; lng: number }
): Promise<CuratedSelection> {
  const durationMap: Record<string, number> = {
    "1h": 60,
    "2h": 120,
    "3h": 180,
    "half-day": 240,
  };
  const targetMins = durationMap[preferences.duration] || 120;
  const maxStops = Math.floor(targetMins / 20); // ~20 min per stop

  const itemSummaries = items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description.slice(0, 200),
    lat: item.latitude,
    lng: item.longitude,
    tags: item.tags,
  }));

  const systemPrompt = `You are a walking tour curator. Your job is to select the best subset of places and create an optimal walking route for a visitor.

Rules:
- Select between 3 and ${maxStops} stops
- The route should be walkable (stops geographically close together)
- Prioritize stops matching the visitor's interests
- Order stops to minimize backtracking (roughly geographic order)
- Return ONLY valid JSON, no markdown, no explanation

Response format:
{
  "selectedIds": ["id1", "id2", ...],
  "title": "Catchy tour name",
  "description": "2-3 sentence description of the tour experience",
  "estimatedDurationMins": 120
}`;

  const userPrompt = `City: ${preferences.city}
Target duration: ${preferences.duration} (~${targetMins} minutes)
Visitor interests: ${preferences.interests.join(", ")}
Preferred categories: ${preferences.categories.join(", ")}
${startLocation ? `Starting near: ${startLocation.lat}, ${startLocation.lng}` : ""}

Available places:
${JSON.stringify(itemSummaries, null, 2)}

Select the best stops and create a walking tour.`;

  const response = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  // Parse JSON from response (strip any markdown code blocks if present)
  const jsonStr = response.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr) as CuratedSelection;

  // Validate that selected IDs exist in our items
  const validIds = new Set(items.map((i) => i.id));
  parsed.selectedIds = parsed.selectedIds.filter((id) => validIds.has(id));

  if (parsed.selectedIds.length === 0) {
    throw new Error("AI returned no valid stop IDs");
  }

  return parsed;
}

/**
 * Fallback: pick items closest to start location using nearest-neighbor TSP.
 */
function nearestNeighborFallback(
  items: ContentItem[],
  preferences: GenerateRouteRequest,
  startLocation?: { lat: number; lng: number }
): CuratedSelection {
  const durationMap: Record<string, number> = {
    "1h": 60, "2h": 120, "3h": 180, "half-day": 240,
  };
  const targetMins = durationMap[preferences.duration] || 120;
  const maxStops = Math.min(Math.floor(targetMins / 20), items.length);

  // Filter by preferred categories
  let filtered = items.filter((item) =>
    preferences.categories.includes(item.category)
  );
  if (filtered.length === 0) filtered = items;

  // Sort by distance from start, or just take first N
  let sorted = filtered;
  if (startLocation) {
    sorted = filtered.sort((a, b) => {
      const distA = haversineKm(startLocation.lat, startLocation.lng, a.latitude, a.longitude);
      const distB = haversineKm(startLocation.lat, startLocation.lng, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  const selected = sorted.slice(0, maxStops);

  return {
    selectedIds: selected.map((i) => i.id),
    title: `${preferences.city} Walking Tour`,
    description: `A curated ${preferences.duration} walking tour of ${preferences.city} featuring ${preferences.categories.join(" and ")}.`,
    estimatedDurationMins: targetMins,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute contribution shares from an ordered list of stops.
 * Each stop contributes equally. If a creator has multiple stops, they get proportional share.
 */
export function computeContributions(
  stops: ContentItem[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of stops) {
    counts[item.creator_id] = (counts[item.creator_id] || 0) + 1;
  }
  const total = stops.length;
  const shares: Record<string, number> = {};
  for (const [creatorId, count] of Object.entries(counts)) {
    shares[creatorId] = Math.round((count / total) * 10000) / 100; // percentage with 2 decimals
  }
  return shares;
}

/**
 * Convert contribution percentages to basis points (sum = 10000).
 */
export function contributionsToBps(
  contributions: Record<string, number>
): { creators: string[]; sharesBps: number[] } {
  const creators = Object.keys(contributions);
  const rawBps = creators.map((c) => Math.floor(contributions[c] * 100));

  // Fix rounding to ensure sum = 10000
  let sum = rawBps.reduce((a, b) => a + b, 0);
  const diff = 10000 - sum;
  if (creators.length > 0 && diff !== 0) {
    rawBps[0] += diff;
  }

  return { creators, sharesBps: rawBps };
}

/**
 * Estimate walking distance between stops in km.
 */
function totalDistanceKm(stops: ContentItem[]): number {
  let dist = 0;
  for (let i = 1; i < stops.length; i++) {
    dist += haversineKm(
      stops[i - 1].latitude,
      stops[i - 1].longitude,
      stops[i].latitude,
      stops[i].longitude
    );
  }
  return Math.round(dist * 10) / 10;
}

/**
 * Build the full GeneratedRoute from a curation result and the content item lookup.
 */
export function buildGeneratedRoute(
  id: string,
  curated: CuratedSelection,
  itemsById: Map<string, ContentItem>
): Omit<GeneratedRoute, "priceOg"> & { distance: number } {
  const stops: RouteStop[] = curated.selectedIds
    .map((itemId, idx) => {
      const item = itemsById.get(itemId);
      if (!item) return null;
      return {
        contentItem: item,
        order: idx + 1,
        walkTimeMins: idx === 0 ? 0 : 15, // ~15 min walk between stops
      } as RouteStop;
    })
    .filter((s): s is RouteStop => s !== null);

  const stopsContent = stops.map((s) => s.contentItem);
  const contributions = computeContributions(stopsContent);
  const distance = totalDistanceKm(stopsContent);

  return {
    id,
    title: curated.title,
    description: curated.description,
    stops,
    totalDuration: curated.estimatedDurationMins,
    totalDistance: distance,
    contributions,
    distance,
  };
}
