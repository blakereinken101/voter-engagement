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

    private let nearbyRepo = NearbyRepository()

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
                } else {
                    // Map
                    NearbyMapView(
                        voters: voters,
                        centerCoordinate: centerCoordinate,
                        userLocation: userLocation
                    )
                    .frame(height: 250)
                    .cornerRadius(12)
                    .padding(.horizontal)

                    // Voter list
                    List(voters.indices, id: \.self) { index in
                        let voter = voters[index]
                        NearbyVoterRow(voter: voter)
                            .listRowBackground(Color.vcBg)
                            .listRowSeparatorTint(Color.vcGray.opacity(0.3))
                    }
                    .listStyle(.plain)
                }

                if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(Color.vcCoral)
                        .padding()
                }
            }
        }
    }

    // MARK: - Use Current Location

    private func useCurrentLocation() async {
        error = nil
        let (address, zip) = await locationManager.fetchCurrentAddress()

        // Store user's location for the map marker
        if let loc = locationManager.lastLocation {
            userLocation = loc.coordinate
        }

        if let locationError = locationManager.error {
            error = locationError
            return
        }

        // Use the reverse-geocoded result to search
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

        let campaignState = auth.campaignConfig?.state ?? "PA"

        // Determine if input is a zip code or an address
        let isZip = query.range(of: #"^\d{5}$"#, options: .regularExpression) != nil

        do {
            let response: NearbyResponse
            if isZip {
                response = try await nearbyRepo.fetchNearby(zip: query, state: campaignState)
            } else {
                response = try await nearbyRepo.fetchNearby(address: query, state: campaignState)
            }

            voters = response.voters

            // Use center coordinates from backend response for the map
            if let lat = response.centerLat, let lng = response.centerLng {
                centerCoordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            } else if let firstVoter = response.voters.first(where: { $0.lat != nil && $0.lng != nil }),
                      let lat = firstVoter.lat, let lng = firstVoter.lng {
                // Fallback: center on first voter with coordinates
                centerCoordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            }

            if voters.isEmpty {
                self.error = "No voters found near that location"
            }
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
                    Annotation(voter.fullName, coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)) {
                        Circle()
                            .fill(Color.partyColor(for: voter.partyAffiliation))
                            .frame(width: 12, height: 12)
                            .overlay(
                                Circle()
                                    .stroke(.white.opacity(0.3), lineWidth: 1)
                            )
                    }
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
    }

    private var mapPosition: MapCameraPosition {
        // Prefer user location if available, otherwise use search center
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

// MARK: - Voter Row

struct NearbyVoterRow: View {
    let voter: SafeVoterRecord

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.partyColor(for: voter.partyAffiliation))
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(voter.fullName)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)

                Text(voter.residentialAddress)
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
            }

            Spacer()

            Text(voter.partyAffiliation)
                .font(.caption2.bold())
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.partyColor(for: voter.partyAffiliation).opacity(0.2))
                .foregroundStyle(Color.partyColor(for: voter.partyAffiliation))
                .cornerRadius(4)
        }
        .padding(.vertical, 4)
    }
}
