import SwiftUI

/// Displays match candidates for a person entry and lets the user confirm or reject.
struct MatchConfirmationView: View {
    let matchResult: MatchResult
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(\.dismiss) private var dismiss
    @State private var isProcessing = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.vcBg.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Person header
                        VStack(spacing: 8) {
                            ZStack {
                                Circle()
                                    .fill(Color.vcPurple.opacity(0.3))
                                    .frame(width: 56, height: 56)

                                Text(matchResult.personEntry.initials)
                                    .font(.title2.bold())
                                    .foregroundStyle(Color.vcPurpleLight)
                            }

                            Text(matchResult.personEntry.fullName)
                                .font(.title3.bold())
                                .foregroundStyle(.white)

                            Text("We found \(matchResult.candidates.count) potential match\(matchResult.candidates.count == 1 ? "" : "es") in the voter file")
                                .font(.subheadline)
                                .foregroundStyle(Color.vcSlate)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 8)

                        // Match candidates
                        ForEach(Array(matchResult.candidates.enumerated()), id: \.offset) { index, candidate in
                            MatchCandidateCard(
                                candidate: candidate,
                                index: index,
                                isProcessing: isProcessing
                            ) {
                                await confirmCandidate(index: index)
                            }
                        }

                        // Reject all button
                        Button {
                            Task { await rejectAll() }
                        } label: {
                            HStack {
                                Image(systemName: "xmark.circle")
                                Text("None of these are a match")
                            }
                            .font(.subheadline)
                            .foregroundStyle(Color.vcCoral)
                            .padding(14)
                            .frame(maxWidth: .infinity)
                            .background(Color.vcCoral.opacity(0.1))
                            .cornerRadius(10)
                        }
                        .disabled(isProcessing)
                        .padding(.top, 4)
                    }
                    .padding()
                }
            }
            .navigationTitle("Confirm Match")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.vcPurpleLight)
                }
            }
        }
    }

    // MARK: - Actions

    private func confirmCandidate(index: Int) async {
        isProcessing = true
        await contacts.confirmMatch(personId: matchResult.id, selectedIndex: index)
        isProcessing = false
        dismiss()
    }

    private func rejectAll() async {
        isProcessing = true
        await contacts.rejectMatch(personId: matchResult.id)
        isProcessing = false
        dismiss()
    }
}

// MARK: - Match Candidate Card

struct MatchCandidateCard: View {
    let candidate: MatchCandidate
    let index: Int
    let isProcessing: Bool
    let onConfirm: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header row
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(candidate.voterRecord.fullName)
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text(candidate.voterRecord.residentialAddress)
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)

                    Text("\(candidate.voterRecord.city), \(candidate.voterRecord.state) \(candidate.voterRecord.zip)")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                }

                Spacer()

                // Party badge
                Text(candidate.voterRecord.partyAffiliation)
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.partyColor(for: candidate.voterRecord.partyAffiliation).opacity(0.2))
                    .foregroundStyle(Color.partyColor(for: candidate.voterRecord.partyAffiliation))
                    .cornerRadius(6)
            }

            // Confidence & score
            HStack(spacing: 12) {
                // Confidence badge
                HStack(spacing: 4) {
                    Circle()
                        .fill(confidenceColor)
                        .frame(width: 8, height: 8)
                    Text("\(candidate.confidenceLevel.rawValue.capitalized) confidence")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                }

                // Score
                Text("\(Int(candidate.score))% match")
                    .font(.caption.bold())
                    .foregroundStyle(scoreColor)
            }

            // Matched on fields
            if !candidate.matchedOn.isEmpty {
                HStack(spacing: 6) {
                    Text("Matched on:")
                        .font(.caption2)
                        .foregroundStyle(Color.vcSlate)

                    ForEach(candidate.matchedOn, id: \.self) { field in
                        Text(field.replacingOccurrences(of: "_", with: " "))
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.vcPurple.opacity(0.15))
                            .foregroundStyle(Color.vcPurpleLight)
                            .cornerRadius(4)
                    }
                }
            }

            // AI reasoning
            if let reasoning = candidate.aiReasoning, !reasoning.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.caption2)
                        Text("AI Analysis")
                            .font(.caption2.bold())
                    }
                    .foregroundStyle(Color.vcPurpleLight)

                    Text(reasoning)
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                        .lineLimit(3)
                }
            }

            // Vote history (compact)
            let votedCount = candidate.voterRecord.voteHistory.filter(\.voted).count
            let totalElections = candidate.voterRecord.voteHistory.count
            HStack(spacing: 4) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.vcTeal)
                    .font(.caption)
                Text("Voted in \(votedCount) of \(totalElections) recent elections")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
            }

            // Confirm button
            Button {
                Task { await onConfirm() }
            } label: {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text("This is the right person")
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(Color.vcTeal)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(isProcessing)
        }
        .padding()
        .background(Color.vcBgCard)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.vcPurple.opacity(index == 0 ? 0.3 : 0), lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private var confidenceColor: Color {
        switch candidate.confidenceLevel {
        case .high: return .vcTeal
        case .medium: return .vcGold
        case .low: return .vcCoral
        case .veryLow: return .vcSlate
        }
    }

    private var scoreColor: Color {
        if candidate.score >= 80 { return .vcTeal }
        if candidate.score >= 60 { return .vcGold }
        return .vcCoral
    }
}
