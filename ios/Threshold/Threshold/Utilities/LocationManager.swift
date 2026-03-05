import CoreLocation

@Observable
final class LocationManager: NSObject, CLLocationManagerDelegate {
    // MARK: - State

    var lastLocation: CLLocation?
    var reverseGeocodedAddress: String?
    var reverseGeocodedZip: String?
    var isLoading = false
    var error: String?
    var authorizationStatus: CLAuthorizationStatus

    // MARK: - Private

    private let manager = CLLocationManager()
    private let geocoder = CLGeocoder()
    private var locationContinuation: CheckedContinuation<CLLocation, Error>?

    // MARK: - Init

    override init() {
        self.authorizationStatus = CLLocationManager().authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    // MARK: - Public

    /// Request a one-shot location fix. Triggers permission prompt if needed.
    func requestLocation() {
        isLoading = true
        error = nil
        reverseGeocodedAddress = nil
        reverseGeocodedZip = nil

        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
            // Will continue in didChangeAuthorization
            return
        }

        guard manager.authorizationStatus == .authorizedWhenInUse ||
              manager.authorizationStatus == .authorizedAlways else {
            error = "Location access denied. Enable it in Settings."
            isLoading = false
            return
        }

        manager.requestLocation()
    }

    /// Async wrapper: request location + reverse geocode, returning (address, zip).
    func fetchCurrentAddress() async -> (address: String?, zip: String?) {
        isLoading = true
        error = nil

        do {
            let location = try await withCheckedThrowingContinuation { continuation in
                self.locationContinuation = continuation

                if manager.authorizationStatus == .notDetermined {
                    manager.requestWhenInUseAuthorization()
                } else if manager.authorizationStatus == .authorizedWhenInUse ||
                          manager.authorizationStatus == .authorizedAlways {
                    manager.requestLocation()
                } else {
                    continuation.resume(throwing: LocationError.denied)
                    self.locationContinuation = nil
                }
            }

            lastLocation = location
            let placemark = try await reverseGeocode(location)
            isLoading = false
            return (address: placemark.address, zip: placemark.zip)
        } catch LocationError.denied {
            error = "Location access denied. Enable it in Settings."
            isLoading = false
            return (nil, nil)
        } catch {
            self.error = error.localizedDescription
            isLoading = false
            return (nil, nil)
        }
    }

    // MARK: - Reverse Geocoding

    private func reverseGeocode(_ location: CLLocation) async throws -> (address: String?, zip: String?) {
        let placemarks = try await geocoder.reverseGeocodeLocation(location)
        guard let placemark = placemarks.first else {
            return (nil, nil)
        }

        let zip = placemark.postalCode
        reverseGeocodedZip = zip

        // Build a street address string
        var parts: [String] = []
        if let number = placemark.subThoroughfare { parts.append(number) }
        if let street = placemark.thoroughfare { parts.append(street) }
        if let city = placemark.locality { parts.append(city) }
        if let state = placemark.administrativeArea { parts.append(state) }
        if let zip { parts.append(zip) }

        let address = parts.isEmpty ? nil : parts.joined(separator: " ")
        reverseGeocodedAddress = address

        return (address: address, zip: zip)
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        lastLocation = location

        if let continuation = locationContinuation {
            continuation.resume(returning: location)
            locationContinuation = nil
        } else {
            // Non-async path: reverse geocode and store results
            Task {
                _ = try? await reverseGeocode(location)
                isLoading = false
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        self.error = error.localizedDescription
        isLoading = false

        if let continuation = locationContinuation {
            continuation.resume(throwing: error)
            locationContinuation = nil
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus

        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            // If we were waiting for permission, now request the location
            if isLoading {
                manager.requestLocation()
            }
        case .denied, .restricted:
            error = "Location access denied. Enable it in Settings."
            isLoading = false
            if let continuation = locationContinuation {
                continuation.resume(throwing: LocationError.denied)
                locationContinuation = nil
            }
        default:
            break
        }
    }

    // MARK: - Error

    enum LocationError: LocalizedError {
        case denied

        var errorDescription: String? {
            switch self {
            case .denied: return "Location access denied"
            }
        }
    }
}
