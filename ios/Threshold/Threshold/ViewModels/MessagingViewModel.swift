import Foundation
import SwiftUI

@Observable
final class MessagingViewModel {
    private let repository = MessagingRepository()

    var channels: [MessagingChannel] = []
    var activeChannel: MessagingChannel?
    var messages: [TeamMessage] = []
    var hasMore = false
    var isLoading = false
    var isSending = false
    var error: String?

    var teamChannels: [MessagingChannel] {
        channels.filter { $0.isTeam }
    }

    var broadcastChannels: [MessagingChannel] {
        channels.filter { $0.isBroadcast }
    }

    var dmChannels: [MessagingChannel] {
        channels.filter { $0.isDirect }
    }

    var totalUnread: Int {
        channels.reduce(0) { $0 + ($1.unreadCount ?? 0) }
    }

    // MARK: - Channels

    @MainActor
    func loadChannels() async {
        isLoading = true
        error = nil
        do {
            channels = try await repository.fetchChannels()
        } catch {
            self.error = "Failed to load channels"
        }
        isLoading = false
    }

    @MainActor
    func loadChannel(_ channelId: String) async {
        do {
            activeChannel = try await repository.fetchChannelDetail(channelId)
        } catch {
            self.error = "Failed to load channel"
        }
    }

    // MARK: - Messages

    @MainActor
    func loadMessages(_ channelId: String) async {
        isLoading = true
        do {
            let result = try await repository.fetchMessages(channelId)
            messages = result.messages
            hasMore = result.hasMore
            // Mark as read
            try? await repository.markRead(channelId)
        } catch {
            self.error = "Failed to load messages"
        }
        isLoading = false
    }

    @MainActor
    func loadOlderMessages(_ channelId: String) async {
        guard hasMore, let oldest = messages.first else { return }
        do {
            let result = try await repository.fetchMessages(channelId, cursor: oldest.createdAt)
            messages = result.messages + messages
            hasMore = result.hasMore
        } catch {
            // silent
        }
    }

    @MainActor
    func sendMessage(_ channelId: String, content: String) async {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isSending = true
        do {
            let msg = try await repository.sendMessage(channelId, content: content)
            if !messages.contains(where: { $0.id == msg.id }) {
                messages.append(msg)
            }
        } catch {
            self.error = "Failed to send message"
        }
        isSending = false
    }

    // MARK: - Channel Creation

    @MainActor
    func createChannel(name: String, description: String?, memberIds: [String]) async -> String? {
        do {
            let channelId = try await repository.createChannel(name: name, description: description, memberIds: memberIds)
            await loadChannels()
            return channelId
        } catch {
            self.error = "Failed to create channel"
            return nil
        }
    }

    @MainActor
    func startDM(userId: String) async -> String? {
        do {
            let channelId = try await repository.startDM(userId: userId)
            await loadChannels()
            return channelId
        } catch {
            self.error = "Failed to start conversation"
            return nil
        }
    }

    // MARK: - Teammates

    var teammates: [Teammate] = []

    @MainActor
    func loadTeammates() async {
        do {
            teammates = try await repository.fetchTeammates()
        } catch {
            // silent — fall back to empty
        }
    }

    // MARK: - Real-time

    func addIncomingMessage(_ message: TeamMessage) {
        if !messages.contains(where: { $0.id == message.id }) {
            messages.append(message)
        }
    }
}
