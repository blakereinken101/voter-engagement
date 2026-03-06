import SwiftUI

struct MessageThreadView: View {
    let channelId: String
    @Environment(MessagingViewModel.self) private var messaging
    @Environment(AuthViewModel.self) private var auth
    @State private var input = ""
    @FocusState private var isInputFocused: Bool

    var body: some View {
        ZStack {
            CosmicBackground()

            VStack(spacing: 0) {
                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            if messaging.hasMore {
                                Button("Load older messages") {
                                    Task { await messaging.loadOlderMessages(channelId) }
                                }
                                .font(.caption)
                                .foregroundStyle(.blue)
                                .padding(.top, 8)
                            }

                            ForEach(groupedMessages) { group in
                                MessageGroup(group: group, currentUserId: auth.user?.id ?? "")
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)

                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .onChange(of: messaging.messages.count) {
                        withAnimation {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                    .onAppear {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }

                // Input bar
                HStack(alignment: .bottom, spacing: 8) {
                    TextField("Message...", text: $input, axis: .vertical)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.white.opacity(0.05))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(.white.opacity(0.1), lineWidth: 1)
                        )
                        .lineLimit(1...5)
                        .focused($isInputFocused)

                    Button {
                        sendMessage()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .white.opacity(0.2) : .blue)
                    }
                    .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || messaging.isSending)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial)
            }
        }
        .navigationTitle(messaging.activeChannel?.displayName ?? "Channel")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.vcBg, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            await messaging.loadChannel(channelId)
            await messaging.loadMessages(channelId)
        }
    }

    private func sendMessage() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        input = ""
        Task {
            await messaging.sendMessage(channelId, content: text)
        }
    }

    // Group sequential messages from same sender within 5 min
    private var groupedMessages: [MessageGroupData] {
        var groups: [MessageGroupData] = []
        for msg in messaging.messages {
            if let last = groups.last,
               last.senderId == msg.senderId,
               msg.messageType == "text",
               timeDiff(last.messages.last!.createdAt, msg.createdAt) < 300 {
                groups[groups.count - 1].messages.append(msg)
            } else {
                groups.append(MessageGroupData(
                    senderId: msg.senderId,
                    senderName: msg.senderName ?? "Unknown",
                    messages: [msg]
                ))
            }
        }
        return groups
    }

    private func timeDiff(_ a: String, _ b: String) -> TimeInterval {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let da = fmt.date(from: a), let db = fmt.date(from: b) else { return .infinity }
        return abs(db.timeIntervalSince(da))
    }
}

// MARK: - Data

struct MessageGroupData: Identifiable {
    let id = UUID()
    let senderId: String
    let senderName: String
    var messages: [TeamMessage]
}

// MARK: - Message Group View

struct MessageGroup: View {
    let group: MessageGroupData
    let currentUserId: String

    private var isMe: Bool { group.senderId == currentUserId }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if !isMe {
                avatar
            }

            VStack(alignment: isMe ? .trailing : .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(isMe ? "You" : group.senderName)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(isMe ? .blue : .white.opacity(0.6))

                    if let first = group.messages.first {
                        Text(formatTime(first.createdAt))
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.2))
                    }
                }

                ForEach(group.messages) { msg in
                    if msg.isSystem {
                        Text("\(msg.senderName ?? "Someone") \(msg.content)")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.3))
                            .italic()
                    } else if msg.isAnnouncement {
                        HStack(spacing: 6) {
                            Image(systemName: "megaphone.fill")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                            Text(msg.isDeleted ? "This message was deleted" : msg.content)
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.9))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.orange.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(.orange.opacity(0.2), lineWidth: 1)
                        )
                    } else {
                        Text(msg.isDeleted ? "This message was deleted" : msg.content)
                            .font(.subheadline)
                            .foregroundStyle(msg.isDeleted ? .white.opacity(0.3) : .white.opacity(0.8))
                            .italic(msg.isDeleted)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: isMe ? .trailing : .leading)

            if isMe {
                avatar
            }
        }
    }

    private var avatar: some View {
        Text(group.senderName.prefix(1).uppercased())
            .font(.caption)
            .fontWeight(.bold)
            .foregroundStyle(.white)
            .frame(width: 28, height: 28)
            .background(isMe ? Color.blue.opacity(0.3) : .white.opacity(0.1))
            .clipShape(Circle())
    }

    private func formatTime(_ dateString: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fmt.date(from: dateString) else { return "" }
        let df = DateFormatter()
        df.doesRelativeDateFormatting = true
        let cal = Calendar.current
        if cal.isDateInToday(date) {
            df.dateStyle = .none
            df.timeStyle = .short
        } else {
            df.dateStyle = .short
            df.timeStyle = .short
        }
        return df.string(from: date)
    }
}
