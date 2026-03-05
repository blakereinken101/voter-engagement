import Foundation

// MARK: - SSE Event Types

enum ChatStreamEvent {
    case text(String)
    case toolResult(id: String, name: String, result: [String: Any])
    case error(String)
    case done
}

// MARK: - SSE Client

final class SSEClient {
    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        return URLSession(configuration: config)
    }()

    /// Stream SSE events from the AI chat endpoint.
    func stream(request: URLRequest) -> AsyncStream<ChatStreamEvent> {
        AsyncStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await session.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.yield(.error("Invalid server response"))
                        continuation.finish()
                        return
                    }

                    // Detect redirect: URLSession auto-follows 302s from the auth
                    // middleware, so we get a 200 from the sign-in HTML page.
                    // Compare response URL to request URL to detect this.
                    if let responseURL = httpResponse.url,
                       let requestURL = request.url,
                       responseURL.path != requestURL.path {
                        continuation.yield(.error("Your session has expired. Please sign in again."))
                        continuation.finish()
                        return
                    }

                    // Check for HTML response (another redirect indicator)
                    if let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type"),
                       contentType.contains("text/html") {
                        continuation.yield(.error("Your session has expired. Please sign in again."))
                        continuation.finish()
                        return
                    }

                    // Handle non-200 status codes with specific messages
                    guard httpResponse.statusCode == 200 else {
                        let errorMessage: String
                        switch httpResponse.statusCode {
                        case 401, 403:
                            errorMessage = "Your session has expired. Please sign in again."
                        case 429:
                            errorMessage = "Too many messages. Please wait a moment and try again."
                        case 503:
                            errorMessage = "AI features are temporarily unavailable. Please try again later."
                        default:
                            // Try to extract error message from response body
                            var bodyText = ""
                            for try await line in bytes.lines {
                                bodyText += line
                                if bodyText.count > 500 { break }
                            }
                            if let data = bodyText.data(using: .utf8),
                               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                               let msg = json["error"] as? String {
                                errorMessage = msg
                            } else {
                                errorMessage = "Request failed (\(httpResponse.statusCode))"
                            }
                        }
                        continuation.yield(.error(errorMessage))
                        continuation.finish()
                        return
                    }

                    for try await line in bytes.lines {
                        if Task.isCancelled { break }

                        guard line.hasPrefix("data: ") else { continue }
                        let payload = String(line.dropFirst(6))

                        if payload == "[DONE]" {
                            continuation.yield(.done)
                            break
                        }

                        guard let data = payload.data(using: .utf8) else { continue }

                        do {
                            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                                  let type = json["type"] as? String else { continue }

                            switch type {
                            case "text":
                                if let text = json["text"] as? String {
                                    continuation.yield(.text(text))
                                }
                            case "tool_result":
                                let id = json["id"] as? String ?? ""
                                let name = json["name"] as? String ?? ""
                                let result = json["result"] as? [String: Any] ?? [:]
                                continuation.yield(.toolResult(id: id, name: name, result: result))
                            case "error":
                                let message = json["message"] as? String ?? "Unknown error"
                                continuation.yield(.error(message))
                            default:
                                break
                            }
                        } catch {
                            // Skip malformed JSON lines
                        }
                    }
                } catch {
                    if !Task.isCancelled {
                        continuation.yield(.error(error.localizedDescription))
                    }
                }

                continuation.finish()
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }
}
