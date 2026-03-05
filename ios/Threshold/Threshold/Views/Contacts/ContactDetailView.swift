import SwiftUI

struct ContactDetailView: View {
    let person: PersonEntry
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var showMatchConfirmation = false
    @State private var isEditingOutreach = false

    // Outreach form state
    @State private var selectedMethod: OutreachMethod?
    @State private var selectedOutcome: ContactOutcome?
    @State private var notes = ""
    @State private var volunteerInterest: VolunteerInterest?
    @State private var surveyResponses: [String: String] = [:]
    @State private var followUpDate: Date?
    @State private var showFollowUpPicker = false
    @State private var isSaving = false

    // Edit mode state
    @State private var isEditingInfo = false
    @State private var editFirstName = ""
    @State private var editLastName = ""
    @State private var editPhone = ""
    @State private var editAddress = ""
    @State private var editCity = ""
    @State private var editZip = ""

    // Delete state
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false

    var body: some View {
        let match = contacts.matchResult(for: person.id)
        let action = contacts.actionItem(for: person.id)
        let isContacted = action?.contacted ?? false

        NavigationStack {
            ZStack {
                Color.vcBg.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        VStack(spacing: 8) {
                            ZStack {
                                Circle()
                                    .fill(Color.vcPurple.opacity(0.3))
                                    .frame(width: 72, height: 72)

                                Text(person.initials)
                                    .font(.title.bold())
                                    .foregroundStyle(Color.vcPurpleLight)
                            }

                            Text(person.fullName)
                                .font(.title2.bold())
                                .foregroundStyle(.white)

                            HStack(spacing: 8) {
                                Label(person.category.displayName, systemImage: person.category.icon)
                                    .font(.caption)
                                    .foregroundStyle(Color.vcSlate)

                                if let segment = match?.segment {
                                    SegmentBadge(segment: segment)
                                }
                            }
                        }

                        // Match review prompt for ambiguous matches
                        if let match, match.status == .ambiguous, !match.candidates.isEmpty {
                            Button {
                                showMatchConfirmation = true
                            } label: {
                                HStack {
                                    Image(systemName: "person.fill.questionmark")
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Review Match Candidates")
                                            .font(.subheadline.weight(.semibold))
                                        Text("\(match.candidates.count) potential match\(match.candidates.count == 1 ? "" : "es") found")
                                            .font(.caption)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                }
                                .padding(14)
                                .background(Color.vcGold.opacity(0.15))
                                .foregroundStyle(Color.vcGold)
                                .cornerRadius(10)
                            }
                        }

                        // Contact Info
                        if isEditingInfo {
                            editInfoSection
                        } else if person.phone != nil || person.address != nil {
                            infoSection
                        }

                        // Voter Record
                        if let voter = match?.bestMatch {
                            voterSection(voter)
                        }

                        // Voter Registration Links
                        VoterRegistrationLinksView(stateAbbr: auth.campaignConfig?.state)

                        // Conversation Guide
                        if let match = contacts.matchResult(for: person.id),
                           let segment = match.segment,
                           let script = ConversationScripts.scripts[segment] {
                            ConversationGuideView(
                                script: script,
                                personName: person.firstName,
                                relationshipTip: ConversationScripts.getRelationshipTip(person.category)
                            )
                            .padding()
                            .background(Color.vcBgCard)
                            .cornerRadius(12)
                        }

                        // Outreach: show form or read-only depending on state
                        if isContacted && !isEditingOutreach {
                            // Already contacted — show read-only summary with edit button
                            if let action {
                                outreachSummarySection(action)
                            }
                        } else {
                            // Not yet contacted (or editing) — show the log form
                            outreachFormSection
                        }

                        // Delete contact
                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text("Delete Contact")
                            }
                            .font(.subheadline)
                            .foregroundStyle(Color.vcCoral)
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(Color.vcCoral.opacity(0.1))
                            .cornerRadius(10)
                        }
                        .padding(.top, 8)
                    }
                    .padding()
                }
            }
            .navigationTitle("Contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.vcPurpleLight)
                }
            }
            .sheet(isPresented: $showMatchConfirmation) {
                if let match = contacts.matchResult(for: person.id) {
                    MatchConfirmationView(matchResult: match)
                }
            }
            .alert("Delete Contact", isPresented: $showDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    isDeleting = true
                    Task {
                        await contacts.deleteContact(contactId: person.id)
                        isDeleting = false
                        dismiss()
                    }
                }
            } message: {
                Text("Are you sure you want to delete \(person.fullName)? This cannot be undone.")
            }
            .onAppear {
                // Pre-fill form if editing an existing outreach
                if let action = contacts.actionItem(for: person.id), action.contacted {
                    selectedMethod = action.outreachMethod
                    selectedOutcome = action.contactOutcome
                    notes = action.notes ?? ""
                    volunteerInterest = action.volunteerInterest
                    surveyResponses = action.surveyResponses ?? [:]
                    if let dateStr = action.followUpDate {
                        followUpDate = ISO8601DateFormatter().date(from: dateStr)
                    }
                }
            }
        }
    }

    // MARK: - Info Section

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Contact Info")
                    .font(.headline)
                    .foregroundStyle(.white)

                Spacer()

                Button {
                    editFirstName = person.firstName
                    editLastName = person.lastName
                    editPhone = person.phone ?? ""
                    editAddress = person.address ?? ""
                    editCity = person.city ?? ""
                    editZip = person.zip ?? ""
                    isEditingInfo = true
                } label: {
                    Label("Edit", systemImage: "pencil")
                        .font(.caption)
                        .foregroundStyle(Color.vcPurpleLight)
                }
            }

            if let phone = person.phone, !phone.isEmpty {
                HStack {
                    Label(phone, systemImage: "phone.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.vcSlate)
                    Spacer()
                    Button {
                        let match = contacts.matchResult(for: person.id)
                        SMSTemplates.openSMS(
                            phone: phone,
                            contactFirstName: person.firstName,
                            volunteerName: auth.user?.name ?? "",
                            segment: match?.segment,
                            electionDate: auth.campaignConfig?.electionDate
                        )
                        selectedMethod = .text
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

            if let address = person.address, !address.isEmpty {
                Label(address, systemImage: "mappin")
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
            }

            if let city = person.city {
                Text("\(city)\(person.zip.map { ", \($0)" } ?? "")")
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
                    .padding(.leading, 24)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.vcBgCard)
        .cornerRadius(12)
    }

    // MARK: - Edit Info Section

    private var editInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Edit Contact Info")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
            }

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("First Name")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                    TextField("First", text: $editFirstName)
                        .textFieldStyle(.plain)
                        .padding(8)
                        .background(Color.vcBg)
                        .cornerRadius(6)
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Last Name")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                    TextField("Last", text: $editLastName)
                        .textFieldStyle(.plain)
                        .padding(8)
                        .background(Color.vcBg)
                        .cornerRadius(6)
                        .foregroundStyle(.white)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Phone")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
                TextField("Phone number", text: $editPhone)
                    .textFieldStyle(.plain)
                    .keyboardType(.phonePad)
                    .padding(8)
                    .background(Color.vcBg)
                    .cornerRadius(6)
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Address")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
                TextField("Street address", text: $editAddress)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.vcBg)
                    .cornerRadius(6)
                    .foregroundStyle(.white)
            }

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("City")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                    TextField("City", text: $editCity)
                        .textFieldStyle(.plain)
                        .padding(8)
                        .background(Color.vcBg)
                        .cornerRadius(6)
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("ZIP")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                    TextField("ZIP", text: $editZip)
                        .textFieldStyle(.plain)
                        .keyboardType(.numberPad)
                        .padding(8)
                        .background(Color.vcBg)
                        .cornerRadius(6)
                        .foregroundStyle(.white)
                        .frame(width: 100)
                }
            }

            HStack(spacing: 10) {
                Button {
                    contacts.updatePerson(
                        contactId: person.id,
                        firstName: editFirstName.trimmingCharacters(in: .whitespaces),
                        lastName: editLastName.trimmingCharacters(in: .whitespaces),
                        phone: editPhone.isEmpty ? nil : editPhone.trimmingCharacters(in: .whitespaces),
                        address: editAddress.isEmpty ? nil : editAddress.trimmingCharacters(in: .whitespaces),
                        city: editCity.isEmpty ? nil : editCity.trimmingCharacters(in: .whitespaces),
                        zip: editZip.isEmpty ? nil : editZip.trimmingCharacters(in: .whitespaces)
                    )
                    isEditingInfo = false
                } label: {
                    Text("Save")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Color.vcTeal)
                        .foregroundStyle(.white)
                        .cornerRadius(8)
                }

                Button {
                    isEditingInfo = false
                } label: {
                    Text("Cancel")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Color.vcBg)
                        .foregroundStyle(Color.vcSlate)
                        .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(Color.vcBgCard)
        .cornerRadius(12)
    }

    // MARK: - Voter Section

    private func voterSection(_ voter: SafeVoterRecord) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Voter Record")
                    .font(.headline)
                    .foregroundStyle(.white)

                Spacer()

                Text(voter.partyAffiliation)
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.partyColor(for: voter.partyAffiliation).opacity(0.2))
                    .foregroundStyle(Color.partyColor(for: voter.partyAffiliation))
                    .cornerRadius(6)
            }

            Label(voter.residentialAddress, systemImage: "house")
                .font(.caption)
                .foregroundStyle(Color.vcSlate)

            Text("\(voter.city), \(voter.state) \(voter.zip)")
                .font(.caption)
                .foregroundStyle(Color.vcSlate)
                .padding(.leading, 24)

            if let year = voter.birthYear {
                Label("Born \(year)", systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
            }

            // Vote history
            Text("Vote History")
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .padding(.top, 4)

            ForEach(voter.voteHistory, id: \.election) { entry in
                HStack {
                    Image(systemName: entry.voted ? "checkmark.circle.fill" : "xmark.circle")
                        .foregroundStyle(entry.voted ? Color.vcTeal : Color.vcSlate.opacity(0.5))
                        .font(.caption)

                    Text(entry.election)
                        .font(.caption)
                        .foregroundStyle(entry.voted ? .white : Color.vcSlate)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.vcBgCard)
        .cornerRadius(12)
    }

    // MARK: - Outreach Summary (read-only)

    private func outreachSummarySection(_ action: ActionPlanItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Outreach")
                    .font(.headline)
                    .foregroundStyle(.white)

                Spacer()

                Button {
                    isEditingOutreach = true
                } label: {
                    Label("Edit", systemImage: "pencil")
                        .font(.caption)
                        .foregroundStyle(Color.vcPurpleLight)
                }
            }

            if let method = action.outreachMethod {
                Label("Method: \(method.displayName)", systemImage: method.icon)
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
            }

            if let outcome = action.contactOutcome {
                Label("Outcome: \(outcome.displayName)", systemImage: outcome.icon)
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
            }

            if let notes = action.notes, !notes.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Notes")
                        .font(.caption.bold())
                        .foregroundStyle(Color.vcSlate)
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                }
                .padding(.top, 4)
            }

            if let interest = action.volunteerInterest {
                Label("Volunteer Interest: \(interest.displayName)", systemImage: "hand.raised.fill")
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
            }

            if let responses = action.surveyResponses, !responses.isEmpty,
               let questions = auth.campaignConfig?.surveyQuestions {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Survey Responses")
                        .font(.caption.bold())
                        .foregroundStyle(Color.vcSlate)
                        .padding(.top, 4)
                    ForEach(questions.filter { responses[$0.id] != nil && !(responses[$0.id]?.isEmpty ?? true) }) { q in
                        Label("\(q.label): \(responses[q.id] ?? "")", systemImage: "list.clipboard")
                            .font(.subheadline)
                            .foregroundStyle(Color.vcSlate)
                    }
                }
            }

            if let dateStr = action.followUpDate, !dateStr.isEmpty {
                Label("Follow-up: \(formattedFollowUp(dateStr))", systemImage: "calendar.badge.clock")
                    .font(.subheadline)
                    .foregroundStyle(Color.vcGold)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.vcBgCard)
        .cornerRadius(12)
    }

    // MARK: - Outreach Form (editable)

    private var outreachFormSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Log Outreach")
                .font(.headline)
                .foregroundStyle(.white)

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

            // Save button
            Button {
                isSaving = true
                Task {
                    let responsesToSave = surveyResponses.isEmpty ? nil : surveyResponses
                    let followUpStr: String? = followUpDate.map { ISO8601DateFormatter().string(from: $0) }
                    await contacts.updateAction(
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
                    isEditingOutreach = false
                }
            } label: {
                HStack {
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                    }
                    Text(isEditingOutreach ? "Update" : "Save")
                }
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(Color.vcTeal)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(isSaving)

            // Cancel button (only when editing existing)
            if isEditingOutreach {
                Button {
                    isEditingOutreach = false
                } label: {
                    Text("Cancel")
                        .font(.subheadline)
                        .foregroundStyle(Color.vcSlate)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding()
        .background(Color.vcBgCard)
        .cornerRadius(12)
    }

    // MARK: - Helpers

    private func formattedFollowUp(_ dateStr: String) -> String {
        if let date = ISO8601DateFormatter().date(from: dateStr) {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            return formatter.string(from: date)
        }
        return dateStr
    }
}
