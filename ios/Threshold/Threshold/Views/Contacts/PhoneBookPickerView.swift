import SwiftUI

struct PhoneBookPickerView: View {
    @Binding var isPresented: Bool
    let onSelect: ([PhoneBookService.PhoneBookContact]) -> Void

    @State private var phoneBookService = PhoneBookService()
    @State private var searchText = ""
    @State private var selectedIds: Set<String> = []

    private var displayedContacts: [PhoneBookService.PhoneBookContact] {
        phoneBookService.search(searchText)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.vcBg.ignoresSafeArea()

                if !phoneBookService.isAuthorized {
                    // Permission request
                    VStack(spacing: 16) {
                        Image(systemName: "person.crop.rectangle.stack")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.vcPurple)

                        Text("Access Your Contacts")
                            .font(.title3.bold())
                            .foregroundStyle(.white)

                        Text("Import people from your phone's contact list to quickly add them")
                            .font(.subheadline)
                            .foregroundStyle(Color.vcSlate)
                            .multilineTextAlignment(.center)

                        Button {
                            Task { await phoneBookService.requestAccess() }
                        } label: {
                            Text("Allow Access")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color.vcPurple)
                                .foregroundStyle(.white)
                                .cornerRadius(10)
                        }
                        .padding(.horizontal, 40)
                    }
                    .padding()
                } else {
                    VStack(spacing: 0) {
                        // Selected count
                        if !selectedIds.isEmpty {
                            HStack {
                                Text("\(selectedIds.count) selected")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(Color.vcPurple)

                                Spacer()

                                Button("Clear") {
                                    selectedIds.removeAll()
                                }
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 8)
                        }

                        List(displayedContacts) { contact in
                            HStack(spacing: 12) {
                                Image(systemName: selectedIds.contains(contact.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selectedIds.contains(contact.id) ? Color.vcPurple : Color.vcSlate)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(contact.fullName)
                                        .font(.subheadline)
                                        .foregroundStyle(.white)

                                    if let phone = contact.phone {
                                        Text(phone)
                                            .font(.caption)
                                            .foregroundStyle(Color.vcSlate)
                                    }
                                }
                            }
                            .listRowBackground(Color.vcBg)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if selectedIds.contains(contact.id) {
                                    selectedIds.remove(contact.id)
                                } else {
                                    selectedIds.insert(contact.id)
                                }
                            }
                        }
                        .listStyle(.plain)
                        .searchable(text: $searchText, prompt: "Search contacts")
                    }
                }
            }
            .navigationTitle("Phone Contacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .foregroundStyle(Color.vcSlate)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add (\(selectedIds.count))") {
                        let selected = phoneBookService.contacts.filter { selectedIds.contains($0.id) }
                        onSelect(selected)
                        isPresented = false
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.vcPurple)
                    .disabled(selectedIds.isEmpty)
                }
            }
        }
    }
}
