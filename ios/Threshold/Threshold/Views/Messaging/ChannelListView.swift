import SwiftUI

struct ChannelListView: View {
    @Environment(MessagingViewModel.self) private var messaging
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                ScrollView {
                    LazyVStack(spacing: 0) {
                        if messaging.isLoading && messaging.channels.isEmpty {
                            ProgressView()
                                .tint(.white)
                                .padding(.top, 40)
                        } else if messaging.channels.isEmpty {
                            emptyState
                        } else {
                            // Broadcast channels
                            if !messaging.broadcastChannels.isEmpty {
                                sectionHeader("Announcements")
                                ForEach(filteredChannels(messaging.broadcastChannels)) { channel in
                                    NavigationLink(value: channel.id) {
                                        ChannelRow(channel: channel)
                                    }
                                }
                            }

                            // Team channels
                            if !messaging.teamChannels.isEmpty {
                                sectionHeader("Team Channels")
                                ForEach(filteredChannels(messaging.teamChannels)) { channel in
                                    NavigationLink(value: channel.id) {
                                        ChannelRow(channel: channel)
                                    }
                                }
                            }

                            // DMs
                            if !messaging.dmChannels.isEmpty {
                                sectionHeader("Direct Messages")
                                ForEach(filteredChannels(messaging.dmChannels)) { channel in
                                    NavigationLink(value: channel.id) {
                                        ChannelRow(channel: channel)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .searchable(text: $searchText, prompt: "Search channels")
            }
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.vcBg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationDestination(for: String.self) { channelId in
                MessageThreadView(channelId: channelId)
            }
            .refreshable {
                await messaging.loadChannels()
            }
            .task {
                await messaging.loadChannels()
            }
        }
    }

    private func filteredChannels(_ channels: [MessagingChannel]) -> [MessagingChannel] {
        guard !searchText.isEmpty else { return channels }
        return channels.filter { ($0.name ?? "").localizedCaseInsensitiveContains(searchText) }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption)
            .fontWeight(.semibold)
            .textCase(.uppercase)
            .foregroundStyle(.white.opacity(0.3))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
            .padding(.bottom, 4)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 40))
                .foregroundStyle(.white.opacity(0.2))
            Text("No messages yet")
                .font(.headline)
                .foregroundStyle(.white)
            Text("Channels and conversations will appear here.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(.top, 60)
    }
}

// MARK: - Channel Row

struct ChannelRow: View {
    let channel: MessagingChannel

    var body: some View {
        HStack(spacing: 12) {
            channelIcon
                .frame(width: 40, height: 40)
                .background(iconBackground)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(channel.displayName)
                        .font(.subheadline)
                        .fontWeight((channel.unreadCount ?? 0) > 0 ? .semibold : .medium)
                        .foregroundStyle(.white.opacity((channel.unreadCount ?? 0) > 0 ? 1 : 0.7))
                        .lineLimit(1)

                    Spacer()

                    if let last = channel.lastMessage {
                        Text(timeAgo(last.createdAt))
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.3))
                    }
                }

                if let last = channel.lastMessage {
                    Text("\(last.senderName): \(last.content)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.4))
                        .lineLimit(1)
                }
            }

            if let unread = channel.unreadCount, unread > 0 {
                Text(unread > 9 ? "9+" : "\(unread)")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Color.blue)
                    .clipShape(Circle())
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var channelIcon: some View {
        if channel.isDirect {
            Image(systemName: "person.fill")
                .foregroundStyle(.blue)
        } else if channel.isBroadcast {
            Image(systemName: "megaphone.fill")
                .foregroundStyle(.orange)
        } else {
            Image(systemName: "number")
                .foregroundStyle(Color.vcPurpleLight)
        }
    }

    private var iconBackground: Color {
        if channel.isDirect { return .blue.opacity(0.15) }
        if channel.isBroadcast { return .orange.opacity(0.15) }
        return Color.vcPurple.opacity(0.15)
    }

    private func timeAgo(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateString) else { return "" }
        let interval = Date().timeIntervalSince(date)

        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        return "\(Int(interval / 86400))d"
    }
}
