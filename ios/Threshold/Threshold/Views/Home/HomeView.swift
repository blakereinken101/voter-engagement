import SwiftUI

struct HomeView: View {
    @Binding var selectedTab: Int
    @Environment(AuthViewModel.self) private var auth
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(ChatViewModel.self) private var chat
    @State private var showWizard = false
    @State private var showPhoneBookPicker = false
    @State private var showCampaignPicker = false

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                ScrollView {
                    VStack(spacing: 24) {
                        // Welcome header
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Welcome back,")
                                .font(.title3)
                                .foregroundStyle(Color.vcSlate)

                            GradientText(auth.user?.name ?? "Volunteer", font: .largeTitle.bold())

                            // Campaign name - always visible
                            if let campaignName = auth.campaignConfig?.name ?? auth.activeMembership?.campaignName {
                                if auth.memberships.count > 1 {
                                    // Tappable to switch
                                    Button {
                                        showCampaignPicker = true
                                    } label: {
                                        HStack(spacing: 6) {
                                            Text(campaignName)
                                                .font(.subheadline.weight(.medium))
                                            Image(systemName: "chevron.down")
                                                .font(.caption.weight(.semibold))
                                        }
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(Color.vcPurple.opacity(0.2))
                                        .foregroundStyle(Color.white.opacity(0.9))
                                        .cornerRadius(8)
                                    }
                                } else {
                                    // Just show name, no switcher
                                    Text(campaignName)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Color.white.opacity(0.9))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                        .padding(.top, 8)

                        if contacts.personEntries.isEmpty {
                            // Empty state
                            emptyState
                        } else {
                            // Stats cards
                            statsSection

                            // Outcome breakdown
                            outcomeSection

                            // Voter Registration
                            VoterRegistrationLinksView(stateAbbr: auth.campaignConfig?.state)
                                .padding(.horizontal)

                            // Quick actions
                            quickActions
                        }
                    }
                    .padding(.vertical)
                }
                .refreshable {
                    await contacts.loadContacts()
                }
            }
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Section {
                            if auth.memberships.count > 1 {
                                Button {
                                    showCampaignPicker = true
                                } label: {
                                    Label("Switch Campaign", systemImage: "arrow.triangle.2.circlepath")
                                }
                            }
                        }

                        Section {
                            Link(destination: URL(string: "https://thresholdvote.com/privacy")!) {
                                Label("Privacy Policy", systemImage: "lock.shield")
                            }
                            Link(destination: URL(string: "https://thresholdvote.com/terms")!) {
                                Label("Terms of Use", systemImage: "doc.text")
                            }
                        }

                        Section {
                            Button("Sign Out", role: .destructive) {
                                auth.signOut()
                            }
                        }

                        Section {
                            Text("v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"))")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                            .foregroundStyle(Color.vcSlate)
                    }
                }
            }
            .fullScreenCover(isPresented: $showWizard) {
                WizardView(isPresented: $showWizard)
            }
            .confirmationDialog("Switch Campaign", isPresented: $showCampaignPicker, titleVisibility: .visible) {
                ForEach(auth.memberships, id: \.campaignId) { membership in
                    Button(membership.campaignName ?? membership.campaignId) {
                        if membership.campaignId != auth.activeMembership?.campaignId {
                            auth.performCampaignSwitch(to: membership.campaignId)
                            chat.clearForCampaignSwitch()
                            Task {
                                await auth.reloadCampaignConfig()
                                async let contactsLoad: () = contacts.loadContacts()
                                async let chatLoad: () = chat.loadHistory()
                                _ = await (contactsLoad, chatLoad)
                            }
                        }
                    }
                }
            }
            .tint(.white)
            .sheet(isPresented: $showPhoneBookPicker) {
                PhoneBookPickerView(isPresented: $showPhoneBookPicker) { selected in
                    Task {
                        for contact in selected {
                            await contacts.addContact(
                                firstName: contact.firstName,
                                lastName: contact.lastName,
                                phone: contact.phone,
                                address: contact.address,
                                city: contact.city,
                                zip: contact.zip,
                                category: .whoDidWeMiss
                            )
                        }
                        await contacts.loadContacts()
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 24) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.system(size: 56))
                .foregroundStyle(Color.vcPurple)

            VStack(spacing: 8) {
                Text("Start Building Your List")
                    .font(.title3.bold())
                    .foregroundStyle(.white)

                Text("Add people you know and we'll match them to the voter file so you can track your outreach.")
                    .font(.subheadline)
                    .foregroundStyle(Color.vcSlate)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: 12) {
                // Manual Entry
                Button {
                    showWizard = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "person.badge.plus")
                            .font(.title3)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Manual Entry")
                                .font(.subheadline.bold())
                            Text("Type in names one by one")
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(Color.vcSlate)
                    }
                    .padding(14)
                    .background(Color.vcPurple.opacity(0.15))
                    .foregroundStyle(Color.vcPurpleLight)
                    .cornerRadius(10)
                }

                // Import from Contacts
                Button {
                    showPhoneBookPicker = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "person.crop.rectangle.stack")
                            .font(.title3)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Import from Contacts")
                                .font(.subheadline.bold())
                            Text("Add people from your phone's contact list")
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(Color.vcSlate)
                    }
                    .padding(14)
                    .background(Color.vcTeal.opacity(0.15))
                    .foregroundStyle(Color.vcTeal)
                    .cornerRadius(10)
                }

                // Sync Rolodex
                Button {
                    Task {
                        await contacts.runMatching(state: auth.campaignConfig?.state ?? "")
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.title3)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Sync Rolodex")
                                .font(.subheadline.bold())
                            Text("Match your contacts to the voter file")
                                .font(.caption)
                                .foregroundStyle(Color.vcSlate)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(Color.vcSlate)
                    }
                    .padding(14)
                    .background(Color.vcGold.opacity(0.15))
                    .foregroundStyle(Color.vcGold)
                    .cornerRadius(10)
                }
            }
        }
        .padding(24)
    }

    // MARK: - Your Outreach Section (matches web app)

    private var statsSection: some View {
        let total = contacts.personEntries.count
        let contacted = contacts.totalContacted
        let pct = total > 0 ? Double(contacted) / Double(total) : 0

        return VStack(spacing: 16) {
            // Hero stats
            HStack(spacing: 0) {
                VStack(spacing: 4) {
                    Text("\(total)")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(.white)
                    Text("People Rolodexed")
                        .font(.caption)
                        .foregroundStyle(Color.white.opacity(0.9))
                }
                .frame(maxWidth: .infinity)

                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 1, height: 50)

                VStack(spacing: 4) {
                    Text("\(contacted)")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(Color.vcGold)
                    Text("Conversations")
                        .font(.caption)
                        .foregroundStyle(Color.white.opacity(0.9))
                }
                .frame(maxWidth: .infinity)
            }

            // Progress bar
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Reached")
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)
                    Spacer()
                    Text("\(Int(pct * 100))%")
                        .font(.caption.bold())
                        .foregroundStyle(Color.vcGold)
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.1))
                            .frame(height: 6)
                        Capsule()
                            .fill(Color.vcGold)
                            .frame(width: geo.size.width * pct, height: 6)
                    }
                }
                .frame(height: 6)
            }
        }
        .padding()
        .glassCard()
        .padding(.horizontal)
    }

    // MARK: - Outcome Section

    private var outcomeSection: some View {
        let supporters = contacts.actionPlanState.filter { $0.contactOutcome == .supporter }.count
        let undecided = contacts.actionPlanState.filter { $0.contactOutcome == .undecided }.count
        let opposed = contacts.actionPlanState.filter { $0.contactOutcome == .opposed }.count
        let leftMessage = contacts.actionPlanState.filter { $0.contactOutcome == .leftMessage }.count
        let noAnswer = contacts.actionPlanState.filter { $0.contactOutcome == .noAnswer }.count
        let total = supporters + undecided + opposed + leftMessage + noAnswer

        return VStack(alignment: .leading, spacing: 12) {
            Text("Outreach Results")
                .font(.headline)
                .foregroundStyle(.white)

            if total > 0 {
                HStack(spacing: 12) {
                    OutcomeBadge(label: "Supporters", count: supporters, color: .vcTeal)
                    OutcomeBadge(label: "Undecided", count: undecided, color: .vcGold)
                    OutcomeBadge(label: "Opposed", count: opposed, color: .vcCoral)
                }

                if leftMessage + noAnswer > 0 {
                    HStack(spacing: 12) {
                        OutcomeBadge(label: "Left Message", count: leftMessage, color: .vcSlate)
                        OutcomeBadge(label: "No Answer", count: noAnswer, color: .vcSlate)
                    }
                }
            } else {
                Text("Start logging conversations to see your results here")
                    .font(.caption)
                    .foregroundStyle(Color.vcSlate)
            }
        }
        .padding()
        .glassCard()
        .padding(.horizontal)
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        VStack(spacing: 12) {
            Button {
                showWizard = true
            } label: {
                HStack {
                    Image(systemName: "plus.circle")
                    Text("Manual Entry")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .padding(14)
                .background(Color.vcPurple.opacity(0.15))
                .foregroundStyle(Color.vcPurpleLight)
                .cornerRadius(10)
            }

            Button {
                showPhoneBookPicker = true
            } label: {
                HStack {
                    Image(systemName: "person.crop.rectangle.stack")
                    Text("Import from Contacts")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .padding(14)
                .background(Color.vcTeal.opacity(0.15))
                .foregroundStyle(Color.vcTeal)
                .cornerRadius(10)
            }

            Button {
                Task {
                    await contacts.runMatching(state: auth.campaignConfig?.state ?? "")
                }
            } label: {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Sync Rolodex")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .padding(14)
                .background(Color.vcGold.opacity(0.15))
                .foregroundStyle(Color.vcGold)
                .cornerRadius(10)
            }
        }
        .padding(.horizontal)
    }
}

// MARK: - Outcome Badge

struct OutcomeBadge: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.headline.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.vcSlate)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

