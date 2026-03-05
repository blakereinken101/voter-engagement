import Foundation

// MARK: - API Error Types

struct APIErrorResponse: Decodable {
    let error: String
}

enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case serverError(statusCode: Int, message: String)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid server response"
        case .unauthorized: return "Session expired. Please sign in again."
        case .serverError(_, let message): return message
        case .decodingError(let error): return "Data error: \(error.localizedDescription)"
        case .networkError(let error): return error.localizedDescription
        }
    }
}

// MARK: - HTTP Method

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - API Endpoint

struct APIEndpoint {
    let path: String
    let method: HTTPMethod
    let body: Encodable?
    let queryItems: [URLQueryItem]?

    init(path: String, method: HTTPMethod = .get, body: Encodable? = nil, queryItems: [URLQueryItem]? = nil) {
        self.path = path
        self.method = method
        self.body = body
        self.queryItems = queryItems
    }

    func urlRequest(baseURL: URL) throws -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems

        guard let url = components.url else {
            throw APIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = AppConstants.requestTimeout

        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return request
    }
}

// MARK: - API Client

final class APIClient {
    static let shared = APIClient()
    private let session: URLSession = {
        // Use ephemeral config so URLSession never stores or sends cookies.
        // The iOS app uses Bearer token + X-Campaign-Id headers, not cookies.
        // Without this, URLSession's shared cookie jar sends stale vc-campaign
        // cookies that override the X-Campaign-Id header on the server.
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = AppConstants.requestTimeout
        return URLSession(configuration: config)
    }()
    private let baseURL = AppConstants.apiBaseURL
    private let tokenManager = TokenManager.shared
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private init() {}

    /// Perform an authenticated API request and decode the response.
    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        var urlRequest = try endpoint.urlRequest(baseURL: baseURL)
        injectHeaders(&urlRequest)

        do {
            let (data, response) = try await session.data(for: urlRequest)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode == 401 {
                tokenManager.clearAll()
                throw APIError.unauthorized
            }

            guard 200...299 ~= httpResponse.statusCode else {
                let errorBody = try? decoder.decode(APIErrorResponse.self, from: data)
                throw APIError.serverError(
                    statusCode: httpResponse.statusCode,
                    message: errorBody?.error ?? "Request failed (\(httpResponse.statusCode))"
                )
            }

            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    /// Perform an authenticated API request that returns no meaningful body.
    func requestVoid(_ endpoint: APIEndpoint) async throws {
        var urlRequest = try endpoint.urlRequest(baseURL: baseURL)
        injectHeaders(&urlRequest)

        let (data, response) = try await session.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            tokenManager.clearAll()
            throw APIError.unauthorized
        }

        guard 200...299 ~= httpResponse.statusCode else {
            let errorBody = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.serverError(
                statusCode: httpResponse.statusCode,
                message: errorBody?.error ?? "Request failed (\(httpResponse.statusCode))"
            )
        }
    }

    /// Build a URLRequest for SSE streaming (caller handles the response stream).
    func streamingRequest(_ endpoint: APIEndpoint) throws -> URLRequest {
        var urlRequest = try endpoint.urlRequest(baseURL: baseURL)
        injectHeaders(&urlRequest)
        return urlRequest
    }

    // MARK: - Private

    private func injectHeaders(_ request: inout URLRequest) {
        request.setValue(AppConstants.mobileClientHeader, forHTTPHeaderField: "X-Client")

        if let token = tokenManager.sessionToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let campaignId = tokenManager.activeCampaignId {
            request.setValue(campaignId, forHTTPHeaderField: "X-Campaign-Id")
        }

        if let pendingToken = tokenManager.pendingToken {
            request.setValue("Bearer \(pendingToken)", forHTTPHeaderField: "X-2FA-Token")
        }
    }
}

// MARK: - AnyEncodable helper

private struct AnyEncodable: Encodable {
    let value: Encodable

    init(_ value: Encodable) {
        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        try value.encode(to: encoder)
    }
}
