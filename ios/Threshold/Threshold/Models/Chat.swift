import Foundation
import SwiftUI

// MARK: - Tool Result (for display)

struct ToolResult: Identifiable {
    let id = UUID()
    let name: String
    let result: [String: Any]

    /// Human-readable label based on tool name and result data
    var label: String {
        switch name {
        case "add_contact":
            if let contact = result["contact"] as? [String: Any],
               let first = contact["firstName"] as? String,
               let last = contact["lastName"] as? String {
                return "Added \(first) \(last)"
            }
            return "Added contact"
        case "run_matching":
            if let matched = result["matched"], let total = result["total"] {
                return "Matched \(matched) of \(total) to voter file"
            }
            return "Ran voter file matching"
        case "log_conversation":
            let outcome = result["outcome"] as? String ?? "conversation"
            return "Logged: \(outcome)"
        case "get_next_contact":
            if let name = result["name"] as? String {
                return "Next: \(name)"
            }
            return "Checked contacts"
        case "get_contact_details":
            return "Looked up contact"
        case "get_contacts_summary":
            return "Checked summary"
        case "update_match_status":
            let status = result["status"] as? String
            return status == "confirmed" ? "Voter file match confirmed" : "Voter file match rejected"
        case "set_workflow_mode":
            return "Set Workflow Mode"
        case "record_event_rsvp":
            if let title = result["eventTitle"] as? String {
                let status = result["status"] as? String ?? ""
                let statusLabel = status == "yes" ? "Yes" : status == "maybe" ? "Maybe" : "No"
                return "\(statusLabel) for \(title)"
            }
            return "Recorded event RSVP"
        case "get_upcoming_events":
            return "Checked events"
        default:
            return name.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    /// SF Symbol icon name
    var icon: String {
        switch name {
        case "add_contact": return "person.badge.plus"
        case "run_matching": return "magnifyingglass"
        case "log_conversation": return "text.bubble"
        case "get_next_contact": return "arrow.right.circle"
        case "get_contact_details": return "person.text.rectangle"
        case "get_contacts_summary": return "list.bullet.clipboard"
        case "update_match_status":
            let status = result["status"] as? String
            return status == "confirmed" ? "checkmark.shield" : "xmark.shield"
        case "set_workflow_mode": return "gearshape"
        case "record_event_rsvp": return "calendar.badge.checkmark"
        case "get_upcoming_events": return "calendar"
        default: return "checkmark.circle"
        }
    }

    /// Chip color
    var chipColor: Color {
        switch name {
        case "add_contact": return .blue
        case "run_matching": return .vcTeal
        case "log_conversation": return .orange
        case "get_next_contact": return .vcPurple
        case "get_contact_details", "get_contacts_summary", "get_upcoming_events":
            return Color.white.opacity(0.6)
        case "update_match_status":
            let status = result["status"] as? String
            return status == "confirmed" ? .green : .vcCoral
        case "set_workflow_mode":
            return Color.white.opacity(0.6)
        case "record_event_rsvp":
            let status = result["status"] as? String
            if status == "yes" { return .vcTeal }
            if status == "maybe" { return .orange }
            return Color.white.opacity(0.6)
        default: return Color.white.opacity(0.6)
        }
    }
}

// MARK: - Chat Message

struct ChatMessage: Codable, Identifiable {
    let id: String
    let role: String  // "user" or "assistant"
    var content: String
    let createdAt: String?
    // Extra fields from API we don't use but must accept
    let toolCalls: AnyCodable?
    let toolResults: AnyCodable?

    // Non-codable: populated during streaming or parsed from toolResults
    var toolResultItems: [ToolResult] = []

    var isUser: Bool { role == "user" }
    var isAssistant: Bool { role == "assistant" }

    enum CodingKeys: String, CodingKey {
        case id, role, content, createdAt, toolCalls, toolResults
    }

    init(id: String, role: String, content: String, createdAt: String?) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.toolCalls = nil
        self.toolResults = nil
        self.toolResultItems = []
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        role = try container.decode(String.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        toolCalls = try container.decodeIfPresent(AnyCodable.self, forKey: .toolCalls)
        toolResults = try container.decodeIfPresent(AnyCodable.self, forKey: .toolResults)
        toolResultItems = Self.parseToolResults(from: toolResults)
    }

    /// Parse the AnyCodable toolResults from the API into structured ToolResult items
    static func parseToolResults(from anyCodable: AnyCodable?) -> [ToolResult] {
        guard let anyCodable = anyCodable,
              let array = anyCodable.unwrapped as? [[String: Any]] else { return [] }

        return array.compactMap { dict -> ToolResult? in
            guard let name = dict["name"] as? String else { return nil }
            let result = dict["result"] as? [String: Any] ?? [:]
            return ToolResult(name: name, result: result)
        }
    }
}

/// Type-erased Codable wrapper for ignoring unknown JSON shapes
struct AnyCodable: Codable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) { value = str }
        else if let int = try? container.decode(Int.self) { value = int }
        else if let dbl = try? container.decode(Double.self) { value = dbl }
        else if let dict = try? container.decode([String: AnyCodable].self) { value = dict }
        else if let arr = try? container.decode([AnyCodable].self) { value = arr }
        else if let bool = try? container.decode(Bool.self) { value = bool }
        else { value = NSNull() }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encodeNil()
    }

    /// Recursively unwrap AnyCodable values to plain Swift types
    var unwrapped: Any {
        switch value {
        case let dict as [String: AnyCodable]:
            return dict.mapValues { $0.unwrapped }
        case let array as [AnyCodable]:
            return array.map { $0.unwrapped }
        default:
            return value
        }
    }
}

// MARK: - Chat History Response

struct ChatHistoryResponse: Codable {
    let messages: [ChatMessage]
}
