import SwiftUI

struct ChatView: View {
    @Environment(ChatViewModel.self) private var chat

    var body: some View {
        @Bindable var chat = chat

        ZStack {
            CosmicBackground()

            VStack(spacing: 0) {
                // Quick actions bar
                if chat.messages.isEmpty {
                    quickActionsBar
                }

                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(chat.messages) { message in
                                ChatBubbleView(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: chat.messages.count) { _, _ in
                        if let lastId = chat.messages.last?.id {
                            withAnimation {
                                proxy.scrollTo(lastId, anchor: .bottom)
                            }
                        }
                    }
                }

                // Error
                if let error = chat.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(Color.vcCoral)
                        .padding(.horizontal)
                }

                // Input bar
                chatInputBar
            }
        }
        .task {
            await chat.loadHistory()
        }
    }

    // MARK: - Quick Actions

    private var quickActionsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(chat.quickActions, id: \.self) { action in
                    Button {
                        chat.sendQuickAction(action)
                    } label: {
                        Text(action)
                            .font(.caption)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .glassCard()
                            .foregroundStyle(Color.vcPurpleLight)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Input Bar

    private var chatInputBar: some View {
        @Bindable var chat = chat

        return HStack(spacing: 8) {
            TextField("Ask your AI coach...", text: $chat.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...4)
                .padding(10)
                .background(Color.vcBgCard)
                .cornerRadius(10)
                .foregroundStyle(.white)

            Button {
                chat.sendMessage()
            } label: {
                Image(systemName: chat.isStreaming ? "stop.circle.fill" : "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(chat.inputText.isEmpty && !chat.isStreaming ? Color.vcSlate : Color.vcPurple)
            }
            .disabled(chat.inputText.isEmpty && !chat.isStreaming)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.vcBg)
    }
}

// MARK: - Chat Bubble

struct ChatBubbleView: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 40) }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                if message.isAssistant {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.caption2)
                        Text("AI Coach")
                            .font(.caption2)
                    }
                    .foregroundStyle(Color.vcPurpleLight)
                }

                Text(message.content.isEmpty ? "..." : message.content)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(message.isUser ? Color.vcPurple : Color.white.opacity(0.07))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                message.isUser
                                    ? Color.vcPurple.opacity(0.5)
                                    : Color.white.opacity(0.08),
                                lineWidth: 1
                            )
                    )
                    .shadow(
                        color: message.isUser ? Color.vcPurple.opacity(0.2) : .clear,
                        radius: 8
                    )
            }

            if message.isAssistant { Spacer(minLength: 40) }
        }
    }
}
