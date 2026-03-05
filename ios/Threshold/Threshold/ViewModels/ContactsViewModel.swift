import Foundation

@Observable
final class ContactsViewModel {
    // MARK: - State

    var personEntries: [PersonEntry] = []
    var matchResults: [MatchResult] = []
    var actionPlanState: [ActionPlanItem] = []
    var isLoading = false
    var error: String?
    var matchingResult: MatchingFeedback?

    enum MatchingFeedback {
        case success(matched: Int, total: Int)
        case noUnmatched
        case missingState
        case error(String)
    }

    // MARK: - Computed

    var segmentedResults: SegmentedResults {
        SegmentedResults(from: matchResults)
    }

    var totalContacted: Int {
        actionPlanState.filter(\.contacted).count
    }

    var totalSupporters: Int {
        actionPlanState.filter { $0.contactOutcome == .supporter }.count
    }

    var hasUnmatchedContacts: Bool {
        matchResults.contains { $0.status == .pending || $0.status == .unmatched || $0.status == .ambiguous }
    }

    // MARK: - Private

    private let contactRepo = ContactRepository()
    private let matchRepo = MatchRepository()

    // MARK: - Load Contacts

    func loadContacts() async {
        isLoading = true
        error = nil

        do {
            let response = try await contactRepo.fetchContacts()
            personEntries = response.personEntries
            matchResults = response.matchResults
            actionPlanState = response.actionPlanState
            print("[Contacts] Loaded \(response.personEntries.count) people, \(response.matchResults.count) matches, \(response.actionPlanState.count) action items")
        } catch {
            self.error = error.localizedDescription
            print("[Contacts] Load failed: \(error)")
        }

        isLoading = false
    }

    // MARK: - Add Contact

    @discardableResult
    func addContact(
        firstName: String,
        lastName: String,
        phone: String? = nil,
        address: String? = nil,
        city: String? = nil,
        zip: String? = nil,
        age: Int? = nil,
        gender: String? = nil,
        category: RelationshipCategory,
        contactOutcome: String? = nil,
        volunteerInterest: String? = nil
    ) async -> String? {
        let body = CreateContactBody(
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            address: address,
            city: city,
            zip: zip,
            age: age,
            ageRange: nil,
            gender: gender,
            category: category.rawValue,
            contactOutcome: contactOutcome,
            volunteerInterest: volunteerInterest
        )

        do {
            let newContact = try await contactRepo.createContact(body)
            personEntries.append(newContact)
            return newContact.id
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    // MARK: - Update Action

    func updateAction(
        contactId: String,
        contacted: Bool? = nil,
        outreachMethod: OutreachMethod? = nil,
        contactOutcome: ContactOutcome? = nil,
        notes: String? = nil,
        volunteerInterest: VolunteerInterest? = nil,
        surveyResponses: [String: String]? = nil,
        followUpDate: String? = nil
    ) async {
        let body = UpdateActionBody(
            contacted: contacted,
            outreachMethod: outreachMethod?.rawValue,
            contactOutcome: contactOutcome?.rawValue,
            notes: notes,
            volunteerInterest: volunteerInterest?.rawValue,
            surveyResponses: surveyResponses,
            followUpDate: followUpDate
        )

        // Optimistic update
        if let index = actionPlanState.firstIndex(where: { $0.id == contactId }) {
            if let contacted { actionPlanState[index].contacted = contacted }
            if let outreachMethod { actionPlanState[index].outreachMethod = outreachMethod }
            if let contactOutcome { actionPlanState[index].contactOutcome = contactOutcome }
            if let notes { actionPlanState[index].notes = notes }
            if let volunteerInterest { actionPlanState[index].volunteerInterest = volunteerInterest }
            if let surveyResponses { actionPlanState[index].surveyResponses = surveyResponses }
            if let followUpDate { actionPlanState[index].followUpDate = followUpDate }
        }

        do {
            try await contactRepo.updateAction(contactId: contactId, action: body)
        } catch {
            self.error = error.localizedDescription
            // Reload on failure to revert optimistic update
            await loadContacts()
        }
    }

    // MARK: - Delete Contact

    func deleteContact(contactId: String) async {
        // Optimistic update
        personEntries.removeAll { $0.id == contactId }
        matchResults.removeAll { $0.id == contactId }
        actionPlanState.removeAll { $0.id == contactId }

        do {
            try await contactRepo.deleteContact(contactId: contactId)
        } catch {
            self.error = error.localizedDescription
            await loadContacts()
        }
    }

    // MARK: - Update Person (local only)

    func updatePerson(
        contactId: String,
        firstName: String,
        lastName: String,
        phone: String?,
        address: String?,
        city: String?,
        zip: String?
    ) {
        if let index = personEntries.firstIndex(where: { $0.id == contactId }) {
            personEntries[index].firstName = firstName
            personEntries[index].lastName = lastName
            personEntries[index].phone = phone
            personEntries[index].address = address
            personEntries[index].city = city
            personEntries[index].zip = zip
        }
    }

    // MARK: - Matching

    func runMatching(state: String) async {
        let trimmedState = state.trimmingCharacters(in: .whitespaces).uppercased()
        guard trimmedState.count == 2 else {
            matchingResult = .missingState
            return
        }

        let unmatchedPeople = personEntries.filter { person in
            !matchResults.contains { $0.personEntry.id == person.id && $0.status == .confirmed }
        }

        guard !unmatchedPeople.isEmpty else {
            matchingResult = .noUnmatched
            return
        }

        isLoading = true
        error = nil
        matchingResult = nil

        do {
            let response = try await matchRepo.runMatching(people: unmatchedPeople, state: trimmedState)

            let matchedCount = response.results.filter { $0.status == .confirmed || $0.status == .ambiguous }.count

            // Merge results
            for result in response.results {
                if let index = matchResults.firstIndex(where: { $0.id == result.id }) {
                    matchResults[index] = result
                } else {
                    matchResults.append(result)
                }
            }

            matchingResult = .success(matched: matchedCount, total: unmatchedPeople.count)
        } catch {
            self.error = error.localizedDescription
            matchingResult = .error(error.localizedDescription)
        }

        isLoading = false
    }

    // MARK: - Confirm / Reject Match

    func confirmMatch(personId: String, selectedIndex: Int) async {
        // Optimistic update
        if let idx = matchResults.firstIndex(where: { $0.id == personId }) {
            matchResults[idx].status = .confirmed
            matchResults[idx].userConfirmed = true
            if selectedIndex < matchResults[idx].candidates.count {
                let candidate = matchResults[idx].candidates[selectedIndex]
                matchResults[idx].bestMatch = candidate.voterRecord
                matchResults[idx].voteScore = candidate.score
            }
        }

        do {
            try await contactRepo.confirmMatch(contactId: personId, status: "confirmed", selectedIndex: selectedIndex)
        } catch {
            self.error = error.localizedDescription
            await loadContacts()
        }
    }

    func rejectMatch(personId: String) async {
        if let idx = matchResults.firstIndex(where: { $0.id == personId }) {
            matchResults[idx].status = .unmatched
        }

        do {
            try await contactRepo.confirmMatch(contactId: personId, status: "unmatched", selectedIndex: nil)
        } catch {
            self.error = error.localizedDescription
            await loadContacts()
        }
    }

    // MARK: - Action Plan Helpers

    func actionItem(for personId: String) -> ActionPlanItem? {
        actionPlanState.first { $0.id == personId }
    }

    func matchResult(for personId: String) -> MatchResult? {
        matchResults.first { $0.id == personId }
    }
}
