import SwiftUI

struct MainTabView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @State private var selectedTab = 0

    @State private var showScanSheet = false

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(selectedTab: $selectedTab)
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            PeopleView()
                .tabItem {
                    Label("People", systemImage: "person.2.fill")
                }
                .tag(1)

            // Camera tab — opens scan sheet instead of navigating
            Color.clear
                .tabItem {
                    Label("Scan", systemImage: "camera.fill")
                }
                .tag(3)

            CoachView()
                .tabItem {
                    Label("Coach", systemImage: "sparkles")
                }
                .tag(2)
        }
        .tint(Color.vcPurple)
        .onChange(of: selectedTab) { oldValue, newValue in
            if newValue == 3 {
                // Don't actually navigate to the scan tab — present the sheet
                selectedTab = oldValue
                showScanSheet = true
            }
        }
        .fullScreenCover(isPresented: $showScanSheet) {
            ScanSheetView()
        }
        .task {
            await contacts.loadContacts()
        }
    }
}

// MARK: - People View (Tab 2)

struct PeopleView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @State private var viewMode: PeopleViewMode = .list
    @State private var showWizard = false

    enum PeopleViewMode: String, CaseIterable {
        case list = "List"
        case map = "Map"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                VStack(spacing: 0) {
                    // Segmented control
                    Picker("View", selection: $viewMode) {
                        ForEach(PeopleViewMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.top, 8)

                    switch viewMode {
                    case .list:
                        ContactListView()
                    case .map:
                        NearbyView()
                    }
                }
            }
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if contacts.hasUnmatchedContacts {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            Task {
                                await contacts.runMatching(state: auth.campaignConfig?.state ?? "")
                            }
                        } label: {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundStyle(Color.vcTeal)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showWizard = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.vcPurple)
                    }
                }
            }
            .fullScreenCover(isPresented: $showWizard) {
                WizardView(isPresented: $showWizard)
            }
        }
    }
}

// MARK: - Coach View (Tab 3)

struct CoachView: View {
    var body: some View {
        NavigationStack {
            ChatView()
                .navigationTitle("AI Coach")
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}
