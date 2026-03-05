import SwiftUI

struct ConversationGuideView: View {
    let script: ConversationScript
    let personName: String
    let relationshipTip: String?

    @State private var isExpanded = false
    @State private var selectedMethod: OutreachMethod = .text
    @State private var showSampleConversation = false
    @State private var showTips = false

    var body: some View {
        DisclosureGroup("Conversation Guide", isExpanded: $isExpanded) {
            VStack(alignment: .leading, spacing: 16) {
                // Title
                Text(script.title)
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.vcPurpleLight)

                // Introduction
                Text(script.introduction)
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)

                // Key points
                VStack(alignment: .leading, spacing: 6) {
                    Text("Remember")
                        .font(.caption.bold())
                        .foregroundStyle(.white)

                    ForEach(script.keyPoints, id: \.self) { point in
                        HStack(alignment: .top, spacing: 6) {
                            Text("->")
                                .foregroundStyle(Color.vcCoral)
                                .font(.caption)
                            Text(point)
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    }
                }

                // Outreach method picker
                Picker("Method", selection: $selectedMethod) {
                    ForEach(OutreachMethod.allCases, id: \.self) { m in
                        Text(m.displayName).tag(m)
                    }
                }
                .pickerStyle(.segmented)

                // Method-specific content
                methodContent

                // Relationship tip
                if let tip = relationshipTip {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Relationship Tip")
                            .font(.caption.bold())
                            .foregroundStyle(Color.vcGold)
                        Text(tip)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(10)
                    .background(Color.vcGold.opacity(0.1))
                    .cornerRadius(8)
                }

                // Closing ask
                VStack(alignment: .leading, spacing: 4) {
                    Text("The Ask")
                        .font(.caption.bold())
                        .foregroundStyle(Color.vcTeal)
                    Text(script.closingAsk)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.8))
                }
                .padding(10)
                .background(Color.vcTeal.opacity(0.1))
                .cornerRadius(8)

                // Sample conversation
                DisclosureGroup("Sample Conversation", isExpanded: $showSampleConversation) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(script.sampleConversation.enumerated()), id: \.offset) { _, line in
                            HStack(alignment: .top, spacing: 8) {
                                Text(line.speaker == "you" ? "You:" : "Them:")
                                    .font(.caption.bold())
                                    .foregroundStyle(line.speaker == "you" ? Color.vcPurpleLight : Color.vcSlate)
                                    .frame(width: 36, alignment: .leading)
                                Text(line.text)
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.8))
                            }
                        }
                    }
                    .padding(.top, 4)
                }
                .font(.caption.bold())
                .foregroundStyle(.white)

                // Tips
                DisclosureGroup("Tips", isExpanded: $showTips) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(script.tips, id: \.self) { tip in
                            HStack(alignment: .top, spacing: 6) {
                                Text("*")
                                    .foregroundStyle(Color.vcPurpleLight)
                                    .font(.caption)
                                Text(tip)
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                        }
                    }
                    .padding(.top, 4)
                }
                .font(.caption.bold())
                .foregroundStyle(.white)
            }
            .padding(.top, 8)
        }
        .font(.subheadline.bold())
        .foregroundStyle(.white)
        .tint(Color.vcPurpleLight)
    }

    @ViewBuilder
    private var methodContent: some View {
        let content: String = {
            switch selectedMethod {
            case .text:
                return insertName(script.textTemplate)
            case .call:
                return insertName(script.callOpener)
            case .oneOnOne:
                return insertName(script.oneOnOneSetup)
            }
        }()

        let title: String = {
            switch selectedMethod {
            case .text: return "Copy this text"
            case .call: return "Start with"
            case .oneOnOne: return "How to set it up"
            }
        }()

        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.bold())
                .foregroundStyle(Color.vcSlate)
            Text(content)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.8))
                .textSelection(.enabled)
        }
        .padding(10)
        .background(Color.vcBg)
        .cornerRadius(8)
    }

    private func insertName(_ text: String) -> String {
        text.replacingOccurrences(of: "[Name]", with: personName)
    }
}
