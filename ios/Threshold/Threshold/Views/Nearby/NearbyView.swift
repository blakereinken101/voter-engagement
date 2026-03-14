import SwiftUI
import MapKit

struct NearbyView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(ContactsViewModel.self) private var contacts
    @State private var searchText = ""
    @State private var voters: [SafeVoterRecord] = []
    @State private var isLoading = false
    @State private var centerCoordinate: CLLocationCoordinate2D?
    @State private var userLocation: CLLocationCoordinate2D?
    @State private var error: String?
    @State private var locationManager = LocationManager()
    @State private var viewMode: ViewMode = .map
    @State private var selectedVoter: SafeVoterRecord?
    @State private var total: Int = 0
    @State private var hasMore: Bool = false
    @State private var offset: Int = 0
    @State private var searchInfo: String = ""
    @State private var lastSearchAddress: String?
    @State private var lastSearchZip: String?

    private let nearbyRepo = NearbyRepository()

    enum ViewMode: String, CaseIterable {
        case map = "Map"
        case list = "List"
    }

    // Names of already-added contacts for duplicate detection
    private var addedNames: Set<String> {
        Set(contacts.personEntries.map { "\($0.firstName.lowercased())-\($0.lastName.lowercased())" })
    }

    private func isAlreadyAdded(_ voter: SafeVoterRecord) -> Bool {
        addedNames.contains("\(voter.firstName.lowercased())-\(voter.lastName.lowercased())")
    }

    var body: some View {
        ZStack {
            Color.vcBg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Search bar + location button
                HStack(spacing: 8) {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(Color.vcSlate)

                        TextField("Address or zip code", text: $searchText)
                            .textFieldStyle(.plain)
                            .foregroundStyle(.white)
                            .onSubmit {
                                Task { await search() }
                            }

                        if isLoading || locationManager.isLoading {
                            ProgressView()
                                .tint(Color.vcPurple)
                        }
                    }
                    .padding(10)
                    .background(Color.vcBgCard)
                    .cornerRadius(10)

                    // Current location button
                    Button {
                        Task { await useCurrentLocation() }
                    } label: {
                        Image(systemName: locationManager.isLoading ? "location.fill" : "location")
                            .font(.title3)
                            .foregroundStyle(locationManager.isLoading ? Color.vcPurple : Color.vcTeal)
                            .frame(width: 44, height: 44)
                            .background(Color.vcBgCard)
                            .cornerRadius(10)
                    }
                    .disabled(locationManager.isLoading || isLoading)
                }
                .padding()

                if voters.isEmpty && !isLoading && !locationManager.isLoading {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "map")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.vcSlate)
                        Text("Search an address or tap")
                            .font(.subheadline)
                            .foregroundStyle(Color.vcSlate)
                        HStack(spacing: 4) {
                            Image(systemName: "location")
                                .font(.caption)
                            Text("to use your current location")
                                .font(.subheadline)
                        }
                        .foregroundStyle(Color.vcTeal)
                    }
                    Spacer()
                } else if !voters.isEmpty {
                    // Results header with view toggle
                    HStack {
                        if !searchInfo.isEmpty {
                            Text(searchInfo)
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                                .lineLimit(1)
                        }

                        Spacer()

                        // View toggle
                        Picker("View", selection: $viewMode) {
                            ForEach(ViewMode.allCases, id: \.self) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 140)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 8)

                    switch viewMode {
                    case .map:
                        // Map view with floating load more
                        ZStack(alignment: .bottom) {
                            NearbyMapView(
                                voters: voters,
                                centerCoordinate: centerCoordinate,
                                userLocation: userLocation,
                                selectedVoter: $selectedVoter,
                                isAlreadyAdded: isAlreadyAdded
                            )
                            .frame(maxHeight: .infinity)
                            .cornerRadius(12)

                            // Floating Load More button on map
                            if hasMore {
                                Button {
                                    Task { await loadMore() }
                                } label: {
                                    HStack(spacing: 6) {
                                        if isLoading {
                                            ProgressView()
                                                .tint(.white)
                                                .scaleEffect(0.8)
                                        }
                                        Text(isLoading ? "Loading..." : "Load Next 50")
                                            .font(.caption.bold())
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Color.vcPurple)
                                    .foregroundStyle(.white)
                                    .cornerRadius(20)
                                    .shadow(color: .black.opacity(0.4), radius: 4, y: 2)
                                }
                                .disabled(isLoading)
                                .padding(.bottom, 8)
                            }
                        }
                        .padding(.horizontal)

                        // Selected voter popup card (slides up from bottom)
                        if let voter = selectedVoter {
                            NearbyVoterPopup(
                                voter: voter,
                                isAdded: isAlreadyAdded(voter),
                                targetConfig: auth.campaignConfig?.aiContext?.targetUniverse,
                                onAdd: { addVoter(voter) },
                                onDismiss: { selectedVoter = nil },
                                onText: voter.phone != nil ? { sendTextToVoter(voter) } : nil,
                                onStarTap: !isAlreadyAdded(voter) ? { addVoter(voter) } : nil
                            )
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .padding(.horizontal)
                            .padding(.bottom, 4)
                        }

                        // Party legend
                        partyLegend
                            .padding(.horizontal)
                            .padding(.vertical, 4)

                    case .list:
                        // List view
                        List {
                            ForEach(voters) { voter in
                                NearbyVoterRow(
                                    voter: voter,
                                    isAdded: isAlreadyAdded(voter),
                                    targetConfig: auth.campaignConfig?.aiContext?.targetUniverse,
                                    onAdd: { addVoter(voter) },
                                    onText: voter.phone != nil ? { sendTextToVoter(voter) } : nil,
                                    onStarTap: !isAlreadyAdded(voter) ? { addVoter(voter) } : nil
                                )
                                .listRowBackground(Color.vcBg)
                                .listRowSeparatorTint(Color.vcGray.opacity(0.3))
                                // LEADING: Text action (swipe right)
                                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                    if let phone = voter.phone, !phone.isEmpty {
                                        Button {
                                            sendTextToVoter(voter)
                                        } label: {
                                            Label("Text", systemImage: "message.fill")
                                        }
                                        .tint(Color.vcTeal)
                                    }
                                }
                                // TRAILING: Outcome actions (swipe left)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button {
                                        markOutcome(voter, outcome: .opposed)
                                    } label: {
                                        Label("Opposed", systemImage: "hand.thumbsdown.fill")
                                    }
                                    .tint(Color.vcCoral)

                                    Button {
                                        markOutcome(voter, outcome: .undecided)
                                    } label: {
                                        Label("Undecided", systemImage: "person.fill.questionmark")
                                    }
                                    .tint(Color.vcGold)

                                    Button {
                                        markOutcome(voter, outcome: .supporter)
                                    } label: {
                                        Label("Supporter", systemImage: "hand.thumbsup.fill")
                                    }
                                    .tint(.green)

                                    if !isAlreadyAdded(voter) {
                                        Button {
                                            addVoter(voter)
                                        } label: {
                                            Label("Add", systemImage: "plus.circle.fill")
                                        }
                                        .tint(Color.vcPurple)
                                    }
                                }
                            }

                            // Load More button
                            if hasMore {
                                Button {
                                    Task { await loadMore() }
                                } label: {
                                    HStack {
                                        if isLoading {
                                            ProgressView().tint(Color.vcPurple)
                                        }
                                        Text(isLoading ? "Loading..." : "Load Next 50")
                                            .font(.subheadline.bold())
                                            .foregroundStyle(Color.vcPurpleLight)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(12)
                                }
                                .listRowBackground(Color.vcBg)
                                .disabled(isLoading)
                            }
                        }
                        .listStyle(.plain)
                    }
                }

                if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(Color.vcCoral)
                        .padding()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: selectedVoter?.fullName)
    }

    // MARK: - Party Legend

    private var partyLegend: some View {
        let parties = Set(voters.map(\.partyAffiliation)).sorted()
        return HStack(spacing: 12) {
            ForEach(parties, id: \.self) { party in
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.partyColor(for: party))
                        .frame(width: 8, height: 8)
                    Text(party)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.vcSlate)
                }
            }
        }
    }

    // MARK: - Add Voter

    private func addVoter(_ voter: SafeVoterRecord) {
        let currentYear = Calendar.current.component(.year, from: Date())
        let age = voter.birthYear.flatMap { Int($0) }.map { currentYear - $0 }

        Task {
            await contacts.addContact(
                firstName: voter.firstName,
                lastName: voter.lastName,
                phone: voter.phone,
                address: voter.residentialAddress,
                city: voter.city,
                zip: voter.zip,
                age: age,
                gender: voter.gender.isEmpty || voter.gender == "U" ? nil : voter.gender,
                category: .neighbors
            )
            HapticManager.notification(.success)
        }
    }

    // MARK: - Send Text to Voter

    private func sendTextToVoter(_ voter: SafeVoterRecord) {
        guard let phone = voter.phone, !phone.isEmpty else { return }

        let alreadyAdded = isAlreadyAdded(voter)
        let segment = VoterSegmentCalculator.determineSegment(
            voteScore: VoterSegmentCalculator.calculateVoteScore(voter: voter)
        )

        // Open SMS immediately so UI feels responsive
        SMSTemplates.openSMS(
            phone: phone,
            contactFirstName: voter.firstName,
            volunteerName: auth.user?.name ?? "",
            segment: segment,
            electionDate: auth.campaignConfig?.electionDate,
            customTemplate: auth.campaignConfig?.customSmsTemplate
        )

        Task {
            // Auto-add contact if not already added
            if !alreadyAdded {
                if let contactId = await contacts.addContact(
                    firstName: voter.firstName,
                    lastName: voter.lastName,
                    phone: voter.phone,
                    address: voter.residentialAddress,
                    city: voter.city,
                    zip: voter.zip,
                    age: voter.birthYear.flatMap { Int($0) }.map { Calendar.current.component(.year, from: Date()) - $0 },
                    gender: voter.gender.isEmpty || voter.gender == "U" ? nil : voter.gender,
                    category: .neighbors
                ) {
                    // Mark outreach as text
                    await contacts.updateAction(
                        contactId: contactId,
                        contacted: true,
                        outreachMethod: .text
                    )
                }
            } else {
                // Already added — just mark outreach
                if let person = contacts.personEntries.first(where: {
                    $0.firstName.lowercased() == voter.firstName.lowercased() &&
                    $0.lastName.lowercased() == voter.lastName.lowercased() &&
                    ($0.address ?? "").lowercased() == voter.residentialAddress.lowercased()
                }) {
                    await contacts.updateAction(
                        contactId: person.id,
                        contacted: true,
                        outreachMethod: .text
                    )
                }
            }
            await MainActor.run { HapticManager.notification(.success) }
        }
    }

    // MARK: - Mark Outcome

    private func markOutcome(_ voter: SafeVoterRecord, outcome: ContactOutcome) {
        let currentYear = Calendar.current.component(.year, from: Date())
        let age = voter.birthYear.flatMap { Int($0) }.map { currentYear - $0 }

        Task {
            var contactId: String?

            if isAlreadyAdded(voter) {
                contactId = contacts.personEntries.first(where: {
                    $0.firstName.lowercased() == voter.firstName.lowercased() &&
                    $0.lastName.lowercased() == voter.lastName.lowercased() &&
                    ($0.address ?? "").lowercased() == voter.residentialAddress.lowercased()
                })?.id
            } else {
                contactId = await contacts.addContact(
                    firstName: voter.firstName,
                    lastName: voter.lastName,
                    phone: voter.phone,
                    address: voter.residentialAddress,
                    city: voter.city,
                    zip: voter.zip,
                    age: age,
                    gender: voter.gender.isEmpty || voter.gender == "U" ? nil : voter.gender,
                    category: .neighbors
                )
            }

            if let contactId {
                let success = await contacts.updateAction(
                    contactId: contactId,
                    contacted: true,
                    contactOutcome: outcome
                )
                if success {
                    await MainActor.run { HapticManager.notification(.success) }
                }
            }
        }
    }

    // MARK: - Use Current Location

    private func useCurrentLocation() async {
        error = nil
        let (address, zip) = await locationManager.fetchCurrentAddress()

        if let loc = locationManager.lastLocation {
            userLocation = loc.coordinate
        }

        if let locationError = locationManager.error {
            error = locationError
            return
        }

        if let zip, !zip.isEmpty {
            searchText = zip
        } else if let address, !address.isEmpty {
            searchText = address
        } else {
            error = "Could not determine your location"
            return
        }

        await search()
    }

    // MARK: - Search

    private func search() async {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }
        isLoading = true
        error = nil
        voters = []
        offset = 0
        total = 0
        hasMore = false
        selectedVoter = nil

        let campaignState = auth.campaignConfig?.state ?? "PA"
        let isZip = query.range(of: #"^\d{5}$"#, options: .regularExpression) != nil

        do {
            let response: NearbyResponse
            if isZip {
                lastSearchAddress = nil
                lastSearchZip = query
                response = try await nearbyRepo.fetchNearby(zip: query, state: campaignState)
            } else {
                lastSearchAddress = query
                lastSearchZip = nil
                response = try await nearbyRepo.fetchNearby(address: query, state: campaignState)
            }

            voters = response.voters
            total = response.total ?? response.voters.count
            hasMore = response.hasMore ?? false

            if let lat = response.centerLat, let lng = response.centerLng {
                centerCoordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            } else if let first = response.voters.first(where: { $0.lat != nil && $0.lng != nil }),
                      let lat = first.lat, let lng = first.lng {
                centerCoordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            }

            searchInfo = response.address.map { "Near \"\($0)\"" } ?? response.zip.map { "Near zip \($0)" } ?? ""

            if voters.isEmpty {
                self.error = "No voters found near that location"
            }
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Load More

    private func loadMore() async {
        let nextOffset = offset + 50
        isLoading = true

        let campaignState = auth.campaignConfig?.state ?? "PA"

        do {
            let response: NearbyResponse
            if let address = lastSearchAddress {
                response = try await nearbyRepo.fetchNearby(address: address, state: campaignState, offset: nextOffset)
            } else if let zip = lastSearchZip {
                response = try await nearbyRepo.fetchNearby(zip: zip, state: campaignState, offset: nextOffset)
            } else {
                isLoading = false
                return
            }

            voters.append(contentsOf: response.voters)
            offset = nextOffset
            hasMore = response.hasMore ?? false
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Map View

struct NearbyMapView: View {
    let voters: [SafeVoterRecord]
    let centerCoordinate: CLLocationCoordinate2D?
    let userLocation: CLLocationCoordinate2D?
    @Binding var selectedVoter: SafeVoterRecord?
    let isAlreadyAdded: (SafeVoterRecord) -> Bool

    var body: some View {
        Map(initialPosition: mapPosition) {
            // User location marker
            if let userLoc = userLocation {
                Annotation("Your Location", coordinate: userLoc) {
                    ZStack {
                        Circle()
                            .fill(Color.blue.opacity(0.2))
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 14, height: 14)
                            .overlay(
                                Circle()
                                    .stroke(.white, lineWidth: 2)
                            )
                    }
                }
            }

            // Voter markers
            ForEach(voters.indices, id: \.self) { index in
                let voter = voters[index]
                if let lat = voter.lat, let lng = voter.lng {
                    let added = isAlreadyAdded(voter)
                    Annotation(voter.fullName, coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)) {
                        Button {
                            withAnimation(.spring(response: 0.3)) {
                                selectedVoter = voter
                            }
                        } label: {
                            Circle()
                                .fill(Color.partyColor(for: voter.partyAffiliation))
                                .opacity(added ? 0.25 : 0.8)
                                .frame(width: 14, height: 14)
                                .overlay(
                                    Circle()
                                        .stroke(.white.opacity(0.3), lineWidth: 1)
                                )
                        }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .colorScheme(.dark)
    }

    private var mapPosition: MapCameraPosition {
        if let userLoc = userLocation {
            return .region(MKCoordinateRegion(
                center: userLoc,
                span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
            ))
        }
        if let center = centerCoordinate {
            return .region(MKCoordinateRegion(
                center: center,
                span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
            ))
        }
        return .automatic
    }
}

// MARK: - Voter Popup Card (shown when tapping a map marker)

struct NearbyVoterPopup: View {
    let voter: SafeVoterRecord
    let isAdded: Bool
    let targetConfig: TargetUniverseConfig?
    let onAdd: () -> Void
    let onDismiss: () -> Void
    var onText: (() -> Void)? = nil
    var onStarTap: (() -> Void)? = nil

    private var voteScore: Double {
        VoterSegmentCalculator.calculateVoteScore(voter: voter)
    }

    private var segment: VoterSegment {
        VoterSegmentCalculator.determineSegment(voteScore: voteScore)
    }

    private var age: Int? {
        guard let year = voter.birthYear, let birthYear = Int(year) else { return nil }
        return Calendar.current.component(.year, from: Date()) - birthYear
    }

    var body: some View {
        VStack(spacing: 10) {
            // Header with dismiss
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(voter.fullName)
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                        if let age {
                            Text("(\(age))")
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                        }
                    }
                    Text("\(voter.residentialAddress), \(voter.city)")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                        .lineLimit(1)
                }
                Spacer()
                Button { onDismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.vcSlate)
                }
            }

            // Stats row
            HStack(spacing: 12) {
                // Party badge
                Text(voter.partyAffiliation)
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.partyColor(for: voter.partyAffiliation).opacity(0.2))
                    .foregroundStyle(Color.partyColor(for: voter.partyAffiliation))
                    .cornerRadius(4)

                // Vote score
                Text("\(Int(voteScore))% vote score")
                    .font(.caption.bold().monospacedDigit())
                    .foregroundStyle(segmentColor)

                // Segment badge
                SegmentBadge(segment: segment)

                Spacer()

                // Target star (tappable to add)
                if let targetConfig, targetConfig.hasAnyCriteria {
                    TargetStarView(
                        isTarget: VoterSegmentCalculator.isInTargetUniverse(voter: voter, config: targetConfig),
                        size: 14,
                        onTap: onStarTap
                    )
                }
            }

            // Action buttons
            if isAdded {
                HStack(spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                        Text("Already Added")
                            .font(.caption.bold())
                    }
                    .foregroundStyle(Color.vcTeal)
                    .frame(maxWidth: .infinity)
                    .padding(8)
                    .background(Color.vcTeal.opacity(0.1))
                    .cornerRadius(8)

                    if let onText {
                        Button(action: onText) {
                            HStack(spacing: 4) {
                                Image(systemName: "message.fill")
                                    .font(.caption)
                                Text("Text")
                                    .font(.caption.bold())
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Color.vcTeal)
                            .cornerRadius(8)
                        }
                    }
                }
            } else {
                HStack(spacing: 8) {
                    Button(action: onAdd) {
                        HStack(spacing: 4) {
                            Image(systemName: "plus.circle.fill")
                                .font(.caption)
                            Text("Add to Contacts")
                                .font(.caption.bold())
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Color.vcPurple)
                        .cornerRadius(8)
                    }

                    if let onText {
                        Button(action: onText) {
                            HStack(spacing: 4) {
                                Image(systemName: "message.fill")
                                    .font(.caption)
                                Text("Text")
                                    .font(.caption.bold())
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color.vcTeal)
                            .cornerRadius(8)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(Color.vcBgCard)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.3), radius: 8, y: -2)
    }

    private var segmentColor: Color {
        switch segment {
        case .superVoter: return .vcTeal
        case .sometimesVoter: return .vcGold
        case .rarelyVoter: return .vcCoral
        }
    }
}

// MARK: - Voter Row (List View)

struct NearbyVoterRow: View {
    let voter: SafeVoterRecord
    let isAdded: Bool
    let targetConfig: TargetUniverseConfig?
    let onAdd: () -> Void
    var onText: (() -> Void)? = nil
    var onStarTap: (() -> Void)? = nil

    private var voteScore: Double {
        VoterSegmentCalculator.calculateVoteScore(voter: voter)
    }

    private var segment: VoterSegment {
        VoterSegmentCalculator.determineSegment(voteScore: voteScore)
    }

    var body: some View {
        HStack(spacing: 12) {
            // Party color dot
            Circle()
                .fill(Color.partyColor(for: voter.partyAffiliation))
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(voter.fullName)
                        .font(.subheadline.bold())
                        .foregroundStyle(isAdded ? .white.opacity(0.4) : .white)

                    if let year = voter.birthYear, let birthYear = Int(year) {
                        let age = Calendar.current.component(.year, from: Date()) - birthYear
                        Text("(\(age))")
                            .font(.caption)
                            .foregroundStyle(Color.vcSlate)
                    }

                    // Target star (tappable to add)
                    if let targetConfig, targetConfig.hasAnyCriteria {
                        TargetStarView(
                            isTarget: VoterSegmentCalculator.isInTargetUniverse(voter: voter, config: targetConfig),
                            size: 10,
                            onTap: onStarTap
                        )
                    }
                }

                Text(voter.residentialAddress)
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
                    .lineLimit(1)
            }

            Spacer()

            // Vote score
            Text("\(Int(voteScore))%")
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(segmentColor)

            // Party badge
            Text(voter.partyAffiliation)
                .font(.caption2.bold())
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.partyColor(for: voter.partyAffiliation).opacity(0.2))
                .foregroundStyle(Color.partyColor(for: voter.partyAffiliation))
                .cornerRadius(4)

            // Text button (when phone available)
            if let onText {
                Button(action: onText) {
                    HStack(spacing: 4) {
                        Image(systemName: "message.fill")
                            .font(.caption)
                        Text("Text")
                            .font(.caption.bold())
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.vcTeal)
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }

            // Add button or status
            if isAdded {
                Text("Added")
                    .font(.caption2.bold())
                    .foregroundStyle(Color.vcTeal)
            } else {
                Button(action: onAdd) {
                    Text("+ Add")
                        .font(.caption2.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.vcPurple)
                        .foregroundStyle(.white)
                        .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
        .opacity(isAdded ? 0.5 : 1.0)
    }

    private var segmentColor: Color {
        switch segment {
        case .superVoter: return .vcTeal
        case .sometimesVoter: return .vcGold
        case .rarelyVoter: return .vcCoral
        }
    }
}
