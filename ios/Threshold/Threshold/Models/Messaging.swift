import Foundation

// MARK: - Channel

struct MessagingChannel: Codable, Identifiable {
    let id: String
    let campaignId: String
    let name: String?
    let channelType: String  // "team", "broadcast", "direct"
    let description: String?
    let createdBy: String
    let isArchived: Bool
    let createdAt: String
    let updatedAt: String
    var unreadCount: Int?
    var memberCount: Int?
    var muted: Bool?
    var lastMessage: LastMessage?
    var members: [ChannelMember]?

    var displayName: String {
        name ?? "Unnamed"
    }

    var isTeam: Bool { channelType == "team" }
    var isBroadcast: Bool { channelType == "broadcast" }
    var isDirect: Bool { channelType == "direct" }
}

struct LastMessage: Codable {
    let id: String
    let content: String
    let senderId: String
    let senderName: String
    let createdAt: String
}

struct ChannelMember: Codable, Identifiable {
    let id: String
    let channelId: String
    let userId: String
    let role: String
    let lastReadAt: String?
    let muted: Bool
    let joinedAt: String
    var userName: String?
    var userEmail: String?
}

// MARK: - Message

struct TeamMessage: Codable, Identifiable {
    let id: String
    let channelId: String
    let senderId: String
    let content: String
    let messageType: String  // "text", "system", "announcement"
    let parentId: String?
    let isEdited: Bool
    let isDeleted: Bool
    let createdAt: String
    let updatedAt: String
    var senderName: String?

    var isSystem: Bool { messageType == "system" }
    var isAnnouncement: Bool { messageType == "announcement" }
}

// MARK: - API Responses

struct ChannelsResponse: Codable {
    let channels: [MessagingChannel]
}

struct ChannelDetailResponse: Codable {
    let channel: MessagingChannel
}

struct MessagesResponse: Codable {
    let messages: [TeamMessage]
    let hasMore: Bool
}

struct SendMessageResponse: Codable {
    let message: TeamMessage
}

struct CreateChannelResponse: Codable {
    let channelId: String
}

struct DMResponse: Codable {
    let channelId: String
}

// MARK: - Teammates

struct Teammate: Codable, Identifiable {
    let userId: String
    let name: String
    let email: String
    let role: String

    var id: String { userId }
}

struct TeammatesResponse: Codable {
    let teammates: [Teammate]
}
