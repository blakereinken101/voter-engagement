import SwiftUI

struct ContactListView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
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
                        .padding(.top, 4)
                        .padding(.bottom, 8)
                    }
                    .background(Color.vcBg)
                    .zIndex(1)

                    List(filteredEntries) { person in
                        ContactRow(
                            person: person,
                            onText: (person.phone != nil && !person.phone!.isEmpty) ? { sendText(to: person) } : nil
                        )
                            .listRowBackground(Color.vcBg)
                            .listRowSeparatorTint(Color.vcGray.opacity(0.3))
                            .onTapGesture {
                                selectedContact = person
                            }
                            // LEADING: Text action (swipe right)
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                if let phone = person.phone, !phone.isEmpty {
                                    Button {
                                        sendText(to: person)
                                    } label: {
                                        Label("Text", systemImage: "message.fill")
                                    }
                                    .tint(Color.vcTeal)
                                }
                            }
                            // TRAILING: Outcome actions (swipe left)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button {
                                    markOutcome(person, outcome: .opposed)
                                } label: {
                                    Label("Opposed", systemImage: "hand.thumbsdown.fill")
                                }
                                .tint(Color.vcCoral)

                                Button {
                                    markOutcome(person, outcome: .undecided)
                                } label: {
                                    Label("Undecided", systemImage: "person.fill.questionmark")
                                }
                                .tint(Color.vcGold)

                                Button {
                                    markOutcome(person, outcome: .supporter)
                                } label: {
                                    Label("Supporter", systemImage: "hand.thumbsup.fill")
                                }
                                .tint(.green)
                            }
                    }
                    .listStyle(.plain)
                    .clipped()
                    .searchable(text: $searchText, prompt: "Search contacts")
                }
            }
        }
        .sheet(item: $selectedContact) { person in
            ContactDetailView(person: person)
        }
    }

    // MARK: - Send Text

    private func sendText(to person: PersonEntry) {
        guard let phone = person.phone, !phone.isEmpty else { return }
        let segment = contacts.matchResult(for: person.id)?.segment
        SMSTemplates.openSMS(
            phone: phone,
            contactFirstName: person.firstName,
            volunteerName: auth.user?.name ?? "",
            segment: segment,
            electionDate: auth.campaignConfig?.electionDate
        )
    }

    // MARK: - Mark Outcome

    private func markOutcome(_ person: PersonEntry, outcome: ContactOutcome) {
        Task {
            let success = await contacts.updateAction(
                contactId: person.id,
                contacted: true,
                contactOutcome: outcome
            )
            if success {
                await MainActor.run { HapticManager.notification(.success) }
            }
        }
    }
}

// MARK: - Contact Row

struct ContactRow: View {
    let person: PersonEntry
    var onText: (() -> Void)? = nil
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
            .layoutPriority(1)

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

            // Message icon button
            if let onText {
                Button(action: onText) {
                    Image(systemName: "message.fill")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 28)
                        .background(Color.vcTeal)
                        .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }

            // Flashing swipe hint arrow
            SwipeHintArrow()
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
