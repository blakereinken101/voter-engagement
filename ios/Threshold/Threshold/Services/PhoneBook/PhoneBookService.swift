import Foundation
import Contacts

@Observable
final class PhoneBookService {
    var isAuthorized = false
    var contacts: [PhoneBookContact] = []
    var error: String?

    private let store = CNContactStore()

    init() {
        // Check existing authorization so we don't show "Allow Access" every time
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .authorized {
            isAuthorized = true
            fetchContacts()
        }
    }

    struct PhoneBookContact: Identifiable {
        let id: String
        let firstName: String
        let lastName: String
        let phone: String?
        let address: String?
        let city: String?
        let zip: String?

        var fullName: String {
            "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        }
    }

    // MARK: - Request Access

    func requestAccess() async {
        do {
            let granted = try await store.requestAccess(for: .contacts)
            isAuthorized = granted
            if granted {
                fetchContacts()
            }
        } catch {
            self.error = "Unable to access contacts: \(error.localizedDescription)"
        }
    }

    // MARK: - Fetch Contacts

    func fetchContacts() {
        let keys: [CNKeyDescriptor] = [
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactPostalAddressesKey as CNKeyDescriptor,
            CNContactIdentifierKey as CNKeyDescriptor,
        ]

        let request = CNContactFetchRequest(keysToFetch: keys)
        request.sortOrder = .familyName

        var results: [PhoneBookContact] = []

        do {
            try store.enumerateContacts(with: request) { cnContact, _ in
                let phone = cnContact.phoneNumbers.first?.value.stringValue
                let address = cnContact.postalAddresses.first?.value

                let contact = PhoneBookContact(
                    id: cnContact.identifier,
                    firstName: cnContact.givenName,
                    lastName: cnContact.familyName,
                    phone: phone,
                    address: address?.street,
                    city: address?.city,
                    zip: address?.postalCode
                )

                // Skip contacts with no name
                if !contact.firstName.isEmpty || !contact.lastName.isEmpty {
                    results.append(contact)
                }
            }

            contacts = results
        } catch {
            self.error = "Failed to load contacts: \(error.localizedDescription)"
        }
    }

    // MARK: - Search

    func search(_ query: String) -> [PhoneBookContact] {
        guard !query.isEmpty else { return contacts }
        return contacts.filter {
            $0.fullName.localizedCaseInsensitiveContains(query)
        }
    }
}
