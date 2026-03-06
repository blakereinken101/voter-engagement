import Foundation

final class MessagingRepository {
    private let client = APIClient.shared

    func fetchChannels() async throws -> [MessagingChannel] {
        let response: ChannelsResponse = try await client.request(MessagingEndpoints.channels)
        return response.channels
    }

    func fetchChannelDetail(_ channelId: String) async throws -> MessagingChannel {
        let response: ChannelDetailResponse = try await client.request(MessagingEndpoints.channelDetail(channelId))
        return response.channel
    }

    func fetchMessages(_ channelId: String, cursor: String? = nil) async throws -> (messages: [TeamMessage], hasMore: Bool) {
        let response: MessagesResponse = try await client.request(MessagingEndpoints.messages(channelId, cursor: cursor))
        return (response.messages, response.hasMore)
    }

    func sendMessage(_ channelId: String, content: String, parentId: String? = nil) async throws -> TeamMessage {
        let response: SendMessageResponse = try await client.request(
            MessagingEndpoints.sendMessage(channelId, content: content, parentId: parentId)
        )
        return response.message
    }

    func markRead(_ channelId: String) async throws {
        let _: EmptyResponse = try await client.request(MessagingEndpoints.markRead(channelId))
    }

    func createChannel(name: String, description: String?, memberIds: [String]) async throws -> String {
        let response: CreateChannelResponse = try await client.request(
            MessagingEndpoints.createChannel(name: name, description: description, memberIds: memberIds)
        )
        return response.channelId
    }

    func startDM(userId: String) async throws -> String {
        let response: DMResponse = try await client.request(MessagingEndpoints.startDM(userId: userId))
        return response.channelId
    }
}

private struct EmptyResponse: Codable {
    let ok: Bool?
}
