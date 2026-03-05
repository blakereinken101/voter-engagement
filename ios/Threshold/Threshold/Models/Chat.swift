import Foundation

// MARK: - Chat Message

struct ChatMessage: Codable, Identifiable {
    let id: String
    let role: String  // "user" or "assistant"
    var content: String
    let createdAt: String?
    // Extra fields from API we don't use but must accept
    let toolCalls: AnyCodable?
    let toolResults: AnyCodable?

    var isUser: Bool { role == "user" }
    var isAssistant: Bool { role == "assistant" }

    init(id: String, role: String, content: String, createdAt: String?) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.toolCalls = nil
        self.toolResults = nil
    }
}

/// Type-erased Codable wrapper for ignoring unknown JSON shapes
struct AnyCodable: Codable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) { value = str }
        else if let int = try? container.decode(Int.self) { value = int }
        else if let dict = try? container.decode([String: AnyCodable].self) { value = dict }
        else if let arr = try? container.decode([AnyCodable].self) { value = arr }
        else if let bool = try? container.decode(Bool.self) { value = bool }
        else { value = NSNull() }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encodeNil()
    }
}

// MARK: - Chat History Response

struct ChatHistoryResponse: Codable {
    let messages: [ChatMessage]
}
