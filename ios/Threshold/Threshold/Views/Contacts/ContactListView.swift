import SwiftUI

struct ContactListView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @State private var searchText = ""
    @State private var segmentFilter: SegmentFilterOption = .all
    @State private var selectedContact: PersonEntry?

    enum SegmentFilterOption: String, CaseIterable {
        case all = "All"
        case toContact = "To Contact"
        case superVoter = "Super"
        case sometimes = "Sometimes"
        case rarely = "Rarely"
        case unmatched = "Unmatched"
    }

    private var filteredEntries: [PersonEntry] {
        var entries = contacts.personEntries

        // Filter by segment
        if segmentFilter != .all {
            entries = entries.filter { person in
                switch segmentFilter {
                case .toContact:
                    let action = contacts.actionItem(for: person.id)
                    return action == nil || !action!.contacted
                case .superVoter:
                    return contacts.matchResult(for: person.id)?.segment == .superVoter
                case .sometimes:
                    return contacts.matchResult(for: person.id)?.segment == .sometimesVoter
                case .rarely:
                    return contacts.matchResult(for: person.id)?.segment == .rarelyVoter
                case .unmatched:
                    let match = contacts.matchResult(for: person.id)
                    return match == nil || match!.status != .confirmed
                case .all:
                    return true
                }
            }
        }

        // Filter by search
        if !searchText.isEmpty {
            entries = entries.filter {
                $0.fullName.localizedCaseInsensitiveContains(searchText)
            }
        }

        return entries.sorted { $0.lastName < $1.lastName }
    }

    var body: some View {
        ZStack {
            Color.vcBg.ignoresSafeArea()

            if contacts.personEntries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "person.slash")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.vcSlate)
                    Text("No contacts yet")
                        .foregroundStyle(Color.vcSlate)
                }
            } else {
                VStack(spacing: 0) {
                    // Segment filter
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(SegmentFilterOption.allCases, id: \.self) { option in
                                Button {
                                    segmentFilter = option
                                } label: {
                                    Text(option.rawValue)
                                        .font(.caption)
                                        .fontWeight(segmentFilter == option ? .bold : .regular)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(segmentFilter == option ? Color.vcPurple : Color.vcBgCard)
                                        .foregroundStyle(segmentFilter == option ? .white : Color.vcSlate)
                                        .cornerRadius(16)
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                    }

                    List(filteredEntries) { person in
                        ContactRow(person: person)
                            .listRowBackground(Color.vcBg)
                            .listRowSeparatorTint(Color.vcGray.opacity(0.3))
                            .onTapGesture {
                                selectedContact = person
                            }
                    }
                    .listStyle(.plain)
                    .searchable(text: $searchText, prompt: "Search contacts")
                }
            }
        }
        .sheet(item: $selectedContact) { person in
            ContactDetailView(person: person)
        }
    }
}

// MARK: - Contact Row

struct ContactRow: View {
    let person: PersonEntry
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        let match = contacts.matchResult(for: person.id)
        let action = contacts.actionItem(for: person.id)
        let targetConfig = auth.campaignConfig?.aiContext?.targetUniverse

        HStack(spacing: 12) {
            // Initials circle
            ZStack {
                Circle()
                    .fill(Color.vcPurple.opacity(0.3))
                    .frame(width: 40, height: 40)

                Text(person.initials)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.vcPurpleLight)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(person.fullName)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)

                HStack(spacing: 6) {
                    Text(person.category.displayName)
                        .font(.caption2)
                        .foregroundStyle(Color.vcSlate)

                    if let segment = match?.segment {
                        SegmentBadge(segment: segment)
                    }
                }
            }

            Spacer()

            // Target universe star
            if let voter = match?.bestMatch, targetConfig?.hasAnyCriteria == true {
                TargetStarView(
                    isTarget: VoterSegmentCalculator.isInTargetUniverse(voter: voter, config: targetConfig),
                    size: 14
                )
            }

            // Status indicator
            if let outcome = action?.contactOutcome {
                Image(systemName: outcome.icon)
                    .font(.caption)
                    .foregroundStyle(outcomeColor(outcome))
            } else if match?.status == .ambiguous {
                Image(systemName: "person.fill.questionmark")
                    .font(.caption)
                    .foregroundStyle(Color.vcGold)
            } else if match?.status == .confirmed {
                Image(systemName: "checkmark.circle")
                    .font(.caption)
                    .foregroundStyle(Color.vcTeal.opacity(0.5))
            }
        }
        .padding(.vertical, 4)
    }

    private func outcomeColor(_ outcome: ContactOutcome) -> Color {
        switch outcome {
        case .supporter: return .vcTeal
        case .undecided: return .vcGold
        case .opposed: return .vcCoral
        case .leftMessage, .noAnswer: return .vcSlate
        }
    }
}

// MARK: - Segment Badge

struct SegmentBadge: View {
    let segment: VoterSegment

    var body: some View {
        Text(segment.displayName)
            .font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .cornerRadius(4)
    }

    private var color: Color {
        switch segment {
        case .superVoter: return .vcTeal
        case .sometimesVoter: return .vcGold
        case .rarelyVoter: return .vcCoral
        }
    }
}
