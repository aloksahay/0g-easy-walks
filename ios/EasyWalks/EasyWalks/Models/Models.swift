import Foundation

// MARK: - Core Models

struct Creator: Codable, Identifiable {
    let id: String // wallet address
    let display_name: String
    let bio: String?
    let avatar_hash: String?
    let created_at: TimeInterval
}

struct ContentItem: Codable, Identifiable {
    let id: String
    let creator_id: String
    let title: String
    let description: String
    let category: ContentCategory
    let latitude: Double
    let longitude: Double
    let city: String
    let tags: [String]
    let photo_hashes: [String]
    let text_hash: String
    let created_at: TimeInterval
    let status: String
}

enum ContentCategory: String, Codable, CaseIterable {
    case place, activity, eatery

    var displayName: String {
        rawValue.capitalized
    }

    var icon: String {
        switch self {
        case .place: return "📍"
        case .activity: return "🎯"
        case .eatery: return "🍜"
        }
    }
}

struct RouteStop: Codable {
    let contentItem: ContentItem
    let order: Int
    let walkTimeMins: Int
}

struct Route: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let city: String
    let duration_mins: Int?
    let distance_km: Double?
    let item_ids: [String]
    let contributions: [String: Double]
    let price_og: String
    let route_hash: String?
    let contract_route_id: Int?
    let created_at: TimeInterval
    var stops: [ContentItem]?
}

struct GeneratedRoute: Codable {
    let id: String
    let title: String
    let description: String
    let stops: [RouteStop]
    let totalDuration: Int
    let totalDistance: Double
    let contributions: [String: Double]
    let priceOg: String
}

// MARK: - API Response Types

struct AuthChallengeResponse: Codable {
    let challenge: String
    let expiresAt: TimeInterval
}

struct AuthVerifyResponse: Codable {
    let token: String
}

struct ContentListResponse: Codable {
    let items: [ContentItem]
    let total: Int
    let page: Int
    let limit: Int
}

struct GenerateRouteResponse: Codable {
    let route: GeneratedRoute
}

struct PreparePurchaseResponse: Codable {
    let contractRouteId: Int
    let priceWei: String
    let contractAddress: String
    let calldata: String
}

struct ConfirmPurchaseResponse: Codable {
    let success: Bool
    let route: Route
}

struct PurchasedRoutesResponse: Codable {
    let routes: [Route]
}

struct CreatorStatsResponse: Codable {
    let profile: Creator
    let stats: CreatorStats
}

struct CreatorStats: Codable {
    let totalContent: Int
    let routesUsedIn: Int
}

struct EarningsResponse: Codable {
    let unclaimed: String
}

// MARK: - Request Types

struct GenerateRouteRequest: Codable {
    let city: String
    let duration: String
    let categories: [String]
    let interests: [String]
}

// MARK: - User Preferences (local only)

struct WalkPreferences {
    var city: String = ""
    var duration: Duration = .two
    var categories: Set<ContentCategory> = [.place, .eatery, .activity]
    var interests: Set<String> = []

    enum Duration: String, CaseIterable {
        case one = "1h"
        case two = "2h"
        case three = "3h"
        case halfDay = "half-day"

        var displayName: String {
            switch self {
            case .one: return "1 hour"
            case .two: return "2 hours"
            case .three: return "3 hours"
            case .halfDay: return "Half day"
            }
        }
    }
}

let popularInterests = [
    "History", "Street Food", "Photography", "Architecture",
    "Art", "Markets", "Nature", "Nightlife", "Shopping", "Local Culture"
]
