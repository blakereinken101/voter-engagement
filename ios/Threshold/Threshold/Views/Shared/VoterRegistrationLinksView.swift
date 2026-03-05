import SwiftUI

struct VoterRegistrationLinksView: View {
    let stateAbbr: String?

    @State private var isExpanded = false
    @State private var safariURL: URL?

    private static let stateNames: [String: String] = [
        "NC": "North Carolina",
        "CA": "California",
        "TX": "Texas",
        "FL": "Florida",
        "NY": "New York",
        "PA": "Pennsylvania",
        "OH": "Ohio",
        "GA": "Georgia",
        "MI": "Michigan",
        "AZ": "Arizona",
    ]

    private static let stateRegistrationUrls: [String: String] = [
        "NC": "https://www.ncsbe.gov/registering/how-register",
        "CA": "https://registertovote.ca.gov/",
        "TX": "https://www.votetexas.gov/register-to-vote/",
        "FL": "https://registertovoteflorida.gov/",
        "NY": "https://dmv.ny.gov/more-info/electronic-voter-registration-application",
        "PA": "https://www.vote.pa.gov/Register-to-Vote/",
        "OH": "https://www.ohiosos.gov/elections/voters/register/",
        "GA": "https://mvp.sos.ga.gov/s/",
        "MI": "https://mvic.sos.state.mi.us/RegisterVoter",
        "AZ": "https://azsos.gov/elections/voting-election/register-vote",
    ]

    private static let checkRegistrationURL = "https://www.vote.org/am-i-registered-to-vote/"

    private var stateName: String {
        guard let abbr = stateAbbr else { return "your state" }
        return Self.stateNames[abbr] ?? abbr
    }

    private var registrationURL: URL {
        if let abbr = stateAbbr, let urlStr = Self.stateRegistrationUrls[abbr], let url = URL(string: urlStr) {
            return url
        }
        if let abbr = stateAbbr, let name = Self.stateNames[abbr] {
            let slug = name.lowercased().replacingOccurrences(of: " ", with: "-")
            return URL(string: "https://www.vote.org/register-to-vote/\(slug)/")!
        }
        return URL(string: "https://www.vote.org/register-to-vote/")!
    }

    private var checkURL: URL {
        URL(string: Self.checkRegistrationURL)!
    }

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Help your contacts in \(stateName) get registered and verify their status.")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)

                HStack(spacing: 10) {
                    Button {
                        safariURL = registrationURL
                    } label: {
                        HStack(spacing: 4) {
                            Text("Register to Vote")
                                .font(.caption.bold())
                            Image(systemName: "arrow.up.right.square")
                                .font(.caption2)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Color.vcTeal)
                        .foregroundStyle(.white)
                        .cornerRadius(8)
                    }

                    Button {
                        safariURL = checkURL
                    } label: {
                        HStack(spacing: 4) {
                            Text("Check Status")
                                .font(.caption.bold())
                            Image(systemName: "arrow.up.right.square")
                                .font(.caption2)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Color.vcBg)
                        .foregroundStyle(Color.vcSlate)
                        .cornerRadius(8)
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundStyle(Color.vcPurpleLight)
                Text("Voter Registration")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .tint(Color.vcPurpleLight)
        .padding()
        .glassCard()
        .sheet(item: $safariURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
        }
    }
}
