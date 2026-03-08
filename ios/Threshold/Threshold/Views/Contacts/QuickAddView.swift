import SwiftUI

struct QuickAddView: View {
    @Binding var isPresented: Bool
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var phone = ""
    @State private var selectedCategory: RelationshipCategory = .household
    @State private var isSaving = false
    @State private var savedCount = 0
    @State private var showPhoneBookPicker = false
    @State private var showSuccess = false
    @FocusState private var focusedField: Field?

    private enum Field { case firstName, lastName, phone }

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                ScrollView {
                    VStack(spacing: 20) {
                        // Category picker
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Category")
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(RelationshipCategory.allCases, id: \.self) { category in
                                        Button {
                                            selectedCategory = category
                                            HapticManager.selection()
                                        } label: {
                                            HStack(spacing: 4) {
                                                Image(systemName: category.icon)
                                                    .font(.caption2)
                                                Text(category.displayName)
                                                    .font(.caption)
                                                    .fontWeight(selectedCategory == category ? .bold : .regular)
                                            }
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(selectedCategory == category ? Color.vcPurple : Color.vcBgCard)
                                            .foregroundStyle(selectedCategory == category ? .white : Color.vcSlate)
                                            .cornerRadius(16)
                                        }
                                    }
                                }
                            }
                        }

                        // Name fields
                        VStack(spacing: 12) {
                            TextField("First Name", text: $firstName)
                                .textFieldStyle(.plain)
                                .padding(12)
                                .background(Color.vcBgCard)
                                .cornerRadius(8)
                                .foregroundStyle(.white)
                                .focused($focusedField, equals: .firstName)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .lastName }

                            TextField("Last Name", text: $lastName)
                                .textFieldStyle(.plain)
                                .padding(12)
                                .background(Color.vcBgCard)
                                .cornerRadius(8)
                                .foregroundStyle(.white)
                                .focused($focusedField, equals: .lastName)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .phone }

                            TextField("Phone (optional)", text: $phone)
                                .textFieldStyle(.plain)
                                .keyboardType(.phonePad)
                                .padding(12)
                                .background(Color.vcBgCard)
                                .cornerRadius(8)
                                .foregroundStyle(.white)
                                .focused($focusedField, equals: .phone)
                        }

                        // Import from contacts
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

                        // Action buttons
                        VStack(spacing: 10) {
                            Button {
                                Task { await saveContact(andClose: false) }
                            } label: {
                                HStack {
                                    if isSaving && !showSuccess {
                                        ProgressView()
                                            .progressViewStyle(.circular)
                                            .tint(.white)
                                            .scaleEffect(0.8)
                                    } else if showSuccess {
                                        Image(systemName: "checkmark.circle.fill")
                                    } else {
                                        Image(systemName: "plus.circle")
                                    }
                                    Text(showSuccess ? "Saved!" : "Save & Add Another")
                                }
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(showSuccess ? Color.vcTeal : Color.vcPurple)
                                .foregroundStyle(.white)
                                .cornerRadius(10)
                            }
                            .disabled(isSaving || !canSave)

                            Button {
                                Task { await saveContact(andClose: true) }
                            } label: {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                    Text("Save & Done")
                                }
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.vcTeal)
                                .foregroundStyle(.white)
                                .cornerRadius(10)
                            }
                            .disabled(isSaving || !canSave)
                        }

                        // Saved count
                        if savedCount > 0 {
                            Text("\(savedCount) \(savedCount == 1 ? "person" : "people") added")
                                .font(.caption)
                                .foregroundStyle(Color.vcTeal)
                                .padding(.top, 4)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Quick Add")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(savedCount > 0 ? "Done" : "Cancel") {
                        if savedCount > 0 {
                            triggerMatching()
                        }
                        isPresented = false
                    }
                    .foregroundStyle(Color.vcSlate)
                }
            }
            .sheet(isPresented: $showPhoneBookPicker) {
                PhoneBookPickerView(isPresented: $showPhoneBookPicker) { selected in
                    if let contact = selected.first {
                        firstName = contact.firstName
                        lastName = contact.lastName
                        phone = contact.phone ?? ""
                    }
                }
            }
            .onAppear {
                focusedField = .firstName
            }
        }
    }

    // MARK: - Helpers

    private var canSave: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty ||
        !lastName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func saveContact(andClose: Bool) async {
        guard canSave else { return }
        isSaving = true

        await contacts.addContact(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.trimmingCharacters(in: .whitespaces),
            phone: phone.trimmingCharacters(in: .whitespaces).isEmpty ? nil : phone.trimmingCharacters(in: .whitespaces),
            category: selectedCategory
        )

        savedCount += 1
        HapticManager.notification(.success)

        if andClose {
            triggerMatching()
            isSaving = false
            isPresented = false
        } else {
            // Show success flash, then clear form
            showSuccess = true
            firstName = ""
            lastName = ""
            phone = ""
            // Keep selectedCategory the same
            isSaving = false

            try? await Task.sleep(for: .seconds(0.8))
            showSuccess = false
            focusedField = .firstName
        }
    }

    private func triggerMatching() {
        Task {
            if let state = auth.campaignConfig?.state {
                await contacts.runMatching(state: state)
            }
        }
    }
}
