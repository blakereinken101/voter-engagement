import SwiftUI

struct WizardView: View {
    @Binding var isPresented: Bool
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @State private var currentPage = 0
    @State private var entries: [RelationshipCategory: [WizardEntry]] = [:]
    @State private var isFinishing = false

    private let categories = RelationshipCategory.allCases

    struct WizardEntry: Identifiable {
        let id = UUID().uuidString
        var firstName = ""
        var lastName = ""
        var phone = ""
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.vcBg.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Progress
                    ProgressView(value: Double(currentPage + 1), total: Double(categories.count))
                        .tint(Color.vcPurple)
                        .padding(.horizontal)
                        .padding(.top, 8)

                    Text("\(currentPage + 1) of \(categories.count)")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                        .padding(.top, 4)

                    // Category page
                    TabView(selection: $currentPage) {
                        ForEach(Array(categories.enumerated()), id: \.element) { index, category in
                            WizardCategoryPage(
                                category: category,
                                entries: binding(for: category)
                            )
                            .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(.easeInOut, value: currentPage)

                    // Navigation
                    HStack {
                        if currentPage > 0 {
                            Button {
                                withAnimation { currentPage -= 1 }
                            } label: {
                                HStack {
                                    Image(systemName: "chevron.left")
                                    Text("Back")
                                }
                                .foregroundStyle(Color.vcSlate)
                            }
                        }

                        Spacer()

                        if currentPage < categories.count - 1 {
                            Button {
                                withAnimation { currentPage += 1 }
                            } label: {
                                HStack {
                                    Text("Next")
                                    Image(systemName: "chevron.right")
                                }
                                .fontWeight(.semibold)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(Color.vcPurple)
                                .foregroundStyle(.white)
                                .cornerRadius(10)
                            }
                        } else {
                            Button {
                                Task { await finish() }
                            } label: {
                                HStack {
                                    if isFinishing {
                                        ProgressView()
                                            .progressViewStyle(.circular)
                                            .tint(.white)
                                            .scaleEffect(0.8)
                                    } else {
                                        Image(systemName: "checkmark.circle.fill")
                                    }
                                    Text("Done")
                                }
                                .fontWeight(.semibold)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(Color.vcTeal)
                                .foregroundStyle(.white)
                                .cornerRadius(10)
                            }
                            .disabled(isFinishing)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Add People")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .foregroundStyle(Color.vcSlate)
                }
            }
        }
    }

    // MARK: - Helpers

    private func binding(for category: RelationshipCategory) -> Binding<[WizardEntry]> {
        Binding(
            get: { entries[category] ?? [WizardEntry()] },
            set: { entries[category] = $0 }
        )
    }

    private func finish() async {
        isFinishing = true

        // Add all non-empty entries as contacts
        for (category, categoryEntries) in entries {
            for entry in categoryEntries where !entry.firstName.isEmpty || !entry.lastName.isEmpty {
                await contacts.addContact(
                    firstName: entry.firstName,
                    lastName: entry.lastName,
                    phone: entry.phone.isEmpty ? nil : entry.phone,
                    category: category
                )
            }
        }

        // Trigger matching
        if let state = auth.campaignConfig?.state {
            await contacts.runMatching(state: state)
        }

        isFinishing = false
        isPresented = false
    }
}

// MARK: - Category Page

struct WizardCategoryPage: View {
    let category: RelationshipCategory
    @Binding var entries: [WizardView.WizardEntry]
    @State private var showPhoneBookPicker = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Image(systemName: category.icon)
                        .font(.title)
                        .foregroundStyle(Color.vcPurple)

                    Text(category.question)
                        .font(.title3.bold())
                        .foregroundStyle(.white)

                    // Examples
                    HStack(spacing: 8) {
                        ForEach(category.examples, id: \.self) { example in
                            Text(example)
                                .font(.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.vcPurple.opacity(0.15))
                                .foregroundStyle(Color.vcPurpleLight)
                                .cornerRadius(8)
                        }
                    }
                }

                // Entry rows
                ForEach(entries.indices, id: \.self) { index in
                    HStack(spacing: 8) {
                        TextField("First", text: $entries[index].firstName)
                            .textFieldStyle(.plain)
                            .padding(10)
                            .background(Color.vcBgCard)
                            .cornerRadius(8)
                            .foregroundStyle(.white)

                        TextField("Last", text: $entries[index].lastName)
                            .textFieldStyle(.plain)
                            .padding(10)
                            .background(Color.vcBgCard)
                            .cornerRadius(8)
                            .foregroundStyle(.white)

                        TextField("Phone", text: $entries[index].phone)
                            .textFieldStyle(.plain)
                            .keyboardType(.phonePad)
                            .padding(10)
                            .background(Color.vcBgCard)
                            .cornerRadius(8)
                            .foregroundStyle(.white)
                            .frame(width: 100)
                    }
                }

                // Add row button
                Button {
                    entries.append(WizardView.WizardEntry())
                } label: {
                    HStack {
                        Image(systemName: "plus.circle")
                        Text("Add another person")
                    }
                    .font(.subheadline)
                    .foregroundStyle(Color.vcPurpleLight)
                }
                .padding(.top, 4)

                // Import from contacts button
                Button {
                    showPhoneBookPicker = true
                } label: {
                    HStack {
                        Image(systemName: "person.crop.rectangle.stack")
                        Text("Import from Contacts")
                    }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color.vcBgCard)
                    .foregroundStyle(Color.vcPurpleLight)
                    .cornerRadius(10)
                }
                .padding(.top, 8)
            }
            .padding()
        }
        .sheet(isPresented: $showPhoneBookPicker) {
            PhoneBookPickerView(isPresented: $showPhoneBookPicker) { selectedContacts in
                // Convert phone book contacts to wizard entries and append
                let newEntries = selectedContacts.map { contact in
                    var entry = WizardView.WizardEntry()
                    entry.firstName = contact.firstName
                    entry.lastName = contact.lastName
                    entry.phone = contact.phone ?? ""
                    return entry
                }

                // Remove any empty placeholder entries first
                entries.removeAll { $0.firstName.isEmpty && $0.lastName.isEmpty && $0.phone.isEmpty }

                // Deduplicate: skip contacts already in the list
                for newEntry in newEntries {
                    let isDuplicate = entries.contains { existing in
                        existing.firstName.lowercased() == newEntry.firstName.lowercased() &&
                        existing.lastName.lowercased() == newEntry.lastName.lowercased()
                    }
                    if !isDuplicate {
                        entries.append(newEntry)
                    }
                }

                // Always keep at least one empty row
                if entries.isEmpty {
                    entries.append(WizardView.WizardEntry())
                }
            }
        }
    }
}
