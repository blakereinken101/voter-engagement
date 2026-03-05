import SwiftUI
import PhotosUI

struct ScanSheetView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var showCamera = false
    @State private var showPhotoPicker = false
    @State private var selectedImage: UIImage?
    @State private var isProcessing = false
    @State private var scannedContacts: [ScannedContact] = []
    @State private var error: String?
    @State private var showReview = false
    @State private var selectedPhotoItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                if showReview {
                    ScanReviewView(
                        contacts: $scannedContacts,
                        isAdmin: auth.isAdmin,
                        onImport: importContacts,
                        onAdminImport: adminImportContacts,
                        onDismiss: { showReview = false }
                    )
                } else {
                    scanHomeContent
                }
            }
            .navigationTitle("Scan Sheet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.vcPurpleLight)
                }
            }
        }
    }

    private var scanHomeContent: some View {
        VStack(spacing: 24) {
            Spacer()

            // Icon
            Image(systemName: "doc.text.viewfinder")
                .font(.system(size: 72))
                .foregroundStyle(Color.vcPurple)
                .shadow(color: Color.vcPurple.opacity(0.4), radius: 16)

            Text("Scan a Contact Sheet")
                .font(.title3.bold())
                .foregroundStyle(.white)

            Text("Take a photo or upload an image of a handwritten contact sheet and AI will extract the names")
                .font(.subheadline)
                .foregroundStyle(Color.vcSlate)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if isProcessing {
                VStack(spacing: 12) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Color.vcPurple)
                        .scaleEffect(1.5)
                    Text("AI is reading your sheet...")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                }
                .padding(.top, 20)
            } else {
                VStack(spacing: 12) {
                    // Camera button
                    Button {
                        showCamera = true
                    } label: {
                        HStack {
                            Image(systemName: "camera.fill")
                            Text("Take Photo")
                        }
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(14)
                        .background(Color.vcPurple)
                        .foregroundStyle(.white)
                        .cornerRadius(10)
                        .shadow(color: Color.vcPurple.opacity(0.3), radius: 12)
                    }

                    // Upload button
                    PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                        HStack {
                            Image(systemName: "photo.on.rectangle")
                            Text("Upload Image")
                        }
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(14)
                        .glassCard()
                        .foregroundStyle(Color.vcPurpleLight)
                    }
                }
                .padding(.horizontal, 32)
            }

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.vcCoral)
                    .padding(.horizontal)
            }

            Spacer()
        }
        .sheet(isPresented: $showCamera) {
            CameraView(image: $selectedImage)
        }
        .onChange(of: selectedImage) { _, newImage in
            if let newImage {
                Task { await processImage(newImage) }
            }
        }
        .onChange(of: selectedPhotoItem) { _, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    await processImage(uiImage)
                }
            }
        }
    }

    private func processImage(_ image: UIImage) async {
        isProcessing = true
        error = nil

        // Compress image
        guard let imageData = image.jpegData(compressionQuality: 0.6) else {
            error = "Failed to process image"
            isProcessing = false
            return
        }

        let base64 = imageData.base64EncodedString()

        do {
            // Build survey questions from campaign config for AI extraction
            let surveyQs: [ScanSurveyQuestion]? = auth.campaignConfig?.surveyQuestions?.map { q in
                ScanSurveyQuestion(id: q.id, label: q.label, type: q.type, options: q.options)
            }

            let endpoint = APIEndpoint(
                path: "/api/ai/scan-sheet",
                method: .post,
                body: ScanSheetBody(image: base64, mimeType: "image/jpeg", mode: "contact", surveyQuestions: surveyQs)
            )

            let response: ScanSheetResponse = try await APIClient.shared.request(endpoint)
            scannedContacts = response.contacts.enumerated().map { idx, c in
                ScannedContact(
                    id: UUID().uuidString,
                    firstName: c.firstName,
                    lastName: c.lastName,
                    phone: c.phone,
                    city: c.city,
                    address: c.address,
                    zip: c.zip,
                    notes: c.notes,
                    category: c.category ?? "who-did-we-miss",
                    contactOutcome: c.contactOutcome,
                    volunteerInterest: c.volunteerInterest,
                    surveyResponses: c.surveyResponses,
                    included: true
                )
            }
            showReview = true
        } catch {
            self.error = error.localizedDescription
        }

        isProcessing = false
    }

    private func importContacts() async {
        let toImport = scannedContacts.filter(\.included)

        for contact in toImport {
            let contactId = await contacts.addContact(
                firstName: contact.firstName,
                lastName: contact.lastName,
                phone: contact.phone,
                address: contact.address,
                city: contact.city,
                zip: contact.zip,
                category: RelationshipCategory(rawValue: contact.category) ?? .whoDidWeMiss,
                contactOutcome: contact.contactOutcome,
                volunteerInterest: contact.volunteerInterest
            )

            // Save survey responses via updateAction if present
            if let contactId, let responses = contact.surveyResponses, !responses.isEmpty {
                await contacts.updateAction(contactId: contactId, surveyResponses: responses)
            }
        }

        await contacts.loadContacts()
        dismiss()
    }

    private func adminImportContacts(targetUserId: String) async {
        let toImport = scannedContacts.filter(\.included)
        let adminContacts = toImport.map { c in
            AdminContactInput(
                firstName: c.firstName.trimmingCharacters(in: .whitespaces),
                lastName: c.lastName.trimmingCharacters(in: .whitespaces),
                phone: c.phone?.trimmingCharacters(in: .whitespaces),
                city: c.city?.trimmingCharacters(in: .whitespaces),
                address: c.address?.trimmingCharacters(in: .whitespaces),
                zip: c.zip?.trimmingCharacters(in: .whitespaces),
                category: c.category,
                contactOutcome: c.contactOutcome,
                volunteerInterest: c.volunteerInterest
            )
        }

        let body = AdminCreateContactsBody(targetUserId: targetUserId, contacts: adminContacts)
        do {
            try await APIClient.shared.requestVoid(AdminEndpoints.createContacts(body))
        } catch {
            // Error handling — the review view shows an alert
        }

        await contacts.loadContacts()
        dismiss()
    }
}

// MARK: - Models

struct ScanSheetBody: Encodable {
    let image: String
    let mimeType: String
    let mode: String
    let surveyQuestions: [ScanSurveyQuestion]?
}

struct ScanSurveyQuestion: Encodable {
    let id: String
    let label: String
    let type: String
    let options: [String]?
}

struct ScanSheetResponse: Codable {
    let contacts: [ScannedContactResponse]
}

struct ScannedContactResponse: Codable {
    let firstName: String
    let lastName: String
    let phone: String?
    let city: String?
    let address: String?
    let zip: String?
    let notes: String?
    let category: String?
    let contactOutcome: String?
    let volunteerInterest: String?
    let surveyResponses: [String: String]?
}

struct ScannedContact: Identifiable {
    let id: String
    var firstName: String
    var lastName: String
    var phone: String?
    var city: String?
    var address: String?
    var zip: String?
    var notes: String?
    var category: String
    var contactOutcome: String?
    var volunteerInterest: String?
    var surveyResponses: [String: String]?
    var included: Bool
}

// MARK: - Scan Review View

struct ScanReviewView: View {
    @Binding var contacts: [ScannedContact]
    let isAdmin: Bool
    let onImport: () async -> Void
    let onAdminImport: (String) async -> Void
    let onDismiss: () -> Void

    @State private var isImporting = false
    @State private var volunteers: [VolunteerInfo] = []
    @State private var selectedVolunteerId: String?
    @State private var isLoadingVolunteers = false
    @State private var importSuccess = false
    @State private var assignedVolunteerName: String?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button("Back") { onDismiss() }
                    .foregroundStyle(Color.vcPurpleLight)
                Spacer()
                Text("\(contacts.filter(\.included).count) of \(contacts.count) selected")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
            }
            .padding()

            // Admin: Data Entry Mode
            if isAdmin {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: "person.badge.key.fill")
                            .font(.caption)
                        Text("Data Entry Mode")
                            .font(.caption.bold())
                            .textCase(.uppercase)
                    }
                    .foregroundStyle(Color.vcGold)

                    if isLoadingVolunteers {
                        HStack {
                            ProgressView().tint(Color.vcPurpleLight)
                            Text("Loading volunteers...")
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                        }
                    } else {
                        Menu {
                            Button("Myself (default)") {
                                selectedVolunteerId = nil
                                assignedVolunteerName = nil
                            }
                            ForEach(volunteers) { vol in
                                Button("\(vol.name) (\(vol.email))") {
                                    selectedVolunteerId = vol.id
                                    assignedVolunteerName = vol.name
                                }
                            }
                        } label: {
                            HStack {
                                Text(assignedVolunteerName ?? "Assign to volunteer...")
                                    .font(.subheadline)
                                    .foregroundStyle(assignedVolunteerName != nil ? .white : Color.vcSlate)
                                Spacer()
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.caption2)
                                    .foregroundStyle(Color.vcSlate)
                            }
                            .padding(10)
                            .background(Color.vcBg)
                            .cornerRadius(8)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
                .padding(.vertical, 8)
                .background(Color.vcGold.opacity(0.08))
            }

            // Contact list
            List {
                ForEach($contacts) { $contact in
                    VStack(alignment: .leading, spacing: 8) {
                        // Top row: checkbox + name
                        HStack {
                            Button {
                                contact.included.toggle()
                            } label: {
                                Image(systemName: contact.included ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(contact.included ? Color.vcTeal : Color.vcSlate)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(contact.firstName) \(contact.lastName)")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(.white)

                                if let phone = contact.phone, !phone.isEmpty {
                                    Text(phone)
                                        .font(.caption)
                                        .foregroundStyle(Color.vcSlate)
                                }
                            }

                            Spacer()

                            // Category picker
                            Menu {
                                ForEach(RelationshipCategory.allCases) { cat in
                                    Button {
                                        contact.category = cat.rawValue
                                    } label: {
                                        Label(cat.displayName, systemImage: cat.icon)
                                    }
                                }
                            } label: {
                                HStack(spacing: 3) {
                                    Image(systemName: RelationshipCategory(rawValue: contact.category)?.icon ?? "questionmark.circle.fill")
                                        .font(.system(size: 9))
                                    Text(RelationshipCategory(rawValue: contact.category)?.displayName ?? "Category")
                                        .font(.system(size: 10, weight: .medium))
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.system(size: 7))
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.vcPurple.opacity(0.15))
                                .foregroundStyle(Color.vcPurpleLight)
                                .cornerRadius(6)
                            }
                        }

                        // Outcome chips (editable)
                        if contact.included {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(ContactOutcome.allCases, id: \.self) { outcome in
                                        Button {
                                            if contact.contactOutcome == outcome.rawValue {
                                                contact.contactOutcome = nil
                                            } else {
                                                contact.contactOutcome = outcome.rawValue
                                            }
                                        } label: {
                                            HStack(spacing: 3) {
                                                Image(systemName: outcome.icon)
                                                    .font(.system(size: 9))
                                                Text(outcome.displayName)
                                                    .font(.system(size: 10, weight: .medium))
                                            }
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(
                                                contact.contactOutcome == outcome.rawValue
                                                    ? scanOutcomeColor(outcome).opacity(0.3)
                                                    : Color.white.opacity(0.05)
                                            )
                                            .foregroundStyle(
                                                contact.contactOutcome == outcome.rawValue
                                                    ? scanOutcomeColor(outcome)
                                                    : Color.vcSlate
                                            )
                                            .cornerRadius(6)
                                        }
                                    }
                                }
                            }
                        }

                        // Survey responses
                        if let responses = contact.surveyResponses, !responses.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 4) {
                                    ForEach(responses.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                                        HStack(spacing: 2) {
                                            Text(key)
                                                .font(.system(size: 8, weight: .medium))
                                                .foregroundStyle(Color.vcSlate)
                                            Text(value)
                                                .font(.system(size: 9, weight: .semibold))
                                                .foregroundStyle(Color.vcTeal)
                                        }
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 3)
                                        .background(Color.vcTeal.opacity(0.1))
                                        .cornerRadius(4)
                                    }
                                }
                            }
                        }

                        // Notes
                        if let notes = contact.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.caption2)
                                .foregroundStyle(Color.vcSlate)
                                .lineLimit(1)
                        }
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(Color.vcBgCard)
                }
            }
            .scrollContentBackground(.hidden)

            // Import button
            Button {
                isImporting = true
                Task {
                    if let targetId = selectedVolunteerId {
                        await onAdminImport(targetId)
                    } else {
                        await onImport()
                    }
                    isImporting = false
                }
            } label: {
                HStack {
                    if isImporting {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                    }
                    if let name = assignedVolunteerName {
                        Text("Assign \(contacts.filter(\.included).count) to \(name)")
                            .fontWeight(.semibold)
                    } else {
                        Text("Import \(contacts.filter(\.included).count) Contacts")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(Color.vcPurple)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(isImporting || contacts.filter(\.included).isEmpty)
            .padding()
        }
        .task {
            guard isAdmin else { return }
            isLoadingVolunteers = true
            do {
                let response: VolunteersResponse = try await APIClient.shared.request(AdminEndpoints.volunteers)
                volunteers = response.volunteers
            } catch {
                // Silently fail — admin can still import as themselves
            }
            isLoadingVolunteers = false
        }
    }

    private func scanOutcomeColor(_ outcome: ContactOutcome) -> Color {
        switch outcome {
        case .supporter: return .vcTeal
        case .undecided: return .vcGold
        case .opposed: return .vcCoral
        case .leftMessage, .noAnswer: return .vcSlate
        }
    }
}

// MARK: - Camera View

struct CameraView: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView

        init(_ parent: CameraView) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = info[.originalImage] as? UIImage
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
