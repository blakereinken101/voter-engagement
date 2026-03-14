import SwiftUI

struct RolodexCardView: View {
    let item: ActionPlanItem
    let onNext: () -> Void
    let onSkip: () -> Void

    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @State private var step: CardStep = .prep
    @State private var selectedMethod: OutreachMethod?
    @State private var selectedOutcome: ContactOutcome?
    @State private var notes = ""
    @State private var volunteerInterest: VolunteerInterest?
    @State private var surveyResponses: [String: String] = [:]
    @State private var followUpDate: Date?
    @State private var showFollowUpPicker = false
    @State private var isSaving = false
    @State private var saveError: String?

    enum CardStep {
        case prep, log
    }

    private var person: PersonEntry { item.matchResult.personEntry }
    private var voter: SafeVoterRecord? { item.matchResult.bestMatch }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header
                VStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(Color.vcPurple.opacity(0.3))
                            .frame(width: 56, height: 56)

                        Text(person.initials)
                            .font(.title3.bold())
                            .foregroundStyle(Color.vcPurpleLight)
                    }

                    Text(person.fullName)
                        .font(.title3.bold())
                        .foregroundStyle(.white)

                    HStack(spacing: 8) {
                        Label(person.category.displayName, systemImage: person.category.icon)
                            .font(.caption)
                            .foregroundStyle(Color.vcSlate)

                        if let segment = item.matchResult.segment {
                            SegmentBadge(segment: segment)
                        }

                        if let party = voter?.partyAffiliation {
                            Text(party)
                                .font(.caption2.bold())
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Color.partyColor(for: party).opacity(0.2))
                                .foregroundStyle(Color.partyColor(for: party))
                                .cornerRadius(4)
                        }
                    }

                    // Target universe indicator
                    if let voter,
                       let targetConfig = auth.campaignConfig?.aiContext?.targetUniverse,
                       targetConfig.hasAnyCriteria {
                        TargetStarView(
                            isTarget: VoterSegmentCalculator.isInTargetUniverse(voter: voter, config: targetConfig),
                            showLabel: true,
                            size: 16
                        )
                    }
                }

                // Step toggle
                Picker("Step", selection: $step) {
                    Text("Prep").tag(CardStep.prep)
                    Text("Log").tag(CardStep.log)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                switch step {
                case .prep:
                    prepSection
                case .log:
                    logSection
                }
            }
            .padding()
        }
        .background(Color.vcBgCard)
        .cornerRadius(16)
        .padding(.horizontal)
    }

    // MARK: - Prep Section

    private var prepSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let voter {
                // Vote history summary
                VStack(alignment: .leading, spacing: 6) {
                    Text("Voter Info")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)

                    HStack(spacing: 16) {
                        ForEach(voter.voteHistory.prefix(4), id: \.election) { entry in
                            VStack(spacing: 2) {
                                Image(systemName: entry.voted ? "checkmark.circle.fill" : "xmark.circle")
                                    .foregroundStyle(entry.voted ? Color.vcTeal : Color.vcSlate.opacity(0.4))
                                    .font(.caption)
                                Text(String(entry.election.prefix(7)))
                                    .font(.system(size: 8))
                                    .foregroundStyle(Color.vcSlate)
                            }
                        }
                    }
                }

                if !voter.residentialAddress.isEmpty {
                    Label(voter.residentialAddress, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                }
            }

            if let phone = person.phone, !phone.isEmpty {
                HStack {
                    Label(phone, systemImage: "phone.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.vcTeal)
                    Spacer()
                    Button {
                        SMSTemplates.openSMS(
                            phone: phone,
                            contactFirstName: person.firstName,
                            volunteerName: auth.user?.name ?? "",
                            segment: item.matchResult.segment,
                            electionDate: auth.campaignConfig?.electionDate,
                            customTemplate: auth.campaignConfig?.customSmsTemplate
                        )
                        selectedMethod = .text
                        step = .log
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "message.fill")
                                .font(.caption)
                            Text("Send Text")
                                .font(.caption.weight(.semibold))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.vcPurple)
                        .foregroundStyle(.white)
                        .cornerRadius(8)
                    }
                }
            }

            // Conversation Guide
            if let segment = item.matchResult.segment,
               let script = ConversationScripts.scripts[segment] {
                ConversationGuideView(
                    script: script,
                    personName: person.firstName,
                    relationshipTip: ConversationScripts.getRelationshipTip(person.category)
                )
            }

            // Action button
            Button {
                step = .log
            } label: {
                HStack {
                    Image(systemName: "arrow.right.circle.fill")
                    Text("Ready to Log")
                }
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(Color.vcPurple)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .padding(.top, 8)

            // Skip button
            Button {
                onSkip()
            } label: {
                Text("Skip for now")
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Log Section

    private var logSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Method
            VStack(alignment: .leading, spacing: 8) {
                Text("How did you reach out?")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)

                HStack(spacing: 8) {
                    ForEach(OutreachMethod.allCases, id: \.self) { method in
                        Button {
                            selectedMethod = method
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: method.icon)
                                    .font(.title3)
                                Text(method.displayName)
                                    .font(.caption2)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(10)
                            .background(selectedMethod == method ? Color.vcPurple : Color.vcBg)
                            .foregroundStyle(selectedMethod == method ? .white : Color.vcSlate)
                            .cornerRadius(10)
                        }
                    }
                }
            }

            // Outcome
            VStack(alignment: .leading, spacing: 8) {
                Text("What was the outcome?")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(ContactOutcome.allCases, id: \.self) { outcome in
                        Button {
                            selectedOutcome = outcome
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: outcome.icon)
                                    .font(.caption)
                                Text(outcome.displayName)
                                    .font(.caption)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(10)
                            .background(selectedOutcome == outcome ? Color.vcPurple : Color.vcBg)
                            .foregroundStyle(selectedOutcome == outcome ? .white : Color.vcSlate)
                            .cornerRadius(8)
                        }
                    }
                }
            }

            // Notes
            VStack(alignment: .leading, spacing: 6) {
                Text("Notes")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)

                TextField("What did you discuss?", text: $notes, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(3...6)
                    .padding(10)
                    .background(Color.vcBg)
                    .cornerRadius(8)
                    .foregroundStyle(.white)
            }

            // Survey Questions (only for response outcomes)
            if let outcome = selectedOutcome,
               outcome != .leftMessage && outcome != .noAnswer,
               let questions = auth.campaignConfig?.surveyQuestions,
               !questions.isEmpty {
                SurveyQuestionsView(questions: questions, responses: $surveyResponses)
            }

            // Volunteer Interest
            VStack(alignment: .leading, spacing: 8) {
                Text("Interested in volunteering?")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)

                HStack(spacing: 8) {
                    ForEach(VolunteerInterest.allCases, id: \.self) { interest in
                        Button {
                            volunteerInterest = interest
                        } label: {
                            Text(interest.displayName)
                                .font(.caption)
                                .frame(maxWidth: .infinity)
                                .padding(8)
                                .background(volunteerInterest == interest ? Color.vcPurple : Color.vcBg)
                                .foregroundStyle(volunteerInterest == interest ? .white : Color.vcSlate)
                                .cornerRadius(8)
                        }
                    }
                }
            }

            // Follow-up date
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Schedule Follow-up")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    Spacer()
                    if followUpDate != nil {
                        Button {
                            followUpDate = nil
                        } label: {
                            Text("Clear")
                                .font(.caption)
                                .foregroundStyle(Color.vcCoral)
                        }
                    }
                }

                Button {
                    if followUpDate == nil {
                        followUpDate = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
                    }
                    showFollowUpPicker.toggle()
                } label: {
                    HStack {
                        Image(systemName: "calendar.badge.clock")
                            .font(.caption)
                        if let date = followUpDate {
                            Text(date, style: .date)
                                .font(.caption)
                        } else {
                            Text("Set a reminder date")
                                .font(.caption)
                        }
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                    .padding(10)
                    .background(followUpDate != nil ? Color.vcGold.opacity(0.15) : Color.vcBg)
                    .foregroundStyle(followUpDate != nil ? Color.vcGold : Color.vcSlate)
                    .cornerRadius(8)
                }

                if showFollowUpPicker, let _ = followUpDate {
                    DatePicker(
                        "Follow-up date",
                        selection: Binding(
                            get: { followUpDate ?? Date() },
                            set: { followUpDate = $0 }
                        ),
                        in: Date()...,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .tint(Color.vcPurple)
                    .colorScheme(.dark)
                }
            }

            // Error message
            if let saveError {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                    Text(saveError)
                        .font(.caption)
                }
                .foregroundStyle(Color.vcCoral)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.vcCoral.opacity(0.1))
                .cornerRadius(8)
            }

            // Save button
            Button {
                isSaving = true
                saveError = nil
                Task {
                    let responsesToSave = surveyResponses.isEmpty ? nil : surveyResponses
                    let followUpStr: String? = followUpDate.map { ISO8601DateFormatter().string(from: $0) }
                    let success = await contacts.updateAction(
                        contactId: person.id,
                        contacted: true,
                        outreachMethod: selectedMethod,
                        contactOutcome: selectedOutcome,
                        notes: notes.isEmpty ? nil : notes,
                        volunteerInterest: volunteerInterest,
                        surveyResponses: responsesToSave,
                        followUpDate: followUpStr
                    )
                    isSaving = false
                    if success {
                        onNext()
                    } else {
                        saveError = "Failed to save. Please try again."
                    }
                }
            } label: {
                HStack {
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                    }
                    Text("Save & Next")
                }
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(Color.vcTeal)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(isSaving)
        }
    }
}
