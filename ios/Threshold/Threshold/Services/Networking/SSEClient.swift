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

                    guard let httpResponse = response as? HTTPURLResponse,
                          httpResponse.statusCode == 200 else {
                        continuation.yield(.error("Server returned an error"))
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
