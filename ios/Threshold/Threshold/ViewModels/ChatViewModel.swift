import Foundation

@Observable
final class ChatViewModel {
    // MARK: - State

    var messages: [ChatMessage] = []
    var inputText = ""
    var isStreaming = false
    var isLoadingHistory = false
    var error: String?

    // MARK: - Private

    private let chatRepo = ChatRepository()
    private var streamTask: Task<Void, Never>?

    // MARK: - Load History

    func loadHistory() async {
        isLoadingHistory = true
        error = nil
        do {
            var loaded = try await chatRepo.fetchHistory()
            // Strip legacy "[Used tool: ...]" text from message content
            for i in loaded.indices {
                loaded[i].content = loaded[i].content
                    .replacingOccurrences(
                        of: #"\n\[Used tool: [^\]]+\]"#,
                        with: "",
                        options: .regularExpression
                    )
            }
            messages = loaded
        } catch {
            // History load failure is non-critical — clear messages and let user start fresh
            messages = []
            print("[ChatVM] History load failed: \(error)")
        }
        isLoadingHistory = false
    }

    /// Clear state for campaign switch
    func clearForCampaignSwitch() {
        cancelStreaming()
        messages = []
        error = nil
        inputText = ""
    }

    // MARK: - Send Message

    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isStreaming else { return }

        // Add user message
        let userMessage = ChatMessage(
            id: UUID().uuidString,
            role: "user",
            content: text,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        messages.append(userMessage)
        inputText = ""

        // Add placeholder for assistant response
        let assistantId = UUID().uuidString
        let placeholder = ChatMessage(
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: nil
        )
        messages.append(placeholder)

        isStreaming = true
        error = nil

        streamTask = Task {
            do {
                let stream = try chatRepo.sendMessage(text)

                for await event in stream {
                    if Task.isCancelled { break }

                    switch event {
                    case .text(let chunk):
                        // Append text to the last assistant message
                        if let idx = messages.lastIndex(where: { $0.id == assistantId }) {
                            messages[idx].content += chunk
                        }

                    case .toolResult(_, let name, let result):
                        // Append structured tool result as a badge chip
                        if let idx = messages.lastIndex(where: { $0.id == assistantId }) {
                            let toolResult = ToolResult(name: name, result: result)
                            messages[idx].toolResultItems.append(toolResult)
                        }

                    case .error(let message):
                        await MainActor.run { self.error = message }

                    case .done:
                        break
                    }
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                }
            }

            await MainActor.run {
                isStreaming = false
            }
        }
    }

    // MARK: - Cancel

    func cancelStreaming() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
    }

    // MARK: - Quick Actions

    let quickActions = [
        "Who should I call next?",
        "Show my progress",
        "Help me with a script",
        "Log a conversation",
    ]

    func sendQuickAction(_ action: String) {
        inputText = action
        sendMessage()
    }
}
