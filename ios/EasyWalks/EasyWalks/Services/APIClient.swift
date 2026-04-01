import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case httpError(Int, String)
    case decodingError(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .networkError(let e): return "Network error: \(e.localizedDescription)"
        case .httpError(let code, let msg): return "HTTP \(code): \(msg)"
        case .decodingError(let e): return "Decode error: \(e.localizedDescription)"
        case .unauthorized: return "Unauthorized — please reconnect wallet"
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    // Change this to your backend URL (localhost for dev, ngrok for device testing)
    private let baseURL = "http://localhost:3000/api/v1"

    private var authToken: String? {
        get { UserDefaults.standard.string(forKey: "auth_token") }
    }

    private init() {}

    func setToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: "auth_token")
    }

    func clearToken() {
        UserDefaults.standard.removeObject(forKey: "auth_token")
    }

    // MARK: - Generic request

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil,
        requiresAuth: Bool = false
    ) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth {
            guard let token = authToken else { throw APIError.unauthorized }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        guard (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            if http.statusCode == 401 { throw APIError.unauthorized }
            throw APIError.httpError(http.statusCode, msg)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Multipart upload

    func uploadContent(
        title: String,
        description: String,
        category: ContentCategory,
        latitude: Double,
        longitude: Double,
        city: String,
        tags: [String],
        photoData: [(data: Data, mimeType: String)]
    ) async throws -> ContentItem {
        guard let url = URL(string: baseURL + "/content") else {
            throw APIError.invalidURL
        }
        guard let token = authToken else { throw APIError.unauthorized }

        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body = Data()

        func appendField(_ name: String, value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        appendField("title", value: title)
        appendField("description", value: description)
        appendField("category", value: category.rawValue)
        appendField("latitude", value: String(latitude))
        appendField("longitude", value: String(longitude))
        appendField("city", value: city)

        let tagsJson = (try? String(data: JSONEncoder().encode(tags), encoding: .utf8)) ?? "[]"
        appendField("tags", value: tagsJson)

        for (idx, photo) in photoData.enumerated() {
            let ext = photo.mimeType.contains("png") ? "png" : "jpg"
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photos\"; filename=\"photo\(idx).\(ext)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: \(photo.mimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(photo.data)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "Upload failed"
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0, msg)
        }

        return try JSONDecoder().decode(ContentItem.self, from: data)
    }

    // MARK: - Convenience methods

    func getChallenge(walletAddress: String) async throws -> AuthChallengeResponse {
        struct Body: Encodable { let walletAddress: String }
        return try await request("/auth/challenge", method: "POST", body: Body(walletAddress: walletAddress))
    }

    func verifySignature(walletAddress: String, signature: String, challenge: String) async throws -> AuthVerifyResponse {
        struct Body: Encodable { let walletAddress, signature, challenge: String }
        return try await request("/auth/verify", method: "POST", body: Body(walletAddress: walletAddress, signature: signature, challenge: challenge))
    }

    func listContent(city: String, category: ContentCategory? = nil, page: Int = 1) async throws -> ContentListResponse {
        var query = "?city=\(city.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? city)&page=\(page)"
        if let cat = category { query += "&category=\(cat.rawValue)" }
        return try await request("/content\(query)")
    }

    func generateRoute(_ preferences: GenerateRouteRequest) async throws -> GenerateRouteResponse {
        return try await request("/routes/generate", method: "POST", body: preferences, requiresAuth: true)
    }

    func getRoute(id: String) async throws -> Route {
        return try await request("/routes/\(id)")
    }

    func getPurchasedRoutes() async throws -> PurchasedRoutesResponse {
        return try await request("/routes/purchased", requiresAuth: true)
    }

    func preparePurchase(routeId: String) async throws -> PreparePurchaseResponse {
        return try await request("/routes/\(routeId)/prepare-purchase", method: "POST", requiresAuth: true)
    }

    func confirmPurchase(routeId: String, txHash: String) async throws -> ConfirmPurchaseResponse {
        struct Body: Encodable { let txHash: String }
        return try await request("/routes/\(routeId)/confirm-purchase", method: "POST", body: Body(txHash: txHash), requiresAuth: true)
    }

    func getCreatorContent(wallet: String) async throws -> ContentListResponse {
        return try await request("/content/creator/\(wallet)")
    }

    func getEarnings(wallet: String) async throws -> EarningsResponse {
        return try await request("/creators/\(wallet)/earnings", requiresAuth: true)
    }

    func mediaURL(for hash: String) -> URL? {
        URL(string: "\(baseURL)/media/\(hash)")
    }
}
