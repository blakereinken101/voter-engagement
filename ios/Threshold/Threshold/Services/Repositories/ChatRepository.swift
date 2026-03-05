import Foundation

final class ChatRepository {
    private let client = APIClient.shared
    private let sseClient = SSEClient()

    func fetchHistory() async throws -> [ChatMessage] {
        let response: ChatHistoryResponse = try await client.request(ChatEndpoints.history)
        return response.messages
    }

    func sendMessage(_ message: String) throws -> AsyncStream<ChatStreamEvent> {
        let request = try client.streamingRequest(ChatEndpoints.send(message: message))
        return sseClient.stream(request: request)
    }
}
